/** Int32 semantics aligned with backend `agora_uid_from_user_id` (Rtc token uid). */
function toInt32(n: number): number {
  return n | 0;
}

export function agoraUidFromUserId(userId: string): number {
  if (!userId) return 1;
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    const c = userId.charCodeAt(i);
    hash = toInt32(toInt32(hash << 5) - hash + c);
  }
  return Math.abs(hash % 1000000) + 1;
}
