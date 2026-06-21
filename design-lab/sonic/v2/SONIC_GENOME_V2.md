# LeylekTAG Sonic Genome v2

**Version:** LSDS v2.0  
**Codename:** *Cyan Meridian Body*  
**Parent:** v1.0 *Cyan Meridian* (`../SONIC_GENOME.md`)

v2 inherits v1 intervals, pitch anchor, and urgency map. The genome bump adds **Meridian Body** — controlled undertone, attack transient, and richer harmonics without alarm or game aesthetics.

---

## 1. Core notes (unchanged anchor)

Base anchor: **A3 = 220 Hz**

| Role | Frequency | Note | v2 addition |
|------|-----------|------|-------------|
| Body | 110 Hz | A2 | Meridian undertone (−15 dB) |
| Root | 220 Hz | A3 | + body layer on operational tokens |
| Major third | 277 Hz | C♯4 | QM / match / payment |
| Fifth | 330 Hz | E4 | Offer classic phase 2 |
| Quick fifth | 349 Hz | F4 | Urgent offer |
| M2 color | 370 Hz | — | Urgent tension partial |
| Octave | 440 Hz | A4 | QR lock, QM phase 2 |
| Micro tap | 880 Hz | A5 | + E6 whisper (−24 dB) |

---

## 2. Meridian Body layers

| Layer | Parameter | Purpose |
|-------|-----------|---------|
| **Undertone** | A2 @ 0.18 linear (~−15 dB) | Phone-speaker warmth |
| **Transient** | 4–30 ms shaped noise @ 0.08–0.14 | Attack definition (not clicky) |
| **Harmonics** | h2 0.17–0.20, h3 0.04–0.09, h4 0.02–0.04 | Glass/edge without buzz |
| **FM sheen** | index ≤ 0.06 on QM phase 2 only | Comms channel texture |
| **Warm LP** | coeff 0.9988 | Round harsh highs post-mix |

Max **4 partials per note** (fundamental stack + body counts as partial).

---

## 3. Rhythm (v2 deltas vs v1)

| Token | Phase 1 | Gap (v2) | Phase 2 | Max duration |
|-------|---------|----------|---------|--------------|
| Brand signature | A3 | 290–305 ms | E4 | 1.2 s |
| Offer classic | A3+body | **260–275 ms** | E4 | 1.05 s |
| Offer urgent | A3+body | **170–185 ms** | F4+M2 | 1.20 s |
| Quick Match ops | C♯4 | **230–245 ms** | A4/E4+FM | 1.30 s |
| Match success | C♯4 stack | **360–375 ms** | A3/E4 resolve | 1.45 s |
| QR success | A4 lock | — | — | 0.38 s |
| QR error | A3→G♯3 | 100 ms | — | 0.55 s |
| Payment | C♯4 | **220–240 ms** | E4+body | 0.95 s |
| Feedback error | A3+A2 | 120 ms | G♯3 | 0.65 s |
| UI tap | A5+E6 | — | — | 0.10 s |

---

## 4. Envelope templates (v2)

| Template | Attack | Decay | Release | Use |
|----------|--------|-------|---------|-----|
| `soft` | 8 ms | 120 ms | 200 ms | Brand, classic offer |
| `soft_short` | 8 ms | 110 ms | 160 ms | Payment |
| `operational` | 5 ms | 90 ms | 150 ms | Urgent |
| `operational_long` | 5 ms | 95 ms | 320 ms | QM ops |
| `micro` | 3 ms | 55 ms | 40 ms | QR success |
| `resolve` | 12 ms | 210 ms | 380 ms | Match success |
| `caution` | 6 ms | 100 ms | 130 ms | QR error |
| `caution_long` | 6 ms | 110 ms | 150 ms | Feedback error |
| `tap` | 1.5 ms | 30 ms | 25 ms | UI tap |

---

## 5. Variation strategy (v2a / v2b / v2c)

| Variant | Delta |
|---------|-------|
| **a** | Canonical v2 body + reference timing |
| **b** | +15 ms phase gap OR softer h2 OR wider payment gap |
| **c** | Shorter release OR micro detune on phase 2 |

Single-variant tokens: `qr_error_v2a`, `feedback_error_v2a`.

---

## 6. Sample format

- PCM WAV, mono, 16-bit, 44.1 kHz  
- Generator: `generate_sonic_v2.py`  
- Peak normalize: 0.85 linear (~−1.4 dBFS)  
- No external assets, no loops
