# V7.2 — Real-World Visibility

**Team:** BRAVO  
**Scope:** Dark/light theme · driving speeds · weather/map types · contrast/glow/stroke  
**Sources:** V6 `10_USER_TEST_RESULTS.md` · B5.6 marker jury · production tokens · `useLiveMapChromeTheme`

---

## 1. Test matrix summary

| Condition | Production result | Primary failure mode |
|-----------|-------------------|-------------------|
| **Dark mode (default)** | Conditional PASS | Wrong glow hue · weak form |
| **White / light theme** | FAIL | Glow washes · no edge boost |
| **Sunlight 1000 nit** | FAIL (T8) | Glow-only readability |
| **Night driving** | Conditional | Acceptable on dark tiles |
| **Rain map** | Not tested | Assumed: glow bloom |
| **Satellite** | FAIL | No route/marker outline |
| **Terrain** | Not tested | Low contrast risk |
| **Traffic overlay** | Partial | Route colors ignore amber spec |
| **90 km/h @0.4s** | **FAIL** (T5) | Car/motor merge |
| **50 km/h @1s** | Marginal | Generic read |
| **30 km/h @2s** | PASS generic | Not brand |
| **Standing still** | PASS | Misleading — not design gate |
| **Deuteranopia** | FAIL (T7) | Hue-only field pins |
| **Low brightness 15% OLED** | Conditional (T9) | Silhouette weak |

---

## 2. Dark mode (production default)

### Visibility

| Element | Assessment |
|---------|------------|
| Entity PNG on `#0D1117` tiles | **Visible** — white/cyan on dark |
| Glow `#22D3EE` | Visible but **off-brand** |
| Ionicons pickup | High contrast cyan/green |
| Destination flag | Visible — pole dark on dark map OK |
| Route line | Bright cyan line — visible |

### Contrast

| Pair | Est. ratio | WCAG for UI chrome |
|------|------------|-------------------|
| Marker edge white on slate body | ~8:1 on glyph | ✅ |
| Glow on map tiles | Variable | Not counted — decorative |
| Price chip text | Theme tokens | ✅ |

### Glow

| Issue | Detail |
|-------|--------|
| Glow substitutes for form | At z16 car/motor identical circles with glow |
| Max opacity | Up to ~45% on pickup Ionicons — exceeds MEX 22% cap |
| Shadow | Ellipse shadow under PNG — helps separation ✅ |

### Stroke

| Issue | Detail |
|-------|--------|
| Constitution 2px min | Motor windows ~1px effective @30px |
| Arc foot stroke | **Absent** |

**Verdict dark:** Usable for stationary/slow — **fails speed + brand gates**.

---

## 3. White theme / light map

### Journey theme scopes

`useLiveMapChromeTheme` — light when journey **or** map scope light (`useJourneyTheme.ts`).

| Element | Light theme risk |
|---------|------------------|
| `MapEntityMarkerImage` glow | `#22D3EE` @12% on `#E8ECF0` tiles — **low contrast** |
| White marker edges | Body merges with light tiles |
| Ionicons pickup cyan | Better than PNG glow |
| Flag pin | Dark pole helps |

### Spec adjustment (MEX)

| Adjustment | Value |
|------------|-------|
| Edge stroke | 2.5px |
| Glow opacity | −30% |
| Body | `#1A2332` 100% — no transparency |

**Production:** No marker-specific light theme ladder — **FAIL** (V6 T4 projected pass only after MEX).

---

## 4. Driving test (speed × exposure)

| Speed | Typical zoom | Exposure | Car vs motor | Pickup vs dest | Brand read |
|-------|--------------|----------|--------------|----------------|------------|
| **90 km/h** | ~14.8–15.5 | 0.4s | **FAIL** | N/A field | Generic |
| **50 km/h** | ~16–17 | ~0.6s | Marginal | Conditional | Generic |
| **30 km/h** | ~17–18 | ~1s | Pass | Pass | Generic |
| **Standing** | ~18–19 | 2s+ | Pass | Pass | Weak brand |

**Evidence:** B5.6 map test narrative · `zoomTargetForSpeedMps` couples high speed to low zoom.

### Driver cognitive load

| Factor | Production |
|--------|------------|
| Dialect switching Offer→Journey | Ionicons field → PNG journey — **re-learning cost** |
| Pointer + PNG | Two cyan systems |
| Trusted chip + markers | UI clutter over map |

---

## 5. Weather & map type

### Sunlight (T8 FAIL)

| Mechanism | Effect |
|-----------|--------|
| Screen 1000 nit | Glow halos wash out |
| Map tiles bright | `#22D3EE` line competes with sky/water |
| Fix | Edge stroke + reduced glow (MEX) |

### Night

| Mechanism | Effect |
|-----------|--------|
| Dark tiles | Production strongest environment |
| OLED black | Glow visible — can mislead as "premium" |

### Rain (map style)

| Risk | Glow bloom on wet UI reflections |
|------|----------------------------------|
| Mitigation | Form-first markers · no reliance on halo |

### Satellite

| Production | Markers lack dark halo outline |
|------------|-------------------------------|
| Route | `#22D3EE` without `#0D1117` outline — edge loss |
| MEX | +1px dark halo on all markers + route |

### Terrain

| Risk | Green/brown tiles vs cyan glow |
|------|--------------------------------|
| Status | Untested — assume conditional fail |

### Traffic overlay

| Spec | Amber `#FFB020` @25% on route — not on markers |
|------|--------------------------------------------------|
| Production | Traffic level enum exists — marker colors unchanged ✅ |

---

## 6. Glow vs stroke discipline

| Approach | Production | MEX |
|----------|------------|-----|
| Primary readability | Glow `#22D3EE` | 2px stroke + silhouette |
| Secondary | PNG silhouette | Arc foot |
| Tertiary | Shadow ellipse | Optional 1px shadow |
| Max glow | ~45% pickup | 22% `#00D4AA` |

**Jury label:** "Glow doing work geometry should do" — `03_MARKER_JURY.md`.

---

## 7. Field conditions checklist (pre ship)

| ID | Test | Pass criteria |
|----|------|---------------|
| V-B1 | Dark z16 @0.4s 90km/h | 90% car≠motor |
| V-B2 | Light tiles z17 | Markers ≥4.5:1 edge |
| V-B3 | Satellite z16 | Outline visible |
| V-B4 | Sunlight photo | Form readable |
| V-B5 | Deuteranopia sim | Pickup≠dest without hue |
| V-B6 | Rain drive video | No glow confusion |
| V-B7 | Night highway | No glare halo |

**Status:** All **NOT RUN** — ECHO V7b field sprint.

---

## 8. Production vs MEX visibility scores

| Dimension | Production (B5.6) | MEX design (V6) |
|-----------|-------------------|-----------------|
| Map visibility | 4/10 | 98 target |
| Small-size @ z16 | 4/10 | 96 |
| Accessibility | 55 ecosystem | 95 projected |

---

**Real-world visibility analysis — COMPLETE**
