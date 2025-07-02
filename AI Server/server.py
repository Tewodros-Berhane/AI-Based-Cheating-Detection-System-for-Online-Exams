# server.py
import asyncio
import json
import io
import wave

from aiohttp import web
import numpy as np
import aiohttp_cors
from aiortc import RTCPeerConnection, RTCSessionDescription, MediaStreamTrack
from aiortc.exceptions import InvalidStateError
from aiortc.mediastreams import MediaStreamError

from Models import predict_head, predict_audio
from Models.audio import AUDIO_LABELS as AUDIO
from Models.Head_movement import GAZE_LABELS, LIP_LABELS

# ─── behaviour‐assignment logic ──────────────────────────────
suspicious_counts = {}
REPETITION_THRESHOLD = 500

def safe_send(dc, payload, label):
    """
    Send over a data‑channel only if it’s still open / connected.
    Silences InvalidStateError and ConnectionError coming from aiortc’s
    internal _transmit() task.
    """
    if dc.readyState != "open":
        print(f"[DATA] ✋ {label}: data‑channel not open, skipping send")
        return
    try:
        dc.send(payload)
    except (InvalidStateError, ConnectionError) as e:
        # log once, but don’t crash the task
        print(f"[DATA] ⚠️  send failed ({label}):", e)


def assign_behaviour(vision_res: dict, audio_res: dict) -> str:
    """
    vision_res: { head_idx, head, gaze_idx, gaze, lip_idx, lip }
    audio_res:  { audio_idx, audio, confidence? }
    """
    h_idx = vision_res.get("head_idx", -1)
    g_idx = vision_res.get("gaze_idx", -1)
    l_idx = vision_res.get("lip_idx",  -1)
    a_idx = audio_res.get("audio_idx", -1)

    audio_label = AUDIO[a_idx] if a_idx >= 0 and a_idx < len(AUDIO) else "unknown"
    lip_label   = LIP_LABELS[l_idx] if l_idx >= 0 and l_idx < len(LIP_LABELS) else "unknown"
    gaze_label  = GAZE_LABELS[g_idx] if g_idx >= 0 and g_idx < len(GAZE_LABELS) else "unknown"

    key = (h_idx, g_idx, l_idx, a_idx)
    print(f"[ASSIGN] inputs → head:{audio_label=}, lip:{lip_label=}, gaze:{gaze_label=}, audio:{audio_label=}")

    # 1) immediate cheating
    if audio_label == "cheating":
        return "cheating"

    # 2) base suspicious logic
    if lip_label == "Talking" and audio_label == "background":
        base = "suspicious"
    elif gaze_label == "Closed":
        base = "suspicious"
    elif gaze_label in ["Left","Up","Down","Right"] and lip_label == "No Movement" and audio_label == "background":
        base = "suspicious"
    elif gaze_label == "Center" and lip_label == "No Movement" and audio_label == "background" and h_idx == 3:
        base = "normal"
    else:
        base = "normal"

    # 3) escalation on repetition
    if base == "suspicious":
        suspicious_counts[key] = suspicious_counts.get(key, 0) + 1
        print(f"[ASSIGN] suspicion count for {key} = {suspicious_counts[key]}")
        if suspicious_counts[key] >= REPETITION_THRESHOLD:
            return "cheating"

    return base

pcs = set()

async def consume_video(track: MediaStreamTrack, dc, context):
    print("[VIDEO] ▶️ starting video consumer")
    while True:
        try:
            frame = await track.recv()
        except MediaStreamError:
            print("[VIDEO] 📹 video track ended")
            break

        print(f"[VIDEO] got frame pts={frame.pts}")
        # encode PNG
        # import numpy as np
        # arr = frame.to_ndarray(format="rgb24")
        # print(f"[DEBUG] raw frame stats — min:{arr.min()}, max:{arr.max()}, mean:{arr.mean():.1f}")
        img = frame.to_ndarray(format="rgb24")
        buf = io.BytesIO()
        from PIL import Image
        Image.fromarray(img).save(buf, format="PNG")
        png_bytes = buf.getvalue()

        try:
            vision_res = predict_head(png_bytes)
        except Exception as e:
            vision_res = {"error": str(e)}
        print(f"[VIDEO] vision_res = {vision_res}")

        context["vision"] = vision_res

        # if audio already ran at least once, compute behaviour
        if "audio" in context:
            audio_res = context["audio"]
            beh = assign_behaviour(vision_res, audio_res)
            print(f"[VIDEO] computed behaviour → {beh}")
            try:
                safe_send(
                            dc,
                            json.dumps({"behaviour": beh, "traineeId": context["traineeId"]}),
                            "VIDEO"
                        )

                print("[VIDEO] sent behaviour to client")
            except InvalidStateError:
                print("[VIDEO] 🚨 data-channel not ready, skipping send")

def int16_to_float32(arr: np.ndarray) -> np.ndarray:
    return arr.astype(np.float32) / 32768.0


async def consume_audio(track: MediaStreamTrack, dc, context):
    print("[AUDIO] ▶️ starting audio consumer")
        # float32 buffer of samples
    buf = np.empty((0,), dtype=np.float32)
    sr = None

    while True:
        try:
            frame = await track.recv()
        except MediaStreamError:
            print("[AUDIO] 🔊 audio track ended")
            break

        print(f"[AUDIO] got frame, samples={frame.samples}")
        arr = frame.to_ndarray()
        print(f"[AUDIO] raw arr shape = {arr.shape}, dtype={arr.dtype}")

        if arr.ndim > 1:
            arr = arr.mean(axis=0)
        # record sample rate once
        if sr is None:
            sr = frame.sample_rate
            print(f"[AUDIO] using sample_rate = {sr}")

        # convert int16 → float32 in -1..+1
        mono = int16_to_float32(arr)
        print(f"[AUDIO] mono.shape = {mono.shape}")


        # append to our float buffer
        buf = np.concatenate([buf, mono])
        print(f"[AUDIO] buf now has {len(buf)} samples; waiting for 16000 to batch.")

        if len(buf) >= 16000:
            print("[AUDIO] batching ~1.0s audio chunk")

            # build WAV
            chunk, buf = buf[:16000], buf[16000:]

            try:
                print(f"[DEBUG AUDIO] arr.dtype={arr.dtype}, min={arr.min()}, max={arr.max()}, mean={arr.mean():.5f}")
                audio_res = predict_audio(chunk, orig_sr=sr)
            except Exception as e:
                audio_res = {"error": str(e)}
            print(f"[AUDIO] audio_res = {audio_res}")

            context["audio"] = audio_res

            # if we already have vision, compute behaviour
            if "vision" in context:
                vision_res = context["vision"]
                beh = assign_behaviour(vision_res, audio_res)
                print(f"[AUDIO] computed behaviour → {beh}")
                try:
                    safe_send(
                            dc,
                            json.dumps({"behaviour": beh, "traineeId": context["traineeId"]}),
                            "AUDIO"
                        )
                    print("[AUDIO] sent behaviour to client")
                except InvalidStateError:
                    print("[AUDIO] 🚨 data-channel not ready, skipping send")

            # buffer.clear()
            # sample_count = 0

async def offer(request):
    print("[OFFER] got new /offer request")
    params = await request.json()
    offer = RTCSessionDescription(sdp=params["sdp"], type=params["type"])

    trainee_id = params.get("traineeId")
    print(f"[OFFER] trainee_id = {trainee_id}")


    pc = RTCPeerConnection()
    pcs.add(pc)
    print("[OFFER] created RTCPeerConnection")

    context = {}
    context = {"traineeId": trainee_id}
    dc = pc.createDataChannel("results")
    print("[OFFER] created data-channel 'results'")

    @dc.on("open")
    def on_open():
        print("[DATA] 📡 data-channel OPEN")

    @pc.on("datachannel")
    def on_datachannel(channel):
        print(f"[DATA] new incoming channel → {channel.label}")
        if channel.label == "control":
            @channel.on("message")
            def on_control(message):
                data = json.loads(message)
                if data.get("action") == "endTest":
                    print("🔴 Received endTest from client, tearing down…")
                    for sender in pc.getSenders():
                        if sender.track:
                            sender.track.stop()
                    asyncio.ensure_future(pc.close())
                elif data.get("type") == "ping":
                    # Optionally reply with pong
                    try:
                        print('recieved ping')
                        channel.send(json.dumps({"type": "pong"}))
                    except Exception as e:
                        print("Failed to send pong:", e)
    @pc.on("track")
    def on_track(track):
        print(f"[OFFER] Received track → kind={track.kind}")
        if track.kind == "video":
            asyncio.create_task(consume_video(track, dc, context))
        else:
            asyncio.create_task(consume_audio(track, dc, context))

    print("[OFFER] setting remote description")
    await pc.setRemoteDescription(offer)

    print("[OFFER] creating answer")
    answer = await pc.createAnswer()
    await pc.setLocalDescription(answer)
    print("[OFFER] answer set locally")

    # wait for ICE gathering (no trickle)
    while pc.iceGatheringState != "complete":
        await asyncio.sleep(0.1)
    print("[OFFER] ICE gathering complete")

    return web.json_response({
        "sdp": pc.localDescription.sdp,
        "type": pc.localDescription.type
    })

async def on_shutdown(app):
    print("[SHUTDOWN] closing peer connections")
    await asyncio.gather(*(pc.close() for pc in pcs))
    pcs.clear()

app = web.Application()
cors = aiohttp_cors.setup(app, defaults={
    "http://localhost:3000": aiohttp_cors.ResourceOptions(
        allow_credentials=True,
        expose_headers="*",
        allow_headers="*"
    )
})
offer_route = app.router.add_post("/offer", offer)
cors.add(offer_route)
app.on_shutdown.append(on_shutdown)



if __name__ == "__main__":
    print("======== Starting aiortc server on port 5020 ========")
    web.run_app(app, port=5020)