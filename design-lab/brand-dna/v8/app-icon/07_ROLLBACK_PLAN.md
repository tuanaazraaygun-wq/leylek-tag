# BRAND-APPICON-1C — Rollback Plan

**Sprint:** BRAND-APPICON-1C-AUDIT  
**Mode:** Read-only analysis  
**Scope:** Revert launcher icon swap (Family A′ R6) back to wireframe Family B

---

## When to rollback

- AC-02 fail: wireframe gone but new icon unreadable @48px
- AND-02 / AND-03 fail: beak/wing clipped on reference devices
- Unexpected prebuild damage to unrelated native files
- Product rejects R6 after APK review

---

## Pre-swap backup (mandatory before 1C execute)

Create timestamp folder **`YYYYMMDD`** = swap date.

### Assets backup

```text
frontend/assets/images/_backup-pre-appicon-YYYYMMDD/
  adaptive-icon-foreground.png    ← current wireframe B
frontend/assets/_backup-pre-appicon-YYYYMMDD/
  ios.premium.logo.png            ← current wireframe B (note: lives in assets/ root)
```

**Commands (execute phase — not run in audit):**

```powershell
$ts = Get-Date -Format "yyyyMMdd"
New-Item -ItemType Directory -Force -Path "frontend/assets/images/_backup-pre-appicon-$ts"
Copy-Item "frontend/assets/images/adaptive-icon-foreground.png" "frontend/assets/images/_backup-pre-appicon-$ts/"
New-Item -ItemType Directory -Force -Path "frontend/assets/_backup-pre-appicon-$ts"
Copy-Item "frontend/assets/ios.premium.logo.png" "frontend/assets/_backup-pre-appicon-$ts/"
```

### Native Android backup

```text
frontend/android/app/src/main/res/_backup-pre-appicon-YYYYMMDD/
  mipmap-mdpi/ic_launcher.png
  mipmap-mdpi/ic_launcher_foreground.png
  mipmap-mdpi/ic_launcher_round.png
  … (repeat all 5 densities)
  mipmap-anydpi-v26/ic_launcher.xml
  mipmap-anydpi-v26/ic_launcher_round.xml
```

**Existing legacy archive (reference only):**

- `frontend/android/app/src/main/res/_backup-pre-b6-3/mipmap-*` — older wireframe generation
- `frontend/assets/images/_backup-pre-b6-3/adaptive-icon-foreground.png`

Prefer **fresh** `_backup-pre-appicon-*` mirroring **current HEAD** at swap time.

### Git metadata

Record in PR / commit message:

- Pre-swap commit SHA: `git rev-parse HEAD`
- Swap commit SHA after 1C execute

One-command revert option: `git revert <swap-commit-sha>` if no later commits touch same files.

---

## Rollback procedure

### Step 1 — Restore Expo source assets

```powershell
$ts = "YYYYMMDD"   # backup folder date
Copy-Item "frontend/assets/images/_backup-pre-appicon-$ts/adaptive-icon-foreground.png" `
          "frontend/assets/images/adaptive-icon-foreground.png" -Force
Copy-Item "frontend/assets/_backup-pre-appicon-$ts/ios.premium.logo.png" `
          "frontend/assets/ios.premium.logo.png" -Force
```

### Step 2 — Restore native mipmaps

**Option A — from backup (fastest):**

```powershell
$res = "frontend/android/app/src/main/res"
$bak = "$res/_backup-pre-appicon-$ts"
foreach ($d in @("mdpi","hdpi","xhdpi","xxhdpi","xxxhdpi")) {
  Copy-Item "$bak/mipmap-$d/*" "$res/mipmap-$d/" -Force
}
Copy-Item "$bak/mipmap-anydpi-v26/*" "$res/mipmap-anydpi-v26/" -Force
```

**Option B — regenerate from restored assets:**

```bash
cd frontend
npx expo prebuild --platform android
```

Review diff; commit restored `mipmap-*` only.

### Step 3 — Verify config unchanged

Rollback **does not require** `app.json` changes if paths stayed:

- `adaptiveIcon.foregroundImage` → same path
- `backgroundColor` → `#08111F` (unchanged)
- `ios.icon` → same path

`colors.xml` `iconBackground` — no change needed.

### Step 4 — Rebuild and verify

```bash
cd frontend
eas build --profile preview --platform android
```

Install APK → launcher should show **wireframe B** (known prior state).

### Step 5 — iOS rollback

Restored `ios.premium.logo.png` from backup → rebuild TestFlight / local iOS.

---

## Rollback does NOT affect

| Surface | Asset | After rollback |
|---------|-------|----------------|
| Login | `leylek-logo-premium.png` | Unchanged (Family A) |
| JS splash | `leylek-logo-premium.png` | Unchanged |
| Notifications | `leylek-logo-premium.png` | Unchanged |
| Native splash drawables | `splashscreen_logo.png` | Unchanged unless prebuild touched them |

---

## Partial rollback scenarios

| Scenario | Action |
|----------|--------|
| Android bad, iOS OK | Restore Android assets + mipmaps only |
| iOS bad, Android OK | Restore `ios.premium.logo.png` only |
| Prebuild corrupted unrelated files | `git checkout HEAD -- frontend/android/` selective paths from backup commit |
| Only FG wrong, legacy OK | Restore `ic_launcher_foreground.png` across densities |

---

## Risk notes

| Risk | Mitigation |
|------|------------|
| `git add .` accidentally stages lab PNGs | Use explicit path list from `06_EXPORT_FILE_MAP.md` |
| Backup not committed | Store backup folder in same PR as swap OR document SHA for revert |
| prebuild overwrites splash | Diff review; restore `drawable-*/splashscreen_logo.png` from backup if changed |
| Play Store already shipped | Rollback requires new store submission with reverted assets |

---

## Verification after rollback

| Check | Expected |
|-------|----------|
| Launcher icon | Wireframe white bird + teal U-arc |
| Login logo | Premium 3D bird (unchanged) |
| `app.json` diff | Empty |
| Git status | Only asset/mipmap paths |

---

## Sign-off

| Role | Confirms |
|------|----------|
| Engineering | Backup exists + revert tested once on dev machine |
| QA | Post-rollback APK screenshot attached |

**BRAND-APPICON-1C ROLLBACK PLAN COMPLETE.**
