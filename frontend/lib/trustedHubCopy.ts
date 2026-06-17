export type TrustedHubRole = 'passenger' | 'driver';

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
