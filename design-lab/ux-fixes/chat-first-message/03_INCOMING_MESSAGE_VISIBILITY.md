# UX-P0-CHAT — Incoming Message Visibility

**User pain:** First message notification appears but chat opens empty, or message not visible until sender sends again.

---

## Root causes

### 1. `incomingMessage` prop is dead code

`index.tsx` passes:

```typescript
incomingMessage={passengerIncomingMessage}  // passenger
incomingMessage={driverIncomingMessage}     // driver
```

`ChatBubble.tsx` declares `incomingMessage` in `ChatBubbleProps` but **does not destructure or use it**.

`setPassengerIncomingMessage` / `setDriverIncomingMessage` are **never called** in the codebase.

---

### 2. First socket handler ignores message body

`onFirstChatMessage` (~9087 passenger, ~16361 driver):

```typescript
setFirstChatTapBanner({
  title: data.from_driver ? 'Sürücü size yazdı' : 'Yolcu size yazdı',
  subtitle: 'Cevap vermek için dokun',
});
```

Backend sends rich payload including `message`, `message_preview`, `sender_name` — **all discarded**.

When user taps banner and opens chat → **empty FlatList** unless Supabase broadcast was received while `ChatBubble` was mounted.

---

### 3. No history hydration on open

`GET /chat/messages?tag_id=` exists and returns persisted rows — **never fetched**.

Opening chat after missing broadcast shows:

```text
Henüz mesaj yok
Bir mesaj göndererek sohbeti başlatın
```

Even though message exists in `chat_messages` table.

---

### 4. Supabase broadcast is the only live path for message 2+

If receiver:

- Was backgrounded with channel unsubscribed, or
- Supabase config missing (`getSupabase()` null → `isConnected` false), or
- Network blip during broadcast

→ No message in local state, no push (after first), no socket.

---

### 5. `onFirstChatMessage` skips when chat visible

```typescript
if (passengerChatVisible) return;
```

If receiver already has chat open but Supabase broadcast fails → **no banner, no fallback, no socket injection**.

Sender sees message (optimistic); receiver sees nothing.

---

### 6. Push body doesn't include message text

First push uses generic body:

```python
_chat_body = "Cevap vermek için dokun"
```

Not `message_preview`. Notification tap opens chat via `paxChatNotifData` but still no text hydration.

---

## Visibility matrix

| Scenario | Banner | Message in list | Fix without backend |
|----------|--------|-----------------|---------------------|
| Receiver online, Supabase OK, chat closed | Yes | Yes (via broadcast to mounted component) | OK |
| Receiver online, Supabase OK, chat open | No | Yes | OK |
| Receiver missed broadcast, taps banner | Yes | **Empty** | Fetch history / wire incomingMessage |
| Receiver gets socket only (first msg) | Yes | **Empty** | Parse `data.message` in handler |
| Message 2+, receiver offline | No | **Empty** | History fetch + optional socket |
| Supabase not configured | Maybe first banner | Unreliable | History fetch mandatory |

---

## Unread badge behavior

When broadcast arrives and `!visible || isMinimized`:

- `unreadCount++` on minimized bubble only.
- Full modal closed (`visible=false`) still accumulates in state (component mounted).
- Opening chat clears unread via `useEffect` on `visible`.

If broadcast missed, unread count stays 0 — **no badge, no banner** for message 2+.

---

## LiveMapView visibility

Chat launcher visible during trip; no unread dot on map chat button — user must notice banner or open chat manually.

First chat banner placement:

- Passenger: trip phase header area (~12528)
- Driver: trip phase header area (~19237)

Competes with boarding banners, force-end UI, trust prompts.

---

## Recommended visibility fixes (priority)

### P0 — Frontend only

1. **`useEffect` on `visible`** → fetch `GET /chat/messages`, merge into `messages[]` (dedupe by id/timestamp).
2. **`onFirstChatMessage`** → call helper to append `data.message` to chat state OR set `incomingMessage` and consume in `ChatBubble`.
3. **Wire `incomingMessage` prop** in `ChatBubble` — append once, clear via callback.

### P1 — Frontend

4. On broadcast receive while chat closed, persist to ref so open shows content even before fetch returns.
5. Show `message_preview` in banner subtitle (truncate 72 chars).

### P2 — Backend optional

6. Emit `new_message` on every `send-message` for socket fallback (receiver can use `onNewMessage`).

---

## Files to patch

| File | Change |
|------|--------|
| `ChatBubble.tsx` | Consume `incomingMessage`; fetch history on `visible` |
| `index.tsx` | `onFirstChatMessage` inject message; optional `onNewMessage` |
| Backend | Optional `new_message` emit — not required for P0 if history fetch works |
