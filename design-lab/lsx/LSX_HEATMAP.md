# LSX Journey Heat Map

**Version:** LSX v1.0  
**Basis:** Product owner feedback — *“Uygulama canlı hissettirmiyor”* + LSDS v2 device test

---

## 1. Top 20 Sensory Moments (highest user impact)

Ranked by **frequency × emotional weight × current gap**.

| Rank | Moment | Role | Current sensory score (1–5) | LSX priority |
|------|--------|------|---------------------------|--------------|
| 1 | **Driver receives new offer** | Driver | 2 | P0 |
| 2 | **Match confirmed** | Both | 3 | P0 |
| 3 | **Passenger scans boarding QR** | Passenger | 3 | P0 |
| 4 | **Driver learns boarding succeeded** | Driver | **1** | P0 |
| 5 | **App cold open / boot** | Both | **0** | P0 |
| 6 | **Primary CTA tap (send offer, accept)** | Both | 2 | P1 |
| 7 | **Quick Match driver invite** | Driver | 3 | P1 |
| 8 | **Passenger trip-end QR scan success** | Passenger | 2 | P1 |
| 9 | **Payment / contribution confirmed** | Both | 3 | P1 |
| 10 | **Driver trip-end (passenger scanned)** | Driver | **1** | P1 |
| 11 | **Role + vehicle continue** | Both | 3 | P1 |
| 12 | **Driver goes online / available** | Driver | 2 | P2 |
| 13 | **Waiting for offers (passenger)** | Passenger | 1 | P2 |
| 14 | **Driver arrival / proximity boarding banner** | Both | 2 | P2 |
| 15 | **Journey started (boarding → in_progress)** | Both | 2 | P2 |
| 16 | **Rating modal opens** | Both | 1 | P2 |
| 17 | **Trust invite sent / accepted** | Both | 1 | P2 |
| 18 | **Leylek Zeka open / send** | Both | 3 | P3 |
| 19 | **Feedback error (API fail)** | Both | 3 | P3 |
| 20 | **Logout / return role select** | Both | 1 | P3 |

**Score key:** 5 = full triad + closure; 0 = complete silence / no feedback.

---

## 2. Emotion Curve (journey intensity)

Intensity 0–10 over typical TAG journey (passenger lens; driver similar with offer peak earlier).

```
10 │                              ╭── Match
 9 │                             ╱    ╲
 8 │                    Offer  ╱       ╲
 7 │                   ╱╲    ╱          ╲
 6 │                  ╱  ╲  ╱            ╲ QR end
 5 │         Boot    ╱    ╲╱              ╲╱╲
 4 │          ·     ╱                      ╲ Payment
 3 │    Login      ╱ Waiting                ╲╱
 2 │   ·····      ╱  (flat)                  Rating
 1 │·············                             · Close
 0 └────────────────────────────────────────────────────► time
     Boot Login Role Wait Offer Match Board Ride QR Pay Rate
```

| Phase | Target intensity | Current problem |
|-------|------------------|-----------------|
| Boot | 3–4 presence | **0** — flat start |
| Login | 2 | Silent forms |
| Role select | 4 | Visual only — OK visually, weak touch/sound |
| Waiting | 2–3 breathe | Too flat — feels dead |
| Offer / Match | 8–9 | Match OK; offer feels notification-tier |
| Boarding QR | 7 | Passenger OK; **driver silent** |
| Ride | 2–3 ambient | Acceptable if guardian breathes |
| QR end + pay | 7–8 | QR weak; modal stays open |
| Rating / close | 4–5 gentle | Too abrupt |

**LSX rule:** Flat lines ≥30 s need **Tier C motion** (breathe) not new sounds.

---

## 3. Confirmation Gap Index

Events where user asks *“Oldu mu?”*

| Event | Gap severity |
|-------|--------------|
| Driver boarding remote | **Critical** |
| Driver trip-end remote | **Critical** |
| QR success → next step | **High** |
| Payment confirm | Medium |
| Offer received (driver) | Medium |
| Trust accept | High |

Detail: `LSX_REMOTE_CONFIRMATION.md`, `LSX_SILENCE_REPORT.md`

---

## 4. Presence Gap Index

| Moment | Should say “I’m here” | Current |
|--------|------------------------|---------|
| Boot | Yes | No |
| Socket live | Subtle | No |
| Driver online | Yes | Weak |
| Active trip chrome | Yes | Partial (guardian dot) |
| Leylek Zeka | Yes | Strong motion |

---

## 5. Cross-Reference

- Silence: `LSX_SILENCE_REPORT.md`  
- Dead UI: `LSX_SILENCE_REPORT.md` §2  
- Journeys: `LSX_JOURNEY_MAP.md`  
- Remote: `LSX_REMOTE_CONFIRMATION.md`
