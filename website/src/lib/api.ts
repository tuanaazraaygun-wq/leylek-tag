/** Public marketing API — browser calls same-origin `/api/intercity` proxy (no secrets). */

export const INTERCITY_PROXY_PATH = "/api/intercity";

export type IntercityLiveRoute = {
  id: string;
  fromCity: string;
  toCity: string;
  dateTime: string;
  seats: number;
  suggestedCost: string;
  type: string;
  status: string;
};

export type IntercityLiveStats = {
  activeListings: string;
  pendingMatches: string;
  todayRoutes: string;
  busiestRoute: string;
};

export type IntercityLiveResponse = {
  success: boolean;
  stats: IntercityLiveStats;
  routes: IntercityLiveRoute[];
  activities?: unknown[];
};

export async function fetchIntercityLive(): Promise<IntercityLiveResponse> {
  const res = await fetch(INTERCITY_PROXY_PATH, {
    credentials: "omit",
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Intercity live HTTP ${res.status}`);
  }
  const data = (await res.json()) as IntercityLiveResponse;
  return data;
}
