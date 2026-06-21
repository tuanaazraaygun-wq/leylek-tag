# Genom Tokens — Logo Production (Phase 3)

**Version:** 1.0 — tüm finalistler paylaşır  
**Status:** Spec only — CSS/SVG Phase 4

---

## 1. Canvas & Grid

| Token | Değer |
|-------|-------|
| `genom.canvas.master` | 512 × 512 px |
| `genom.canvas.icon` | 1024 × 1024 px (symbol 512 centered) |
| `genom.grid.base` | 8 px |
| `genom.origin` | (256, 256) |
| `genom.snap` | Tüm koordinatlar integer; 0.5 px yasak |

---

## 2. Stroke Scale

| Master @512 | Export @48 | Formula |
|-------------|------------|---------|
| primary 2.5 px | 2.0 px | `round(2.5 * size/512 * 48/48)` min 1.5 @24 |
| ring 2.0 px | 1.5 px | secondary |
| horizon 2.5 px | 2.0 px | same as primary |

---

## 3. Radius

`genom.radius` = 2–4 px @512 implicit corners; scale proportional.

---

## 4. Color Tokens (Phase 4 fill — spec only)

| ID | Hex | Kullanım |
|----|-----|----------|
| `--logo-accent` | `#00D4AA` | Accent dot, lock peak |
| `--logo-stroke` | `#F5F7FA` | Dark mode symbol |
| `--logo-stroke-light` | `#1A2332` | Light mode symbol |
| `--logo-ground` | `#0D1117` | Icon background |
| `--logo-ring-idle` | `#F5F7FA` @ 60% | Ring stroke idle |
| `--logo-warm` | `#C8E6D0` @ 40% | Match overlay chrome |

**Gradient:** Yasak statik SVG içinde.

---

## 5. Layer ID Registry (master SVG)

| Layer ID | Açıklama | F1 | F2 | F3 |
|----------|----------|----|----|-----|
| `logo.layer.horizon` | Yatay meridian | ✓ | ✓ split | ✓ segment |
| `logo.layer.wing` | Kanat arc | ✓ | ✓ | chevron |
| `logo.layer.ring` | Lock ring | ✓ | opt | ✓ |
| `logo.layer.accent` | Cyan dot | ✓ | ✓ | ✓ |
| `logo.layer.gap` | Negatif compound | — | ✓ | — |
| `logo.layer.ground` | Background rect | export | export | export |

---

## 6. Simplification Tier IDs

| Tier | ID | Boyut |
|------|-----|-------|
| M0 | `logo.tier.micro` | 16–20 |
| M1 | `logo.tier.small` | 24–29 |
| S | `logo.tier.standard` | 32–64 |
| F | `logo.tier.full` | 96–512 |

Phase 4: `visibility` layer sets per export script.

---

## 7. Motion Token Bindings

| Event | Motion ID | Süre |
|-------|-----------|------|
| Boot | `v4.motion.presence.pulse` | 550 ms |
| Match | `v4.motion.pulse.journey` | 480 ms |
| Offer | `v4.motion.relay.ingress` | 260 ms |
| QR | `v4.motion.lock.ringClose` | 320 ms |
| Payment | `v4.motion.success.checkDraw` | 360 ms |
| Trust | `v4.motion.online.glow` | 360 ms |
| AI | `v4.motion.ai.orbExpand` | 300 ms |

---

## 8. Sonic Token Bindings

| Event | Sonic ID |
|-------|----------|
| Boot | `sonic.presence.boot` +40 ms |
| QR | `sonic.qr.success` |
| Offer | `sonic.driver.offer.classic` / `.urgent` |
| Payment | `sonic.payment.confirmed` |
| Match | `sonic.match.success` |

---

## 9. Marker Shared (logo ≠ marker path)

| Parametre | Shared |
|-----------|--------|
| `--genom-cyan` | `#00D4AA` |
| ring close 320 ms | ✓ |
| stroke ratio 512:48 | ✓ |
| role siluet | marker only |

---

**Non-goals:** `.css`, `.svg` dosyası Phase 3'te yok.
