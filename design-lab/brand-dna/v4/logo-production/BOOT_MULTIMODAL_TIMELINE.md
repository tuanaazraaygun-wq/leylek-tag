# Boot Multimodal Timeline — Logo Production Phase 1

**Version:** 1.0  
**Status:** Analysis only  
**Parent:** `LOGO_SONIC_LINK.md`, `SONIC_DNA.md`, `MOTION_DNA.md`, `HAPTIC_DNA.md`, `LIGHT_DNA.md`  
**Pattern:** T4 Presence — total narrative ≤550 ms; extended table to 700 ms for tail + handoff clarity

---

## 1. Orchestration İlkesi

| Kural | Değer |
|-------|-------|
| Motion lead | 0 ms — görsel önce |
| Sound offset | +40 ms (laggy hissiyat yok) |
| Haptic boot | **Yok** — sakin açılış |
| Glow max | 0.25 opacity — boot only |
| Tier | A (T4 — haptic exempt) |

**LSX Triad boot:** Motion + Sound (+ Glow). Haptic kanalı bilinçli boş.

---

## 2. Frame Timeline (0–700 ms)

| ms | Motion (logo) | Sonic (LSDS) | Glow / Light | Haptic | Visual state | Algı hedefi |
|----|---------------|--------------|--------------|--------|--------------|-------------|
| **0** | Opacity 0; scale 0.96; transform başlar | — | Off | — | Splash void ground `#0D1117` | "Yanıt başladı" |
| **16** | Opacity ~0.25; scale 0.97 | — | — | — | İlk piksel commit | Lag yok |
| **40** | Opacity ~0.55; scale 0.98→1.0 attack | `presence.boot` A3 attack başlar (+40 ms sync) | Fade in başlar 0→0.08 | — | Siluet okunmaya başlar | "Sistem canlı" |
| **100** | Opacity ~0.85; scale 1.0 | A3 body swell; Meridian undertone | Cyan 0.12 | — | Kanat arc hint net | **200 ms hedefi — marka tanınır** |
| **120** | Opacity 1.0 commit | Body peak building | 0.15 | — | Tam siluet | Güven zeminı |
| **160** | Scale peak **1.03** — HOLD | Gap başlangıcı (120 ms gap öncesi son vücut) | **0.25 max** | — | Nefes tepe | Presence doruk |
| **200** | Hold 1.03; micro settle başlar | Phase 1 tail; gap içi sakin | 0.22→0.20 | — | **200 ms commit tamam** | "LeylekTAG — generic değil" |
| **280** | Scale 1.03→1.01 | E4 phase 2 attack @ −6 dB | 0.18 fade | — | Resolve başlar | Warm forward |
| **350** | Scale 1.0 settle | E4 body | 0.12 | — | Kapanış hissi | Operasyon hazır |
| **400** | Scale 1.0 locked | Phase 2 decay | 0.08 | — | Statik mark | Sakin |
| **480** | — | E4 tail | 0.05 | — | — | — |
| **550** | `splash.handoff` opacity fade başlar 150 ms | Audible tail max 95 ms after content | Glow off 0 | — | Logo fade; chrome in | Geçiş |
| **600** | Logo opacity ~0.5 | Tail bitiş | Off | — | App chrome dominant | — |
| **700** | Logo hidden; chrome full | Sessiz | Off | — | İlk ekran interactive | Journey başlayabilir |

---

## 3. Kanal Detayı

### 3.1 Motion tokens

| ms aralığı | Token | Transform |
|------------|-------|-----------|
| 0–220 | `v4.motion.presence.pulse` | scale 0.96→1.03→1.0 |
| 550–700 | `v4.motion.splash.handoff` | logo opacity 1→0; chrome opacity 0→1 |

**Easing:** Premium stop `(0.22, 1, 0.36, 1)` — lock snap boot'ta **yok**.

### 3.2 Sonic tokens

| Parametre | Değer |
|-----------|-------|
| Token | `sonic.presence.boot` |
| Faz 1 | A3 220 Hz + Meridian Body, ~180 ms attack |
| Gap | 120 ms @ 160–280 ms bandı |
| Faz 2 | E4 330 Hz @ −6 dB, ~200 ms |
| Peak | −1.4 dBFS (~0.85 linear) |
| Remix süre | ≤550 ms audible |

### 3.3 Glow tokens

| ms | Token | Opacity |
|----|-------|---------|
| 40–120 | `glow.presence` fade in | 0→0.15 |
| 120–160 | build | 0.15→0.25 |
| 160–350 | hold + decay | 0.25→0.08 |
| 550+ | off | 0 |

**Kural:** SVG `feGaussianBlur` filter — retire; runtime/CSS/Lottie glow layer.

### 3.4 Haptic

| Boot | Değer |
|------|-------|
| Tier A T4 | Haptic **yok** |
| Gerekçe | Sakin presence; alarm değil |

Post-boot ilk tap → `ui.tap` + `selection` ayrı olay.

---

## 4. Logo Form Gereksinimleri (boot için)

Boot animasyonu logo geometry'den türemeli:

| Öğe | Boot davranışı |
|-----|----------------|
| Wing arc | Opacity + scale taşıyıcı |
| Horizon | Statik — sweep loading ayrı loop |
| Lock ring | Boot'ta **idle** — QR'da animate |
| Accent dot | Glow peak @ 160 ms sync |

Pin formu boot'ta scale pulse **zayıf** — teardrop optik ağırlık alt; arc+horizon boot için üstün.

---

## 5. Platform Varyasyonları

| Platform | Boot süre | Ses | Glow | Logo |
|----------|-----------|-----|------|------|
| iOS cold open | Full 550 ms | Full | Full | Full motion |
| Android cold open | Full 550 ms | Full | Full | Full |
| Warm start | 0 ms — skip | — | — | Statik |
| Widget open | 0 veya micro 200 ms | micro / tap | Off | M0 static |
| Watch open | Static | off / tap | Off | M1 static |
| Web hero | 550 ms on load | gesture only | reduced 0.15 max | motion + reduced-motion static |
| CarPlay | Static | — | — | Monochrome |

---

## 6. QA Sync Toleransı

| Eşleşme | Tolerans |
|---------|----------|
| Visual 200 ms commit ↔ A3 body | ±16 ms |
| Scale peak 160 ms ↔ sonic gap | ±16 ms |
| Glow peak ↔ scale peak | Same frame |
| Handoff 550 ms ↔ sonic tail end | ±32 ms |

---

## 7. QR / Lock Timeline (referans — boot sonrası)

Boot ile karıştırılmaz. Özet:

| ms | Motion | Sonic | Glow | Haptic |
|----|--------|-------|------|--------|
| 0 | ringClose start | A4 attack | — | lock |
| 80 | peak | peak | 0.50 flash | — |
| 320 | complete | tail | fade | — |

Detay: `LOGO_MOTION.md`, `LOGO_SONIC_LINK.md`.

---

**Non-goals:** Lottie implementasyonu, `sound.ts` değişikliği yok.
