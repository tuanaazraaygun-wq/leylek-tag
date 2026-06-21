# LeylekTAG Light DNA v4

**Version:** Brand DNA v4.0 — Light & Glow Layer  
**Parent:** MOTION_HAPTIC_DNA_V3 §4, MARKER_DNA_V4  
**Scope:** Analysis & specification only

---

## 1. Light Felsefe

LeylekTAG ışığı **dijital nefes** — kontrollü enerji, neon patlaması değil. Işık dili marker, logo, kart, harita, AI ve QR'da **aynı aileyi** konuşur.

| İlke | V4 tanım |
|------|----------|
| Kontrollü | Max opacity 0.7 |
| Semantic | Glow rengi = durum anlamı |
| Okunabilirlik | Harita ve metin öncelik |
| Premium | Frost edge, soft shadow — cheap bloom yok |
| 10 yıl | Cyan meridian — trend gradient yok |

**North Star:** "Sessizce nefes alan" — ışık nefes; lock = kısa flash then fade.

---

## 2. Renk Işık Paleti

| Token | Hex | Opacity range | Anlam |
|-------|-----|---------------|-------|
| **Meridian Cyan** | `#00D4AA` | 15–50% | Aktif, relay, lock, AI |
| **Trust White** | `#F5F7FA` | 8–15% | Edge, frost, highlight |
| **Warm Resolve** | `#C8E6D0` | 15–25% | Match, payment, journey end |
| **Depth Shadow** | `#0D1117` | 20–40% | Depth, elevation |
| **Caution Amber** | `#FFB020` | 20–25% | Error only |
| **Void** | `#000000` | 0% | True black — OLED |

---

## 3. Glow Token Registry

| Token | Renk | Opacity | Fade in | Fade out | Kullanım |
|-------|------|---------|---------|----------|----------|
| `glow.presence` | Cyan | 0.15–0.25 | 120 ms | 200 ms | Boot, online |
| `glow.relay` | Cyan | 0.30–0.40 | 80 ms | 260 ms trail | Offer ingress |
| `glow.lock` | Cyan | 0.50 peak | 80 ms flash | 240 ms | QR, payment |
| `glow.scan` | Cyan + white edge | 0.35 | 40 ms | 100 ms | QR viewfinder |
| `glow.journey` | Warm Resolve | 0.20 | 120 ms | 480 ms breathe | Match |
| `glow.trust` | Warm Resolve | 0.20 | 80 ms | 360 ms | Trust accept |
| `glow.ai` | Cyan core + white halo | 0.20–0.35 | 100 ms | 1.5 s loop | Leylek Zeka |
| `glow.caution` | Amber | 0.25 | 40 ms | 180 ms | Error |
| `glow.marker.idle` | Cyan | 0.15 | 200 ms | 2000 ms loop | Marker breathe |
| `glow.map.ambient` | Cyan | 0.05–0.08 | — | — | Active journey chrome |

---

## 4. Halo

| Yüzey | Spec |
|-------|------|
| Logo boot | 24 px blur, cyan 0.25 max |
| Leylek Zeka orb | 32 px blur, white 0.12 + cyan 0.20 |
| Marker selected | 16 px blur, cyan 0.30 |
| App icon (marketing) | Optional outer halo — print only |

**Kural:** UI chrome'da max 1 halo layer per element.

---

## 5. Reflection & Glass

| Yüzey | Spec |
|-------|------|
| Card frost edge | 1 px `#F5F7FA` @ 12% top edge |
| Modal glass | Background blur 12–20 px + frost |
| QR viewfinder | Glass border + scan glow |
| Bottom sheet | Subtle top edge highlight |
| Watch face | Minimal — 1 px edge only |

**Sonic eşleşme:** Glass air harmonics ↔ frost edge görsel.

---

## 6. Energy (motion-synced light)

| Olay | Energy pattern |
|------|----------------|
| Relay ingress | Cyan trail follows card Y motion |
| Lock | Radial flash 80 ms → ring fade 240 ms |
| Scan | Border pulse clockwise 100 ms |
| Journey | Warm breathe sync pulse.journey |
| AI think | Core pulse 0.20↔0.35 |

---

## 7. Soft Shadow

| Element | Shadow |
|---------|--------|
| Marker | 0 2 px 4 px rgba(0,0,0,0.25) |
| Card | 0 4 px 12 px rgba(0,0,0,0.15) |
| Modal | 0 8 px 24 px rgba(0,0,0,0.20) |
| FAB | 0 2 px 8 px rgba(0,212,170,0.15) — cyan tint |

**Yasak:** Multi-layer random shadow stack.

---

## 8. Ambient Light

| Context | Spec |
|---------|------|
| Dark map | Depth Slate base; markers = light source |
| Light map (future) | Reduced glow opacity ×0.7 |
| Splash | Depth gradient `#0D1117` → `#1A2332` |
| Website hero | Subtle cyan ambient 0.05 full bleed |
| Waiting screen | Minimal — breathe opacity only |

---

## 9. Yüzey Matrisi

### 9.1 Marker glow

Detay: `MARKER_DNA.md` §4.1. Harita okunabilirliği override.

### 9.2 Logo glow

| Durum | Glow |
|-------|------|
| Boot | presence 0.25 max 120 ms |
| Lock overlay | lock flash sync ring |
| Idle | **Off** — logo static |

### 9.3 AI glow

| Durum | Glow |
|-------|------|
| Closed | — |
| Opening | ai expand 300 ms |
| Thinking | ai loop 1.5 s |
| Response | Single resolve flash 200 ms |

### 9.4 Harita glow

| Durum | Glow |
|-------|------|
| Default | None |
| Active journey | map.ambient 0.05 |
| Match | journey 0.20 |
| Offer | relay trail on pin only |

### 9.5 QR glow

| Phase | Glow |
|-------|------|
| Camera active | scan border 0.35 |
| Decoded | scan flash 100 ms |
| Verified | lock 0.50 peak |

---

## 10. Dark / Light Mode

| Token | Dark | Light |
|-------|------|-------|
| Cyan glow | Full spec | ×0.7 opacity |
| Shadow | rgba(0,0,0,0.25) | rgba(0,0,0,0.10) |
| Frost edge | White 12% | Slate 8% |
| Map ambient | 0.05 cyan | 0.03 cyan |

---

## 11. Epilepsy & Accessibility

| Kural | Spec |
|-------|------|
| Flash frequency | Max 3 Hz |
| Lock flash | Single frame peak ≤80 ms |
| **Yasak** | Strobe, continuous blink |
| Reduce Transparency | Solid fallback — glow → border |

---

## 12. Anti-Patterns

- Full opacity neon
- Rainbow gradient glow
- Glow without state change
- Multiple competing halos
- Tron grid lines
- Bloom on text
- Cyan glow on error (amber only)

---

## 13. Cross-Reference

- Marker: `MARKER_DNA.md`  
- Logo: `LOGO_DNA.md`  
- AI: `AI_DNA.md`  
- Motion sync: `MOTION_DNA.md`

**Non-goals:** Shader/asset üretilmedi.
