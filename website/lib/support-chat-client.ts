import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const ticketClientsByTokenLower = new Map<string, SupabaseClient>();

/** Public destek kartı için ayrı istemci (anon JWT; site oturumundan bağımsız). `x-support-client-token` ile RLS bağlanır. */
export function getSupabaseTicketChatClient(clientToken: string): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!url || !anonKey) return null;

  const headerVal = clientToken.trim();
  const cacheKey = headerVal.toLowerCase();
  if (!cacheKey) return null;

  const existing = ticketClientsByTokenLower.get(cacheKey);
  if (existing) return existing;

  const client = createClient(url, anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
      flowType: "pkce",
    },
    global: {
      headers: {
        "x-support-client-token": headerVal,
      },
    },
  });

  ticketClientsByTokenLower.set(cacheKey, client);
  return client;
}
