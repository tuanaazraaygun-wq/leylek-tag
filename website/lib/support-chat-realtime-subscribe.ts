import type { RealtimeChannel, SupabaseClient } from "@supabase/supabase-js";

import { supportTypingBridgeTopic } from "@/lib/support-typing-realtime";

/** Her effect kurulumunda yeni kimlik — Strict Mode güvenli. */
export function newRealtimeInstanceId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  const perf = typeof performance !== "undefined" ? performance.now() : 0;
  return `${Date.now()}-${Math.random().toString(16).slice(2)}-${perf}`;
}

export type SubscribeChannelStatusCb = (
  status: string,
  err?: { message?: string } | Error | null,
) => void;

/**
 * Sadece postgres_changes INSERT — tek `subscribe()` en sonda (sonrasında `.on` yok).
 */
export function subscribeAdminSupportChatPostgresRealtime(options: {
  supabase: SupabaseClient;
  ticketId: string;
  instanceId: string;
  onInsert: (payloadNew: Record<string, unknown>) => void;
  onChannelStatus?: SubscribeChannelStatusCb;
  /** SUBSCRIBED olduğunda .send() için aynı channel referansı */
  onSubscribedReady?: (channel: RealtimeChannel) => void;
}): RealtimeChannel {
  const topic = `admin-support-chat:${options.ticketId}:${options.instanceId}`;
  let ch: RealtimeChannel = options.supabase.channel(topic);

  ch = ch.on(
    "postgres_changes",
    {
      event: "INSERT",
      schema: "public",
      table: "support_chat_messages",
      filter: `support_message_id=eq.${options.ticketId}`,
    },
    (payload) => {
      const row = payload.new as Record<string, unknown> | null;
      options.onInsert(row ?? {});
    },
  );

  ch.subscribe((status, err) => {
    if (status === "SUBSCRIBED") {
      options.onSubscribedReady?.(ch);
    }
    options.onChannelStatus?.(status, err);
  });

  return ch;
}

/**
 * Site tenant: iki postgres_changes + tek subscribe (en sonda).
 */
export function subscribeSiteTicketSupportPostgresRealtime(options: {
  client: SupabaseClient;
  ticketId: string;
  instanceId: string;
  onChatInsert: (payloadNew: Record<string, unknown>) => void;
  onTicketMetaUpdate: (payloadNew: Record<string, unknown>) => void;
  onChannelStatus?: SubscribeChannelStatusCb;
}): RealtimeChannel {
  const topic = `site-support-chat:${options.ticketId}:${options.instanceId}`;
  let ch: RealtimeChannel = options.client.channel(topic);

  ch = ch.on(
    "postgres_changes",
    {
      event: "INSERT",
      schema: "public",
      table: "support_chat_messages",
      filter: `support_message_id=eq.${options.ticketId}`,
    },
    (payload) => {
      const row = payload.new as Record<string, unknown> | null;
      options.onChatInsert(row ?? {});
    },
  );

  ch = ch.on(
    "postgres_changes",
    {
      event: "UPDATE",
      schema: "public",
      table: "support_messages",
      filter: `id=eq.${options.ticketId}`,
    },
    (payload) => {
      const row = payload.new as Record<string, unknown> | null;
      options.onTicketMetaUpdate(row ?? {});
    },
  );

  ch.subscribe((status, err) => {
    options.onChannelStatus?.(status, err);
  });

  return ch;
}

/**
 * Paylaşımlı yazıyor köprüsü: admin ile ziyaretçi **aynı** topic’e bağlanır;
 * postgres yok → payload çakışması riski daha düşük; yine de sıra garanti edilir.
 */
export function subscribeSupportTypingBroadcastBridge(options: {
  client: SupabaseClient;
  ticketId: string;
  incomingEvent: string;
  onIncoming: () => void;
  onChannelStatus?: SubscribeChannelStatusCb;
  onSubscribedReady?: (channel: RealtimeChannel) => void;
}): RealtimeChannel {
  const topic = supportTypingBridgeTopic(options.ticketId);

  let ch: RealtimeChannel = options.client.channel(topic, {
    config: { broadcast: { ack: false } },
  });

  ch = ch.on("broadcast", { event: options.incomingEvent }, () => {
    options.onIncoming();
  });

  ch.subscribe((status, err) => {
    if (status === "SUBSCRIBED") {
      options.onSubscribedReady?.(ch);
    }
    options.onChannelStatus?.(status, err);
  });

  return ch;
}

export type CreateAdminChatRealtimeChannelArgs = {
  supabase: SupabaseClient;
  ticketId: string;
  instanceId: string;
  onMessage: (payloadNew: Record<string, unknown>) => void;
  onChannelStatus?: SubscribeChannelStatusCb;
};

/** Alias: admin panelde net isim; arkada yalnızca postgres + tek subscribe. */
export function createAdminChatRealtimeChannel(args: CreateAdminChatRealtimeChannelArgs): RealtimeChannel {
  return subscribeAdminSupportChatPostgresRealtime({
    supabase: args.supabase,
    ticketId: args.ticketId,
    instanceId: args.instanceId,
    onInsert: args.onMessage,
    onChannelStatus: args.onChannelStatus,
  });
}
