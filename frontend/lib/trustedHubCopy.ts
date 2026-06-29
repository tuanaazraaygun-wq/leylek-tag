import type { TrustedConnectionTie } from './trustedNetworkApi';

export type TrustedHubRole = 'passenger' | 'driver';

export type TrustStructuralContext = 'hub' | 'dashboard';

export type TrustStructuralCounts = {
  active: number;
  incoming: number;
  outgoing: number;
};

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

/** Yapısal trust özeti — Hub header ve dashboard paylaşır. */
export function formatTrustStructuralSubtitle(
  role: TrustedHubRole,
  counts: TrustStructuralCounts,
  context: TrustStructuralContext = 'hub',
): string {
  const a = Math.max(0, Math.floor(Number(counts.active) || 0));
  const inc = Math.max(0, Math.floor(Number(counts.incoming) || 0));
  const out = Math.max(0, Math.floor(Number(counts.outgoing) || 0));

  if (role === 'passenger') {
    if (a === 0 && inc === 0 && out === 0) {
      return context === 'dashboard'
        ? 'Henüz güvenilir sürücünüz yok'
        : 'Güven ağınız burada görünür';
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

export function hubHeaderSubtitle(
  role: TrustedHubRole,
  active: number,
  incoming: number,
  outgoing: number,
): string {
  return formatTrustStructuralSubtitle(
    role,
    { active, incoming, outgoing },
    'hub',
  );
}

/** TRUST_READY presence — dashboard + briefing aynı dil. */
export function formatTrustedReadyPresenceLine(readyCount: number): string | null {
  const ready = Math.max(0, Math.floor(Number(readyCount) || 0));
  if (ready === 1) {
    return '1 sürücün şu anda müsait';
  }
  if (ready > 1) {
    return `${ready} sürücün şu anda müsait`;
  }
  return null;
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
/** LiveMap compact chip — gelen davet köprüsü (legacy Hub) */
export const TRUST_INCOMING_CHIP_BRIDGE = 'Davet var · Yanıtla';
/** Journey chip / profile — gelen davet kabul CTA */
export const TRUST_INCOMING_CHIP_ACCEPT = 'Davet var · Kabul et';

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

  const readyLine = formatTrustedReadyPresenceLine(ready);
  if (readyLine) {
    parts.push(readyLine);
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

export const TDM_REQUEST_CTA = 'İstek gönder';
export const TDM_REQUEST_BUSY = 'İstek bekleniyor…';
export const TDM_ROUTE_BANNER_TITLE = 'Seçilen rota';
export const TDM_PENDING_BANNER = 'Doğrudan eşleşme isteğiniz sürücüye iletildi.';
export const TDM_UNAVAILABLE_HINT = 'Doğrudan eşleşme şu an kullanılamıyor.';
export const TDM_NO_ROUTE_HINT = 'Önce rota seçerek Sürücülerim üzerinden istek gönderebilirsiniz.';
export const TDM_VEHICLE_MISMATCH = 'Araç tercihiniz bu sürücüyle uyumlu değil.';
export const TDM_DIRECT_TARGET_INELIGIBLE =
  'Bu kullanıcı sürücü eşleşmesi için uygun değil.';
export const TDM_ACTIVE_TAG_BLOCK = 'Aktif yolculuğunuz varken yeni istek gönderilemez.';
export const TDM_CONTRIBUTION_TITLE = 'Katkı payı';
export const TDM_CONTRIBUTION_CONFIRM = 'İsteği gönder';
export const TDM_CONTRIBUTION_CANCEL = 'Vazgeç';
export const TDM_WAITING_SENDING_TITLE = 'İstek gönderiliyor';
export const TDM_WAITING_PENDING_TITLE = 'Sürücü yanıtı bekleniyor';
export const TDM_WAITING_PENDING_BODY = '{name} yanıt verene kadar bekleyin.';
export const TDM_WAITING_MATCHING_TITLE = 'Sürücü yanıt verdi, eşleşme doğrulanıyor…';
export const TDM_WAITING_MATCHING_BODY =
  'Eşleşme oluştuysa yolculuk ekranı açılacak. Yanıt alınmadıysa kısa süre içinde kapanır.';
export const TDM_WAITING_MATCHING_HINT =
  'Doğrulama tamamlanınca otomatik devam edeceksiniz.';
export const TDM_WAITING_CREATING_HINT = 'İstek hazırlanıyor…';
export const TDM_WAITING_CANCEL = 'İsteği iptal et';
export const TDM_MATCHING_TIMEOUT =
  'Bu istek için eşleşme doğrulanamadı. Sürücü reddetmiş veya süre dolmuş olabilir.';
export const TDM_TERMINAL_DECLINED = 'Karşı tarafın isteği sonlandı.';
export const TDM_TERMINAL_NO_RESPONSE = 'Sürücü yanıt vermedi.';
export const TDM_TERMINAL_EXPIRED =
  'Sürücü yanıt vermedi. İstek süresi doldu; başka bir sürücüye istek gönderebilirsiniz.';
export const TDM_TERMINAL_CANCELLED = 'İstek iptal edildi.';
export const TDM_DRIVER_STATUS_ONLINE = 'Çevrimiçi';
export const TDM_DRIVER_STATUS_BUSY = 'Meşgul';
export const TDM_DRIVER_STATUS_OFFLINE = 'Çevrimdışı';
/** Canonical TDM CTA labels — match status when disabled. */
export const TDM_BUTTON_REQUEST = TDM_REQUEST_CTA;
export const TDM_BUTTON_BUSY = TDM_DRIVER_STATUS_BUSY;
export const TDM_BUTTON_OFFLINE = TDM_DRIVER_STATUS_OFFLINE;
export const TDM_DRIVER_HELPER_OFFLINE = 'Sürücü çevrimdışı';
export const TDM_DRIVER_HELPER_BUSY = 'Sürücü şu anda yolculukta';
export const TDM_DRIVER_HELPER_UNAVAILABLE = 'Sürücü şu anda uygun değil';
export const TDM_REQUEST_BLOCKED_TITLE = 'İstek gönderilemiyor';
export const TDM_ORPHAN_PENDING_TITLE = 'Bekleyen doğrudan istek';
export const TDM_ORPHAN_PENDING_BODY =
  'Bekleyen bir doğrudan eşleşme isteğiniz olabilir. Rota bilgisi bu oturumda bulunamadı.';
export const TDM_ORPHAN_CANCEL = 'İsteği iptal et';
export const TDM_ORPHAN_PICK_ROUTE = 'Yeni rota seç';
export const TDM_ORPHAN_CLOSE = 'Kapat';
export const TDM_PENDING_ROW_HINT = 'Başka bir istek bekleniyor.';
export const TDM_NOTIFY_CTA = 'Bildirim gönder';
export const TDM_NOTIFY_SHEET_TITLE = 'Yolcuya müsaitlik bildirimi gönder';
export const TDM_NOTIFY_OPTION_AVAILABLE = 'Şu anda müsaitim';
export const TDM_NOTIFY_OPTION_NEARBY = 'Yakınlardayım, istek gönderebilirsin';
export const TDM_TERMINAL_DECLINED_TITLE = '{name} şu anda müsait değil';
export const TDM_TERMINAL_DECLINED_BODY =
  '{name} bu yol paylaşım isteğini şu anda kabul edemedi. Müsait olduğunda size güven ağından müsaitlik bildirimi gönderebilir. Bu sırada diğer sürücülerinize istek gönderebilirsiniz.';
export const TDM_TERMINAL_DECLINED_PRIMARY = 'Diğer sürücülere bak';
export const TDM_TERMINAL_DECLINED_SECONDARY = 'Tamam';

function tdmResponderDisplayName(responderLabel?: string | null): string {
  const name = (responderLabel || '').trim();
  return name || 'Sürücü';
}

export function formatTdmTerminalDeclinedAlert(responderLabel?: string | null): {
  title: string;
  body: string;
} {
  const name = tdmResponderDisplayName(responderLabel);
  return {
    title: TDM_TERMINAL_DECLINED_TITLE.replace('{name}', name),
    body: TDM_TERMINAL_DECLINED_BODY.replace(/\{name\}/g, name),
  };
}
export const TDM_NOTIFY_SEND = 'Gönder';
export const TDM_NOTIFY_CANCEL = 'Vazgeç';
export const TDM_NOTIFY_SUCCESS = 'Bildirim gönderildi';
export const TDM_NOTIFY_RATE_LIMITED = 'Bu yolcuya kısa süre önce bildirim gönderdiniz.';
export const TDM_NOTIFY_FAILED = 'Bildirim gönderilemedi. Lütfen tekrar deneyin.';
export const TDM_GENERIC_ERROR = 'İşlem tamamlanamadı. Lütfen tekrar deneyin.';

export const TDM_DRIVER_INVITE_TITLE = 'Güven ağından doğrudan istek';
export const TDM_DRIVER_INVITE_SUBTITLE = 'Güvenilir bağlantınızdan gelen istek.';
export const TDM_DRIVER_INVITE_POLL_WARNING = 'Bağlantı zayıf, yeniden deneniyor.';
export const TDM_CONTRIBUTION_DISCLAIMER = 'LeylekTAG katkıyı tahsil etmez.';

export const TDM_DRIVER_ROLE_BLOCK_TITLE = 'Zaten sürücüsünüz';
export const TDM_DRIVER_ROLE_BLOCK_BODY =
  'Bu özellik, yolcuların güvenilir sürücülerine doğrudan yol paylaşımı isteği göndermesi içindir. Size gelen yol paylaşımı isteklerini sürücü panelinizden kabul edebilirsiniz.';
export const TDM_DRIVER_ROLE_BLOCK_OK = 'Tamam';
export const TDM_DRIVER_ROLE_BLOCK_GO_DRIVER = 'Sürücü paneline git';

export function formatTdmVehiclePreference(
  value: string | null | undefined,
): string {
  const raw = String(value || '').trim().toLowerCase();
  if (raw === 'motorcycle') return 'Motosiklet';
  if (raw === 'car') return 'Otomobil';
  if (!raw) return 'Belirtilmedi';
  return raw;
}

export function formatTdmDriverDistanceLabel(
  distanceKm: number | null | undefined,
  distanceBand: string | null | undefined,
): string {
  const km = Number(distanceKm);
  if (Number.isFinite(km) && km > 0) {
    const rounded = km >= 10 ? Math.round(km) : Math.round(km * 10) / 10;
    return `${rounded} km`;
  }

  const band = String(distanceBand || '').trim();
  switch (band) {
    case '0_5':
      return '0–5 km';
    case '5_10':
      return '5–10 km';
    case '10_20':
      return '10–20 km';
    default:
      if (band.includes('-')) return `${band} km`;
      if (band) return band;
      return 'Yakın mesafe';
  }
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
