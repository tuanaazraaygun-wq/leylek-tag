export const SUPPORT_TICKET_ID_KEY = "support_ticket_id";
export const SUPPORT_CLIENT_TOKEN_KEY = "support_client_token";

export type StoredSupportTicket = {
  ticketId: string;
  clientToken: string;
};

export function readStoredSupportTicket(): StoredSupportTicket | null {
  try {
    if (typeof window === "undefined") return null;
    const ticketId = window.localStorage.getItem(SUPPORT_TICKET_ID_KEY)?.trim() ?? "";
    const clientToken = window.localStorage.getItem(SUPPORT_CLIENT_TOKEN_KEY)?.trim() ?? "";
    if (!ticketId || !clientToken) return null;
    return { ticketId, clientToken };
  } catch {
    return null;
  }
}

export function writeStoredSupportTicket(ticketId: string, clientToken: string): void {
  try {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(SUPPORT_TICKET_ID_KEY, ticketId);
    window.localStorage.setItem(SUPPORT_CLIENT_TOKEN_KEY, clientToken);
  } catch {
    /* noop */
  }
}

export function clearStoredSupportTicket(): void {
  try {
    if (typeof window === "undefined") return;
    window.localStorage.removeItem(SUPPORT_TICKET_ID_KEY);
    window.localStorage.removeItem(SUPPORT_CLIENT_TOKEN_KEY);
  } catch {
    /* noop */
  }
}
