import { apiConfig } from "@/lib/config";
import { intercityListings } from "@/lib/mock-data";

export function getIntercityListings() {
  // TODO: Connect this to ride_listings or a dedicated listings endpoint.
  // The base URL is already configurable through NEXT_PUBLIC_API_BASE_URL.
  void apiConfig.apiBaseUrl;

  return intercityListings;
}
