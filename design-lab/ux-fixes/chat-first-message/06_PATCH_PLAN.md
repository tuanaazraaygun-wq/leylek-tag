# UX-P0-CHAT — Patch Plan

**Goal:** First message visible on open + reliable history + keyboard usable  
**Constraint:** Minimal diff; no navigation redesign; backend optional for P0

---

## Root cause (executive)

TAG chat **persist messages to DB** but the UI **only renders Supabase Broadcast** events into local state. First-message socket/push notifies the user with a **banner only** — message text is dropped. **`GET /chat/messages` is never called.** Dead Socket.io paths (`send_message` emit, `incomingMessage` prop) create false confidence that messaging is wired.

---

## Phased delivery

### Phase 1 — P0 visibility (frontend only, ship first)

| # | Task | File | Backend |
|---|------|------|---------|
| 1.1 | On `visible && tagId`, fetch `GET /chat/messages`, map rows → `messages[]` | `ChatBubble.tsx` | No |
| 1.2 | Dedupe merge with existing broadcast messages | `ChatBubble.tsx` | No |
| 1.3 | Wire `incomingMessage` prop — `useEffect` append + parent clear | `ChatBubble.tsx`, `index.tsx` | No |
| 1.4 | `onFirstChatMessage`: set incoming payload from `data.message` / preview | `index.tsx` | No |
| 1.5 | Banner subtitle: show truncated preview | `index.tsx` | No |

**Est. diff:** ~80–120 lines across 2 files.

### Phase 2 — P0 keyboard (frontend only)

| # | Task | File |
|---|------|------|
| 2.1 | `KeyboardAvoidingView` wrapper (iOS padding) | `ChatBubble.tsx` |
| 2.2 | `keyboardShouldPersistTaps="handled"` on FlatList | `ChatBubble.tsx` |
| 2.3 | Android hide debounce (~150ms) | `ChatBubble.tsx` |
| 2.4 | Optional: suppress backdrop close when input focused | `ChatBubble.tsx` |

**Est. diff:** ~40 lines.

### Phase 3 — P1 cleanup (frontend)

| # | Task | File |
|---|------|------|
| 3.1 | Remove or document dead `onSendMessage` / `emitSendMessage` from index ChatBubble props | `index.tsx` |
| 3.2 | REST send: show sending state; rollback bubble on hard fail (non-boarding) | `ChatBubble.tsx` |
| 3.3 | Optional LSX haptic on send | `ChatBubble.tsx` + lsx if desired |

### Phase 4 — P2 backend optional (not required for first message fix)

| # | Task | File |
|---|------|------|
| 4.1 | Emit `new_message` to receiver room on every `send-message` | `server.py` |
| 4.2 | Register `onNewMessage` in index → same ingest as broadcast | `index.tsx` |

Use when Supabase unreliable; history fetch alone fixes "empty on open".

---

## Safest minimal patch (recommended PR-1)

```
Single PR: ChatBubble history fetch + incomingMessage + index first-chat inject + keyboard KAV/taps
```

Do **not** touch backend in PR-1.

---

## File checklist

| File | Phase 1 | Phase 2 | Notes |
|------|---------|---------|-------|
| `frontend/components/ChatBubble.tsx` | ✓ | ✓ | Primary |
| `frontend/app/index.tsx` | ✓ | — | First chat handler + incoming state |
| `frontend/components/LiveMapView.tsx` | — | — | No change |
| `frontend/hooks/useSocket.ts` | — | — | No change P0 |
| `frontend/contexts/SocketContext.tsx` | — | — | Dead emit OK to leave |
| `backend/server.py` | — | — | No change P0 |

---

## API usage (new client calls)

```typescript
GET ${API_BASE_URL}/chat/messages?tag_id=${tagId}&limit=50
// Response: { success, messages: [{ id, message, sender_id, created_at, ... }] }
```

Map `sender_id === userId` → `'me'` else `'other'`.

Call when:

- `visible` transitions true
- `tagId` changes while visible

---

## onFirstChatMessage patch sketch (index.tsx)

```typescript
onFirstChatMessage: (data) => {
  // ... existing tag guards ...
  const text = String(data.message_preview || data.message || '').trim();
  if (text) {
    setPassengerIncomingMessage({
      text,
      senderId: String(data.sender_id || ''),
      timestamp: Date.now(),
    });
  }
  if (passengerChatVisible) return;
  setFirstChatTapBanner({ title: '...', subtitle: text || 'Cevap vermek için dokun' });
},
```

Mirror for driver.

---

## QA matrix

| # | Test | Expected |
|---|------|----------|
| 1 | Driver sends first msg, passenger offline | Push/banner → open chat → **message visible** |
| 2 | Passenger replies | Driver sees via broadcast |
| 3 | Passenger reopens chat | History from API |
| 4 | After boarding | Send blocked; history read OK |
| 5 | iOS keyboard | Input not hidden |
| 6 | Android keyboard | No double gap |
| 7 | Duplicate tap send | Spam guard still works |

---

## Backend / socket needed?

| Fix | Backend | Socket |
|-----|---------|--------|
| P0 visibility (history + incomingMessage) | **No** | **No** |
| P2 live fallback for msg 2+ offline | Optional emit | Optional `new_message` |

---

## Production touched in analysis?

**NO** — this sprint is docs only.

---

## Next sprint after patch

1. UX-P0-CHAT-1 production patch (this plan Phase 1+2)
2. Consider unread badge on LiveMapView chat button
3. Align TAG chat status UX with Muhabbet (P3+)

---

## Related docs

| Doc | Content |
|-----|---------|
| `01_CHAT_CURRENT_FLOW.md` | As-is architecture |
| `02_MESSAGE_STATUS_ANALYSIS.md` | Status gaps |
| `03_INCOMING_MESSAGE_VISIBILITY.md` | First message root cause |
| `04_KEYBOARD_UX_ANALYSIS.md` | Keyboard issues |
| `05_RISK_REGISTER.md` | Risks |
