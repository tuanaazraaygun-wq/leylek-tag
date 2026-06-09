/** Meta Growth Center status yanıtı — yalnızca boolean bayraklar, secret yok. */
export type MetaGrowthStatusPayload = {
  phase: 1;
  mode: "draft";
  apiCallsEnabled: false;
  pixelConfigured: boolean;
  metaAppIdConfigured: boolean;
  metaPageIdConfigured: boolean;
  metaIgUserIdConfigured: boolean;
  metaAccessTokenConfigured: boolean;
  graphConnectionConfigured: boolean;
  siteUrlConfigured: boolean;
};

export type MetaStatusApiResponse = {
  success?: boolean;
  status?: MetaGrowthStatusPayload;
  fetchedAt?: string;
  error?: string;
};
