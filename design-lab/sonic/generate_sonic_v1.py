#!/usr/bin/env python3
"""
Leylek Sonic Design System v1 — local WAV generator.

Uses only Python standard library (math, wave, struct, array, pathlib).
No network, no third-party packages, no external audio files.

Run from repo root or this directory:
    python design-lab/sonic/generate_sonic_v1.py
"""

from __future__ import annotations

import array
import math
import struct
import wave
from dataclasses import dataclass
from pathlib import Path

SAMPLE_RATE = 44100
OUTPUT_DIR = Path(__file__).resolve().parent / "output" / "wav"

# Genome anchor frequencies (Hz)
A3 = 220.0
CS4 = 277.18  # C#4 — major third above A3
E4 = 329.63
F4 = 349.23
A4 = 440.0
GS3 = 207.65  # G#3 — minor third below A3
A5 = 880.0


@dataclass(frozen=True)
class Envelope:
    attack_ms: float
    decay_ms: float
    release_ms: float

    def amplitude_at(self, t_sec: float, note_duration_ms: float) -> float:
        attack = self.attack_ms / 1000.0
        decay = self.decay_ms / 1000.0
        release = self.release_ms / 1000.0
        sustain_end = note_duration_ms / 1000.0
        total = attack + decay + sustain_end + release

        if t_sec < 0 or t_sec >= total:
            return 0.0
        if t_sec < attack:
            return t_sec / attack if attack > 0 else 1.0
        if t_sec < attack + decay:
            progress = (t_sec - attack) / decay if decay > 0 else 1.0
            return 1.0 - 0.35 * progress
        if t_sec < attack + decay + sustain_end:
            return 0.65
        rel_t = t_sec - (attack + decay + sustain_end)
        progress = rel_t / release if release > 0 else 1.0
        return 0.65 * (1.0 - progress)


SOFT = Envelope(attack_ms=8, decay_ms=120, release_ms=180)
OPERATIONAL = Envelope(attack_ms=5, decay_ms=90, release_ms=140)
MICRO = Envelope(attack_ms=2, decay_ms=40, release_ms=30)
RESOLVE = Envelope(attack_ms=10, decay_ms=200, release_ms=350)
CAUTION = Envelope(attack_ms=6, decay_ms=100, release_ms=120)


@dataclass(frozen=True)
class Partial:
    freq: float
    level: float = 1.0
    harmonic2: float = 0.0
    harmonic3: float = 0.0


@dataclass(frozen=True)
class NoteEvent:
    start_ms: float
    duration_ms: float
    partials: tuple[Partial, ...]
    envelope: Envelope


def sine_sample(phase: float) -> float:
    return math.sin(2.0 * math.pi * phase)


def render_events(events: list[NoteEvent], tail_ms: float = 80.0) -> list[float]:
    if not events:
        return []

    end_ms = max(e.start_ms + e.duration_ms + e.envelope.release_ms for e in events)
    end_ms += tail_ms
    n_samples = int(SAMPLE_RATE * end_ms / 1000.0) + 1
    buf = [0.0] * n_samples

    for event in events:
        start_sample = int(SAMPLE_RATE * event.start_ms / 1000.0)
        note_samples = int(SAMPLE_RATE * event.duration_ms / 1000.0)
        env_total_ms = (
            event.envelope.attack_ms
            + event.envelope.decay_ms
            + event.duration_ms
            + event.envelope.release_ms
        )
        env_samples = int(SAMPLE_RATE * env_total_ms / 1000.0) + 1

        phases = {i: 0.0 for i in range(len(event.partials))}

        for i in range(env_samples):
            idx = start_sample + i
            if idx >= n_samples:
                break
            t_sec = i / SAMPLE_RATE
            amp = event.envelope.amplitude_at(t_sec, event.duration_ms)
            if amp <= 0.0:
                continue

            sample = 0.0
            for pi, partial in enumerate(event.partials):
                phases[pi] += partial.freq / SAMPLE_RATE
                if phases[pi] >= 1.0:
                    phases[pi] -= int(phases[pi])
                fundamental = sine_sample(phases[pi]) * partial.level
                h2 = sine_sample(phases[pi] * 2.0) * partial.harmonic2
                h3 = sine_sample(phases[pi] * 3.0) * partial.harmonic3
                sample += fundamental + h2 + h3

            buf[idx] += sample * amp

    peak = max(abs(x) for x in buf) or 1.0
    target = 0.85
    gain = target / peak
    return [x * gain for x in buf]


def apply_gentle_lowpass(samples: list[float], coeff: float = 0.9992) -> list[float]:
    if not samples:
        return samples
    out = [samples[0]]
    for i in range(1, len(samples)):
        out.append(out[-1] + coeff * (samples[i] - out[-1]))
    return out


def write_wav(path: Path, samples: list[float]) -> float:
    path.parent.mkdir(parents=True, exist_ok=True)
    pcm = array.array("h")
    for s in samples:
        clamped = max(-1.0, min(1.0, s))
        pcm.append(int(clamped * 32767))

    with wave.open(str(path), "w") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(SAMPLE_RATE)
        wf.writeframes(pcm.tobytes())

    duration_sec = len(samples) / SAMPLE_RATE
    return duration_sec


def partial(freq: float, level: float = 1.0, h2: float = 0.0, h3: float = 0.0) -> Partial:
    return Partial(freq=freq, level=level, harmonic2=h2, harmonic3=h3)


def note(
    start_ms: float,
    duration_ms: float,
    freqs: list[tuple[float, float]],
    envelope: Envelope,
    h2: float = 0.125,
    h3: float = 0.0,
) -> NoteEvent:
    partials = tuple(partial(f, lvl, h2, h3) for f, lvl in freqs)
    return NoteEvent(start_ms, duration_ms, partials, envelope)


# ── Token builders ──────────────────────────────────────────────────────────


def build_brand_signature(variant: int) -> list[NoteEvent]:
    gap = {1: 280, 2: 295, 3: 285}[variant]
    h2 = {1: 0.125, 2: 0.10, 3: 0.125}[variant]
    f2 = {1: E4, 2: E4, 3: E4 * 1.002}[variant]
    return [
        note(0, 320, [(A3, 1.0)], SOFT, h2=h2),
        note(gap, 360, [(f2, 0.95)], SOFT, h2=h2),
    ]


def build_driver_offer_classic(variant: int) -> list[NoteEvent]:
    gap = {1: 240, 2: 255, 3: 245}[variant]
    rel_scale = {1: 1.0, 2: 0.92, 3: 0.88}[variant]
    env = Envelope(
        attack_ms=SOFT.attack_ms,
        decay_ms=SOFT.decay_ms,
        release_ms=SOFT.release_ms * rel_scale,
    )
    return [
        NoteEvent(0, 280, (partial(A3, 1.0, 0.10),), env),
        NoteEvent(gap, 300, (partial(E4, 0.92, 0.10),), env),
    ]


def build_driver_offer_urgent(variant: int) -> list[NoteEvent]:
    gap = {1: 180, 2: 195, 3: 185}[variant]
    h3 = {1: 0.04, 2: 0.05, 3: 0.045}[variant]
    f2 = {1: F4, 2: F4, 3: F4 * 1.003}[variant]
    env = Envelope(
        attack_ms=OPERATIONAL.attack_ms,
        decay_ms=OPERATIONAL.decay_ms,
        release_ms=260,
    )
    return [
        NoteEvent(0, 320, (partial(A3, 1.0, 0.08),), env),
        NoteEvent(gap, 400, (partial(f2, 1.0, 0.12, h3),), env),
    ]


def build_quick_match_ops(variant: int) -> list[NoteEvent]:
    gap = {1: 220, 2: 235, 3: 225}[variant]
    env = Envelope(
        attack_ms=OPERATIONAL.attack_ms,
        decay_ms=OPERATIONAL.decay_ms,
        release_ms=300,
    )
    if variant == 1:
        phase2 = (partial(A4, 0.75, 0.14, 0.035), partial(E4, 0.35, 0.08))
    elif variant == 2:
        phase2 = (
            partial(A4, 0.72, 0.16, 0.05),
            partial(A4 * 1.008, 0.18, 0.0),
            partial(E4, 0.30, 0.10),
        )
    else:
        phase2 = (
            partial(A4 * 1.004, 0.74, 0.15, 0.04),
            partial(E4, 0.32, 0.09),
        )
    return [
        NoteEvent(0, 340, (partial(CS4, 1.0, 0.11, 0.02),), env),
        NoteEvent(gap, 380, phase2, env),
    ]


def build_match_success(variant: int) -> list[NoteEvent]:
    gap = {1: 350, 2: 365, 3: 355}[variant]
    rel = {1: 1.0, 2: 0.95, 3: 0.90}[variant]
    env = Envelope(
        attack_ms=RESOLVE.attack_ms,
        decay_ms=RESOLVE.decay_ms,
        release_ms=RESOLVE.release_ms * rel,
    )
    return [
        NoteEvent(0, 380, (partial(CS4, 0.85, 0.12), partial(E4, 0.25, 0.06)), env),
        NoteEvent(
            gap,
            420,
            (partial(A3, 0.70, 0.10), partial(E4, 0.55, 0.08), partial(CS4, 0.20, 0.05)),
            env,
        ),
    ]


def build_qr_success() -> list[NoteEvent]:
    return [note(0, 170, [(A4, 1.0)], MICRO, h2=0.08)]


def build_qr_error() -> list[NoteEvent]:
    return [
        note(0, 160, [(A3, 1.0)], CAUTION, h2=0.06),
        note(120, 180, [(GS3, 0.95)], CAUTION, h2=0.05),
    ]


def build_payment_confirmed() -> list[NoteEvent]:
    return [
        note(0, 260, [(CS4, 0.90)], SOFT, h2=0.10),
        note(260, 300, [(E4, 0.88)], SOFT, h2=0.11),
    ]


def build_feedback_error() -> list[NoteEvent]:
    return [
        note(0, 180, [(A3, 1.0)], CAUTION, h2=0.07),
        note(140, 220, [(GS3, 0.90)], CAUTION, h2=0.06),
    ]


def build_ui_tap() -> list[NoteEvent]:
    tap_env = Envelope(attack_ms=1.5, decay_ms=25, release_ms=18)
    return [NoteEvent(0, 35, (partial(A5, 1.0, 0.05),), tap_env)]


# ── Generation manifest ─────────────────────────────────────────────────────

MANIFEST: list[tuple[str, callable, float]] = [
    ("brand_signature_v1.wav", lambda: build_brand_signature(1), 80),
    ("brand_signature_v2.wav", lambda: build_brand_signature(2), 80),
    ("brand_signature_v3.wav", lambda: build_brand_signature(3), 80),
    ("driver_offer_classic_v1.wav", lambda: build_driver_offer_classic(1), 80),
    ("driver_offer_classic_v2.wav", lambda: build_driver_offer_classic(2), 80),
    ("driver_offer_classic_v3.wav", lambda: build_driver_offer_classic(3), 80),
    ("driver_offer_urgent_v1.wav", lambda: build_driver_offer_urgent(1), 80),
    ("driver_offer_urgent_v2.wav", lambda: build_driver_offer_urgent(2), 80),
    ("driver_offer_urgent_v3.wav", lambda: build_driver_offer_urgent(3), 80),
    ("quick_match_ops_v1.wav", lambda: build_quick_match_ops(1), 80),
    ("quick_match_ops_v2.wav", lambda: build_quick_match_ops(2), 80),
    ("quick_match_ops_v3.wav", lambda: build_quick_match_ops(3), 80),
    ("match_success_v1.wav", lambda: build_match_success(1), 80),
    ("match_success_v2.wav", lambda: build_match_success(2), 80),
    ("match_success_v3.wav", lambda: build_match_success(3), 80),
    ("qr_success_v1.wav", build_qr_success, 40),
    ("qr_error_v1.wav", build_qr_error, 50),
    ("payment_confirmed_v1.wav", build_payment_confirmed, 70),
    ("feedback_error_v1.wav", build_feedback_error, 50),
    ("ui_tap_v1.wav", build_ui_tap, 12),
]


def generate_all() -> list[tuple[str, float]]:
    results: list[tuple[str, float]] = []
    for filename, builder, tail_ms in MANIFEST:
        events = builder()
        samples = render_events(events, tail_ms=tail_ms)
        samples = apply_gentle_lowpass(samples)
        duration = write_wav(OUTPUT_DIR / filename, samples)
        results.append((filename, duration))
    return results


def print_tree(base: Path, prefix: str = "") -> None:
    entries = sorted(base.iterdir(), key=lambda p: (p.is_file(), p.name.lower()))
    for i, entry in enumerate(entries):
        connector = "+-- " if i == len(entries) - 1 else "|-- "
        print(f"{prefix}{connector}{entry.name}")
        if entry.is_dir():
            extension = "    " if i == len(entries) - 1 else "|   "
            print_tree(entry, prefix + extension)


def main() -> None:
    sonic_root = Path(__file__).resolve().parent
    results = generate_all()

    print("Leylek Sonic Design System v1 - generation complete\n")
    print(f"Output: {OUTPUT_DIR}\n")
    print("Folder tree:")
    print("design-lab/sonic/")
    print_tree(sonic_root, prefix="")

    print("\nGenerated WAV files (duration):")
    for name, dur in results:
        print(f"  {name:32s}  {dur:.3f}s")


if __name__ == "__main__":
    main()
