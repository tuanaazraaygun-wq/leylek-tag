/**
 * Controlled trust & safety protocol steps for the marketing homepage.
 * Static curated content — wire to product docs or live status when available.
 */

export type TrustProtocolPhase = "identity" | "comms" | "verify" | "support";

export type TrustProtocolStep = {
  id: string;
  order: number;
  title: string;
  description: string;
  statusLabel: string;
  phase: TrustProtocolPhase;
  /** Leylek Zeka step lists helper capabilities instead of a gate. */
  supportPoints?: readonly string[];
};

export const TRUST_SAFETY_PROTOCOL_STEPS: readonly TrustProtocolStep[] = [
  {
    id: "profile-visibility",
    order: 1,
    title: "Profil görünürlüğü",
    description: "Eşleşme öncesi doğrulanmış profil sinyalleri ve güven katmanı görünürlüğü sağlanır.",
    statusLabel: "Doğrulandı",
    phase: "identity",
  },
  {
    id: "voice-text-comms",
    order: 2,
    title: "Sesli ve yazılı iletişim",
    description: "Uygulama içi kontrollü mesajlaşma ve arama kanalları eşleşme sürecinde açılır.",
    statusLabel: "Aktif",
    phase: "comms",
  },
  {
    id: "video-trust",
    order: 3,
    title: "Görüntülü güven görüşmesi",
    description: "Yolculuk öncesi yüz yüze tanışma adımı; taraflar karar vermeden önce birbirini görür.",
    statusLabel: "Hazır",
    phase: "comms",
  },
  {
    id: "qr-start",
    order: 4,
    title: "QR başlangıç doğrulaması",
    description: "Biniş noktasında QR ile başlangıç adımı teyit edilir; süreç kontrollü şekilde başlar.",
    statusLabel: "QR aktif",
    phase: "verify",
  },
  {
    id: "qr-end",
    order: 5,
    title: "QR bitiş doğrulaması",
    description: "Varış noktasında bitiş QR adımı tamamlanır; yolculuk döngüsü güven katmanında kapanır.",
    statusLabel: "Doğrulandı",
    phase: "verify",
  },
  {
    id: "leylek-zeka",
    order: 6,
    title: "Leylek Zeka destek katmanı",
    description: "Karar vermez; rota, teklif ve güven akışlarında operasyon desteği sağlar.",
    statusLabel: "Destek katmanı",
    phase: "support",
    supportPoints: [
      "Operasyon desteği",
      "Rota uyumu desteği",
      "Güven akışı desteği",
      "Teklif optimizasyon desteği",
    ],
  },
];

export const phaseStyles: Record<
  TrustProtocolPhase,
  { node: string; badge: string; connector: string }
> = {
  identity: {
    node: "border-cyan-400/28 bg-cyan-400/10 text-cyan-100",
    badge: "bg-cyan-400/10 text-cyan-100/95 ring-cyan-400/20",
    connector: "from-cyan-400/35",
  },
  comms: {
    node: "border-sky-400/26 bg-sky-400/10 text-sky-100",
    badge: "bg-sky-400/10 text-sky-100/95 ring-sky-400/20",
    connector: "from-sky-400/30",
  },
  verify: {
    node: "border-emerald-400/26 bg-emerald-400/10 text-emerald-100",
    badge: "bg-emerald-400/10 text-emerald-100/95 ring-emerald-400/20",
    connector: "from-emerald-400/30",
  },
  support: {
    node: "border-violet-400/24 bg-violet-400/8 text-violet-100",
    badge: "bg-violet-400/10 text-violet-100/95 ring-violet-400/20",
    connector: "from-violet-400/25",
  },
};
