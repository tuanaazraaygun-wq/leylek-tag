# V7 — Product Language

**Name:** Meridian Operative  
**Version:** MEX v1.0  
**One sentence:** *A premium stork guides you forward inside a cyan orbital field — calm, precise, trustworthy.*

---

## Grammar primitives

| Primitive | Visual | Sonic | Haptic | Motion |
|-----------|--------|-------|--------|--------|
| **Presence** | Logo / eye dot | A3 boot | T0 | presence.pulse |
| **Forward** | Beak / route / wedge | E4 fifth | — | ingress |
| **Orbit** | Arc / ring / foot | A3 body | P2 | breathe / pulse |
| **Lock** | Ring close | A4 tick | P4 | lock.snap |
| **Resolve** | Check / match | C♯ third | P6 | checkDraw |
| **Caution** | Amber segment | warn pair | T5 | nudge |

---

## Color (in-product only)

| Token | Hex | Use |
|-------|-----|-----|
| `meridian.cyan` | `#00D4AA` | Primary brand · route · glow |
| `depth.field` | `#0D1117` | App chrome · splash |
| `depth.slate` | `#1A2332` | Marker body · cards |
| `trust.white` | `#F5F7FA` | Text · edges |
| `warm.resolve` | `#C8E6D0` | Trust overlay only |
| `amber.alert` | `#FFB020` | Error/warn only |

**Retired:** `#22D3EE` everywhere.

---

## Typography

| Role | Face | Notes |
|------|------|-------|
| UI | System default | SF Pro / Roboto |
| Brand wordmark | Custom lockup — **not** on map chrome | Login, store |
| Nav numbers | Tabular figures | ETA chips |

---

## Spacing & touch

| Rule | Value |
|------|-------|
| Min touch target | 48×48 pt |
| Map marker hit | 44×44 invisible |
| Card padding | 16 / 20 |
| Safe area | Respect notch — splash LC-2 optical center |

---

## Brand surfaces (in-product)

| Surface | MEX element | Mockup |
|---------|-------------|--------|
| Premium logo | LC-2 + raster hero | splash |
| Wordmark | Login header only | — |
| App icon | LC-2 + cyan arc | android/iphone home |
| Adaptive | 66% safe foreground | play-store |
| Favicon | LC-3 eye+arc | — |
| Splash | presence.pulse | splash-in-phone |
| Launcher | Same as icon | home screens |
| Notification | LC-3 micro | notification |
| Widget | State + ETA | widget |

---

## Recognition stack (200ms)

```
0ms    touch/notification
16ms   motion start
32ms   haptic (if Tier A/B)
80ms   sonic phase 1 (if Tier A)
200ms  visual commit — user knows "LeylekTAG"
```

---

## What Meridian Operative is NOT

- Not playful mascot  
- Not taxi yellow  
- Not cyberpunk Tron  
- Not generic Material You clone  
- Not glow-without-form  

---

## Cross-reference

| Domain | Doc |
|--------|-----|
| Map | `03_MAP_SYSTEM.md` |
| Nav | `04_NAVIGATION_SYSTEM.md` |
| Sonic | `05_SONIC_SYSTEM.md` |
| Motion | `06_MOTION_SYSTEM.md` |
| Haptic | `07_HAPTIC_SYSTEM.md` |
| Zeka | `08_LEYLEK_ZEKA_SYSTEM.md` |

---

**This document is the constitution for all implementation sprints post-approval.**
