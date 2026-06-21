# LSX Remote Confirmation

**Version:** LSX v1.0  
**Scope:** Two-device sensory reciprocity + Confirmation Map

---

## 1. Problem Statement

LeylekTAG journeys are **bilateral**. One device performs an action; the other must **feel** completion. Today LSDS tokens fire mostly on the **actor** device. Product test: *driver QR — no sound* = missing **remote confirmation**.

---

## 2. Remote Confirmation Map

| Actor action | Actor device (today) | Remote device (today) | Remote device (LSX v1 target) |
|--------------|----------------------|------------------------|-------------------------------|
| Passenger scans **boarding** QR | `playQrScanSuccessSound` + API | Socket `boarding_confirmed` → modal close **silent** | **Triad T3:** motion lock + haptic remote + `lsx.sound.qr.remoteAck` |
| Driver displays boarding QR | None | — | Passive: show “listening” pulse until ack |
| Passenger scans **trip-end** QR | `playQrScanSuccessSound` → payment step | Driver QR modal **silent** | Remote ack when `complete-qr` succeeds |
| Driver accepts offer | Match chime (both often) | Passenger match | OK — keep triad sync |
| Passenger accepts driver offer | Match chime | Driver match | OK |
| QM driver accepts invite | Ops sound driver | Passenger socket | Passenger: `lsx.motion.relay` + soft chime |
| Payment approved (transfer) | `playPaymentConfirmedSound` driver | Passenger | Passenger: payment lock triad |
| Trust invite accepted | Minimal | Inviter | Success micro triad both sides |

---

## 3. Triad T3 — Remote Echo (spec)

When socket/state confirms remote party action:

| Step | Frame | Channel |
|------|-------|---------|
| 1 | 0 | Visual: status chip → “Doğrulandı” |
| 2 | 0 | Motion: `lock.ringClose` on modal/card |
| 3 | 1 | Haptic: `lsx.haptic.remote` |
| 4 | 2 | Sound: `lsx.sound.qr.remoteAck` (120–280 ms) |
| 5 | 18–30 | Motion: `dismiss.sheet` |
| 6 | — | State: modal close, journey advance |

**Max latency budget:** 200 ms from socket receive to first sensory (motion).

---

## 4. Confirmation Map (all screens)

| Screen / flow | Confirm needed for | Current | Gap |
|---------------|-------------------|---------|-----|
| QR boarding | Scan valid | Passenger sound only | Driver remote |
| QR trip end | Scan valid | Passenger sound; modal stays | Closure + driver remote |
| Payment | Money/handshake | Sound on confirm button | Visual lock weak |
| Driver offer | New task | Sound | Motion + haptic missing |
| Match | Journey paired | Chime | Emotion arc + motion |
| QM invite | Ops task | Sound | Visual ingress |
| Trust | Relationship | Almost none | Full triad |
| Login | Auth success | Silent nav | Tier B motion |
| Rating submit | Feedback sent | Silent | Micro success |
| Force end / cancel | Trip aborted | Alert only | Caution triad |

---

## 5. Token Proposals (sound — LSDS v3 aligned)

| Token | Duration | Character |
|-------|----------|-----------|
| `lsx.sound.qr.remoteAck` | 0.18–0.32 s | Magnetic lock echo — same DNA as local lock, shorter |
| `lsx.sound.journey.remoteStart` | 0.4–0.6 s | Boarding confirmed on driver |
| `lsx.sound.journey.remoteEnd` | 0.35–0.5 s | Trip complete on driver |

---

## 6. Failure Modes

| Failure | User belief | LSX response |
|---------|-------------|--------------|
| Remote ack delayed >500 ms | “Çalışmadı” | Show processing motion at 100 ms; ack or error at 500 ms |
| Sound muted | — | Haptic + motion mandatory |
| Duplicate socket | Double chime | Dedupe by tag_id (existing pattern) |

---

## 7. Non-Goals

This document does not change socket payloads, Redis, or QR API — only specifies **sensory response** when those events already arrive.
