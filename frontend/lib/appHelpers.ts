function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === 'object' ? (v as Record<string, unknown>) : null;
}

export async function parseApiJson(response: Response): Promise<{ data: unknown }> {
  const text = await response.text();
  if (!text) return { data: null };
  try {
    return { data: JSON.parse(text) as unknown };
  } catch {
    return { data: text };
  }
}

export function apiErrMsg(data: unknown, fallback: string): string {
  const o = asRecord(data);
  if (!o) return typeof data === 'string' && data.trim() ? data.trim() : fallback;
  const detail = o.detail;
  if (typeof detail === 'string' && detail.trim()) return detail.trim();
  if (Array.isArray(detail) && detail.length) {
    const first = detail[0];
    if (typeof first === 'string') return first;
    const fr = asRecord(first);
    if (fr && typeof fr.msg === 'string') return fr.msg;
  }
  const msg = o.message ?? o.error ?? o.msg;
  if (typeof msg === 'string' && msg.trim()) return msg.trim();
  return fallback;
}

export type TagMemberRole = 'passenger' | 'driver';

export type TagMembershipSlice = {
  id?: string;
  passenger_id?: string;
  driver_id?: string;
};

export type ForceEndInitiatorSlice = {
  initiator_id?: string;
  initiator_type?: string;
};

function normTripUserId(id: unknown): string {
  return String(id ?? '').trim().toLowerCase();
}

/** Tag üyeliğinden kullanıcının yolcu mu sürücü mü olduğunu çıkarır (user.role kullanmaz). */
export function inferTagRoleForUser(
  activeTag: TagMembershipSlice | null | undefined,
  userId: string | null | undefined,
): TagMemberRole | null {
  const uid = normTripUserId(userId);
  if (!uid || !activeTag) return null;
  const pid = normTripUserId(activeTag.passenger_id);
  const did = normTripUserId(activeTag.driver_id);
  if (pid && uid === pid) return 'passenger';
  if (did && uid === did) return 'driver';
  return null;
}

/** Force-end initiator mı — canonical id, tag rolü ve tag üye id eşlemesi. */
export function isCurrentUserForceEndInitiator(
  endRequest: ForceEndInitiatorSlice | null | undefined,
  userId: string | null | undefined,
  tag: TagMembershipSlice | null | undefined,
): boolean {
  if (!endRequest || typeof endRequest !== 'object') return false;
  const iniRaw = String(endRequest.initiator_id ?? '').trim();
  if (!iniRaw || !userId) return false;

  const ini = normTripUserId(iniRaw);
  const uid = normTripUserId(userId);
  if (ini && uid && ini === uid) return true;

  const initiatorType = String(endRequest.initiator_type ?? '').trim().toLowerCase();
  if (initiatorType !== 'driver' && initiatorType !== 'passenger') return false;

  const role = inferTagRoleForUser(tag, userId);
  if (role && role === initiatorType) return true;

  const tagMemberId =
    initiatorType === 'driver'
      ? normTripUserId(tag?.driver_id)
      : normTripUserId(tag?.passenger_id);
  if (tagMemberId && ini === tagMemberId && role === initiatorType) return true;

  return false;
}

/**
 * Force-end için ender_type — tag üyeliğinden; dashboard ipucu yalnızca __DEV__ uyarısı için.
 */
export function resolveForceEndEnderType(
  activeTag: TagMembershipSlice | null | undefined,
  userId: string | null | undefined,
  dashboardHint?: TagMemberRole,
): TagMemberRole | null {
  const inferred = inferTagRoleForUser(activeTag, userId);
  if (
    typeof __DEV__ !== 'undefined' &&
    __DEV__ &&
    dashboardHint &&
    inferred &&
    dashboardHint !== inferred
  ) {
    console.warn('FORCE_END_ENDER_TYPE_MISMATCH', {
      dashboardHint,
      inferredFromTag: inferred,
      tagId: activeTag?.id ?? null,
      userId: userId ?? null,
    });
  }
  return inferred;
}

/** inferred null ise ender_type gönderilmez — backend tag'den çıkarır. */
export function buildForceEndTripUrl(
  apiUrl: string,
  tagId: string,
  userId: string,
  enderType: TagMemberRole | null,
): string {
  const q = new URLSearchParams({
    tag_id: String(tagId),
    user_id: String(userId),
  });
  if (enderType) {
    q.set('ender_type', enderType);
  }
  return `${apiUrl}/trip/force-end?${q.toString()}`;
}

/** Türkiye cep: 10 hane (başında 0 veya +90 olabilir). */
export function normalizeTrMobile10(raw?: string | null): string {
  if (!raw) return '';
  let d = String(raw).replace(/\D/g, '');
  if (d.startsWith('90') && d.length >= 12) d = d.slice(2);
  if (d.startsWith('0') && d.length === 11) d = d.slice(1);
  if (d.length > 10) d = d.slice(-10);
  return d.length === 10 ? d : '';
}
