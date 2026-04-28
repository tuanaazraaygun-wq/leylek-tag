export const apiConfig = {
  apiBaseUrl: process.env.NEXT_PUBLIC_API_BASE_URL ?? "",
};

export const hasApiBaseUrl = apiConfig.apiBaseUrl.trim().length > 0;
