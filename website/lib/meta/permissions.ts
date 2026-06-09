/**
 * Meta Graph API izin ve faz planı — statik referans (API çağrısı yok).
 */

export type GraphApiPhase = {
  phase: string;
  title: string;
  detail: string;
  permissions: string[];
  apiCalls: "none" | "read-only" | "write-with-approval";
};

export const GRAPH_API_ROADMAP: GraphApiPhase[] = [
  {
    phase: "Faz 1",
    title: "Durum paneli · taslak mod",
    detail: "Env checklist, Pixel/domain/Page/IG hazırlık; Graph API çağrısı yok.",
    permissions: [],
    apiCalls: "none",
  },
  {
    phase: "Faz 2",
    title: "İçerik taslak üretici",
    detail: "Social Studio + opsiyonel OpenAI önerisi; yayın yok.",
    permissions: [],
    apiCalls: "none",
  },
  {
    phase: "Faz 3",
    title: "Graph API read-only test",
    detail: "Page/IG profil, medya listesi, temel insights salt okunur.",
    permissions: [
      "pages_show_list",
      "pages_read_engagement",
      "instagram_basic",
      "instagram_manage_insights",
    ],
    apiCalls: "read-only",
  },
  {
    phase: "Faz 4",
    title: "Admin onaylı yayınlama",
    detail: "Tek hedef Page/IG; önizleme + onay kapısı; audit log.",
    permissions: [
      "pages_manage_posts",
      "instagram_content_publish",
      "instagram_manage_comments",
    ],
    apiCalls: "write-with-approval",
  },
  {
    phase: "Faz 5",
    title: "Yorum / mention inbox",
    detail: "Moderasyon kuyruğu; admin onaylı yanıt taslakları.",
    permissions: ["pages_read_user_content", "instagram_manage_comments"],
    apiCalls: "read-only",
  },
];

export const BUSINESS_MANAGEMENT_NOTE =
  "business_management genelde Business Manager asset atama ve App Review için gerekir.";
