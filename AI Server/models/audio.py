import os
import io
import numpy as np
import tensorflow as tf  # type: ignore
import librosa
import logging

BASE = os.path.dirname(__file__)
MODEL_PATH = os.path.join(BASE, 'audio_classifier_4class.h5')
logger = logging.getLogger(__name__)
audio_model = None
audio_model_error = None

# Keep labels tolerant across 3-class and 4-class exported models.
AUDIO_LABELS = ['background', 'normal', 'suspicious', 'cheating']


def _load_audio_model():
    global audio_model, audio_model_error

    if audio_model is not None or audio_model_error is not None:
        return

    try:
        audio_model = tf.keras.models.load_model(MODEL_PATH, compile=False)
        logger.info('Loaded audio model from %s', MODEL_PATH)
    except Exception as error:
        audio_model_error = error
        logger.exception(
            'Failed to load audio model from %s. Falling back to lightweight audio heuristics.',
            MODEL_PATH
        )


def _fallback_predict_audio(wav: np.ndarray):
    # Basic fallback to keep AI server online even when model deserialization fails.
    # This preserves WebRTC/alert flow and emits conservative non-cheating outputs.
    amplitude = float(np.mean(np.abs(wav))) if wav.size else 0.0

    if amplitude < 0.005:
        label = 'background'
        confidence = 0.92
    elif amplitude > 0.08:
        label = 'suspicious'
        confidence = 0.62
    else:
        label = 'normal'
        confidence = 0.74

    return {
        'audio_idx': AUDIO_LABELS.index(label),
        'audio': label,
        'confidence': confidence
    }

def predict_audio(wav: np.ndarray, orig_sr: int, target_sr=16000):
    if orig_sr != target_sr:
        wav = librosa.resample(wav, orig_sr=orig_sr, target_sr=target_sr)
    if len(wav) >= target_sr:
        wav = wav[:target_sr]
    else:
        wav = np.pad(wav, (0, target_sr - len(wav)))

    _load_audio_model()
    if audio_model is None:
        return _fallback_predict_audio(wav)

    spec = np.abs(librosa.stft(wav, n_fft=256, hop_length=128))
    spec = spec.T[np.newaxis, ..., np.newaxis]

    try:
        probs = audio_model.predict(spec, verbose=0)[0]
    except Exception:
        logger.exception('Audio model inference failed. Switching to fallback classifier output.')
        return _fallback_predict_audio(wav)

    idx = int(np.argmax(probs))
    label = AUDIO_LABELS[idx] if idx < len(AUDIO_LABELS) else 'unknown'
    confidence = float(probs[idx]) if idx < len(probs) else 0.0
    return {
        'audio_idx': idx,
        'audio': label,
        'confidence': confidence
    }
