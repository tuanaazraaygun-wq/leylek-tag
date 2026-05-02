export type ActivityItem = {
  id: string;
  label: string;
  region: string;
  tone: "cyan" | "violet" | "emerald";
};

export type IntercityListing = {
  id: string;
  from: string;
  to: string;
  dateTime: string;
  seats: number;
  contribution: string;
  rating: number;
  note: string;
};

export const activityFeed: ActivityItem[] = [
  {
    id: "ankara-eskisehir",
    label: "Ankara -> Eskisehir icin yeni yolculuk paylasildi",
    region: "Ic Anadolu",
    tone: "cyan",
  },
  {
    id: "istanbul-eslesme",
    label: "Istanbul icinde yeni eslesme basladi",
    region: "Sehir ici",
    tone: "violet",
  },
  {
    id: "muhabbet-basladi",
    label: "Bir teklif akışı başlatıldı",
    region: "Topluluk",
    tone: "emerald",
  },
  {
    id: "izmir-bursa",
    label: "Izmir -> Bursa icin bos koltuk paylasimi eklendi",
    region: "Ege",
    tone: "cyan",
  },
  {
    id: "konya-ankara",
    label: "Konya -> Ankara icin ayni yone gidenler bulustu",
    region: "Masraf paylasimi",
    tone: "violet",
  },
];

export const intercityListings: IntercityListing[] = [
  {
    id: "ankara-istanbul",
    from: "Ankara",
    to: "Istanbul",
    dateTime: "Cuma, 19:30",
    seats: 3,
    contribution: "650 TL",
    rating: 4.9,
    note: "Ayni yone gidenlerle konforlu yolculuk paylasimi",
  },
  {
    id: "izmir-eskisehir",
    from: "Izmir",
    to: "Eskisehir",
    dateTime: "Cumartesi, 10:00",
    seats: 2,
    contribution: "520 TL",
    rating: 4.8,
    note: "Bos koltuk paylasimi ve guvenli iletisim",
  },
  {
    id: "bursa-antalya",
    from: "Bursa",
    to: "Antalya",
    dateTime: "Pazar, 08:15",
    seats: 1,
    contribution: "780 TL",
    rating: 4.7,
    note: "Planli rota, topluluk puani ve uygulamada goruntuleme",
  },
];

export const featurePillars = [
  "yolculuk paylasimi",
  "masraf paylasimi",
  "ayni yone gidenler",
  "guvenli eslesme",
  "topluluk",
  "bos koltuk paylasimi",
];
