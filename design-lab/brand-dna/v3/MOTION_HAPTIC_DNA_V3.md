# LeylekTAG Motion · Haptic · Light/Glow · Timing DNA v3

**Version:** Brand DNA v3.0 — Kinetic & Tactile Layer  
**Parent:** LSX v1 Motion/Haptic/Timing, Brand DNA v3 Constitution  
**Scope:** Analysis & specification only

---

## 1. Tek karakter: Optical-Kinetic Presence

LeylekTAG hareketi **ışık taşır, yüzeyler kilitlenir, krom nefes alır**. Bouncy game UI değil; sert enterprise form değil.

| Attribute | V3 değer |
|-----------|----------|
| Primary easing | `cubic-bezier(0.22, 1, 0.36, 1)` — premium stop |
| Secondary easing | `cubic-bezier(0.4, 0, 0.2, 1)` — exit/dismiss |
| Snap easing | `cubic-bezier(0.34, 1.56, 0.64, 1)` — lock only, max scale 1.06 |
| Duration bands | Micro 80–120 ms · Standard 180–280 ms · Resolve 320–480 ms · Narrative 600–900 ms |
| Scale range | 0.96–1.04 typical |
| Opacity | Flash yok; min 120 ms fade |

---

## 2. Motion DNA — token registry

| Token | Süre | Transform | Metafor |
|-------|------|-----------|---------|
| `v3.motion.presence.pulse` | 220 ms | scale 1→1.03→1 | Kinetic pulse (boot) |
| `v3.motion.relay.ingress` | 260 ms | translateY 12→0 + opacity | Digital relay (offer) |
| `v3.motion.lock.ringClose` | 320 ms | ring stroke 100%→0 | Magnetic lock |
| `v3.motion.scan.viewfinderFlash` | 100 ms | border glow cyan fade | Optical scan |
| `v3.motion.pulse.journey` | 480 ms | map chrome breathe | Journey open |
| `v3.motion.click.press` | 90 ms | scale 1→0.97→1 | Precision click |
| `v3.motion.dismiss.sheet` | 280 ms | translateY 0→100% | Closure |
| `v3.motion.waiting.breathe` | 2000 ms loop | opacity 0.4↔0.7 | Sakin bekleme |
| `v3.motion.error.nudge` | 180 ms | translateX ±4 | Soft fail |
| `v3.motion.success.checkDraw` | 360 ms | checkmark stroke | Trust/payment |
| `v3.motion.online.glow` | 400 ms | chrome badge fade in | Driver online |
| `v3.motion.remote.ack` | 320 ms | lock + chip “Doğrulandı” | Remote QR |

**Direction semantiği:** Ascend = inform · Inward = lock · Expand = journey · Descend = dismiss

---

## 3. Haptic DNA

### 3.1 İlkeler

1. Haptic, gözün gördüğünü **vücuda onaylar** — Tier A'da görsel olmadan tek başına değil  
2. Boot'ta haptic **yok** (T4)  
3. Remote ack'te haptic **zorunlu** — ses kapalı olsa bile  
4. Urgent offer = **double** tap; error = warning/error ayrımı  

### 3.2 Token registry

| Token | iOS | Android | Hissi |
|-------|-----|---------|-------|
| `v3.haptic.selection` | selectionAsync | Light | Micro |
| `v3.haptic.light` | Light impact | Light | Tap |
| `v3.haptic.medium` | Medium | Medium | Confirm |
| `v3.haptic.success` | NotificationSuccess | Success | Resolve |
| `v3.haptic.warning` | NotificationWarning | Warning | Caution |
| `v3.haptic.error` | NotificationError | Error | Fail |
| `v3.haptic.double` | Med + 80ms + Light | Two Light | Urgent offer |
| `v3.haptic.lock` | Rigid/Medium | Med + 30ms Light | QR/payment |
| `v3.haptic.remote` | Medium | Med + 50ms vibrate | Remote ack |

### 3.3 Fatigue policy

| Olay | Max rate |
|------|----------|
| Offer / QM | Mevcut cooldown (1s / 2s) |
| UI tap | 70 ms anti-double |
| QR error | 500 ms |
| Match | 2800 ms debounce |

---

## 4. Light / Glow DNA

Glow, LeylekTAG'ın **dijital nefesidir** — marker, logo, kart, harita chrome ve QR viewfinder aynı dil.

### 4.1 Glow tokens

| Token | Renk | Opacity | Fade | Kullanım |
|-------|------|---------|------|----------|
| `v3.glow.presence` | Meridian Cyan | 0.15–0.25 | 120 ms in | Boot, online |
| `v3.glow.relay` | Meridian Cyan | 0.30–0.40 | 260 ms trail | Offer ingress |
| `v3.glow.lock` | Meridian Cyan | 0.50 peak | 80 ms flash + 240 ms out | QR/payment |
| `v3.glow.scan` | Cyan + white edge | 0.35 | 100 ms | QR viewfinder |
| `v3.glow.journey` | Warm Resolve | 0.20 | 480 ms breathe | Match |
| `v3.glow.caution` | Amber `#FFB020` | 0.25 | 180 ms | Error |

### 4.2 Kurallar

- Max opacity **0.7** — asla full neon  
- Glow **harita okunabilirliğini** bozmaz  
- Lock flash tek frame peak — epilepsi güvenli  
- Dark theme birincil; light theme'de opacity %70  

### 4.3 Glass air (yüzey)

Kartlar ve modallar: hafif frost edge, 1 px `#F5F7FA` @ 12% — sonic "glass air" harmonikleri ile duyusal eşleşme.

---

## 5. Timing DNA — orchestration

### 5.1 Pattern'ler

| Pattern | Sıra | Kullanım |
|---------|------|----------|
| **T1 Standard Triad** | Motion → Haptic (+0) → Sound (+8 ms) → Visual commit (+80 ms) | Offer, match, QR lock |
| **T2 Micro Confirm** | Haptic (+0) → Motion (+4) → Sound (+12) | Tap, scan tick |
| **T3 Remote Echo** | State (+0) → Motion (+0) → Haptic (+16) → Sound (+24) | Driver QR ack |
| **T4 Presence** | Motion (+0) → Sound (+40) → no haptic | Boot |
| **T5 Caution** | Haptic warning (+0) → Sound (+20) → Motion nudge (+40) | Error |

**Altın kural:** Tier A'da ses, motion'dan **önde başlamaz**.

### 5.2 Frame budget

60 fps → 16.67 ms/frame. Tüm gecikmeler en yakın frame'e yuvarlanır.

### 5.3 T1 timeline (@ 60fps)

| Frame | ~ms | Motion | Haptic | Sound | Glow |
|-------|-----|--------|--------|-------|------|
| 0 | 0 | ingress start | fire | — | relay on |
| 1 | 16 | 20% | — | attack | — |
| 2 | 33 | 40% | — | body | peak |
| 5 | 83 | peak | — | body | fade |
| 8 | 133 | settle | — | release | off |
| 15 | 250 | complete | — | — | — |

### 5.4 Latency budget

| Metrik | Hedef |
|--------|-------|
| Tap → first sensory | ≤ 32 ms |
| Socket remote → driver sensory | ≤ 200 ms |
| Boot → presence felt | ≤ 250 ms |

---

## 6. Canlılık vs sessizlik

| Durum | Strateji |
|-------|----------|
| Bekleme (search) | `waiting.breathe` — ses yok |
| Boot | T4 — kısa presence, uzun sting yok |
| Her tap | T2 — motion + light haptic; ses opsiyonel 0.40 vol |
| Remote QR | T3 — sürücüde zorunlu triad |
| Silent mode | Ses off; motion + haptic Tier A devam |

---

## 7. Production gap (referans — dokunulmadı)

| Kanal | Bugün | V3 hedef |
|-------|-------|----------|
| Offer sound | Var | + ingress + haptic |
| Offer motion/haptic | Yok | Triad |
| Boot sound | Yok | presence.boot + logo |
| QR remote driver | LSX patch ile iyileşti | T3 standardize |
| Global tap | playTapSound no-op | T2 minimum |

---

## 8. Cross-reference

- Ses: `SONIC_DNA_V3.md`  
- Marker glow: `MARKER_DNA_V3.md`  
- Logo pulse: `LOGO_DNA_V3.md`  
- Event tablosu: `CROSS_LANGUAGE_MAP_V3.md`
