/**
 * Leylek Muhabbeti: mesajlar cihazda (AsyncStorage) + sunucuda en fazla ~90 gün (muhabbet_messages).
 * Açılışta yerel + API birleştirilir.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

export function muhabbetMessagesStorageKey(conversationId: string): string {
  const c = String(conversationId || '').trim().toLowerCase();
  return `muhabbet_messages_${c}`;
}

/** Eski kayıtlar silinir (FIFO); en güncel N mesaj kalır */
export const MUHABBET_MAX_MESSAGES_PER_CONVERSATION = 200;

/** created_at yoksa veya parse edilemezse `Date.now()` ile ISO */
export function coerceMessageCreatedAt(value: unknown): string {
  if (value != null && String(value).trim() !== '') {
    const t = new Date(String(value)).getTime();
    if (!Number.isNaN(t)) return new Date(t).toISOString();
  }
  return new Date(Date.now()).toISOString();
}

export function normalizeMuhabbetMessageId(raw: unknown): string {
  return String(raw ?? '')
    .toLowerCase()
    .trim();
}

type MessagesEnvelopeV1 = { v: 1; items: StoredMuhabbetMessage[] };

export type StoredMuhabbetMessage = {
  message_id: string;
  conversation_id: string;
  sender_id: string;
  text: string;
  created_at: string;
  out_status?: string;
  sender_role?: string | null;
  message_type?: 'text' | 'audio';
  /** Kalıcı Storage yolu; signed `audio_url` süresi dolunca yeniden çekimde güncellenir */
  audio_storage_path?: string | null;
  audio_url?: string | null;
  audio_duration_ms?: number | null;
  audio_mime_type?: string | null;
};

function normalizeStored(m: Partial<StoredMuhabbetMessage>, cidFallback: string): StoredMuhabbetMessage {
  const cid = String(m.conversation_id || cidFallback || '').trim().toLowerCase();
  const mtRaw = m.message_type != null ? String(m.message_type).trim().toLowerCase() : '';
  const message_type: 'text' | 'audio' | undefined =
    mtRaw === 'audio' ? 'audio' : mtRaw === 'text' ? 'text' : undefined;
  return {
    message_id: normalizeMuhabbetMessageId(m.message_id),
    conversation_id: cid,
    sender_id: String(m.sender_id || '').trim().toLowerCase(),
    text: String(m.text ?? ''),
    created_at: coerceMessageCreatedAt(m.created_at),
    out_status: m.out_status ? String(m.out_status) : undefined,
    sender_role: m.sender_role != null && m.sender_role !== '' ? String(m.sender_role) : null,
    ...(message_type ? { message_type } : {}),
    audio_storage_path:
      m.audio_storage_path != null && String(m.audio_storage_path).trim() !== ''
        ? String(m.audio_storage_path).trim()
        : null,
    audio_url: m.audio_url != null && String(m.audio_url).trim() !== '' ? String(m.audio_url) : null,
    audio_duration_ms:
      m.audio_duration_ms != null && Number.isFinite(Number(m.audio_duration_ms))
        ? Math.round(Number(m.audio_duration_ms))
        : null,
    audio_mime_type:
      m.audio_mime_type != null && String(m.audio_mime_type).trim() !== ''
        ? String(m.audio_mime_type).trim().toLowerCase()
        : null,
  };
}

export async function loadMuhabbetMessagesLocal(conversationId: string): Promise<StoredMuhabbetMessage[]> {
  const cid = String(conversationId || '').trim().toLowerCase();
  if (!cid) return [];
  try {
    const raw = await AsyncStorage.getItem(muhabbetMessagesStorageKey(cid));
    if (!raw) return [];
    const p = JSON.parse(raw) as MessagesEnvelopeV1 | StoredMuhabbetMessage[];
    if (Array.isArray(p)) {
      return p.map((x) => normalizeStored(x, cid)).filter((x) => x.message_id);
    }
    if (p && typeof p === 'object' && Array.isArray((p as MessagesEnvelopeV1).items)) {
      return (p as MessagesEnvelopeV1).items.map((x) => normalizeStored(x, cid)).filter((x) => x.message_id);
    }
  } catch {
    /* noop */
  }
  return [];
}

export async function saveMuhabbetMessagesLocal(conversationId: string, items: StoredMuhabbetMessage[]): Promise<void> {
  const cid = String(conversationId || '').trim().toLowerCase();
  if (!cid) return;
  let norm = items.map((x) => normalizeStored(x, cid)).filter((x) => x.message_id);
  norm.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  if (norm.length > MUHABBET_MAX_MESSAGES_PER_CONVERSATION) {
    norm = norm.slice(norm.length - MUHABBET_MAX_MESSAGES_PER_CONVERSATION);
  }
  const env: MessagesEnvelopeV1 = { v: 1, items: norm };
  await AsyncStorage.setItem(muhabbetMessagesStorageKey(cid), JSON.stringify(env));
}

export async function clearMuhabbetMessagesLocal(conversationId: string): Promise<void> {
  const cid = String(conversationId || '').trim().toLowerCase();
  if (!cid) return;
  await AsyncStorage.removeItem(muhabbetMessagesStorageKey(cid));
}

/** Push / bildirim verisi — type dışında alanlar */
export async function upsertMuhabbetMessageFromPushData(data: Record<string, unknown>): Promise<boolean> {
  const cid = data.conversation_id != null ? String(data.conversation_id).trim().toLowerCase() : '';
  const mid = normalizeMuhabbetMessageId(data.message_id);
  if (!cid || !mid) return false;
  const items = await loadMuhabbetMessagesLocal(cid);
  if (items.some((x) => x.message_id === mid)) return true;
  const sender_id = data.sender_id != null ? String(data.sender_id).trim().toLowerCase() : '';
  const text = data.text != null ? String(data.text) : '';
  const created_at = coerceMessageCreatedAt(data.created_at);
  const sender_role = data.sender_role != null ? String(data.sender_role) : null;
  const mtRaw = data.message_type != null ? String(data.message_type).trim().toLowerCase() : '';
  const message_type = mtRaw === 'audio' ? 'audio' : mtRaw === 'text' ? 'text' : undefined;
  items.push(
    normalizeStored(
      {
        message_id: mid,
        conversation_id: cid,
        sender_id,
        text,
        created_at,
        sender_role,
        ...(message_type ? { message_type } : {}),
        audio_url: data.audio_url != null ? String(data.audio_url) : null,
        audio_duration_ms:
          data.audio_duration_ms != null ? Number(data.audio_duration_ms) : null,
        audio_mime_type: data.audio_mime_type != null ? String(data.audio_mime_type) : null,
      },
      cid
    )
  );
  await saveMuhabbetMessagesLocal(cid, items);
  return true;
}

export function storedMessagesToDisplayRows(items: StoredMuhabbetMessage[]): {
  id: string;
  body: string;
  sender_user_id: string;
  created_at: string;
  out_status?: string;
  sender_role?: string | null;
  message_type?: 'text' | 'audio';
  audio_storage_path?: string | null;
  audio_url?: string | null;
  audio_duration_ms?: number | null;
  audio_mime_type?: string | null;
}[] {
  return items.map((m) => ({
    id: m.message_id,
    body: m.text,
    sender_user_id: m.sender_id,
    created_at: m.created_at,
    out_status: m.out_status,
    sender_role: m.sender_role ?? undefined,
    message_type: m.message_type,
    audio_storage_path: m.audio_storage_path ?? null,
    audio_url: m.audio_url ?? null,
    audio_duration_ms: m.audio_duration_ms ?? null,
    audio_mime_type: m.audio_mime_type ?? null,
  }));
}

/** Chat state’inden AsyncStorage’a tam liste yazar */
export async function persistMuhabbetChatRowsLocal(
  conversationId: string,
  rows: {
    id: string;
    body?: string | null;
    sender_user_id?: string | null;
    created_at?: string | null;
    out_status?: string;
    sender_role?: string | null;
    message_type?: 'text' | 'audio';
    audio_storage_path?: string | null;
    audio_url?: string | null;
    audio_duration_ms?: number | null;
    audio_mime_type?: string | null;
  }[]
): Promise<void> {
  const c = String(conversationId || '').trim().toLowerCase();
  if (!c) return;
  const items = rows
    .filter((r) => String(r.id || '').trim())
    .map((r) =>
      normalizeStored(
        {
          message_id: normalizeMuhabbetMessageId(r.id),
          conversation_id: c,
          sender_id: String(r.sender_user_id || ''),
          text: String(r.body ?? ''),
          created_at: coerceMessageCreatedAt(r.created_at),
          out_status: r.out_status,
          sender_role: r.sender_role,
          message_type: r.message_type,
          audio_storage_path: r.audio_storage_path,
          audio_url: r.audio_url,
          audio_duration_ms: r.audio_duration_ms,
          audio_mime_type: r.audio_mime_type,
        },
        c
      )
    );
  await saveMuhabbetMessagesLocal(c, items);
}

/** GET /muhabbet/conversations/:id/messages satırları → depolama biçimi */
export function storedMessagesFromConversationApi(
  conversationId: string,
  apiMessages: {
    id?: string;
    body?: string;
    sender_user_id?: string;
    created_at?: string;
    message_type?: string;
    audio_storage_path?: string | null;
    audio_url?: string | null;
    audio_duration_ms?: number | null;
    audio_mime_type?: string | null;
  }[]
): StoredMuhabbetMessage[] {
  const cid = String(conversationId || '').trim().toLowerCase();
  const out: StoredMuhabbetMessage[] = [];
  for (const m of apiMessages || []) {
    const id = normalizeMuhabbetMessageId(m.id);
    if (!id) continue;
    const mtRaw = m.message_type != null ? String(m.message_type).trim().toLowerCase() : '';
    const message_type: 'text' | 'audio' | undefined =
      mtRaw === 'audio' ? 'audio' : mtRaw === 'text' ? 'text' : undefined;
    out.push(
      normalizeStored(
        {
          message_id: id,
          conversation_id: cid,
          sender_id: m.sender_user_id != null ? String(m.sender_user_id).trim().toLowerCase() : '',
          text: m.body != null ? String(m.body) : '',
          created_at: coerceMessageCreatedAt(m.created_at),
          ...(message_type ? { message_type } : {}),
          audio_storage_path: m.audio_storage_path ?? null,
          audio_url: m.audio_url ?? null,
          audio_duration_ms:
            m.audio_duration_ms != null && Number.isFinite(Number(m.audio_duration_ms))
              ? Math.round(Number(m.audio_duration_ms))
              : null,
          audio_mime_type: m.audio_mime_type != null ? String(m.audio_mime_type) : null,
        },
        cid
      )
    );
  }
  return out;
}

/**
 * Yerel (optimistic, push) + sunucu son 200: id bazlı birleştirme.
 * Aynı id: sunucu metni esas; gönderende hâlâ `sending` ise o satır korunur.
 */
export function mergeMuhabbetLocalWithServer(
  local: StoredMuhabbetMessage[],
  server: StoredMuhabbetMessage[],
  myUserId: string
): StoredMuhabbetMessage[] {
  const my = String(myUserId || '').trim().toLowerCase();
  const byServer = new Map<string, StoredMuhabbetMessage>();
  for (const s of server) {
    const sid = normalizeMuhabbetMessageId(s.message_id);
    if (sid) byServer.set(sid, normalizeStored({ ...s, message_id: sid }, s.conversation_id));
  }
  const merged: StoredMuhabbetMessage[] = [];
  const usedLocal = new Set<string>();

  for (const [mid, srow] of byServer) {
    const loc = local.find((l) => normalizeMuhabbetMessageId(l.message_id) === mid);
    usedLocal.add(mid);
    if (loc && String(loc.sender_id || '').trim().toLowerCase() === my && loc.out_status === 'sending') {
      merged.push(
        normalizeStored(
          {
            ...srow,
            out_status: 'sending',
            text: (loc.text && loc.text.trim() !== '' ? loc.text : srow.text) || srow.text,
            created_at: loc.created_at || srow.created_at,
            sender_role: loc.sender_role ?? srow.sender_role,
            message_type: srow.message_type ?? loc.message_type,
            audio_storage_path: srow.audio_storage_path ?? loc.audio_storage_path,
            audio_url: srow.audio_url ?? loc.audio_url,
            audio_duration_ms: srow.audio_duration_ms ?? loc.audio_duration_ms,
            audio_mime_type: srow.audio_mime_type ?? loc.audio_mime_type,
          },
          srow.conversation_id
        )
      );
    } else {
      const srvText = String(srow.text ?? '').trim();
      const locText = loc ? String(loc.text ?? '').trim() : '';
      const mergedText = srvText !== '' ? String(srow.text) : locText !== '' ? String(loc!.text) : String(srow.text ?? '');
      merged.push(
        normalizeStored(
          {
            ...srow,
            text: mergedText,
            sender_role: loc?.sender_role ?? srow.sender_role,
            message_type: srow.message_type ?? loc?.message_type,
            audio_storage_path: srow.audio_storage_path ?? loc?.audio_storage_path ?? null,
            audio_url: srow.audio_url ?? loc?.audio_url ?? null,
            audio_duration_ms: srow.audio_duration_ms ?? loc?.audio_duration_ms ?? null,
            audio_mime_type: srow.audio_mime_type ?? loc?.audio_mime_type ?? null,
            out_status:
              loc && String(loc.sender_id || '').trim().toLowerCase() === my
                ? loc.out_status || srow.out_status
                : srow.out_status,
          },
          srow.conversation_id
        )
      );
    }
  }

  for (const l of local) {
    const lid = normalizeMuhabbetMessageId(l.message_id);
    if (!lid || usedLocal.has(lid)) continue;
    merged.push(normalizeStored(l, l.conversation_id));
  }

  merged.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  if (merged.length > MUHABBET_MAX_MESSAGES_PER_CONVERSATION) {
    return merged.slice(merged.length - MUHABBET_MAX_MESSAGES_PER_CONVERSATION);
  }
  return merged;
}

export async function getLocalConversationLastPreview(
  conversationId: string
): Promise<{ text: string; created_at: string } | null> {
  const items = await loadMuhabbetMessagesLocal(conversationId);
  if (!items.length) return null;
  let best = items[0];
  let bestT = new Date(best.created_at).getTime();
  for (let i = 1; i < items.length; i++) {
    const t = new Date(items[i].created_at).getTime();
    if (t >= bestT) {
      best = items[i];
      bestT = t;
    }
  }
  const preview =
    best.message_type === 'audio'
      ? best.text?.trim()
        ? best.text
        : 'Sesli mesaj'
      : best.text || '';
  return { text: preview, created_at: best.created_at };
}

/** Sohbet listesi — kullanıcı istenen ad */
export const getLastMessageFromLocal = getLocalConversationLastPreview;
