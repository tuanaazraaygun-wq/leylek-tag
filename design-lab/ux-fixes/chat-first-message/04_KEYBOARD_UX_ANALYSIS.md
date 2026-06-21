# UX-P0-CHAT — Keyboard UX Analysis

**Scope:** TAG trip `ChatBubble.tsx` keyboard behavior vs platform best practices and in-app references (`LeylekZekaChat.tsx`).

---

## Current implementation (ChatBubble)

### Layout

- Full-screen transparent `Modal` → bottom sheet `Animated.View`
- Fixed height: `SCREEN_HEIGHT * 0.6` (60%)
- Structure: header → `FlatList` (flex 1) → suggestions → input row
- **No** `KeyboardAvoidingView`

### Keyboard handling

```typescript
// Lines ~205-225
Keyboard.addListener(keyboardWillShow / keyboardDidShow) → setKeyboardPad(height)
Keyboard.addListener(keyboardWillHide / keyboardDidHide) → setKeyboardPad(0)

// Input container paddingBottom:
keyboardPad > 0 ? keyboardPad + 10 : safeArea bottom
```

- Scroll-to-end on `keyboardPad` change (100ms delay).
- Comment on send: *"klavye yüksekliği ile altta sabit; gönderince klavye kapanmaz"* — intentional.

### TextInput

- `multiline`, `maxLength={500}`
- No `keyboardAppearance`, `returnKeyType`, `blurOnSubmit`, `onSubmitEditing`
- No `KeyboardAvoidingView` wrapper

### FlatList

- No `keyboardShouldPersistTaps`
- No `keyboardDismissMode`
- Tapping outside input does not dismiss keyboard (backdrop closes entire modal via `Pressable`)

### Android manifest

`windowSoftInputMode="adjustResize"` — resizes window; combined with manual `keyboardPad` may **double-adjust** input area on some devices.

---

## Issues observed

| ID | Issue | Severity |
|----|-------|----------|
| K1 | Fixed 60% sheet + keyboard pad pushes input up but **message list area shrinks** — long threads may hide behind keyboard | High |
| K2 | No `keyboardShouldPersistTaps="handled"` — tapping suggestion chips may dismiss keyboard inconsistently | Medium |
| K3 | Android `keyboardDidHide` immediate reset (no debounce) — known focus loss pattern; `LeylekZekaChat` debounces 150ms+ | Medium |
| K4 | Backdrop `Pressable` closes modal — accidental dismiss while typing near top edge | Medium |
| K5 | No `KeyboardAvoidingView` — relies solely on padding math; iOS safe area + home indicator can overlap when `keyboardPad=0` | Low–Med |
| K6 | Suggestions row always visible — consumes vertical space above keyboard | Low |
| K7 | Modal inside map stack — may interact with other modals (QR, boarding) — not keyboard-specific but affects focus | Low |

---

## Reference: LeylekZekaChat patterns (same repo)

| Pattern | LeylekZekaChat | ChatBubble |
|---------|----------------|------------|
| `KeyboardAvoidingView` | Yes (`padding` iOS) | No |
| Manual `keyboardHeight` + padding | Yes (Android supplement) | Yes (`keyboardPad` only) |
| Hide debounce | Yes | No |
| `keyboardShouldPersistTaps` | `"always"` | Missing |
| `keyboardDismissMode` | `"none"` on scroll | Missing |

---

## Reference: MuhabbetChatScreen

Production Muhabbet chat uses more complete input bar + list insets (separate from TAG). TAG patch should **not** copy entire Muhabbet stack — borrow keyboard patterns only.

---

## LSX / sound / haptics

- `frontend/lib/lsx/` — **no chat-specific bindings** (QR/payment/trust focused).
- `frontend/utils/sound.ts` — no chat send/receive sounds.
- `frontend/utils/touchHaptics.ts` — map/LiveMapView uses `tapButtonHaptic` on chat **button** open; ChatBubble send has **no** haptic (only `Vibration.vibrate(200)` on **incoming** broadcast).

Optional P1: LSX light tap on send (align with QR scan haptics) — cosmetic.

---

## Platform notes

### iOS

- `keyboardWillShow` gives accurate height — current approach OK for input lift.
- Risk: FlatList not inset — last messages may sit under keyboard until scroll fires.

### Android

- `adjustResize` + manual pad: test on Samsung/Pixel for double padding.
- Consider `KeyboardAvoidingView` with `behavior={undefined}` on Android and pad only on iOS (LeylekZekaChat split).

---

## Recommended keyboard patch (minimal)

### Phase 1 — ChatBubble only

1. Wrap content in `KeyboardAvoidingView` (`behavior="padding"` iOS, `undefined` Android).
2. Add `keyboardShouldPersistTaps="handled"` on message `FlatList`.
3. Debounce `keyboardDidHide` on Android (150–200ms) like LeylekZekaChat.
4. `keyboardDismissMode="interactive"` (iOS) on FlatList optional.
5. Reduce sheet to `maxHeight` flex layout OR shrink suggestions when `keyboardPad > 0`.

### Phase 2 — Polish

6. `returnKeyType="send"` + `blurOnSubmit={false}` for hardware keyboard.
7. Prevent backdrop close while `TextInput` focused (require explicit X).

### Do NOT (per sprint constraints)

- Redesign entire chat layout / navigation
- Change Modal to non-Modal without UX sign-off

---

## Test matrix

| Case | Pass criteria |
|------|---------------|
| Open chat, focus input | Input visible above keyboard |
| 10+ messages, open keyboard | Last message scrolls into view |
| Tap suggestion chip | Message sends, keyboard stays |
| Android rotate / gesture nav | No input under system bar |
| Send message | Keyboard stays open (current behavior preserved unless product changes) |
| Minimize bubble + keyboard | N/A — minimized hides input |
