# UX-P0-CHAT — Message Status Analysis

**Question:** What delivery/read status exists for TAG trip chat?

---

## Summary

TAG `ChatBubble` has **no message status model** (no sent/delivered/read ticks, no failed state beyond local spam/API rollback for boarding lock).

Muhabbet chat (`MuhabbetChatScreen.tsx`) implements full status; TAG chat does not reuse it.

---

## What the UI shows today

| Element | TAG ChatBubble | Meaning |
|---------|----------------|---------|
| Timestamp per bubble | Yes (`toLocaleTimeString`) | Send time (local/client) |
| "Bağlı" / "Bağlanıyor..." header | Yes | Supabase Realtime channel subscription status — **not** message ACK |
| Optimistic "me" bubble | Yes | Added before broadcast/API complete |
| Delivered ✓ | No | — |
| Read ✓✓ | No | — |
| Failed / retry | No | Broadcast error logged only; bubble stays |
| Sending spinner | No | — |

---

## Socket events (useSocket.ts)

| Event | Handler | Registered in index.tsx? |
|-------|---------|--------------------------|
| `message_sent` | `onMessageSent` | **No** |
| `new_message` | `onNewMessage` | **No** |
| `first_chat_message` | `onFirstChatMessage` | **Yes** — banner only, not status |

Backend: **no** `message_sent` or `new_message` emit from `POST /chat/send-message` for TAG.

---

## Backend receipt infrastructure

| Socket event | Handler | Scope |
|--------------|---------|-------|
| `message_delivered` | `sio_message_delivered` (~32638) | Muhabbet conversations |
| `message_seen` | `sio_message_seen` (~32643) | Muhabbet conversations |

`POST /chat/mark-read` exists for TAG table but **frontend never calls it**.

---

## Send-side failure handling

### Supabase broadcast fail

- `catch` logs error; optimistic message **remains** in list.
- No user-visible failed state.

### REST `/chat/send-message` fail

| Error | Behavior |
|-------|----------|
| `boarding_comm_closed` | Removes optimistic message + spam warning |
| Other errors | Logged as non-fatal; optimistic message **kept** |
| Network error | `console.warn`; optimistic message **kept** |

First-message push/socket may never fire if REST fails after broadcast succeeded → **split-brain** possible.

---

## First message vs subsequent — status asymmetry

| Message # | DB saved | Push | Socket | Live broadcast |
|-----------|----------|------|--------|----------------|
| First (claim OK) | Yes | Yes | `first_chat_message` | Yes |
| Subsequent | Yes | No | No | Yes only |

Receiver offline for message 2+: no push, no socket — **silent loss** until reopen + history fetch (which doesn't exist).

---

## `first_message_sent` flag

- Column on `tags` table (`add_expo_push_and_first_message_sent.sql`).
- Atomically claimed on first successful push schedule.
- Controls **notification** dedupe — not UI read receipts.

---

## Comparison: MuhabbetChatScreen (reference)

Muhabbet implements:

- Pending / sent / failed message rows
- Retry queue (`pendingActionRef`)
- Socket receipts (`message_delivered`, `message_seen`)
- Optimistic UI with rollback

TAG ChatBubble is intentionally lighter but lacks even basic "failed to send" feedback.

---

## Product implications

Users may believe message was delivered because:

1. Optimistic bubble appears immediately.
2. No failed/delivered indicator.
3. "Bağlı" refers to Realtime channel, not peer receipt.

---

## Safest status improvements (patch direction)

| Priority | Change | Backend? |
|----------|--------|----------|
| P0 | Load history on open — proves persistence | No |
| P1 | Show subtle "gönderiliyor" until REST OK; remove bubble on hard fail | No |
| P2 | Optional `new_message` socket on every send (offline fallback) | Yes |
| P3 | Read receipts like Muhabbet | Yes + UI |

See `06_PATCH_PLAN.md`.
