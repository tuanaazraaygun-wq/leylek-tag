/**
 * Mock AI ön kontrol — gerçek model entegrasyonu öncesi UX doğrulaması.
 * Görüntü veri boyutuna göre deterministik green / yellow / red üretir.
 */

export type AiTier = 'green' | 'yellow' | 'red';

export type AiMockResult = {
  status: AiTier;
  title: string;
  messages: string[];
};

function delay(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

function base64PayloadLength(dataUrl: string | null | undefined): number {
  if (!dataUrl || typeof dataUrl !== 'string') return 0;
  const idx = dataUrl.indexOf(',');
  const raw = idx >= 0 ? dataUrl.slice(idx + 1) : dataUrl;
  return raw.length;
}

export async function analyzeVehicleMock(dataUrl: string | null | undefined): Promise<AiMockResult> {
  await delay(550);
  const n = base64PayloadLength(dataUrl);
  if (n < 6000) {
    return {
      status: 'red',
      title: 'Araç fotoğrafı yetersiz',
      messages: [
        'Görüntü çok düşük çözünürlükte veya eksik görünüyor.',
        'Plakanın net ve okunaklı olduğu, aracın tamamının kadrajda olduğu bir fotoğraf yükleyin.',
      ],
    };
  }
  if (n < 22000) {
    return {
      status: 'yellow',
      title: 'Ön kontrol: iyileştirme önerilir',
      messages: [
        'Genel olarak kabul edilebilir; plaka veya kadraj biraz daha net olabilir.',
        'Mümkünse daha iyi ışıkta tekrar çekebilirsiniz (devam edebilirsiniz).',
      ],
    };
  }
  return {
    status: 'green',
    title: 'Araç fotoğrafı uygun görünüyor',
    messages: ['Araç görünürlüğü mock olarak uygun.', 'Plaka alanı tespit edildi (mock).'],
  };
}

export async function analyzeLicenseMock(dataUrl: string | null | undefined): Promise<AiMockResult> {
  await delay(550);
  const n = base64PayloadLength(dataUrl);
  if (n < 5000) {
    return {
      status: 'red',
      title: 'Ehliyet fotoğrafı yetersiz',
      messages: [
        'Belge net okunmuyor veya kadraj dışında kalmış olabilir.',
        'Ehliyetin dört köşesinin göründüğü, yazıların okunabildiği bir fotoğraf yükleyin.',
      ],
    };
  }
  if (n < 18000) {
    return {
      status: 'yellow',
      title: 'Ön kontrol: dikkat',
      messages: [
        'Belge mock olarak sınırda; admin incelemesinde sorulabilir.',
        'Gölgeleri azaltıp daha düz açıdan çekmek iyi olur (devam edebilirsiniz).',
      ],
    };
  }
  return {
    status: 'green',
    title: 'Ehliyet fotoğrafı uygun görünüyor',
    messages: ['Belge çerçevesi mock olarak uygun.', 'Metin alanı okunabilir görünüyor (mock).'],
  };
}

export function combineAiTier(a: AiMockResult | null, b: AiMockResult | null): AiTier {
  const tiers: AiTier[] = [a?.status || 'green', b?.status || 'green'];
  if (tiers.includes('red')) return 'red';
  if (tiers.includes('yellow')) return 'yellow';
  return 'green';
}

export function combineAiWarnings(a: AiMockResult | null, b: AiMockResult | null, max = 40): string[] {
  const out = [...(a?.messages ?? []), ...(b?.messages ?? [])];
  return out.slice(0, max);
}
