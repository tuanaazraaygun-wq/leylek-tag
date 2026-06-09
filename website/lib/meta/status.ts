/**
 * Server-only Meta Growth Center status — env varlığı (boolean), secret değer yok.
 * Meta Graph API çağrısı yapmaz.
 */

import type { MetaGrowthStatusPayload } from "@/lib/meta/types";

export type { MetaGrowthStatusPayload };

function envConfigured(key: string): boolean {
  const value = process.env[key]?.trim();
  return Boolean(value && value.length > 0);
}

/** Sunucu tarafında env varlığını boolean olarak döndürür; secret değer asla dönmez. */
export function getMetaGrowthStatus(): MetaGrowthStatusPayload {
  const pixelConfigured = envConfigured("NEXT_PUBLIC_META_PIXEL_ID");
  const metaAppIdConfigured = envConfigured("META_APP_ID");
  const metaPageIdConfigured = envConfigured("META_PAGE_ID");
  const metaIgUserIdConfigured = envConfigured("META_IG_USER_ID");
  const metaAccessTokenConfigured = envConfigured("META_ACCESS_TOKEN");

  return {
    phase: 1,
    mode: "draft",
    apiCallsEnabled: false,
    pixelConfigured,
    metaAppIdConfigured,
    metaPageIdConfigured,
    metaIgUserIdConfigured,
    metaAccessTokenConfigured,
    graphConnectionConfigured:
      metaAppIdConfigured &&
      metaPageIdConfigured &&
      metaIgUserIdConfigured &&
      metaAccessTokenConfigured,
    siteUrlConfigured: envConfigured("NEXT_PUBLIC_SITE_URL"),
  };
}
