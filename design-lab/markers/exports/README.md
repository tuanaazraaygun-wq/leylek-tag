# Marker Exports — README

**Sprint:** B-2 — Patch B2-1  
**Status:** Pipeline placeholder — no exports yet

---

## Naming convention

```
{type}-{theme}-{size}@{scale}.png

Types: passenger | driver-car | driver-motor | destination | pickup | cluster-badge
Themes: dark | light
Sizes: 24 | 32 | 34 | 48
Scale: 1x | 2x | 3x
```

Example: `passenger-dark-32@2x.png`

---

## SVG masters (B-3)

```
exports/svg/
  marker-passenger-master.svg
  marker-driver-car-master.svg
  marker-driver-motor-master.svg
  marker-destination-master.svg
  marker-pickup-master.svg
  overlay-qm-ring.svg
  overlay-trust-ring.svg
```

---

## Lottie (B-6 optional)

```
exports/lottie/
  marker-breathe-idle.json
  overlay-lock-ring-close.json
```

---

## manifest.json

See `GENOM_TOKEN_BRIDGE.md` schema. Updated on each export run.

---

## Non-goals

- Do not commit production-sized assets until B-3 QA pass
- Do not copy F1 logo SVG as marker body

---

**Workflow:** constitution → prompts → drafts → exports
