# V7 — Real-World Mockups

**Rule:** No white artboard evaluation. Every asset shown **in product context**.

**Path:** `mockups/` · regenerate: `node mockups/_generate-mockups.mjs`

---

## Mockup catalog

| File | Surface | Tests addressed |
|------|---------|-----------------|
| `android-home.svg` | Android launcher grid | 3-meter · store visibility |
| `iphone-home.svg` | iOS home + Dynamic Island | squircle · premium |
| `google-maps-journey.svg` | Live map journey | map @ speed · markers · route |
| `journey-screen.svg` | In-app journey UI | ETA chip · nav language |
| `offer-screen.svg` | Driver offer card | offer UX · motion spec |
| `splash-in-phone.svg` | Cold start | brand · motion handoff |
| `notification.svg` | Push banner | 24px icon · recognition |
| `app-store-listing.svg` | App Store grid | international · uniqueness |
| `play-store-listing.svg` | Play Store row | adaptive circle |
| `widget.svg` | Home screen widget | glance · technology |
| `watch-concept.svg` | Apple Watch | complication scale |
| `car-dashboard-concept.svg` | CarPlay / Android Auto | driving @ speed · high contrast |

---

## What each mockup proves

### Home screens (`android-home`, `iphone-home`)
- LC-2 icon with **cyan arc mass** — not flat bird blob  
- Icon adjacent to gray competitors — **thumb-stop test**  
- Label "LeylekTAG" secondary to **silhouette recognition**

### Map journey (`google-maps-journey`, `journey-screen`)
- **MEX markers:** passenger stick + car wedge + destination pennant  
- Route line `#00D4AA` 4px — matches sonic/motion meridian token  
- ETA chip uses **nav typography** — not generic Google chip clone  
- Bottom sheet = journey chrome — **one language**

### Offer (`offer-screen`)
- Map preview + relay card — **triad ready** (motion ingress + offer sonic + haptic P2)  
- Accept CTA ≥48pt — one-hand  
- Cyan ring on card = offer state — not error green

### Splash (`splash-in-phone`)
- Logo @38% width optical center  
- Subtle orbit ellipse = **presence.pulse** hint (static mock)  
- Progress hairline — calm hold, not spinner

### Notification (`notification`)
- **Eye + arc tick only** — 24px legible  
- No full bird — jury requirement from B5.6

### Store listings
- LeylekTAG highlighted among 8 gray icons  
- **3-meter:** arc cyan distinguishes

### Widget / watch / car
- Widget: state + ETA without opening app  
- Watch: eye mark + single number  
- Car dashboard: **6px route** · large vehicle marker — 0.4s read

---

## Mockup fidelity disclaimer

These are **design-lab compositional proofs** — not production screenshots.  
They define **layout, scale, token usage, and co-presence** of brand + map + nav + motion notes.

---

## Review protocol

1. Open mockup + production screenshot **side by side** (when available)  
2. Score recognition @ 3m viewing distance (print A4)  
3. Scale notification mock to 24px width — still LeylekTAG?  
4. Simulate map on **light + dark** tile (overlay `#E8ECF0` / `#0D1117`)  
5. Record in `10_USER_TEST_RESULTS.md`

---

## Gaps (honest)

| Gap | V7 follow-up |
|-----|--------------|
| Real Google Maps tiles | Device capture sprint V7b |
| Satellite / traffic overlay | `03_MAP_SYSTEM.md` spec |
| OLED sun glare photo | Outdoor QA mandatory |
| Animated mockups | Lottie storyboard sprint |

---

**All mockups judge the designed MEX system — not current production.**
