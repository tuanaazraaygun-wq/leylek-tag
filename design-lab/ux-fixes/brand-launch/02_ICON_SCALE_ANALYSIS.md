# 02 — Launcher Icon Scale & Safe-Zone Analysis

**Sprint:** BRAND-LAUNCH-2A (read-only)  
**Finding:** APK launcher icon appears large, misshapen, not premium.

---

## Android adaptive icon mechanics

| Layer | Source | Color |
|-------|--------|-------|
| Background | `@color/iconBackground` → `#08111F` | Solid navy |
| Foreground | `@mipmap/ic_launcher_foreground` | From `adaptive-icon-foreground.png` |

Wrapper: `mipmap-anydpi-v26/ic_launcher.xml`

**System mask:** Circle, squircle, or rounded square (OEM-dependent). Only the **center ~66%** (“safe zone”) of the 108×108 dp foreground is guaranteed visible; outer 33% may be clipped.

Expo / Google guidance for a 1024×1024 master:

- Full canvas = 1024 px  
- Safe zone diameter ≈ **682 px** (66%)  
- Logo artwork should fit inside safe zone with **transparent padding** outside  
- Foreground PNG should **not** include opaque background (use `backgroundColor` in manifest instead)

---

## Current foreground asset (`adaptive-icon-foreground.png`)

**Visual inspection (repo):**

- Premium metallic stork + ring — **same family as login** (Family A), not old wireframe.
- **Opaque black/navy fills entire 1024 canvas** — not RGBA transparent.
- Stork + ring extend **near canvas edges**; ring brush fragments reach outer margin.
- Thin leg, beak tip, ring splinters sit in **mask clip zone**.

**Why it looks “big” on device:**

1. **Double background** — baked black in FG + `#08111F` adaptive BG → icon reads as a dark blob filling the mask.
2. **No inset padding** — artwork scaled to full canvas; after mask, only center mass remains → stork feels zoomed/cropped.
3. **Non-uniform silhouette** — ring is wider than tall at bottom; circular mask cuts ring asymmetrically → “biçimsiz”.
4. **Legacy mipmaps** — `ic_launcher.png` / `ic_launcher_round.png` are flattened composites; may amplify clipping at mdpi/hdpi.

---

## iOS icon (`ios.premium.logo.png`)

- Same premium stork on dark navy (not pure black).
- iOS applies its own corner radius; full-bleed artwork still risks corner clip.
- Separate from Android adaptive but **same safe-zone issue** if symbol fills frame.

---

## `expo.icon` vs adaptive

`app.json`:

```json
"icon": "./assets/images/leylek-logo-premium.png",
"android": {
  "adaptiveIcon": {
    "foregroundImage": "./assets/images/adaptive-icon-foreground.png",
    "backgroundColor": "#08111F"
  }
}
```

When `adaptiveIcon` is set, **Android home screen does not use `expo.icon`**. Login/splash PNG ≠ launcher PNG path — users correctly perceive launcher as a different treatment even when same bird motif.

---

## Notification icon (related, not launcher)

`plugins.expo-notifications.icon` → `leylek-logo-premium.png`

- Full-color premium PNG is **wrong shape** for Android status-bar monochrome silhouette rules.
- May render soft/busy at 24dp — separate from launcher bug but same “not premium at small size” class.

---

## Recommended safe-zone targets (production patch)

| Platform | Master size | Symbol box | Padding |
|----------|-------------|------------|---------|
| Android adaptive FG | 1024×1024 RGBA | ~660×660 px centered | Transparent outside; **no** `#08111F` in FG layer |
| iOS app icon | 1024×1024 | ~820×820 (Apple ~80% guidance) | Dark navy optional in file OR separate |
| Legacy mipmaps | Generated | From prebuild | Do not hand-edit |

**Optical center:** Shift symbol **+4 to +6 px down** (design-lab B5.3 notes) so squircle mask feels centered.

**Do not change:** mask geometry, `ic_launcher.xml` structure, package name, activity theme.

---

## Regeneration path

1. Export new **RGBA** foreground from existing premium master (evolve, don’t replace brand).
2. Replace `frontend/assets/images/adaptive-icon-foreground.png`.
3. Run `npx expo prebuild --platform android` (or EAS) to refresh `mipmap-*/ic_launcher_*`.
4. Verify on API 26+ circle and API 33+ themed icon if enabled.

---

## Verification checklist (post-patch)

- [ ] Launcher at 48dp: stork leg + beak not clipped
- [ ] Circle vs squircle OEM skins: ring symmetric
- [ ] FG file has alpha channel; checkerboard visible in design tool
- [ ] Side-by-side: launcher vs login logo — same family, different scale OK
- [ ] No regression on `#08111F` home-screen background harmony

---

## Key references

| Topic | Path |
|-------|------|
| Adaptive config | `frontend/app.json` L41–44 |
| FG source | `frontend/assets/images/adaptive-icon-foreground.png` |
| Native FG | `frontend/android/app/src/main/res/mipmap-*/ic_launcher_foreground.png` |
| XML wrapper | `frontend/android/app/src/main/res/mipmap-anydpi-v26/ic_launcher.xml` |
| Production audit | `design-lab/brand-dna/v8/app-icon/05_PRODUCTION_SWAP_AUDIT.md` |
| Spec safe zone | `design-lab/brand-dna/v4/brand-identity-production/02_LOGO_EVOLUTION_PRODUCTION_SPEC.md` |
