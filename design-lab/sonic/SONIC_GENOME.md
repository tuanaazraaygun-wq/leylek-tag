# LeylekTAG Sonic Genome

**Version:** LSDS v1.0  
**Codename:** *Cyan Meridian*

The genome is the shared DNA every LSDS token inherits. All v1 WAVs in `generate_sonic_v1.py` derive from these parameters.

---

## 1. Core notes (reference pitch)

Base anchor: **A3 = 220 Hz** (trustworthy, mobile-friendly, not tubby).

| Role | Frequency | Note | Meaning |
|------|-----------|------|---------|
| Root | 220 Hz | A3 | Stability, brand ground |
| Fifth | 330 Hz | E4 | Openness, forward motion |
| Major third | 277 Hz | C♯4 | Warmth (match, payment) |
| Octave | 440 Hz | A4 | Clarity, signature sparkle |
| Quick fifth | 349 Hz | F4 | Operational lift (QM phase 2) |
| Caution minor | 208 Hz | G♯3 | Soft warning (errors) |

---

## 2. Intervals

| Interval | Ratio | Emotional use |
|----------|-------|-----------------|
| Perfect fifth (P5) | 3:2 | Brand signature, offer classic phase 2 |
| Major third (M3) | 5:4 | Match success resolution |
| Major second (M2) | 9:8 | Urgent offer second hit (tension, not alarm) |
| Minor third (m3) | 6:5 | QR/payment error caution color |

**Rule:** ascending motion = *request / inform*; descending motion = *resolve / caution*.

---

## 3. Rhythm

- **Grid:** 120 BPM conceptual (500 ms quarter) — used as timing reference, not musical loop.
- **Stagger:** second phase starts at **180–320 ms** after first attack depending on token.
- **Micro UI tap:** single burst **60–100 ms** audible window.

| Token family | Phase 1 | Gap | Phase 2 |
|--------------|---------|-----|---------|
| Brand signature | 220 Hz | 280 ms | 330 Hz |
| Offer classic | 220 Hz | 240 ms | 330 Hz |
| Offer urgent | 220 Hz | 180 ms | 349 Hz (+ M2 color partial) |
| Quick Match ops | 277 Hz | 220 ms | 440 Hz + 330 Hz blend |
| Match success | 277 Hz | 350 ms | 220 Hz + 330 Hz warm stack |
| QR success | 440 Hz | — | — |
| QR error | 220 Hz → 208 Hz | 120 ms | — |
| Payment | 277 Hz | 260 ms | 330 Hz |
| UI tap | 880 Hz burst | — | — |

---

## 4. Synth character

**Primary oscillator:** sine (pure, premium).

**Shaping partials (max 2 per note):**

| Partial | Level | Purpose |
|---------|-------|---------|
| 2nd harmonic | −18 dB | Glass sheen |
| 3rd harmonic | −24 dB | Futuristic edge (urgent/QM only) |

**Optional gentle FM** (Quick Match ops v2/v3 only): mod index ≤ 0.08 at 2× carrier for “comms channel” texture—never audible as vibrato wobble.

**Filtering:** per-note exponential decay simulates one-pole low-pass (coefficient 0.9992/sample at 44.1 kHz).

---

## 5. Envelope (ADSR)

Shared envelope templates:

| Template | Attack | Decay | Sustain | Release | Use |
|----------|--------|-------|---------|---------|-----|
| `soft` | 8 ms | 120 ms | 0 | 180 ms | Brand, classic offer |
| `operational` | 5 ms | 90 ms | 0 | 140 ms | QM ops, urgent |
| `micro` | 2 ms | 40 ms | 0 | 30 ms | UI tap, QR |
| `resolve` | 10 ms | 200 ms | 0 | 350 ms | Match success |
| `caution` | 6 ms | 100 ms | 0 | 120 ms | Errors |

All amplitudes normalized to target peak after mix.

---

## 6. Emotional meaning map

```
        inform ──────────────► resolve
           │                      │
    offer.classic          match.success
    brand.signature        payment.confirmed
           │
           ▼
        action
           │
    quickMatch.opsCall
    offer.urgent
           │
           ▼
        caution
           │
    qr.error / feedback.error
```

---

## 7. Variation strategy (v1 / v2 / v3)

For tokens with three variations:

| Var | Delta |
|-----|-------|
| v1 | Canonical genome (reference) |
| v2 | +15 ms phase gap, 2nd harmonic −2 dB |
| v3 | +5 Hz detune on phase 2 (+0.02 semitone), slightly shorter release |

Listeners pick one winner; others archived in design-lab.

---

## 8. Sample format

- **Format:** PCM WAV, mono, 16-bit, 44.1 kHz
- **Generator:** `generate_sonic_v1.py` (stdlib only)
- **No external assets**
