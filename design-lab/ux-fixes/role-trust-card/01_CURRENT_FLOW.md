# UX-P1-ROLECARD-1A — Driver-as-Passenger Trust Card Current Flow

**Sprint:** UX-P1-ROLECARD-1A  
**Mode:** Read-only analysis  
**Date:** 2026-06-21  
**Scope:** Passenger home «Sürücülerim» secondary card when viewer has approved driver registration

---

## Executive summary

On the **passenger idle home** («Eşleşme kararı» cockpit), the secondary card titled **«Sürücülerim»** is rendered by `PassengerMatchModeCards`. It always uses passenger-facing copy and subtitle formatting, even when the logged-in user **also has an approved driver registration**.

Today, tapping that card as a registered driver does **not** open Trusted Direct Match (TDM). Instead, `index.tsx` blocks with an alert («Zaten sürücüsünüz») and sends the user to **role-select** — not the driver cockpit. The card UI still says «Sürücülerim» and may show **«X güvenilir sürücü»**, which is the wrong mental model for someone who should manage **trusted passengers** from the driver side.

**Recommendation:** For `userHasDriverRegistration(user) === true`, morph the card to **«Yolcularım» / «X güvenilir yolcu» / tap → Sürücü paneli** without touching TDM, payment, QR, or socket paths for normal passengers.

---

## Screen location

```
Login → role-select → passenger → dashboard (passenger home, no activeTag)
  └─ GlassSurface «Eşleşme kararı»
       └─ PassengerMatchModeCards
            └─ SECONDARY_CARDS[1] id='trusted'  ← «Sürücülerim»
```

**Primary file:** `frontend/components/superUx/PassengerMatchModeCards.tsx`  
**Wiring:** `frontend/app/index.tsx` ~13352–13380 (`onTrustedPress`)

---

## Card definition (static today)

```73:87:frontend/components/superUx/PassengerMatchModeCards.tsx
const SECONDARY_CARDS: CardDef[] = [
  {
    id: 'proxy',
    title: 'Yerime Al',
    subtitle: 'Yakınınız için güvenli aldırma',
    enabled: false,
    tier: 'primary',
  },
  {
    id: 'trusted',
    title: 'Sürücülerim',
    subtitle: 'Güvendiğiniz sürücüler',
    enabled: false,
    tier: 'secondary',
  },
];
```

Card becomes interactive when `onTrustedPress` is passed from parent (`trustedWired === true`).

---

## Subtitle data path (passenger framing)

1. `useTrustedSummary()` → `GET /trusted/summary` (no role query param)
2. When `status === 'ready'`, `formatPassengerTrustedCardSubtitle(summary)` runs
3. That helper hardcodes `role: 'passenger'` in `formatTrustStructuralSubtitle` → **«X güvenilir sürücü»** (+ optional online presence line)

```7:26:frontend/lib/trustedSummaryCopy.ts
export function formatPassengerTrustedCardSubtitle(
  summary: TrustedSummaryResponse,
): string {
  const structural = formatTrustStructuralSubtitle(
    'passenger',
    {
      active: summary.active_count,
      incoming: summary.incoming_pending_count,
      outgoing: summary.outgoing_pending_count,
    },
    'dashboard',
  );
  // ... online_trusted_count appended for passenger
}
```

**Loading / unavailable fallbacks in card:**

| State | Subtitle shown |
|-------|----------------|
| Summary loading | Static `card.subtitle` → «Güvendiğiniz sürücüler» |
| Summary ready | Dynamic passenger structural line |
| Summary unavailable + wired | Static «Güvendiğiniz sürücüler» |
| Not wired | «Yakında» pill (disabled) |

---

## Tap handler (driver block)

```13369:13380:frontend/app/index.tsx
onTrustedPress={() => {
  playTapSound();
  if (userHasDriverRegistration(user)) {
    alertTrustedDirectPassengerOnlyBlocked(() => setScreen('role-select'));
    return;
  }
  setPassengerIdleOfferChannel('normal');
  setRoutePickerIntent('trusted_direct');
  setRoutePickerStep('pickup');
  setDestinationPickerPhase('search');
  setShowDestinationPicker(true);
}}
```

**Second guard** on route confirm (`routePickerIntent === 'trusted_direct'`) repeats the same alert (~11681–11686).

Alert copy (`trustedHubCopy.ts`):

- Title: «Zaten sürücüsünüz»
- Body: TDM is passenger-only; accept requests from driver panel
- Optional button: «Sürücü paneline git» → currently **`setScreen('role-select')` only** (user must re-pick driver + vehicle)

---

## Parallel surfaces (context)

| Surface | Role lens | Driver-reg user behavior |
|---------|-----------|-------------------------|
| **PassengerMatchModeCards** | Passenger | Wrong title/subtitle; blocked TDM |
| **DriverCockpitQuickStrip** | Driver | «Güven ağı» + `formatDriverTrustedHeaderSubtitle` |
| **TrustedNetworkHub** | Query `?role=passenger\|driver` | Full hub; driver panel opens `?role=driver` |
| **LiveMapView / RatingModal** | Passenger hub bridge | `router.push('/trusted-network?role=passenger')` |

Driver cockpit already has the correct **driver-side** trust summary pattern; passenger deck does not mirror it for dual-role users.

---

## User-visible problem

| Persona | Sees today | Expected |
|---------|------------|----------|
| Passenger only | «Sürücülerim» → TDM route picker → hub | ✅ Correct |
| Approved driver in passenger mode | «Sürücülerim» + «X güvenilir sürücü» → alert | **«Yolcularım» + «X güvenilir yolcu» → Sürücü paneli** |

The mismatch is **copy + routing**, not missing backend trust data entirely — but **count accuracy** needs care (see `02_DRIVER_PROFILE_DETECTION.md` and `03_COPY_AND_ROUTING_PLAN.md`).

---

## Out of scope (per sprint rules)

- Backend / socket / payment / QR / match logic changes
- Production code edits (this sprint)
- `TrustedNetworkHub` list filtering bugs (noted as related risk only)
