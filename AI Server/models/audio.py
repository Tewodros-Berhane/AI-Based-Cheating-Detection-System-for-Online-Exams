import os
import io
import numpy as np
import tensorflow as tf  # type: ignore
import librosa

BASE = os.path.dirname(__file__)
MODEL_PATH = os.path.join(BASE, 'audio_classifier_4class.h5')
audio_model = tf.keras.models.load_model(MODEL_PATH, compile=False)

AUDIO_LABELS = ['background', 'normal', 'cheating']

def predict_audio(wav: np.ndarray, orig_sr: int, target_sr=16000):
    # resample …
    if orig_sr != target_sr:
        wav = librosa.resample(wav, orig_sr=orig_sr, target_sr=target_sr)
    # trim/pad to exactly 1 second …
    if len(wav) >= target_sr:
        wav = wav[:target_sr]
    else:
        wav = np.pad(wav, (0, target_sr - len(wav)))
    # STFT + model.predict …
    spec = np.abs(librosa.stft(wav, n_fft=256, hop_length=128))
    spec = spec.T[np.newaxis, ..., np.newaxis]
    probs = audio_model.predict(spec, verbose=0)[0]
    idx   = int(np.argmax(probs))
    return {
        'audio_idx':  idx,
        'audio':      AUDIO_LABELS[idx],
        'confidence': float(probs[idx])
    }