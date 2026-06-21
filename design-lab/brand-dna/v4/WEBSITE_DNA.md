# LeylekTAG Website DNA v4

**Version:** Brand DNA v4.0 — Web Layer  
**Scope:** Analysis & specification only

---

## 1. Website Felsefe

Website, mobil uygulamanın broşürü değil — **marka deneyiminin tam genişlikli yüzü**. Hero, animasyon, ses, marker, motion ve sonic aynı DNA ailesini konuşur.

| İlke | V4 tanım |
|------|----------|
| Brand-first | Logo geometry + cyan meridian |
| Responsive | Mobile-first; tablet/desktop expand |
| Performance | Motion respects prefers-reduced-motion |
| Optional sound | User gesture required for audio |
| Conversion | Trust + operasyon — not hype |

---

## 2. Breakpoint Aileleri

| Breakpoint | Layout | Motion density |
|------------|--------|----------------|
| **Mobile** (<768 px) | Single column; full bleed hero | Reduced |
| **Tablet** (768–1024 px) | 2 column; hero + feature | Standard |
| **Desktop** (>1024 px) | 3 column; cinematic hero | Full narrative |
| **Watch promo** | Dedicated section — not primary nav | Watch-specific assets |

---

## 3. Hero

| Öğe | Spec |
|-----|------|
| Background | Depth Slate → Void gradient |
| Logo | Motion symbol — presence.pulse 550 ms on load |
| Headline | Geometric sans; white; max 8 words |
| Sub | Operasyonel ton — not slogan stack |
| CTA | Primary cyan; click.press on hover/tap |
| Map preview | Marker breathe demo — live or loop video |
| Sound | Optional — "Experience sound" toggle; presence.boot on click |

**Değil:** Stock photo taxi, generic map screenshot, auto-play loud audio.

---

## 4. Animations

| Section | Motion token | Trigger |
|---------|--------------|---------|
| Hero logo | presence.pulse | Page load |
| Feature cards | relay.ingress stagger 40 ms | Scroll into view |
| Map demo | marker breathe + match lock | Scroll / click |
| QR demo | scan.flash → lock.ringClose | Click CTA |
| Trust | success.checkDraw | Scroll |
| AI section | ai.orbExpand | Scroll |

**Kural:** `prefers-reduced-motion: reduce` → static fallback.

---

## 5. Sound (Web)

| Kural | Spec |
|-------|------|
| Autoplay | **Yasak** |
| User gesture | Click to enable brand preview |
| Tokens | presence.boot, offer excerpt, qr lock — max 3 demo |
| Volume | 0.5 default |
| Format | AAC/MP3 from sonic lab WAV |

---

## 6. Marker (Web)

| Kullanım | Spec |
|----------|------|
| Hero map | SVG markers — MARKER_DNA compliant |
| Interactive demo | Click driver → offer relay animation |
| Static fallback | PNG @1x @2x |
| **Yasak** | Google Maps embed default pins |

---

## 7. Motion (Web)

| Tech | Spec |
|------|------|
| Engine | CSS + Lottie or Framer Motion |
| Easing | Same bezier as MOTION_DNA |
| Duration | Same ms values |
| GPU | transform/opacity only |

---

## 8. Page Architecture

| Sayfa | Brand moment |
|-------|--------------|
| **Home** | Hero pulse + map demo |
| **Driver** | Offer relay demo |
| **Passenger** | Match + QR lock demo |
| **Trust / Safety** | Warm resolve + lock metaphor |
| **Leylek Zeka** | AI orb section |
| **Apple Watch** | Watch complication mock — WATCH_DNA |
| **Download** | App icon + store badges |
| **Legal** | Minimal — monochrome logo |

---

## 9. Typography & Color

| Token | Web |
|-------|-----|
| Primary text | `#F5F7FA` dark theme default |
| Background | `#0D1117` / `#1A2332` |
| Accent | `#00D4AA` |
| Font | Inter or geometric sans — matches app |
| **Yasak** | Gradient text, neon glow on body copy |

---

## 10. Apple Watch Tanıtım Section

| Öğe | Spec |
|-----|------|
| Visual | Watch mock + complication |
| Copy | "Bilekten operasyon" — glanceable |
| Motion | Minimal dot breathe |
| Link | App Store watch section |

---

## 11. SEO & OG

| Asset | Spec |
|-------|------|
| OG image | Symbol + horizon; Depth Slate bg |
| Favicon | Symbol 32 px — LOGO_DNA |
| Title | LeylekTAG — [page] |
| **Brand** | Consistent cyan accent in OG |

---

## 12. Mobile Web (PWA future)

| Kural | Spec |
|-------|------|
| Parity | Same tokens as native where possible |
| Haptic | N/A web — motion + sound compensate |
| Install prompt | Brand icon symbol |

---

## 13. Anti-Patterns

- Different color cyan than app
- Uber-style hero with phone in hand stock
- Auto-play video with sound
- Different logo than app
- Lottie from unrelated brand pack
- Web-only "marketing font"

---

## 14. Cross-Reference

- Logo: `LOGO_DNA.md`  
- Motion: `MOTION_DNA.md`  
- Sonic: `SONIC_DNA.md`  
- Watch: `WATCH_DNA.md`  
- Cross-platform: `CROSS_PLATFORM_DNA.md`

**Non-goals:** `website/` production değiştirilmedi.
