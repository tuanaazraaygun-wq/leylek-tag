# B3-6 QA Plan

**Sprint:** B3-6 — White theme screen migration QA  
**Date:** 2026-06-21

---

## Test environments

| Env | Flags |
|-----|-------|
| Production default | All theme flags OFF |
| TestFlight B3-6a | `LIGHT_THEME=true`, `SCREENS=auth` |
| TestFlight full | Incremental screen list |

---

## Global regression (every patch)

| ID | Test | Pass criteria |
|----|------|---------------|
| G-01 | Flag OFF cold start | Pixel-identical dark vs pre-patch |
| G-02 | Flag OFF navigate all touched screens | No new warnings |
| G-03 | Dark mode after patch | No PREMIUM import breaks |
| G-04 | Theme persistence | Kill app → mode retained |
| G-05 | No layout shift | Screenshot diff spacing unchanged |

---

## Per-phase QA

### B3-6a Auth

| ID | Test |
|----|------|
| QA-6a-01 | Login phone entry light/dark |
| QA-6a-02 | OTP 6-digit light/dark |
| QA-6a-03 | Register branch inputs |
| QA-6a-04 | PIN set/enter |
| QA-6a-05 | KVKK modal opens (legal contrast note) |
| QA-6a-06 | Logo header visible light |
| QA-6a-07 | Keyboard open — no color flash |

### B3-6b Role

| ID | Test |
|----|------|
| QA-6b-01 | Card selection states |
| QA-6b-02 | Vehicle path |
| QA-6b-03 | Continue disabled/enabled |

### B3-6c Settings

| ID | Test |
|----|------|
| QA-6c-01 | Theme segment toggle → hub updates |
| QA-6c-02 | Profile fields |
| QA-6c-03 | Legal pages scroll |
| QA-6c-04 | Delete account flow |

### B3-6d Passenger

| ID | Test |
|----|------|
| QA-6d-01 | Destination search |
| QA-6d-02 | Waiting screen |
| QA-6d-03 | Offer accept |
| QA-6d-04 | Quick match flow |

### B3-6e Driver

| ID | Test |
|----|------|
| QA-6e-01 | Online toggle |
| QA-6e-02 | Offer list |
| QA-6e-03 | Accept offer |
| QA-6e-04 | Quick strip |

### B3-6f QR / Trust

| ID | Test |
|----|------|
| QA-6f-01 | Boarding scan both themes |
| QA-6f-02 | QR still scans in light |
| QA-6f-03 | Payment confirm |
| QA-6f-04 | Rating modal |

### B3-6g Map

| ID | Test |
|----|------|
| QA-6g-01 | Active ride map |
| QA-6g-02 | All marker types visible light |
| QA-6g-03 | Bottom sheet contrast |
| QA-6g-04 | Theme toggle mid-ride |
| QA-6g-05 | Searching passenger map |

### B3-6h Cleanup

| ID | Test |
|----|------|
| QA-6h-01 | grep PREMIUM_* stragglers |
| QA-6h-02 | Admin panel smoke |
| QA-6h-03 | Full E2E dark + light |

---

## Accessibility

| Check | Target |
|-------|--------|
| Body text contrast | WCAG AA 4.5:1 light surfaces |
| Muted text | Min 3:1 for large text |
| Focus borders | Visible on input light fill |
| Map pills | Readable on satellite/hybrid |

---

## Devices

- Android mid-range (primary crash surface)
- iOS latest
- Small screen (SE class) — auth + role
- Large screen — driver offer list

---

## Screenshot baseline

Capture dark before each patch; light after on TestFlight. Compare:

- Login, Role, Settings hub, Passenger waiting, Driver offer, LiveMapView active ride

---

## Sign-off

| Role | Sign |
|------|------|
| Engineering | Per-phase PR |
| Design | Light parity vs dark LHIS |
| QA | Phase checklist complete |
