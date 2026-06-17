export type TrustedInviteSocketPayload = {
  invite_id?: string;
  initiator_id?: string;
  counterparty_id?: string;
  source_tag_id?: string;
  status?: string;
  actor_user_id?: string;
  updated_at?: string;
};

type TrustedInviteHubRefreshFn = () => void;

const hubRefreshSubs = new Set<TrustedInviteHubRefreshFn>();

/** Hub açıkken trusted invite socket → soft pending refresh */
export function subscribeTrustedInviteHubRefresh(fn: TrustedInviteHubRefreshFn): () => void {
  hubRefreshSubs.add(fn);
  return () => {
    hubRefreshSubs.delete(fn);
  };
}

export function publishTrustedInviteHubRefresh(): void {
  hubRefreshSubs.forEach((fn) => {
    try {
      fn();
    } catch {
      /* noop */
    }
  });
}

/** Yalnız aktif yolculuk + karşı taraf ile eşleşen invite socket eventleri */
export function trustedInviteEventMatchesTrip(
  payload: TrustedInviteSocketPayload,
  args: {
    selfUserId: string | null | undefined;
    activeTagId: string | null | undefined;
    counterpartyUserId: string | null | undefined;
  },
): boolean {
  const tagId = String(args.activeTagId || '').trim().toLowerCase();
  const cpId = String(args.counterpartyUserId || '').trim().toLowerCase();
  const selfId = String(args.selfUserId || '').trim().toLowerCase();
  if (!tagId || !cpId || !selfId) {
    return false;
  }

  const sourceTag = String(payload.source_tag_id || '').trim().toLowerCase();
  if (sourceTag && sourceTag !== tagId) {
    return false;
  }

  const ini = String(payload.initiator_id || '').trim().toLowerCase();
  const counter = String(payload.counterparty_id || '').trim().toLowerCase();
  if (!ini || !counter) {
    return false;
  }

  const parties = new Set([ini, counter]);
  if (!parties.has(selfId) || !parties.has(cpId)) {
    return false;
  }

  return true;
}
