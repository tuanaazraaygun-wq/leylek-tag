export type ConversationUpdatedPayload = {
  conversation_id?: string;
  reason?: string;
  version?: string;
};

export type TripSessionUpdatedPayload = {
  session_id?: string;
  reason?: string;
  version?: string;
};

type ConvFn = (p: ConversationUpdatedPayload) => void;
type TripFn = (p: TripSessionUpdatedPayload) => void;

const convSubs = new Set<ConvFn>();
const tripSubs = new Set<TripFn>();

export function subscribeConversationUpdated(fn: ConvFn): () => void {
  convSubs.add(fn);
  return () => convSubs.delete(fn);
}

export function subscribeTripSessionUpdated(fn: TripFn): () => void {
  tripSubs.add(fn);
  return () => tripSubs.delete(fn);
}

export function emitConversationUpdated(payload: ConversationUpdatedPayload): void {
  convSubs.forEach((fn) => {
    try {
      fn(payload);
    } catch {
      /* noop */
    }
  });
}

export function emitTripSessionUpdated(payload: TripSessionUpdatedPayload): void {
  tripSubs.forEach((fn) => {
    try {
      fn(payload);
    } catch {
      /* noop */
    }
  });
}
