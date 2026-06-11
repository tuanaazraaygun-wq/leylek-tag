import type { TrustedSummaryResponse } from './trustedNetworkApi';

export function formatPassengerTrustedCardSubtitle(
  summary: TrustedSummaryResponse,
): string {
  const active = Math.max(0, Number(summary.active_count) || 0);
  const incoming = Math.max(0, Number(summary.incoming_pending_count) || 0);
  const outgoing = Math.max(0, Number(summary.outgoing_pending_count) || 0);

  if (active === 0 && incoming === 0 && outgoing === 0) {
    return 'Henüz güvenilir sürücünüz yok';
  }
  if (active > 0 && incoming === 0 && outgoing === 0) {
    return `${active} güvenilir sürücü`;
  }
  if (incoming > 0 && outgoing === 0) {
    return `${active} sürücü · ${incoming} gelen davet`;
  }
  if (outgoing > 0 && incoming === 0) {
    return `${active} sürücü · ${outgoing} giden davet`;
  }
  return `${active} sürücü · ${incoming} gelen · ${outgoing} giden`;
}

export function formatDriverTrustedHeaderSubtitle(
  summary: TrustedSummaryResponse,
): string {
  const active = Math.max(0, Number(summary.active_count) || 0);
  const incoming = Math.max(0, Number(summary.incoming_pending_count) || 0);
  const outgoing = Math.max(0, Number(summary.outgoing_pending_count) || 0);

  if (active === 0 && incoming === 0 && outgoing === 0) {
    return 'Güven ağınızı oluşturun';
  }
  if (active > 0 && incoming === 0 && outgoing === 0) {
    return `${active} güvenilir yolcu`;
  }
  return `${active} yolcu · ${incoming} gelen · ${outgoing} giden davet`;
}
