# Settings Theme Storage

**Sprint:** B3-5 — Storage policy analysis

---

## Current keys (production)

| Key | Scope | Values | Writer |
|-----|-------|--------|--------|
| `lh_theme_mode_v1` | **Device** | `dark` \| `light` \| `system` | ThemeProvider.setTheme |
| `lh_theme_resolved_v1` | Device cache | `dark` \| `light` | ThemeProvider hydrate/persist |
| `lh_theme_choice_done_{userId}` | **Per user** | `true` | Theme Choice complete |
| `lh_theme_choice_done_local` | Fallback | `true` | Theme Choice (no userId) |

**Module:** `frontend/lib/theme/themeStorage.ts`

---

## Device vs user policy

### Today (B3-2–4)

| Data | Scope | Implication |
|------|-------|-------------|
| Theme **mode** | Device | User A logout → User B login → B sees A's theme mode |
| Choice **done** | User | User B first login still skips theme choice if B's done flag set |

### B3-5 recommendation: **Keep device-level mode** (phase 1)

| Reason | Detail |
|--------|--------|
| Simplicity | Single key; matches iOS/Android system settings mental model |
| Offline | No userId required |
| Consistency | Theme Choice already writes `lh_theme_mode_v1` |

### B3-5 optional enhancement (phase 2)

Per-user mode key:

```
lh_theme_mode_v1_{userId}
```

| Event | Action |
|-------|--------|
| Login | Load user key → fallback device key → default dark |
| Settings change | Write user key + device key (mirror) |
| Logout | Device key retains last value |

**Defer to B3-5f** unless multi-account same device is P0 product requirement.

---

## Settings write flow

```
User taps segment (e.g. Gündüz)
    ↓
setTheme('light')
    ↓
setThemeMode('light') → lh_theme_mode_v1
    ↓
resolveThemeMode('light', deviceScheme) → resolved
    ↓
setResolvedThemeCache(resolved) → lh_theme_resolved_v1
    ↓
Context updates → primitives re-render
```

**Settings does NOT write:**
- `lh_theme_choice_done_*` (unchanged)
- `legal_accepted`
- User profile JSON

---

## Theme Choice ↔ Settings sync

| Action | Storage effect |
|--------|----------------|
| First-run Theme Choice CTA | `setTheme(mode)` + `markThemeChoiceDone(userId)` |
| Settings segment change | `setTheme(mode)` only |
| Settings after choice | Same `lh_theme_mode_v1` — **automatic sync** |

**Conflict:** None — single SSOT key.

---

## Offline behavior

| Scenario | Behavior |
|----------|----------|
| Airplane mode + settings change | AsyncStorage local write succeeds |
| Storage read fail on hydrate | Default dark (120ms timeout) |
| Corrupt mode value | normalize → dark |

Cloud sync not required for offline-first mobile UX.

---

## Future cloud sync (B3-5+ / B3-6)

### Backend (not exists today)

```sql
-- proposed
users.ui_theme_mode text CHECK (ui_theme_mode IN ('dark','light','system'))
users.ui_theme_updated_at timestamptz
```

### API

```
GET  /user/preferences
PATCH /user/preferences { ui_theme_mode: 'system' }
```

### Merge policy

| Source | Rule |
|--------|------|
| Local newer | Keep local; queue PATCH |
| Remote newer (login) | Pull remote → setTheme |
| Tie | Prefer local |

**Phase:** After B3-5 settings UI stable; flag `FEATURE_THEME_CLOUD_SYNC`.

---

## Logout / login

| Event | Theme behavior |
|-------|----------------|
| Logout | Mode persists on device; no clear |
| Login same device | Hydrate reads `lh_theme_mode_v1` |
| Login new account | Same device mode until user changes in settings |
| Re-install | Default dark; theme choice shows if choice flag ON |

---

## Migration

| User state | B3-5 deploy |
|------------|-------------|
| No keys | dark default |
| Existing B3-2+ users | mode key preserved |
| choice_done set | Theme choice skipped; settings reflects stored mode |

No migration script required.

---

**Related:** `THEME_SYNC_FLOW.md`, `SETTINGS_THEME_ARCHITECTURE.md`
