import React, { useMemo } from 'react';
import LeylekAIFloating from '../components/LeylekAIFloating';

const FALLBACK_MESSAGE = 'Leylek\u2019e sor, yoğun bölgeleri göstereyim';

/** Son segmentte sık görülen il / ilçe adayı (adres metninden). */
function extractCityFromAddress(raw: string): string | null {
  const t = raw.replace(/\s+/g, ' ').trim();
  if (!t) return null;
  const head = t.split('/')[0].trim();
  const parts = head.split(',').map((s) => s.trim()).filter(Boolean);
  if (parts.length === 0) return null;
  const stripPostal = (s: string) => s.replace(/\b\d{5}\b/g, '').replace(/\s+/g, ' ').trim();
  for (let i = parts.length - 1; i >= 0; i -= 1) {
    const seg = stripPostal(parts[i]);
    if (seg.length < 2 || seg.length > 48) continue;
    if (/^\d+$/.test(seg)) continue;
    if (/^(mah|cad|sok|bulvar|apt|no)\b/i.test(seg)) continue;
    return seg;
  }
  return null;
}

function resolveCityLabel(profileCity?: string | null, addressContext?: string | null): string {
  const fromProfile = (profileCity ?? '').trim();
  if (fromProfile) return fromProfile;
  const fromAddr = extractCityFromAddress((addressContext ?? '').trim());
  return (fromAddr ?? '').trim();
}

type DriverWaitingLeylekAIFloatingProps = {
  /** Profildeki şehir (ör. kullanıcı kaydı). */
  profileCity?: string | null;
  /** Bekleyen talep vb. mevcut adres satırı — şehir çıkarımı için. */
  addressContext?: string | null;
};

/** Sürücü teklif / bekleme haritası — Leylek AI (app/index.tsx sürücü panelinde kullanılır). */
export function DriverWaitingLeylekAIFloating({
  profileCity,
  addressContext,
}: DriverWaitingLeylekAIFloatingProps) {
  const message = useMemo(() => {
    const city = resolveCityLabel(profileCity, addressContext);
    if (!city) return FALLBACK_MESSAGE;
    return `${city} içinde yoğun bölgeleri öğrenmek ister misin?`;
  }, [profileCity, addressContext]);

  return <LeylekAIFloating position="top-left" message={message} />;
}
