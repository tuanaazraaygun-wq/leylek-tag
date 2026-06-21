# V7.2 — Zoom Behaviour

**Team:** BRAVO  
**Method:** Map zoom level vs display px · B5.5 zoom sheet · V6 map spec · production `MARKER_PIXEL` · camera logic in LiveMapView  
**Display formula (approx):** `markerDisplayPx ≈ artboardPx × (zoomScale / refZoom)` — varies by latitude and device DPI

---

## 1. Zoom reference table

Google Maps zoom levels · typical driving context:

| Zoom | Context | Production camera (LiveMapView) |
|------|---------|--------------------------------|
| **13** | City overview | Rare in nav — offer field possible |
| **14** | District | `zoomTargetForSpeed` @70+ km/h → ~14.8 |
| **15** | Neighborhood | Highway nav ~15.5 |
| **16** | **Critical — car/motor test** | ~16.5 @40 km/h — **B5.6 FAIL zone** |
| **17** | Street | ~17.5 @20 km/h |
| **18** | Street detail | SearchingMapView **maxZoomLevel 18** |
| **19** | Building | Nav slow speed ~18.5 |
| **20** | Max detail | Pickup/dest discrimination test |

**Evidence:** `zoomTargetForSpeedMps` · SearchingMapView `maxZoomLevel={18}`.

---

## 2. Effective marker size by zoom

Assuming 34px car artboard @ z18 baseline:

| Zoom | ~Relative scale | Car ~px | Motor ~px | Passenger ~px | Readability band |
|------|-----------------|---------|-----------|---------------|------------------|
| **13** | 0.25× | ~8 | ~7 | ~8 | **FAIL** — blobs |
| **14** | 0.35× | ~12 | ~10 | ~11 | **FAIL** car/motor |
| **15** | 0.5× | ~17 | ~15 | ~16 | **Marginal** |
| **16** | 0.7× | ~24 | ~21 | ~22 | **Jury test zone** — merge |
| **17** | 0.85× | ~29 | ~25 | ~27 | Conditional |
| **18** | 1.0× | 34 | 30 | 32 | Design target |
| **19** | 1.15× | ~39 | ~34 | ~37 | Good |
| **20** | 1.3× | ~44 | ~39 | ~42 | Good detail |

**Note:** Circular badge container makes car/motor **same visual diameter** at z16 — width ratio inside circle ~1.13× not 1.35× spec.

---

## 3. Per-type zoom behaviour (production)

### Passenger @32px artboard

| Zoom | Visible | Lost |
|------|---------|------|
| 13–14 | White circle blob | Cyan dot · legs |
| 15–16 | Person-ish stick | Arc foot (never existed) |
| 17+ | Full stick figure | — |
| 18+ | Gender-neutral read ✅ | Brand DNA weak |

### Driver car @34px

| Zoom | Visible | Lost |
|------|---------|------|
| 13–15 | Cyan-white circle | Windows · wedge |
| **16** | Rounded rect hint | **Indistinguishable from motor** |
| 17+ | Car-ish rectangle | Front wedge still weak |
| Nav flat rotate | Bearing helps @17+ | @16 rotation insufficient |

### Driver motor @30px

| Zoom | Visible | Lost |
|------|---------|------|
| 13–15 | Circle blob | Wheel detail |
| **16** | Oval + two dots | **Reads as small car** |
| 17+ | Narrower oval | Acceptable |

### Pickup / destination (Ionicons)

| Zoom | Pickup | Destination |
|------|--------|-------------|
| 13–16 | Green/cyan dot | Flag pole merges |
| 17–18 | Navigate icon readable | Flag readable |
| 20 | Good | Good |
| **Issue** | Different component from entity PNG dialect | z18 test **FAIL** vs MK-07/09 |

### Route polyline

| Zoom | Behaviour |
|------|-----------|
| 13–14 | 4px line may sub-pixel — visibility OK (bright color) |
| 16+ | Full path readable |
| Satellite | No outline — edge loss (production) |

---

## 4. Zoom-driven UI in production

| Feature | Zoom-aware? | Evidence |
|---------|-------------|----------|
| DriverOffer field pins | ✅ `mapZoomBand` filters pins | `selectFieldSeekingPinsForZoom` |
| LiveMapView entity scale | ⚠️ Fixed px — no zoom scaling | `MARKER_PIXEL` constants |
| Cluster collapse | ❌ | Not implemented |
| Marker simplify @ low zoom | ❌ | Same PNG all zooms |
| Camera auto zoom by speed | ✅ | `zoomTargetForSpeedMps` |

**Gap:** Markers do not **simplify** at z13–15 — same detail scales down to mud.

---

## 5. MEX zoom strategy (target)

| Zoom band | Strategy |
|-----------|----------|
| **13–15** | Simplified silhouette tier — wedge vs oval **only** · hide passenger legs |
| **16** | **Proof band** — car width ≥1.35× motor @ display |
| **17–18** | Full chassis + arc foot |
| **19–20** | Field pickup vs dest pennant detail |
| **Cluster** | Collapse @≤16 when >2 entities |

### B5.5 test matrix

| Zoom | Test |
|------|------|
| z16 | Car vs motor vs passenger |
| z18 | Pickup vs destination |
| z20 | Trust ring · search pulse |

Sheet: `visual-sketch-lab/sheets/marker-zoom-sheet.svg`

---

## 6. SearchingMapView zoom cap

`maxZoomLevel={18}` — passengers never see z19–20 detail during search phase.

| Impact | Assessment |
|--------|------------|
| Driver discrimination @ search | Limited to z18 max |
| Dest/pickup detail | Capped — acceptable for overview |
| Risk | Car/motor merge still possible @ default fit bounds |

---

## 7. Driving speed ↔ zoom coupling

From `LiveMapView.tsx`:

| Speed | Target zoom |
|-------|-------------|
| <5 km/h | 18.5 |
| <20 km/h | 17.5 |
| <40 km/h | 16.5 |
| <70 km/h | 15.5 |
| ≥70 km/h | 14.8 |

**Critical:** At **90 km/h**, camera near **z14.8–15.5** — markers **smallest** when discrimination hardest.

**Bravo requirement:** Form must read @ z15 · 90 km/h · 0.4s — not @ z18 static lab.

---

## 8. Zoom + collision

| Issue | Production | Spec |
|-------|------------|------|
| Overlapping pins | zIndex only | Collision spacing 44dp minimum tap |
| Price tags on drivers | SearchingMapView glass chip below pin | Adds vertical clutter @ z17 |
| Field seeking density | Zoom band thins pins | ✅ |

---

## 9. Recommendations (pre-production)

1. **Design proof at z15.5 + z16** — not z18 only  
2. **Width-based car/motor** — not circle badge  
3. **LOD export ladder** — simplified PNG/SVG @ z≤15  
4. **Device video suite** — ECHO E-03 z16/z18/z20  
5. **Remove maxZoom cap** or document why 18 is sufficient

---

**Zoom behaviour analysis — COMPLETE**
