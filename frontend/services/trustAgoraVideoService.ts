/**
 * Güven görüşmesi — Agora video oturumu.
 * Tek IRtcEngine kuralı için asıl motor `agoraVoiceService` üzerinden yönetilir.
 */
import { agoraVoiceService } from './agoraVoiceService';

let joinPromise: Promise<void> | null = null;
let joinChannelKey: string | null = null;
let leavePromise: Promise<void> | null = null;

function trustJoinKey(channelName: string, token: string, uid: number): string {
  return `${String(channelName).trim()}|${String(token).trim()}|${uid}`;
}

export async function trustVideoJoin(
  channelName: string,
  token: string,
  uid: number,
): Promise<void> {
  const key = trustJoinKey(channelName, token, uid);
  if (joinPromise && joinChannelKey === key) {
    return joinPromise;
  }
  if (joinPromise) {
    await joinPromise.catch(() => {});
  }
  joinChannelKey = key;
  joinPromise = (async () => {
    try {
      await agoraVoiceService.leaveChannelAndDestroy();
      await agoraVoiceService.joinTrustVideoChannel(channelName, token, uid);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      console.log(
        '[TRUST]',
        JSON.stringify({
          evt: 'TRUST_JOIN_ERROR',
          phase: 'trustVideoJoin_inner',
          channel_name: channelName,
          uid_used_for_join: uid,
          message,
        }),
      );
      throw e;
    }
  })();
  try {
    await joinPromise;
  } finally {
    if (joinChannelKey === key) {
      joinPromise = null;
      joinChannelKey = null;
    }
  }
}

export async function trustVideoLeave(): Promise<void> {
  if (leavePromise) {
    return leavePromise;
  }
  leavePromise = (async () => {
    await agoraVoiceService.leaveChannelAndDestroy();
  })();
  try {
    await leavePromise;
  } finally {
    leavePromise = null;
  }
}
