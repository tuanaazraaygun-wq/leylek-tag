# V7.2 — Competitor Comparison

**Team:** BRAVO  
**Scope:** Map marker + navigation readability vs global benchmarks  
**Method:** B5.6 jury · V6 MEX · competitive UX patterns · production evidence

---

## 1. Comparison framework

| Criterion | Weight @ 90 km/h |
|-----------|------------------|
| Form discrimination (car/type/dest) | Critical |
| Glance time ≤0.5s | Critical |
| Map tile independence | High |
| Brand without clutter | Medium |
| Light theme / satellite | High |

---

## 2. Google Maps

| Aspect | Google Maps | LeylekTAG production | LeylekTAG MEX target |
|--------|-------------|----------------------|----------------------|
| Pin grammar | Universal red/green pins · high training | Ionicons + PNG mix | Unified MEX family |
| Vehicle | Blue dot / arrow | PNG car/motor circles | Wedge + width ratio |
| Route | Blue/red polyline | `#22D3EE` cyan | `#00D4AA` + outline |
| @ z16 | Decades of user training | **Fails car/motor** | Must exceed via form |
| Brand | Low brand · high utility | Low utility · low brand | Instrument brand |

**Verdict:** Google wins **default recognition** via platform training. LeylekTAG cannot win copying Google pins — must win **Branded instrument clarity** (Mercedes nav analogy, B5.6).

---

## 3. Apple Maps

| Aspect | Apple Maps | LeylekTAG |
|--------|------------|-----------|
| Aesthetic | Minimal pins · subtle shadow | Glow-heavy circles |
| Light mode | Excellent edge discipline | Glow wash FAIL |
| Night | Restrained | Over-glow risk |
| Vehicle | Clean arrow | Split pointer/PNG dialect |

**Verdict:** Apple wins **light theme + restraint**. MEX must adopt **stroke-first** Apple discipline with LeylekTAG cyan.

---

## 4. Uber

| Aspect | Uber | LeylekTAG production |
|--------|------|----------------------|
| Vehicle | Simple car glyph · high contrast | Circular badges — similar **2018 Uber glow era** |
| Pickup | Green circle | Cyan/green Ionicons — **adjacent aesthetic** |
| Destination | Square/black pin | Flag Ionicons |
| Brand | Global training | **Generic Turkish startup cluster** (jury) |
| @ speed | Proven @ millions of trips | **Unproven** — jury FAIL |

**Verdict:** Production **resembles outdated Uber** (B5.6 five-year risk). MEX must **escape glow-blob** grammar.

---

## 5. Bolt

| Aspect | Bolt | LeylekTAG |
|--------|------|-----------|
| Marker | Green circle + white icon | Cyan circles — similar read |
| Simplicity | Extreme | Attempted but **inconsistent dialects** |
| Discrimination | Car icon inside circle | Car/motor **merge** — Bolt-simple but Bolt-fails discrimination |

**Verdict:** Bolt wins **single-language simplicity**. LeylekTAG must match simplicity **and** fix car/motor ratio.

---

## 6. Lyft

| Aspect | Lyft | LeylekTAG |
|--------|------|-----------|
| Playful markers | Pink mustache era | Premium calm — different positioning |
| Readability | Friendly blobs | Premium instrument target |
| Map | Consumer casual | Highway trust required |

**Verdict:** Different segment — LeylekTAG should **not** copy Lyft playfulness.

---

## 7. Tesla Navigation

| Aspect | Tesla | LeylekTAG |
|--------|-------|-----------|
| Vehicle | Minimal chevron on map | Heavy PNG badges |
| UI | Monochrome + red line | Cyan glow stack |
| Speed | Optimized @ highway | **Fails @ highway zoom** |
| Brand | Vehicle brand | Mobility platform |

**Verdict:** Tesla wins **HUD minimalism @ speed**. LeylekTAG markers too heavy for z15 — simplify LOD.

---

## 8. BlaBlaCar

| Aspect | BlaBlaCar | LeylekTAG |
|--------|-----------|-----------|
| Map usage | Lighter — trip matching | Heavy live map |
| Markers | Simple avatars/pins | Over-engineered PNG pack partially unused |
| Trust | Community faces | Trust ring spec — **not on map** |

**Verdict:** BlaBlaCar less map-dependent. LeylekTAG map **must be best-in-class** for ride ops — higher bar.

---

## 9. Grab / regional premium (jury reference)

B5.6: Production **below Grab craft** internationally (4/10).

| Gap | Fix |
|-----|-----|
| Shared chassis | MEX-M arc foot |
| Device proof | z16 video |
| No Ionicons field | Unified SVG |

---

## 10. Score summary

| System | Map composite (B5.6) | Speed test | Brand uniqueness |
|--------|------------------------|------------|------------------|
| LeylekTAG production | **43 FAIL** | **FAIL** | 3/10 |
| LeylekTAG MEX design | **96 target** | PASS projected | 96 target |
| Google Maps (utility) | N/A | PASS (training) | Low |
| Uber (2018 glow) | N/A | PASS (historical) | Medium |
| Apple Maps | N/A | PASS | Medium |

---

## 11. What LeylekTAG can win

| Win zone | Strategy |
|----------|----------|
| Branded highway instrument | Arc foot + wedge + meridian cyan |
| Trust on map | Warm ring native to pin |
| QM visibility | Lock ring — competitors hide in UI |
| Turkish premium positioning | Calm form · not playful |

| Cannot win | Reason |
|------------|--------|
| Generic pin familiarity | Don't fight Google training |
| Glow aesthetics alone | Uber 2018 — outdated |

---

## 12. Competitive requirement for ship

**G2-1:** z16 @0.4s must match or beat **Uber driver discrimination** without copying Uber grammar.

**G4 composite ≥95** — map lane currently **43**.

---

**Competitor comparison — COMPLETE**
