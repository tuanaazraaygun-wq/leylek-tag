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
    await agoraVoiceService.leaveChannelAndDestroy();
    await agoraVoiceService.joinTrustVideoChannel(channelName, token, uid);
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
