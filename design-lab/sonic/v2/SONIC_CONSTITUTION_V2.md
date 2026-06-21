# Leylek Sonic Design System — Constitution v2

**Version:** LSDS v2.0  
**Scope:** `design-lab/sonic/v2/` only until promotion sign-off.

Amends v1 constitution (`../SONIC_CONSTITUTION.md`). v1 rules remain unless overridden below.

---

## 1. Brand feeling (v2 emphasis)

| Attribute | v2 target | Still avoid |
|-----------|-----------|-------------|
| Premium | Body + transient + harmonic depth | Thin sine ping |
| Operational | Distinct driver/QM/match channels | Generic notification |
| Calm | Headroom; urgency via rhythm/timbre | Raw gain spikes |
| LeylekTAG-native | A3/Meridian interval family | Taxi horn, game fanfare |

---

## 2. Duration rules (unchanged hard limits)

- One-shot only — **no loops**
- Max audible content: **1.6 s**
- Silence tail: up to **95 ms** after content

---

## 3. Loudness rules

- Peak normalize: **0.85 linear** (~−1.4 dBFS)
- Urgent ≠ louder — brighter partials + tighter gap
- v2 body must not exceed v1 perceived loudness at same runtime volume

---

## 4. v2 synthesis rules (new)

1. Every operational token (offer, QM, match, payment) includes **Meridian Body** on at least one phase.
2. **Transient** allowed on all tokens; max 30 ms on QR success; max 8 ms on UI tap.
3. Max **4 partials per note** including body undertone.
4. FM index ≤ **0.06** — QM phase 2 only.
5. No square/saw primary oscillators.
6. No internet or licensed third-party SFX.

---

## 5. Haptic pairing

| Token | Haptic |
|-------|--------|
| `sonic.ui.tap` | `selectionAsync` / Light |
| `sonic.driver.offer.classic` | Medium |
| `sonic.driver.offer.urgent` | Medium → Light (80 ms gap) |
| `sonic.quickMatch.driver.opsCall` | Medium |
| `sonic.match.success` | Success notification |
| `sonic.qr.success` | Light |
| `sonic.qr.error` | Warning |
| `sonic.payment.confirmed` | Success (low priority) |
| `sonic.feedback.error` | Error notification |

---

## 6. What must never happen

All v1 prohibitions apply, plus:

11. **No v2 promotion** without blind A/B vs v1 production WAV on phone speaker.  
12. **No duration creep** beyond v2 token specs without genome bump to v2.1.

---

## 7. Promotion path

1. Fill `LSDS_V2_LISTENING_REPORT.md`  
2. Pick one winner per token family  
3. Asset-only PR to `frontend/assets/sounds/` (same filenames)  
4. Optional volume tune PR in `sound.ts`

---

## 8. Governance

- v1 files in `design-lab/sonic/` are **frozen**  
- v2 outputs live only under `design-lab/sonic/v2/output/`  
- `manifest.json` is source of truth for SHA/duration at generation time
