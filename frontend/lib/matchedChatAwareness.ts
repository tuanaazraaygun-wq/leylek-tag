/** Sprint 5B — matched trip chat peek / preview helpers (frontend-only). */

export const MATCHED_CHAT_PEEK_MS = 5500;
/** İlk okunmamış mesaj — daha uzun, daha belirgin banner. */
export const MATCHED_CHAT_FIRST_PEEK_MS = 8000;

export type MatchedChatPeek = {
  senderLabel: string;
  preview: string;
  /** İlk mesajda "Yeni mesaj" başlığı. */
  headline?: string;
};

export function clipMatchedChatPreview(text: string, maxLen = 48): string {
  const t = String(text || '').trim();
  if (!t) return '';
  if (t.length <= maxLen) return t;
  return `${t.slice(0, maxLen - 1)}…`;
}

export function formatMatchedChatUnreadBadge(count: number): string {
  if (count <= 0) return '';
  return count > 9 ? '9+' : String(count);
}
