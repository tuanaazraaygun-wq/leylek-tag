# UX-P0-CHAT — Risk Register

**Sprint:** UX-P0-CHAT (pre-patch)

---

## Risk matrix

| ID | Risk | L | I | Mitigation |
|----|------|---|---|------------|
| R1 | History fetch duplicates broadcast messages | M | L | Dedupe by `message_id` or `(sender, text, created_at)` |
| R2 | History fetch shows pre-boarding messages after comms lock | L | M | Filter by time or respect lock UI (read-only) |
| R3 | Wiring `onNewMessage` + Supabase = double append | M | M | Single ingest pipeline with id dedupe |
| R4 | Removing dead `emitSendMessage` breaks unknown caller | L | L | Grep before delete; ChatBubble never called it |
| R5 | Keyboard KAV + manual pad double-lift | M | M | Platform split: KAV iOS only OR pad only |
| R6 | Backdrop close while typing | M | L | Disable backdrop press when input focused |
| R7 | First message push spam if `first_message_sent` migration missing | L | H | Backend already logs migration hint — ops gate |
| R8 | Supabase channel leak on rapid tag switch | L | M | Existing cleanup in `useEffect` return |
| R9 | PII in logs (`console.log` message text) | M | L | Reduce dev logging in patch |
| R10 | Muhabbet vs TAG chat confusion | L | M | Patch TAG files only; don't touch MuhabbetChatScreen |

---

## Idempotency

| Operation | Guard |
|-----------|-------|
| First push | `tags.first_message_sent` atomic update |
| History merge | Client dedupe on `id` from API |
| `incomingMessage` inject | Clear after consume; ref guard for same timestamp |

---

## What must NOT change (P0 patch)

1. **Boarding comms lock** — UI + API `boarding_comm_closed`
2. **Muhabbet chat** — separate product surface
3. **First push semantics** — still one push per tag via backend flag
4. **Spam / profanity filters** in ChatBubble
5. **Navigation / map layout** — no LiveMapView redesign

---

## Rollback

| Phase | Rollback |
|-------|----------|
| History fetch | Remove `useEffect` fetch in ChatBubble |
| incomingMessage wire | Revert prop handler |
| Keyboard KAV | Revert to pad-only |
| Backend new_message | Revert server emit (if added in P2) |

All P0 fixes are frontend-only → single PR revert.

---

## Monitoring

| Signal | Source |
|--------|--------|
| `CHAT_FIRST_PUSH_*` logs | Backend |
| `[ChatBubble] Broadcast subscription status` | Client |
| Empty chat reports | Support |
| Supabase config missing warn | Client startup |

---

## Sign-off gates

- [ ] First message: banner tap → message visible
- [ ] Second message: receiver online sees via broadcast
- [ ] Second message: receiver offline → sees on open after history fetch
- [ ] Boarding lock still blocks send
- [ ] iOS + Android keyboard input visible
- [ ] No duplicate bubbles on send/receive
