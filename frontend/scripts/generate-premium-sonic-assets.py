"""Generate P0-D premium sonic WAV assets (video trust + force end)."""
import math
import os
import struct
import wave

OUT = os.path.join(os.path.dirname(__file__), "..", "assets", "sounds")
SAMPLE_RATE = 44100


def write_wav(path: str, samples: list[float]) -> None:
    with wave.open(path, "w") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SAMPLE_RATE)
        frames = b"".join(
            struct.pack("<h", max(-32767, min(32767, int(s * 32767)))) for s in samples
        )
        w.writeframes(frames)


def env(t: float, attack: float, decay: float, sustain_level: float, release: float, duration: float) -> float:
    if t < attack:
        return t / attack if attack > 0 else 1.0
    if t < attack + decay:
        return 1.0 - (1.0 - sustain_level) * ((t - attack) / decay)
    if t < duration - release:
        return sustain_level
    return sustain_level * max(0.0, (duration - t) / release) if release > 0 else 0.0


def sine_tone(
    freq: float,
    duration: float,
    volume: float = 0.35,
    attack: float = 0.02,
    decay: float = 0.05,
    sustain: float = 0.7,
    release: float = 0.08,
) -> list[float]:
    n = int(SAMPLE_RATE * duration)
    out: list[float] = []
    for i in range(n):
        t = i / SAMPLE_RATE
        e = env(t, attack, decay, sustain, release, duration)
        fundamental = math.sin(2 * math.pi * freq * t)
        harmonic = 0.12 * math.sin(2 * math.pi * freq * 2 * t) * e
        out.append((fundamental + harmonic) * volume * e)
    return out


def mix_segments(segments: list[list[float]], gap: float = 0.0) -> list[float]:
    gap_n = int(SAMPLE_RATE * gap)
    out: list[float] = []
    for idx, seg in enumerate(segments):
        out.extend(seg)
        if idx < len(segments) - 1:
            out.extend([0.0] * gap_n)
    return out


def main() -> None:
    os.makedirs(OUT, exist_ok=True)

    # video_trust_call — soft premium 2-stage (E5 pause G5)
    stage1 = sine_tone(659.25, 0.38, volume=0.28, attack=0.04, decay=0.08, sustain=0.55, release=0.12)
    stage2 = sine_tone(783.99, 0.42, volume=0.24, attack=0.05, decay=0.1, sustain=0.5, release=0.16)
    video_trust = mix_segments([stage1, stage2], gap=0.09)
    write_wav(os.path.join(OUT, "video-trust-call.wav"), video_trust)

    # force_end_alert — short amber warning double pulse
    pulse1 = sine_tone(587.33, 0.14, volume=0.34, attack=0.008, decay=0.04, sustain=0.65, release=0.05)
    pulse2 = sine_tone(493.88, 0.18, volume=0.32, attack=0.01, decay=0.05, sustain=0.55, release=0.08)
    force_end = mix_segments([pulse1, pulse2], gap=0.07)
    write_wav(os.path.join(OUT, "force-end-alert.wav"), force_end)

    print("Generated video-trust-call.wav and force-end-alert.wav")


if __name__ == "__main__":
    main()
