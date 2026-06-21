# 04 — Background Guide

**Sprint:** BRAND-LOGO-EVO-2A  
**Rule:** Saf siyah kullanma — **premium soft black**

---

## Token palette

| Token | Hex | RGB | Use |
|-------|-----|-----|-----|
| `bg.premium.soft` | **#08111F** | 8, 17, 31 | Primary — login, splash, icon BG |
| `bg.premium.softAlt` | **#0B1220** | 11, 18, 32 | Preview C; splash gradient mid |
| `bg.premium.deep` | `#0D1117` | 13, 17, 23 | Brand genom unify (future) |
| **Avoid** | `#000000` | 0, 0, 0 | Harsh; wireframe icons only (legacy) |

---

## Why not pure black

| Issue | Pure `#000` | Soft black |
|-------|-------------|------------|
| OLED crush | Logo glow bleeds harsh | Controlled contrast |
| Premium read | “Cheap app / template” | Cockpit navy — brand DNA |
| Login continuity | JS auth uses `#08111F` family | Seamless splash → login |
| Icon mask | Adaptive OEM clips hard edge | Softer vignette optional |

---

## V2 background application

| Preview | Background |
|---------|------------|
| A, B | Flat `#08111F` full bleed @1024 |
| C | Radial soft vignette: center `#0B1220` → edge `#08111F` (+3/+4/+6 RGB delta) |

**Login/splash:** Evolution PNG may embed soft black OR sit on existing screen gradient — both valid; **do not** return to pure black PNG matte.

---

## Surface mapping (future production)

| Surface | Background token |
|---------|------------------|
| App icon adaptive BG | `#08111F` (`app.json` + `colors.xml`) |
| Splash native | `#08111F` |
| Login screen | UI gradient; logo `contain` on same family |
| iOS icon full-bleed | `#08111F` baked in PNG |

---

## White / dark theme

OS launcher + login premium auth = **dark soft black**. In-app white theme **does not** change logo background token — same PNG on light screens uses transparent/black surround in `contain` mode.
