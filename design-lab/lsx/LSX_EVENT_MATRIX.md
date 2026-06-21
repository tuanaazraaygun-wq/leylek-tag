# LSX Event Matrix

**Version:** LSX v1.0  
**Master reference:** EVENT → Motion → Haptic → Sound → Visual → Transition → Completion

Timing pattern keys: **T1** Standard Triad · **T2** Micro · **T3** Remote · **T4** Presence · **T5** Caution  
See `LSX_CONSTITUTION.md` §6.

---

## Tier A — Journey Critical

| Event ID | Motion | Haptic | Sound (LSDS/LSX) | Visual state | Transition | Completion | Timing |
|----------|--------|--------|------------------|--------------|------------|------------|--------|
| `boot.ready` | `presence.pulse` | — | `brand.boot` *(new)* | Logo visible | splash→app | idle chrome | T4 |
| `driver.offer.new` | `relay.ingress` | `medium` / `double` urgent | `driver.offer.*` | Request row highlight | list→highlight | row settles | T1 |
| `qm.invite.new` | `relay.ingress` | `medium` | `quickMatch.ops` | QM banner | banner in | banner idle | T1 |
| `match.confirmed` | `pulse.journey` | `success` | `match.success` | Map chrome pulse | matched→active UI | hold 480ms | T1 |
| `qr.scan.local` | `scan.viewfinderFlash` | `light` | `qr.scan.tick` *(micro)* | Viewfinder glow | scanning | decode | T2 |
| `qr.verify.lock` | `lock.ringClose` | `lock` | `qr.success` | Verified badge | scan→verified | hold 350ms | T1 |
| `qr.remote.ack` | `lock.ringClose` | `remote` | `qr.remoteAck` *(new)* | “Doğrulandı” chip | waiting→done | dismiss modal | T3 |
| `payment.confirmed` | `lock.ringClose` + `checkDraw` | `success` | `payment.confirmed` | Checkmark | form→success | sheet close | T1 |
| `feedback.error` | `error.nudge` | `error` | `feedback.error` | Error banner | — | user dismiss | T5 |

---

## Tier B — Primary Affordance

| Event ID | Motion | Haptic | Sound | Visual | Transition | Completion | Timing |
|----------|--------|--------|-------|--------|------------|------------|--------|
| `ui.cta.press` | `click.press` | `light` | `ui.tap` | Button depress | — | release | T2 |
| `role.continue` | `click.press` | `selection` | `ui.tap` | Hero select | role→vehicle | dashboard route | T2 |
| `offer.send` | `click.press` | `medium` | `ui.tap` | Submit loading | idle→loading | sent state | T2 |
| `trust.accept` | `success.checkDraw` | `success` | trust micro *(new)* | Trust badge | pending→active | — | T1 |
| `login.submit` | crossfade | `light` | — | Form | login→home | — | T2 |

---

## Tier C — Ambient

| Event ID | Motion | Haptic | Sound | Visual |
|----------|--------|--------|-------|--------|
| `waiting.search` | `waiting.breathe` | — | — | Searching UI |
| `driver.online` | chrome glow | `light` | — | Online badge |
| `socket.connected` | dot pulse once | — | — | Guardian dot |
| `leylek.open` | orb expand (existing) | `light` | — | Chat sheet |

---

## Tier D — Silent by design

Poll, background refresh, map tile load, typing indicators, location tick.

---

## Frame Timeline (T1 example @ 60fps)

| Frame | ~ms | Motion | Haptic | Sound | Visual |
|-------|-----|--------|--------|-------|--------|
| 0 | 0 | ingress start | fire | — | pre-state |
| 1 | 16 | ingress 20% | — | attack | — |
| 2 | 33 | ingress 40% | — | body | highlight |
| 5 | 83 | peak | — | body | — |
| 8 | 133 | — | — | release | state commit |
| 15 | 250 | settle | — | — | completion UI |

---

## Production Mapping (current LSDS tokens)

| LSX event | Current sound wired | Motion wired | Haptic wired |
|-----------|---------------------|--------------|--------------|
| `driver.offer.new` | Yes | No | No |
| `match.confirmed` | Yes | No | No |
| `qr.verify.lock` | Yes (passenger) | No | Vibration only trip-end |
| `qr.remote.ack` | **No** | No | No |
| `payment.confirmed` | Yes | No | No |
| `ui.cta.press` | Partial | Partial | Partial |
| `boot.ready` | **No** | Splash hide only | No |

---

## Cross-Reference

Journey narratives: `LSX_JOURNEY_MAP.md`  
Haptic detail: `LSX_HAPTIC_LANGUAGE.md`  
Motion detail: `LSX_MOTION_LANGUAGE.md`
