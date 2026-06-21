# LeylekTAG AI DNA v4 — Leylek Zeka

**Version:** Brand DNA v4.0 — AI Layer  
**Scope:** Analysis & specification only

---

## 1. AI Felsefe

Leylek Zeka, markadan **ayrı görünmemeli**. Chatbot arayüzü değil — **operasyon sisteminin zeka katmanı**. Ses, motion, glow, logo, eye, marker, loading ve conversation aynı aileyi konuşur.

| İlke | V4 tanım |
|------|----------|
| Same family | Logo orb + cyan halo + glass air |
| Operational | Dispatch assistant — companion değil |
| Silent think | Thinking = görsel; ses yok |
| Trust | AI önerisi = platform güveni |
| 10 yıl | Abstract orb — trend face/robot yok |

**North Star:** AI de "sessizce nefes alan" — think pulse; response = kısa resolve.

---

## 2. Görsel Kimlik

### 2.1 Orb

| Öğe | Spec |
|-----|------|
| Base | Logo symbol center — scaled |
| Halo | ai.glow cyan 0.20–0.35 |
| Glass | Frost edge + inner white 0.12 |
| Eye | Optional — logo symbol core as "eye" (abstract dot) |
| Renk | Meridian Cyan + Trust White |
| **Yasak** | Robot face, human avatar, purple "AI gradient" |

### 2.2 Eye

| Durum | Eye |
|-------|-----|
| Idle | Symbol core static |
| Listening | Subtle scale 1.0↔1.02 |
| Thinking | Glow pulse — eye brightness 0.7↔1.0 |
| Responding | Single flash resolve |
| Error | Amber ring — not eye red |

**Metafor:** Eye = logo symbol core — markanın gözü, ayrı karakter değil.

### 2.3 Marker (harita AI modu)

| Öğe | Spec |
|-----|------|
| Overlay | AI halo on route suggestion |
| Path | Cyan dashed → solid on accept |
| Detay | `MARKER_DNA.md` §3.10 |

---

## 3. Motion

| State | Token | Süre |
|-------|-------|------|
| Open | `ai.orbExpand` | 300 ms |
| Think | `ai.think` loop | 1200 ms |
| Response arrive | `success.checkDraw` micro | 200 ms |
| Dismiss | `dismiss.sheet` | 280 ms |
| Error | `error.nudge` | 180 ms |

**Kural:** Native orb flutter ile fight etmez — LSX event subset only.

---

## 4. Sonic

| State | Token | Kural |
|-------|-------|-------|
| Open | `leylek.open` glass air | Once per session open |
| Think | **Sessiz** | — |
| Response | `leylek.response` soft C♯4 | Konuşma TTS sırasında off |
| Error | `feedback.error` | |
| **Yasak** | Continuous AI hum loop | |

---

## 5. Haptic

| State | Pattern |
|-------|---------|
| Open | P1 light |
| Confirm suggestion | P6 success +16 ms |
| Error | T5 warning |
| Think | T0 none |

---

## 6. Glow / Light

| State | Glow token |
|-------|------------|
| Closed | — |
| Open | ai expand |
| Think | ai loop 1.5 s |
| Response | lock micro flash 200 ms |

Detay: `LIGHT_DNA.md` §9.3.

---

## 7. Loading

| Tür | Spec |
|-----|------|
| First open | Meridian sweep — not spinner |
| Think | ai.think pulse — not progress bar |
| Long query | Breathe only — no percentage unless data |
| **Yasak** | "ChatGPT typing dots" clone |

---

## 8. Conversation UI

| Öğe | Spec |
|-----|------|
| User bubble | Depth Slate; minimal |
| AI bubble | Glass air; cyan left edge 2 px |
| Typography | Same as app — no "AI font" |
| Avatar | Orb 24 px — not photo |
| Input | Standard app input + mic |
| Suggestions | Chip — click.press motion |

**Ton:** Operasyonel, kısa, güvenilir — "3 sürücü 5 dk mesafede" not "Harika haber! 🎉"

---

## 9. Thinking vs Response

| Phase | Visual | Sound | Haptic | Duration |
|-------|--------|-------|--------|----------|
| **Thinking** | ai.think pulse | Silent | None | Until response |
| **Response** | Text stream + resolve flash | leylek.response once | Light optional | — |
| **Streaming TTS** | Orb subtle breathe | TTS only — no token | None | — |

---

## 10. Logo Entegrasyonu

```
App Logo Symbol ──expand──► Leylek Zeka Orb
         │                        │
         └──── same geometry ─────┘
```

- Open animation: symbol → orb (scale + halo)
- Close: orb → symbol reverse
- QR/Match sırasında orb **minimize** — journey öncelik

---

## 11. Trust & AI

| Kural | Spec |
|-------|------|
| AI suggestion | Platform onayı — not anonymous tip |
| Driver/passenger ID | AI never impersonates user |
| Privacy | No face/voice storage in brand UI |
| Trust score | AI explains — warm resolve visual |

---

## 12. Platform AI Surfaces

| Yüzey | AI scope |
|-------|----------|
| Mobile | Full orb + conversation |
| Watch | Glance answer only |
| Widget | No AI — status only |
| Web | Hero demo + help chat |
| CarPlay | Voice only — no orb |

---

## 13. Anti-Patterns

- Separate "AI app" branding
- Purple gradient AI cliché
- Robot mascot
- Typing indicator three dots (use pulse)
- AI fanfare on response
- AI sound during think
- Chatbot personality name ≠ LeylekTAG

---

## 14. Cross-Reference

- Logo orb: `LOGO_DNA.md` §4  
- Sonic: `SONIC_DNA.md` §3.9  
- Motion: `MOTION_DNA.md` §5.8  
- Light: `LIGHT_DNA.md` §9.3

**Non-goals:** AI model/API değişikliği yok; experience DNA only.
