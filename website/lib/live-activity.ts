import { apiConfig } from "@/lib/config";

export type CityActivity = {
  id: string;
  label: string;
  district: string;
  tone: "cyan" | "blue" | "violet" | "emerald";
  x: number;
  y: number;
};

export type RegionIntensity = {
  id: string;
  region: string;
  level: number;
  note: string;
};

export type LiveStats = {
  activeMatches: string;
  popularRegion: string;
  routeReadiness: string;
};

export const useRealLiveData = process.env.NEXT_PUBLIC_USE_REAL_LIVE_DATA === "true";

export function getDemoCityActivity(): CityActivity[] {
  return [
    {
      id: "kizilay-cankaya-start",
      label: "Kızılay → Çankaya anında yolculuk başladı",
      district: "Kızılay",
      tone: "cyan",
      x: 50,
      y: 47,
    },
    {
      id: "cankaya-offer-density",
      label: "Çankaya bölgesi yoğun yolcu teklifi",
      district: "Çankaya",
      tone: "violet",
      x: 61,
      y: 62,
    },
    {
      id: "district-demand",
      label: "Yolcular Çankaya, Kızılay, Ulus bölgelerine gitmek istiyor",
      district: "Merkez",
      tone: "blue",
      x: 46,
      y: 54,
    },
    {
      id: "ulus-kizilay-match",
      label: "Ulus → Kızılay güvenli eşleşme yapıldı",
      district: "Ulus",
      tone: "emerald",
      x: 44,
      y: 34,
    },
    {
      id: "sihhiye-cankaya-found",
      label: "Sıhhiye → Çankaya yolcu bulundu",
      district: "Sıhhiye",
      tone: "cyan",
      x: 48,
      y: 41,
    },
  ];
}

export function getDemoRegionIntensity(): RegionIntensity[] {
  return [
    {
      id: "cankaya",
      region: "Çankaya",
      level: 92,
      note: "Şehir içi yolculuk paylaşımı talebi yüksek",
    },
    {
      id: "kizilay",
      region: "Kızılay",
      level: 78,
      note: "Aynı yöne gidenler için aktif rota ilgisi",
    },
    {
      id: "ulus",
      region: "Ulus",
      level: 64,
      note: "Güvenli eşleşme hareketliliği artıyor",
    },
  ];
}

export function getDemoLiveStats(): LiveStats {
  return {
    activeMatches: "24",
    popularRegion: "Çankaya",
    routeReadiness: "%86",
  };
}

export async function fetchRealCityActivity(): Promise<CityActivity[]> {
  // TODO: Connect to future live city activity endpoint or socket stream.
  // Possible sources: ride/create event, offer accepted event, muhabbet started event.
  // Base URL is configured through NEXT_PUBLIC_API_BASE_URL.
  void apiConfig.apiBaseUrl;

  return getDemoCityActivity();
}

export async function fetchRealRegionIntensity(): Promise<RegionIntensity[]> {
  // TODO: Connect to future region intensity endpoint or socket aggregation.
  // Possible sources: ride/create event, offer accepted event, listing created event.
  void apiConfig.apiBaseUrl;

  return getDemoRegionIntensity();
}

export async function fetchRealLiveStats(): Promise<LiveStats> {
  // TODO: Connect to future live stats endpoint/socket.
  // Possible sources: ride/create event, offer accepted event,
  // listing created event, muhabbet started event, intercity listing created event.
  void apiConfig.apiBaseUrl;

  return getDemoLiveStats();
}
