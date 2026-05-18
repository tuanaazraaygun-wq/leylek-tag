/** Paylaşılan Supabase Realtime broadcast olayları (Postgres/RLS ile ilgilenmez). */
export const SUPPORT_USER_TYPING_EVENT = "support_user_typing";
export const SUPPORT_ADMIN_TYPING_EVENT = "support_admin_typing";

export function supportTypingBridgeTopic(ticketId: string): string {
  return `support-typing-bridge:${ticketId}`;
}
