/**
 * Güven görüşmesi — Agora video oturumu.
 * Tek IRtcEngine kuralı için asıl motor `agoraVoiceService` üzerinden yönetilir.
 */
import { agoraVoiceService } from './agoraVoiceService';

/** Aynı anda iki join (çift effect / yarış) — tek zincir; ikinci çağrı aynı Promise’i bekler */
let trustVideoJoinLock: Promise<void> | null = null;

export async function trustVideoJoin(
  channelName: string,
  token: string,
  uid: number,
): Promise<void> {
  if (trustVideoJoinLock) {
    return trustVideoJoinLock;
  }
  trustVideoJoinLock = (async () => {
    try {
      await agoraVoiceService.leaveChannelAndDestroy();
      await agoraVoiceService.joinTrustVideoChannel(channelName, token, uid);
    } finally {
      trustVideoJoinLock = null;
    }
  })();
  return trustVideoJoinLock;
}

export async function trustVideoLeave(): Promise<void> {
  await agoraVoiceService.leaveChannelAndDestroy();
}
