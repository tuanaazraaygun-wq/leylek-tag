import type { TrustedConnectionTie } from './trustedNetworkApi';

export type TrustedHubRole = 'passenger' | 'driver';

function normalizeInsightCopy(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

/** TIE row insight — yalnızca backend insights[0]; radar duplicate ise null. */
export function formatTieInsightLine(
  tie: TrustedConnectionTie | null | undefined,
  radarLine?: string | null,
): string | null {
  if (!tie) return null;
  const insights = tie.insights;
  if (!Array.isArray(insights) || insights.length === 0) return null;
  const first = String(insights[0] ?? '').trim();
  if (!first) return null;

  const radarNorm = radarLine ? normalizeInsightCopy(radarLine) : '';
  const tieNorm = normalizeInsightCopy(first);
  if (!tieNorm) return null;

  if (radarNorm) {
    if (radarNorm === tieNorm) return null;
    if (radarNorm.includes(tieNorm) || tieNorm.includes(radarNorm)) return null;
  }

  return first;
}

export function hubTitle(role: TrustedHubRole): string {
  return role === 'passenger' ? 'Sürücülerim' : 'Yolcularım';
}

export function hubHeaderSubtitle(
  role: TrustedHubRole,
  active: number,
  incoming: number,
  outgoing: number,
): string {
  const a = Math.max(0, active);
  const inc = Math.max(0, incoming);
  const out = Math.max(0, outgoing);

  if (role === 'passenger') {
    if (a === 0 && inc === 0 && out === 0) {
      return 'Güven ağınız burada görünür';
    }
    if (a > 0 && inc === 0 && out === 0) {
      return `${a} güvenilir sürücü`;
    }
    if (inc > 0 && out === 0) {
      return `${a} sürücü · ${inc} gelen davet`;
    }
    if (out > 0 && inc === 0) {
      return `${a} sürücü · ${out} giden davet`;
    }
    return `${a} sürücü · ${inc} gelen · ${out} giden`;
  }

  if (a === 0 && inc === 0 && out === 0) {
    return 'Güven ağınızı oluşturun';
  }
  if (a > 0 && inc === 0 && out === 0) {
    return `${a} güvenilir yolcu`;
  }
  return `${a} yolcu · ${inc} gelen · ${out} giden davet`;
}

export function sectionConnectionsTitle(role: TrustedHubRole): string {
  return role === 'passenger' ? 'Güvenilir sürücüler' : 'Güvenilir yolcular';
}

export const SECTION_INCOMING_TITLE = 'Gelen davetler';
export const SECTION_OUTGOING_TITLE = 'Giden davetler';

export function globalEmptyTitle(role: TrustedHubRole): string {
  return role === 'passenger'
    ? 'Henüz güvenilir sürücünüz yok.'
    : 'Güven ağınızı oluşturun.';
}

export function globalEmptyBody(role: TrustedHubRole): string {
  return role === 'passenger'
    ? 'Tamamlanan yolculuklardan sonra güven ağınızı oluşturabilirsiniz.'
    : 'Tamamlanan yolculuklardan sonra güvenilir yolcularınız burada görünür.';
}

export const HUB_ERROR_TITLE = 'Güven ağı şu an kullanılamıyor';
export const HUB_ERROR_BODY = 'Lütfen daha sonra tekrar deneyin.';

export const PENDING_BADGE_INCOMING = 'Gelen davet';
export const PENDING_BADGE_OUTGOING = 'Giden davet';

/** Journey / profile — gelen davet pill metni */
export const TRUST_INCOMING_LABEL = 'Güven ağı daveti var';
/** Journey profile modal — Hub köprüsü */
export const TRUST_INCOMING_HUB_BRIDGE = 'Hub\'da yanıtla';
/** LiveMap compact chip — gelen davet köprüsü */
export const TRUST_INCOMING_CHIP_BRIDGE = 'Davet var · Yanıtla';

export const ACTION_ACCEPT = 'Kabul Et';
export const ACTION_DECLINE = 'Reddet';
export const ACTION_REMOVE = 'Kaldır';
export const CONFIRM_DECLINE_TITLE = 'Daveti reddetmek istiyor musunuz?';
export const CONFIRM_REVOKE_TITLE = 'Bu kişiyi güven ağından kaldırmak istiyor musunuz?';
export const ACTION_SUCCESS = 'İşlem tamamlandı';
export const ACTION_FAILED = 'İşlem yapılamadı, tekrar deneyin';
export const ACTION_CANCEL = 'Vazgeç';

export function formatTrustedHubDate(iso: string | null | undefined): string {
  if (!iso || !String(iso).trim()) return '';
  const d = new Date(String(iso));
  if (Number.isNaN(d.getTime())) return '';
  const now = Date.now();
  const diff = now - d.getTime();
  const MS = 1000;
  const MIN = 60 * MS;
  const HOUR = 60 * MIN;
  const DAY = 24 * HOUR;
  if (diff < MIN) return 'Az önce';
  if (diff < HOUR) {
    const m = Math.max(1, Math.floor(diff / MIN));
    return `${m} dk önce`;
  }
  if (diff < DAY) {
    const h = Math.max(1, Math.floor(diff / HOUR));
    return `${h} sa. önce`;
  }
  if (diff < 7 * DAY) {
    const days = Math.max(1, Math.floor(diff / DAY));
    return `${days} gün önce`;
  }
  return d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });
}

export type TrustedRadarBriefingCounts = {
  hasRadarData: boolean;
  readyCount: number;
  onTripCount: number;
  staleCount: number;
  offlineCount: number;
};

/** Anlık radar özeti — radar yoksa null; iddialı/AI copy yok. */
export function formatTrustedRadarBriefing(input: TrustedRadarBriefingCounts): string | null {
  if (!input.hasRadarData) return null;

  const ready = Math.max(0, Math.floor(Number(input.readyCount) || 0));
  const onTrip = Math.max(0, Math.floor(Number(input.onTripCount) || 0));

  const parts: string[] = [];

  if (ready === 1) {
    parts.push('1 sürücün şu anda müsait');
  } else if (ready > 1) {
    parts.push(`${ready} sürücün şu anda müsait`);
  }

  if (onTrip === 1) {
    parts.push('1 sürücü yolculukta');
  } else if (onTrip > 1) {
    parts.push(`${onTrip} sürücü yolculukta`);
  }

  if (parts.length > 0) {
    return parts.join(' · ');
  }

  return 'Güven ağında anlık müsait sürücü görünmüyor';
}

export function formatTrustedExpiresHint(iso: string | null | undefined): string {
  if (!iso || !String(iso).trim()) return '';
  const d = new Date(String(iso));
  if (Number.isNaN(d.getTime())) return '';
  const diff = d.getTime() - Date.now();
  if (diff <= 0) return 'Süresi doldu';
  const MS = 1000;
  const HOUR = 60 * 60 * MS;
  const DAY = 24 * HOUR;
  if (diff < HOUR) return 'Süresi yakında doluyor';
  if (diff < DAY) {
    const h = Math.max(1, Math.ceil(diff / HOUR));
    return `${h} sa. içinde sona erer`;
  }
  const days = Math.max(1, Math.ceil(diff / DAY));
  return `${days} gün içinde sona erer`;
}
