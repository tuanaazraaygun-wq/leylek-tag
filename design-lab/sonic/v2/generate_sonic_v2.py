#!/usr/bin/env python3
"""
Leylek Sonic Design System v2 — Meridian Body WAV generator.

Uses only Python standard library. No network, no external assets.

Run from repo root:
    python design-lab/sonic/v2/generate_sonic_v2.py
"""

from __future__ import annotations

import array
import hashlib
import json
import math
import wave
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path

SAMPLE_RATE = 44100
GENOME_VERSION = "2.0"
CODENAME = "Cyan Meridian Body"
TARGET_PEAK = 0.85

ROOT = Path(__file__).resolve().parent
OUTPUT_WAV_DIR = ROOT / "output" / "wav"
MANIFEST_PATH = ROOT / "output" / "manifest.json"

# Genome anchor frequencies (Hz)
A2 = 110.0
A3 = 220.0
GS3 = 207.65
CS4 = 277.18
E4 = 329.63
F4 = 349.23
M2_COLOR = 370.0  # major second color above A3
A4 = 440.0
E5 = 659.25
A5 = 880.0
E6 = 1318.51

# Meridian Body defaults (linear amplitude ≈ dB)
BODY_LEVEL = 0.18       # ~ -14.9 dB
H2_DEFAULT = 0.20       # ~ -14.0 dB
H3_DEFAULT = 0.10       # ~ -20.0 dB
H4_DEFAULT = 0.04       # ~ -28.0 dB
TRANSIENT_LEVEL = 0.12  # ~ -18.4 dB


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
            return 1.0 - 0.32 * progress
        if t_sec < attack + decay + sustain_end:
            return 0.68
        rel_t = t_sec - (attack + decay + sustain_end)
        progress = rel_t / release if release > 0 else 1.0
        return 0.68 * (1.0 - progress)


SOFT = Envelope(attack_ms=8, decay_ms=120, release_ms=200)
SOFT_SHORT = Envelope(attack_ms=8, decay_ms=110, release_ms=160)
OPERATIONAL = Envelope(attack_ms=5, decay_ms=90, release_ms=150)
OPERATIONAL_LONG = Envelope(attack_ms=5, decay_ms=95, release_ms=320)
MICRO = Envelope(attack_ms=3, decay_ms=55, release_ms=40)
MICRO_SHORT = Envelope(attack_ms=2, decay_ms=45, release_ms=32)
RESOLVE = Envelope(attack_ms=12, decay_ms=210, release_ms=380)
RESOLVE_MID = Envelope(attack_ms=12, decay_ms=200, release_ms=340)
CAUTION = Envelope(attack_ms=6, decay_ms=100, release_ms=130)
CAUTION_LONG = Envelope(attack_ms=6, decay_ms=110, release_ms=150)
TAP = Envelope(attack_ms=1.5, decay_ms=30, release_ms=25)
TAP_GLASS = Envelope(attack_ms=1.5, decay_ms=28, release_ms=22)


@dataclass(frozen=True)
class Partial:
    freq: float
    level: float = 1.0
    harmonic2: float = H2_DEFAULT
    harmonic3: float = 0.0
    harmonic4: float = 0.0
    body_level: float = 0.0
    fm_index: float = 0.0


@dataclass(frozen=True)
class NoteEvent:
    start_ms: float
    duration_ms: float
    partials: tuple[Partial, ...]
    envelope: Envelope
    transient_ms: float = 5.0
    transient_level: float = TRANSIENT_LEVEL
    body_on: bool = True


@dataclass
class TokenSpec:
    filename: str
    token: str
    description: str
    builder: object
    tail_ms: float = 80.0


def variant_index(letter: str) -> int:
    return {"a": 1, "b": 2, "c": 3}[letter.lower()]


def sine_sample(phase: float) -> float:
    return math.sin(2.0 * math.pi * phase)


def deterministic_noise(sample_index: int, seed: int) -> float:
    x = math.sin((sample_index + seed) * 12.9898 + seed * 0.137) * 43758.5453
    return (x - math.floor(x)) * 2.0 - 1.0


def partial_sample(
    phase: float,
    partial: Partial,
    mod_phase: float,
) -> float:
    carrier = sine_sample(phase)
    if partial.fm_index > 0.0:
        carrier = math.sin(2.0 * math.pi * phase + partial.fm_index * sine_sample(mod_phase))

    sample = carrier * partial.level
    sample += sine_sample(phase * 2.0) * partial.harmonic2
    sample += sine_sample(phase * 3.0) * partial.harmonic3
    sample += sine_sample(phase * 4.0) * partial.harmonic4

    if partial.body_level > 0.0:
        body_phase = phase * (A2 / partial.freq) if partial.freq > 0 else phase * 0.5
        sample += sine_sample(body_phase) * partial.body_level

    return sample


def render_events(events: list[NoteEvent], tail_ms: float = 80.0) -> list[float]:
    if not events:
        return []

    end_ms = max(e.start_ms + e.duration_ms + e.envelope.release_ms for e in events)
    end_ms += tail_ms
    n_samples = int(SAMPLE_RATE * end_ms / 1000.0) + 1
    buf = [0.0] * n_samples

    for event_idx, event in enumerate(events):
        start_sample = int(SAMPLE_RATE * event.start_ms / 1000.0)
        env_total_ms = (
            event.envelope.attack_ms
            + event.envelope.decay_ms
            + event.duration_ms
            + event.envelope.release_ms
        )
        env_samples = int(SAMPLE_RATE * env_total_ms / 1000.0) + 1
        transient_samples = int(SAMPLE_RATE * event.transient_ms / 1000.0)

        phases = [0.0] * len(event.partials)
        mod_phases = [0.0] * len(event.partials)

        for i in range(env_samples):
            idx = start_sample + i
            if idx >= n_samples:
                break
            t_sec = i / SAMPLE_RATE
            amp = event.envelope.amplitude_at(t_sec, event.duration_ms)
            if amp <= 0.0:
                continue

            sample = 0.0
            for pi, p in enumerate(event.partials):
                phases[pi] += p.freq / SAMPLE_RATE
                mod_phases[pi] += (p.freq * 2.0) / SAMPLE_RATE
                if phases[pi] >= 1.0:
                    phases[pi] -= int(phases[pi])
                if mod_phases[pi] >= 1.0:
                    mod_phases[pi] -= int(mod_phases[pi])

                body_level = BODY_LEVEL if event.body_on else 0.0
                if p.body_level > 0.0:
                    body_level = p.body_level
                partial = Partial(
                    freq=p.freq,
                    level=p.level,
                    harmonic2=p.harmonic2,
                    harmonic3=p.harmonic3,
                    harmonic4=p.harmonic4,
                    body_level=body_level,
                    fm_index=p.fm_index,
                )
                sample += partial_sample(phases[pi], partial, mod_phases[pi])

            if i < transient_samples and event.transient_level > 0.0:
                t_env = 1.0 - (i / transient_samples)
                noise = deterministic_noise(idx, event_idx * 997 + 17)
                sample += noise * event.transient_level * t_env * t_env

            buf[idx] += sample * amp

    peak = max(abs(x) for x in buf) or 1.0
    gain = TARGET_PEAK / peak
    return [x * gain for x in buf]


def apply_warm_lowpass(samples: list[float], coeff: float = 0.9988) -> list[float]:
    if not samples:
        return samples
    out = [samples[0]]
    for i in range(1, len(samples)):
        out.append(out[-1] + coeff * (samples[i] - out[-1]))
    return out


def peak_dbfs(samples: list[float]) -> float:
    peak = max(abs(x) for x in samples) if samples else 0.0
    if peak <= 1e-12:
        return -120.0
    return 20.0 * math.log10(peak)


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as fh:
        for chunk in iter(lambda: fh.read(65536), b""):
            digest.update(chunk)
    return digest.hexdigest()


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

    return len(samples) / SAMPLE_RATE


def p(
    freq: float,
    level: float = 1.0,
    h2: float = H2_DEFAULT,
    h3: float = 0.0,
    h4: float = 0.0,
    body: float = 0.0,
    fm: float = 0.0,
) -> Partial:
    return Partial(freq, level, h2, h3, h4, body, fm)


def ne(
    start_ms: float,
    duration_ms: float,
    partials: tuple[Partial, ...],
    envelope: Envelope,
    transient_ms: float = 5.0,
    transient_level: float = TRANSIENT_LEVEL,
    body_on: bool = True,
) -> NoteEvent:
    return NoteEvent(start_ms, duration_ms, partials, envelope, transient_ms, transient_level, body_on)


# ── Token builders (variant a=1, b=2, c=3) ──────────────────────────────────


def build_driver_offer_classic(variant: int) -> list[NoteEvent]:
    gap = {1: 260, 2: 275, 3: 265}[variant]
    rel = {1: 1.0, 2: 0.95, 3: 0.90}[variant]
    env = Envelope(SOFT.attack_ms, SOFT.decay_ms, SOFT.release_ms * rel)
    h2 = {1: 0.20, 2: 0.18, 3: 0.17}[variant]
    return [
        ne(0, 300, (p(A3, 1.0, h2, 0.06),), env, transient_ms=6.0),
        ne(gap, 320, (p(E4, 0.94, h2, 0.05),), env, transient_ms=5.0),
    ]


def build_driver_offer_urgent(variant: int) -> list[NoteEvent]:
    gap = {1: 170, 2: 185, 3: 175}[variant]
    h3 = {1: 0.08, 2: 0.09, 3: 0.085}[variant]
    f2 = {1: F4, 2: F4, 3: F4 * 1.004}[variant]
    env = Envelope(OPERATIONAL.attack_ms, OPERATIONAL.decay_ms, 240)
    return [
        ne(0, 330, (p(A3, 1.0, 0.16, 0.05),), env, transient_ms=5.0),
        ne(
            gap,
            410,
            (
                p(f2, 1.0, 0.18, h3, 0.03),
                p(M2_COLOR, 0.12, 0.08, 0.0, 0.0, body=0.0),
            ),
            env,
            transient_ms=4.0,
            transient_level=0.14,
        ),
    ]


def build_quick_match_ops(variant: int) -> list[NoteEvent]:
    gap = {1: 230, 2: 245, 3: 235}[variant]
    fm = {1: 0.05, 2: 0.06, 3: 0.055}[variant]
    env = OPERATIONAL_LONG
    if variant == 1:
        phase2 = (
            p(A4, 0.76, 0.17, 0.06, 0.02, fm=fm),
            p(E4, 0.34, 0.12, 0.04),
        )
    elif variant == 2:
        phase2 = (
            p(A4, 0.74, 0.18, 0.07, 0.03, fm=fm),
            p(A4 * 1.006, 0.16, 0.10, 0.0, 0.0, body=0.0),
            p(E4, 0.28, 0.11, 0.04),
        )
    else:
        phase2 = (
            p(A4 * 1.003, 0.75, 0.17, 0.06, 0.02, fm=fm),
            p(E4, 0.30, 0.10, 0.04),
        )
    return [
        ne(0, 350, (p(CS4, 1.0, 0.15, 0.04, 0.02),), env, transient_ms=5.0),
        ne(gap, 390, phase2, env, transient_ms=4.0, transient_level=0.11),
    ]


def build_match_success(variant: int) -> list[NoteEvent]:
    gap = {1: 360, 2: 375, 3: 365}[variant]
    rel = {1: 1.0, 2: 0.94, 3: 0.88}[variant]
    env = Envelope(RESOLVE.attack_ms, RESOLVE.decay_ms, RESOLVE.release_ms * rel)
    return [
        ne(
            0,
            390,
            (p(CS4, 0.86, 0.16, 0.06), p(E4, 0.26, 0.10, 0.03)),
            env,
            transient_ms=6.0,
        ),
        ne(
            gap,
            430,
            (
                p(A3, 0.72, 0.14, 0.05, body=BODY_LEVEL),
                p(E4, 0.56, 0.12, 0.05),
                p(CS4, 0.22, 0.08, 0.03, body=0.0),
            ),
            env,
            transient_ms=5.0,
            body_on=True,
        ),
    ]


def build_qr_success(variant: int) -> list[NoteEvent]:
    env = MICRO if variant == 1 else MICRO_SHORT
    h2 = 0.14 if variant == 1 else 0.12
    return [
        ne(
            0,
            200 if variant == 1 else 175,
            (p(A4, 1.0, h2, 0.04), p(E5, 0.08, 0.06, 0.0, 0.0, body=0.0)),
            env,
            transient_ms=30.0 if variant == 1 else 24.0,
            transient_level=0.10,
            body_on=False,
        ),
    ]


def build_qr_error() -> list[NoteEvent]:
    return [
        ne(0, 165, (p(A3, 1.0, 0.14, 0.04),), CAUTION, transient_ms=4.0, transient_level=0.08),
        ne(100, 185, (p(GS3, 0.94, 0.12, 0.03),), CAUTION, transient_ms=0.0, transient_level=0.0),
    ]


def build_payment_confirmed(variant: int) -> list[NoteEvent]:
    gap = {1: 220, 2: 240}[variant]
    env = SOFT_SHORT
    return [
        ne(0, 250, (p(CS4, 0.92, 0.16, 0.05),), env, transient_ms=5.0),
        ne(gap, 290, (p(E4, 0.90, 0.17, 0.05, body=BODY_LEVEL * 0.85),), env, transient_ms=4.0),
    ]


def build_feedback_error() -> list[NoteEvent]:
    return [
        ne(
            0,
            175,
            (p(A3, 1.0, 0.15, 0.05), p(A2, 0.14, 0.0, 0.0, 0.0, body=0.0)),
            CAUTION_LONG,
            transient_ms=4.0,
            transient_level=0.09,
        ),
        ne(120, 210, (p(GS3, 0.92, 0.13, 0.04),), CAUTION_LONG, transient_ms=0.0, transient_level=0.0),
    ]


def build_ui_tap(variant: int) -> list[NoteEvent]:
    env = TAP if variant == 1 else TAP_GLASS
    return [
        ne(
            0,
            42 if variant == 1 else 38,
            (
                p(A5, 1.0, 0.12, 0.04),
                p(E6, 0.06, 0.05, 0.0, 0.0, body=0.0),
            ),
            env,
            transient_ms=8.0,
            transient_level=0.08,
            body_on=False,
        ),
    ]


def build_brand_signature(variant: int) -> list[NoteEvent]:
    gap = {1: 290, 2: 305}[variant]
    h2 = {1: 0.18, 2: 0.16}[variant]
    return [
        ne(0, 340, (p(A3, 1.0, h2, 0.05),), SOFT, transient_ms=6.0),
        ne(gap, 370, (p(E4, 0.96, h2, 0.06),), SOFT, transient_ms=5.0),
    ]


TOKEN_SPECS: list[TokenSpec] = [
    TokenSpec("driver_offer_classic_v2a.wav", "sonic.driver.offer.classic", "Calm dispatch — body + P5 ascent", build_driver_offer_classic, 85),
    TokenSpec("driver_offer_classic_v2b.wav", "sonic.driver.offer.classic", "Calm dispatch — wider gap, softer sheen", build_driver_offer_classic, 85),
    TokenSpec("driver_offer_classic_v2c.wav", "sonic.driver.offer.classic", "Calm dispatch — snappier tail", build_driver_offer_classic, 85),
    TokenSpec("driver_offer_urgent_v2a.wav", "sonic.driver.offer.urgent", "Attention offer — tight rhythm, M2 color", build_driver_offer_urgent, 85),
    TokenSpec("driver_offer_urgent_v2b.wav", "sonic.driver.offer.urgent", "Attention offer — spaced phase, comms edge", build_driver_offer_urgent, 85),
    TokenSpec("driver_offer_urgent_v2c.wav", "sonic.driver.offer.urgent", "Attention offer — balanced detune", build_driver_offer_urgent, 85),
    TokenSpec("quick_match_ops_v2a.wav", "sonic.quickMatch.driver.opsCall", "Ops channel — C# lift to A/E stack", build_quick_match_ops, 90),
    TokenSpec("quick_match_ops_v2b.wav", "sonic.quickMatch.driver.opsCall", "Ops channel — FM shimmer + detune", build_quick_match_ops, 90),
    TokenSpec("quick_match_ops_v2c.wav", "sonic.quickMatch.driver.opsCall", "Ops channel — middle FM weight", build_quick_match_ops, 90),
    TokenSpec("match_success_v2a.wav", "sonic.match.success", "Warm journey resolve — longest tail", build_match_success, 95),
    TokenSpec("match_success_v2b.wav", "sonic.match.success", "Warm resolve — wider gap", build_match_success, 95),
    TokenSpec("match_success_v2c.wav", "sonic.match.success", "Warm resolve — tighter release", build_match_success, 95),
    TokenSpec("qr_success_v2a.wav", "sonic.qr.success", "Scan lock — transient + A4/E5 whisper", build_qr_success, 35),
    TokenSpec("qr_success_v2b.wav", "sonic.qr.success", "Scan lock — shorter micro confirm", build_qr_success, 35),
    TokenSpec("qr_error_v2a.wav", "sonic.qr.error", "Soft QR fail — descending m3", build_qr_error, 45),
    TokenSpec("payment_confirmed_v2a.wav", "sonic.payment.confirmed", "Handshake fifth — trustworthy ascent", build_payment_confirmed, 75),
    TokenSpec("payment_confirmed_v2b.wav", "sonic.payment.confirmed", "Handshake — wider gap variant", build_payment_confirmed, 75),
    TokenSpec("feedback_error_v2a.wav", "sonic.feedback.error", "API/form fail — darker undertone", build_feedback_error, 50),
    TokenSpec("ui_tap_v2a.wav", "sonic.ui.tap", "Premium CTA micro click", build_ui_tap, 15),
    TokenSpec("ui_tap_v2b.wav", "sonic.ui.tap", "Glass tap — lighter transient", build_ui_tap, 15),
    TokenSpec("brand_signature_v2a.wav", "sonic.brand.signature", "Brand sting — Leylek opens", build_brand_signature, 85),
    TokenSpec("brand_signature_v2b.wav", "sonic.brand.signature", "Brand sting — softer sheen", build_brand_signature, 85),
]


def build_events_for_spec(spec: TokenSpec) -> list[NoteEvent]:
    if spec.filename in ("qr_error_v2a.wav", "feedback_error_v2a.wav"):
        return spec.builder()  # type: ignore[operator]
    letter = spec.filename.rsplit("_v2", 1)[1][0]
    return spec.builder(variant_index(letter))  # type: ignore[operator]


def generate_all() -> list[dict]:
    entries: list[dict] = []

    for spec in TOKEN_SPECS:
        events = build_events_for_spec(spec)

        samples = render_events(events, tail_ms=spec.tail_ms)
        samples = apply_warm_lowpass(samples)
        out_path = OUTPUT_WAV_DIR / spec.filename
        duration = write_wav(out_path, samples)
        peak = peak_dbfs(samples)
        digest = sha256_file(out_path)

        entries.append(
            {
                "token": spec.token,
                "filename": spec.filename,
                "duration_sec": round(duration, 4),
                "peak_dbfs": round(peak, 2),
                "sha256": digest,
                "description": spec.description,
                "genome_version": GENOME_VERSION,
                "codename": CODENAME,
            }
        )

    manifest = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "genome_version": GENOME_VERSION,
        "codename": CODENAME,
        "sample_rate_hz": SAMPLE_RATE,
        "format": "PCM mono 16-bit WAV",
        "target_peak_linear": TARGET_PEAK,
        "file_count": len(entries),
        "files": entries,
    }

    MANIFEST_PATH.parent.mkdir(parents=True, exist_ok=True)
    MANIFEST_PATH.write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    return entries


def print_tree(base: Path, prefix: str = "") -> None:
    if not base.exists():
        return
    entries = sorted(base.iterdir(), key=lambda p: (p.is_file(), p.name.lower()))
    for i, entry in enumerate(entries):
        connector = "+-- " if i == len(entries) - 1 else "|-- "
        print(f"{prefix}{connector}{entry.name}")
        if entry.is_dir():
            extension = "    " if i == len(entries) - 1 else "|   "
            print_tree(entry, prefix + extension)


def main() -> None:
    entries = generate_all()

    print("Leylek Sonic Design System v2 (Meridian Body) - generation complete\n")
    print(f"Output WAV: {OUTPUT_WAV_DIR}")
    print(f"Manifest:   {MANIFEST_PATH}\n")
    print("Folder tree:")
    print("design-lab/sonic/v2/")
    print_tree(ROOT, prefix="")

    print("\nGenerated WAV files:")
    for e in entries:
        print(f"  {e['filename']:36s}  {e['duration_sec']:.3f}s  peak {e['peak_dbfs']:.1f} dBFS")


if __name__ == "__main__":
    main()
