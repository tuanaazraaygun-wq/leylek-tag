# B6-6 — Orphan Cleanup Report

**Sprint:** B6-6 — Orphan Cleanup + Final Brand QA  
**Date:** 2026-06-21  
**Mode:** Production-safe asset cleanup + audit  
**Production code touched:** ❌ None  
**Website touched:** ❌ None

---

## 1. Audit scope

Searched:

- `frontend/assets/images/`
- `frontend/assets/markers/`
- `frontend/components/`, `frontend/app/`, `frontend/lib/mapNavMarkers.ts`
- `website/public/` (read-only audit)
- `design-lab/brand-dna/v4/brand-identity-production/`

Patterns: pin/wireframe, F1 Meridian Wing, crown/maskot B5 v1, `passenger-woman` / `passenger-man`, legacy marker PNGs, orphan logo files.

---

## 2. Removed files (safe — zero `require()` / `app.json` reference)

| File | Size (approx) | Reason |
|------|---------------|--------|
| `frontend/assets/images/login-brand.png` | unused | No TS/TSX `require()` in repo |
| `frontend/assets/images/icon.png` | 18.5 KB | Orphan — `app.json` uses `leylek-logo-premium.png` / `ios.premium.logo.png` |
| `frontend/assets/images/adaptive-icon.png` | 18.5 KB | Orphan — `app.json` uses `adaptive-icon-foreground.png` only |

**Backup:** `frontend/assets/images/_backup-pre-b6-6/` (3 files above)

**Temp export dirs removed (if present):** `_export-tmp-b6-2`, `_export-tmp-b6-3`, `_export-tmp-b6-4` under `frontend/assets/images/`

---

## 3. Kept — candidate (still referenced or uncertain)

| Asset / artifact | Status | Action |
|------------------|--------|--------|
| `frontend/components/Logo.tsx` | **Candidate** | Zero imports; uses B5.2 `leylek-logo-premium.png` — delete or wire in B6-7+ |
| `frontend/assets/images/leylek-header.png` | **Candidate** | Live in `LeylekMuhabbetiFaz1Screen.tsx` — legacy muhabbet art; migrate to B5.2 in B6-7b |
| `frontend/assets/images/leylek-blue.png` | **Candidate** | Live in `LeylekMuhabbetiHomeTab.tsx` — legacy hero art; migrate in B6-7b |
| `website/public/logo-leylek.svg` | **Candidate** | Pin/wireframe family B — archive when website nav audit runs (no code change in B6-6) |
| `frontend/assets/images/_backup-pre-b6-*` | **Keep** | Rollback folders (B6-2…B6-6) — one release cycle |
| `frontend/assets/markers/_backup-pre-b6-5/` | **Keep** | Marker rollback |
| `frontend/android/app/src/main/res/_backup-pre-b6-*` | **Keep** | Native splash/icon rollback |
| `NAV_MARKER_IMG` keys (pickup…searching) | **Candidate** | Assets exported B6-5; consumers still Ionicons/`mapMarkerChrome` — wiring deferred |
| `mapMarkerChrome.tsx` glow `#22D3EE` | **Candidate** | Constitution `#00D4AA` — B6-5b or post-freeze |
| `DriverOfferScreen` field markers | **Candidate** | System B (Ionicons/circles) — out of B6-5 scope |
| F1 Meridian Wing SVGs | **Keep in design-lab only** | `design-lab/.../exports/f1-*` — never production; forbidden ship path |

---

## 4. References audit — cleared

| Pattern | Frontend production | Result |
|---------|---------------------|--------|
| `passenger-woman.png` / `passenger-man.png` | `mapNavMarkers.ts`, assets | ✅ **Clear** — `passenger-neutral.png` only |
| F1 Meridian Wing | frontend/ | ✅ **None** |
| Crown/maskot B5 v1 filenames | frontend/ | ✅ **None** |
| Pin/wireframe in app icon/splash/mipmap | post B6-2/3 | ✅ **Replaced** with B5.2 exports |
| Gendered marker API | `getPassengerMarkerImage()` | ✅ Params deprecated, ignored |

---

## 5. References audit — remaining drift

| Surface | Drift | Severity |
|---------|-------|----------|
| Muhabbet `leylek-header.png` / `leylek-blue.png` | Pre-B5 illustration family | P2 |
| `Logo.tsx` dead component | Maintenance noise | P3 |
| Website `logo-leylek.svg` | Unused pin SVG on disk | P2 (website scope) |
| Pickup/destination map chrome | Ionicons not B5.2 PNG | P2 |
| LSX / theme flags | OFF — unchanged | OK |

---

## 6. Production behaviour

**Unchanged.** Only orphan PNG files removed; no component, navigation, or logic edits.

---

## 7. Rollback (orphan cleanup)

```powershell
Copy-Item "frontend/assets/images/_backup-pre-b6-6/*" "frontend/assets/images/" -Force
```

---

**Sprint B6-6 orphan cleanup:** ✅ **COMPLETE** (safe tier)
