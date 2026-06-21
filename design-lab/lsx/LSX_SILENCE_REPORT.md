# LSX Silence Report

**Version:** LSX v1.0  
**Includes:** Silence Map · Dead UI Map

---

## 1. Silence Map

Places where the app is **accidentally silent** (not intentional Tier D).

| Location | Journey | Duration of silence | Severity | LSX fix class |
|----------|---------|---------------------|----------|---------------|
| Cold start → first paint | App boot | **300–800 ms** | Critical | `lsx.sound.presence.boot` + motion pulse |
| Splash hide → role/login | App boot | 200–500 ms | High | Boot triad T4 |
| Login form submit success | Login | Until navigation | Medium | Motion crossfade only |
| Dashboard idle (passenger waiting) | Waiting | **Minutes** | Medium | Tier C `waiting.breathe` — no new sound loop |
| Map pan / zoom | Dashboard | Continuous | OK | Intentional silence |
| List row tap (most) | Dashboard | Per tap | High | Dead UI — see §2 |
| `playTapSound` no-op paths | Global | Per tap | **Critical** | `index.tsx` empty callback |
| Driver offer received (muted phone) | Driver offer | Per offer | Medium | Haptic mandatory when sound blocked |
| Boarding: driver waits for scan | QR boarding | **Until socket** | **Critical** | Remote ack triad |
| Trip-end: driver shows QR | QR end | Until passenger acts | High | Remote ack on scan |
| QR success → payment step | QR end | Modal open | High | Lock animation + timed dismiss |
| Socket reconnect | Background | Hidden | OK | Tier D |
| Trust invite pending | Trust | Until poll/socket | Medium | Subtle status motion |
| Rating modal appear | Complete | Open | Low | Soft presence motion |
| Logout | Logout | Instant | Low | Optional release gesture |

### Intentional silence (preserve)

- Background location / poll  
- Chat typing (no tap sound per key)  
- Map driving mode  
- Silent mode: sound off but **haptic + motion remain** on Tier A  

---

## 2. Dead UI Map

*“Kullanıcı bastı ama uygulama yaşamıyor.”*

| Screen / control | Interaction | Current feedback | Problem |
|------------------|-------------|------------------|---------|
| Most `TouchableOpacity` in `index.tsx` | Tap | `playTapSound()` = **{}** | No sound, often no haptic |
| Map controls | Tap | Haptic only on some | Inconsistent |
| Back buttons | Tap | Silent no-op | Dead |
| Offer list items (passenger) | Tap | Often silent | Dead |
| Driver request cards | Tap | Visual only | Needs relay motion |
| Settings rows | Tap | Silent | Acceptable Tier C |
| Chat send (some paths) | Tap | Haptic in places | OK |
| Share ride | Tap | Silent no-op | Dead |
| QR modal close | Tap | None | OK for dismiss |
| **Role continue** | CTA | `playUiTapSound` + haptic | **Alive** — reference pattern |
| **Price offer send** | CTA | ui tap + haptic on warn path | Partial |
| SoundButton (legacy) | Tap | Mixkit URI | Off-brand, not LSX |

**Root cause:** No global LSX policy; only scattered CTAs wired. Majority taps = visual state only at 60 fps with zero sensory confirm.

**LSX rule:** Tier B minimum = `motion.click.press` + `haptic.light` within 16 ms. Sound optional at 0.40 vol.

---

## 3. Silence vs Aliveness

| Strategy | Wrong | Right |
|----------|-------|-------|
| Fix waiting | Add ticking sound | Slow breathe motion + copy |
| Fix boot | Long logo sting 2 s | 220 ms presence + pulse |
| Fix every tap | Full sound | Motion + light haptic |
| Fix driver QR | Louder passenger sound | **Remote ack on driver device** |

---

## 4. Measurement (future)

- Session replay: time from tap to first sensory channel (target ≤32 ms)  
- Driver boarding: time from passenger verify to driver sensory (target ≤200 ms via socket)  

---

## 5. Cross-Reference

- Heat map: `LSX_HEATMAP.md`  
- Confirmation: `LSX_REMOTE_CONFIRMATION.md`  
- Product summary: `LSX_PRODUCT_GUIDE.md`
