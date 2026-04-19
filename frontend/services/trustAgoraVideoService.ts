/**
 * Güven görüşmesi — Agora video oturumu.
 * Tek IRtcEngine kuralı için asıl motor `agoraVoiceService` üzerinden yönetilir.
 */
import { agoraVoiceService } from './agoraVoiceService';

let joinPromise: Promise<void> | null = null;

export async function trustVideoJoin(
  channelName: string,
  token: string,
  uid: number,
): Promise<void> {
  if (joinPromise) {
    return joinPromise;
  }
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
    joinPromise = null;
  }
}

export async function trustVideoLeave(): Promise<void> {
  await agoraVoiceService.leaveChannelAndDestroy();
}
