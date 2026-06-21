# Finalist F1 — Meridian Wing + Ring (S07)

**Sketch ID:** S07  
**Yön:** Direction A — Meridian Arc  
**Status:** Production sheet — Phase 2 finalist; SVG Phase 3  
**Evrim:** SVG kanat path + PNG orbital arc → horizon + wing + lock ring (pin ve 3D kuş yok)

---

## Wireframe (master)

```
        ╭── wing arc (+2°) ──╮
   ─────●──────────────────●─────  horizon @ alt ⅓
        ╲    lock ring 12%  ╱
         ╰──────────────────╯
              ○ accent (Phase 3 cyan)
```

---

## Evrim tanınırlığı

| Mevcut | F1'de |
|--------|-------|
| Pin içi kanat | Kanat dışarı — aynı sweep ailesi |
| PNG orbital arc | İnce lock ring — metal kalktı |
| Merkez cyan dot | Accent @ horizon∩wing |
| Tam kuş | Yok — arc taşır leylek |

**Beklenen algı:** *"Aynı logo, daha net ve premium."*

---

## Meridian Cyan bölgeleri (renk üretilmedi)

| Bölge | Phase 3 token | Statik | Motion |
|-------|---------------|--------|--------|
| Accent dot | `logo.accent` | Cyan fill | Glow boot peak |
| Lock ring peak | `logo.ring` | White 60% idle | Cyan @ QR peak |
| Boot glow | — | Off | Cyan halo 0.25 max |
| Match overlay | — | Off | Warm resolve — logo üstü değil chrome |

**Gradient:** Yok.

---

## Yüzey değerlendirmesi

| Yüzey | Davranış | Tier | Not |
|-------|----------|------|-----|
| **App Icon** | Symbol center; void ground; ring F | F | Squircle safe; wing apex içerde |
| **Adaptive Icon** | Foreground symbol; bg void flat | F / void | Ring 12% safe zone içi |
| **Splash** | presence.pulse 550 ms; glow 0.25 | F→motion | Wordmark +40 ms opsiyonel |
| **Login** | Statik symbol S; sakin | S | Glow off — güven |
| **Harita** | Watermark mono 0.12 opacity | M0–S | Logo ≠ marker; statik |
| **QR** | lock.ringClose 320 ms ring | F ring animate | Marker sync |
| **Watch** | M1 @ 44 px; ring ince veya gizli | M1 | 2-color: white + cyan dot |
| **Widget** | S @ 24–32 px statik | S | Cyan journey text ayrı |
| **Website** | Hero motion boot; nav S statik | S/F | violet wrapper yok |
| **Favicon** | M0: dot + horizon; ring gizli | M0 | 16 px pass |
| **AI Orb** | Symbol core expand; ring → halo | F core | Orb = scaled symbol |

---

## Logo ↔ Marker

| | Logo F1 | Marker |
|---|---------|--------|
| Rol | Marka imza | Navigasyon |
| Ortak | Stroke 2.5/2px; radius 2–4; ring 320ms; cyan hex | Aynı genom |
| Fark | Wing arc + horizon | Car/motor/human siluet |
| Kopya | Yok | Destination stem rhyme — logo stem **yok** |

---

## Motion

| Olay | Davranış | Token | Süre |
|------|----------|-------|------|
| **Boot** | scale 0.96→1.03→1; opacity; glow | presence.pulse | 550 ms |
| **Match** | Symbol breathe ±2%; ring opacity pulse | pulse.journey subtle | 480 ms |
| **QR** | Ring stroke close; cyan flash | lock.ringClose | 320 ms |
| **Payment** | Check overlay symbol üstü | success.checkDraw | 360 ms |
| **Trust** | Warm ring micro once | online.glow micro | 360 ms |
| **Leylek Zeka** | Symbol→orb; ring→glass halo | ai.orbExpand | 300 ms |
| **Idle UI** | Statik | — | — |

---

## Sonic uyumu

| Olay | Token | F1 geometri eşleşmesi |
|------|-------|-------------------------|
| **Boot** | presence.boot A3→gap→E4 | Horizon=A3 zemin; peak 160ms=arc tepe |
| **QR** | qr.success A4 | Ring close peak |
| **Match** | match.success C♯4 | Arc breathe |
| **Offer** | offer.* relay | Ingress header symbol |
| **Payment** | payment.confirmed C♯4→E4 | Check + ring echo |

**Uyum puanı:** 9/10 — constitution referans yönü.

---

## Risk & Phase 3 notları

| Risk | Mitigasyon |
|------|------------|
| Ring @16px | M0 ring hide |
| Arc soyut | Wordmark LeylekTAG |
| S21 duplicate | S07 = ship candidate |

**Phase 3 öncelik:** Birincil master SVG candidate.

---

## Puan özeti (S07)

Fav 8 · Watch 8 · Icon 9 · Marker 9 · Motion 9 · Sonic 9 · 10yr 9 · **Ort 8.7**
