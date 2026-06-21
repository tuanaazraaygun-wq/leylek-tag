# LeylekTAG Apple Watch DNA v4

**Version:** Brand DNA v4.0 — Watch Layer  
**Scope:** Analysis & specification only

---

## 1. Watch Felsefe

Apple Watch uygulaması **telefonun küçüğü değildir**. Saat, yolculuğun **en yakın, en sessiz, en hızlı** temas noktasıdır — bilekten operasyon.

| İlke | V4 tanım |
|------|----------|
| Glanceable | 2 saniyede oku |
| Minimal | Tek bilgi per screen |
| Haptic-first | Ses varsayılan kapalı |
| Brand | Cyan accent + symbol; aynı DNA |
| Role-aware | Driver ≠ Passenger |

**North Star:** "Sessizce nefes alan" — watch = en sessiz yüzey; kilit anları haptic-strong.

---

## 2. Bilgi Hiyerarşisi

### 2.1 Driver Watch

| Öncelik | Bilgi | Complication |
|---------|-------|--------------|
| 1 | Aktif offer var mı | Offer count badge |
| 2 | QR bekleniyor mu | Lock icon |
| 3 | Yolcu adı / pickup mesafe | Primary text |
| 4 | Journey ETA | Secondary text |
| 5 | Online status | Dot green/cyan |

### 2.2 Passenger Watch

| Öncelik | Bilgi | Complication |
|---------|-------|--------------|
| 1 | Sürücü geliyor mu | ETA primary |
| 2 | Araç / plaka kısa | Secondary |
| 3 | QR boarding ready | Lock prompt |
| 4 | Journey progress | Progress ring |
| 5 | Trust indicator | Warm dot |

### 2.3 Journey (her iki rol)

| Faz | Watch face |
|-----|------------|
| Pre-match | "Aranıyor" + breathe dot |
| Matched | ETA + sürücü/yolcu kısa |
| En route | ETA countdown + direction arrow |
| QR pending | "QR okut" + lock icon pulse |
| QR done | Check + haptic lock |
| Payment | "Tamamlandı" + warm resolve |

---

## 3. Ekran Aileleri

| Ekran | İçerik | Motion |
|-------|--------|--------|
| **Glance** | Tek satır durum | None |
| **Offer** | Fiyat + mesafe + Accept/Decline | relay micro |
| **QR** | "Doğrulandı" chip remote ack | lock.ringClose |
| **Navigation** | Arrow + ETA (future) | minimal |
| **Trust** | Warm dot + isim | trust micro |
| **AI** | "Leylek" kısa yanıt text | think pulse |
| **Error** | Amber icon + retry | nudge |

---

## 4. Complication & Widget

| Tip | Driver | Passenger |
|-----|--------|-------------|
| **Circular** | Cyan ring progress = ETA | Same |
| **Rectangular** | Offer snippet | Driver ETA |
| **Inline** | "Offer" / "En route" | "3 dk" |
| **Graphic corner** | Symbol only | Symbol only |

**Renk:** Max 2 — white text + cyan accent. Symbol = logo symbol monochrome.

---

## 5. Haptic (Watch-primary)

| Olay | Pattern | Not |
|------|---------|-----|
| Offer | P3 double | En güçlü watch haptic |
| QR remote ack | P5 remote | Sürücü bilek |
| QR local | P4 lock | |
| Match | P6 success +16 ms | |
| Tap | P1 selection | |
| Error | T5 warning | |

Ses watch'ta **opsiyonel** — Settings toggle; default off.

---

## 6. Sonic (Watch-secondary)

| Olay | Token | Kural |
|------|-------|-------|
| Offer | offer shortened 70% | Only if sound ON |
| QR lock | qr.success shortened | |
| Boot | — | Silent |
| **Default** | **Haptic only** | |

---

## 7. Motion (Watch)

| Kural | Spec |
|-------|------|
| Duration | Max 320 ms — battery |
| Loop | Sadece waiting dot breathe 2 s |
| Transition | Native watchOS navigation |
| **Yasak** | Complex Lottie on watch |

---

## 8. Navigation (Future)

| Faz | Spec |
|-----|------|
| V4 spec | ETA + direction arrow complication |
| V5+ | Turn-by-turn haptic tap pattern (left/right) |
| CarPlay overlap | Watch = glance; CarPlay = full nav |

---

## 9. Trust on Watch

| Durum | UI |
|-------|-----|
| Trusted driver/passenger | Warm resolve dot |
| New match | Neutral — no badge |
| Trust action | iPhone'dan — watch notify only |

---

## 10. AI on Watch

| Kural | Spec |
|-------|------|
| Scope | Kısa yanıt: ETA, durum, "sürücünüz 3 dk" |
| Input | Voice primary; scribble secondary |
| Visual | Symbol micro + 1–2 satır text |
| Motion | think pulse subtle |
| Ses | Sessiz — text only |

**Değil:** Full chat UI on 40 mm screen.

---

## 11. Phone ↔ Watch Sync

| Olay | Phone | Watch |
|------|-------|-------|
| Offer | Full card + triad | Complication + haptic |
| QR remote | lock triad | P5 + chip |
| Match | Full celebration | Success haptic + ETA |
| Silent mode phone | Haptic continues | Unchanged |

Latency: socket → watch ≤200 ms (Tier A).

---

## 12. Anti-Patterns

- Full phone UI scaled down
- Map on watch (primary)
- Continuous GPS redraw animation
- Sound default on
- Multiple buttons per screen
- Marketing content on watch

---

## 13. Cross-Reference

- Haptic: `HAPTIC_DNA.md` § Watch  
- Sonic: `SONIC_DNA.md` § Watch  
- Cross-platform: `CROSS_PLATFORM_DNA.md`

**Non-goals:** watchOS kod yok; spec only.
