/**
 * B4-1 — LSX event registry (declarative bindings only — no fire/orchestrate).
 */

import type { LsxEventBinding, LsxEventId } from './types';

const BINDINGS: readonly LsxEventBinding[] = [
  {
    eventId: 'brand.boot',
    motion: 'brand.boot',
    sonic: 'brand.boot',
    haptic: null,
    priority: 'ambient',
    dedupe: { strategy: 'oncePerSessionKey', keyField: 'eventId' },
    rollbackId: 'lsx.brand.boot',
    scope: 'global',
  },
  {
    eventId: 'screen.enter',
    motion: 'screen.enter',
    sonic: null,
    haptic: null,
    priority: 'low',
    dedupe: { strategy: 'none' },
    rollbackId: 'lsx.screen.enter',
    scope: 'global',
  },
  {
    eventId: 'screen.exit',
    motion: 'screen.exit',
    sonic: null,
    haptic: null,
    priority: 'low',
    dedupe: { strategy: 'none' },
    rollbackId: 'lsx.screen.exit',
    scope: 'global',
  },
  {
    eventId: 'match.accept',
    motion: 'match.accept',
    sonic: 'match.accept',
    haptic: 'match.accept',
    priority: 'critical',
    dedupe: { strategy: 'cooldownMs', cooldownMs: 2800, keyField: 'tagId' },
    rollbackId: 'lsx.match.accept',
    scope: 'journey',
  },
  {
    eventId: 'match.reject',
    motion: 'match.reject',
    sonic: null,
    haptic: 'match.reject',
    priority: 'normal',
    dedupe: { strategy: 'cooldownMs', cooldownMs: 800, keyField: 'tagId' },
    rollbackId: 'lsx.match.reject',
    scope: 'journey',
  },
  {
    eventId: 'offer.new',
    motion: 'offer.new',
    sonic: 'offer.new',
    haptic: 'offer.new',
    priority: 'critical',
    dedupe: { strategy: 'oncePerSessionKey', keyField: 'tagId' },
    rollbackId: 'lsx.offer.new',
    scope: 'driver',
  },
  {
    eventId: 'offer.accept',
    motion: 'offer.accept',
    sonic: 'offer.accept',
    haptic: 'offer.accept',
    priority: 'high',
    dedupe: { strategy: 'cooldownMs', cooldownMs: 70 },
    rollbackId: 'lsx.offer.accept',
    scope: 'passenger',
  },
  {
    eventId: 'offer.reject',
    motion: 'offer.reject',
    sonic: null,
    haptic: 'offer.reject',
    priority: 'normal',
    dedupe: { strategy: 'cooldownMs', cooldownMs: 500 },
    rollbackId: 'lsx.offer.reject',
    scope: 'passenger',
  },
  {
    eventId: 'journey.start',
    motion: 'journey.start',
    sonic: 'journey.start',
    haptic: 'journey.start',
    priority: 'critical',
    dedupe: { strategy: 'oncePerSessionKey', keyField: 'tagId' },
    rollbackId: 'lsx.journey.start',
    scope: 'journey',
  },
  {
    eventId: 'journey.finish',
    motion: 'journey.finish',
    sonic: 'journey.finish',
    haptic: 'journey.finish',
    priority: 'high',
    dedupe: { strategy: 'oncePerSessionKey', keyField: 'tagId' },
    rollbackId: 'lsx.journey.finish',
    scope: 'journey',
  },
  {
    eventId: 'qr.scan.success',
    motion: 'qr.scan.success',
    sonic: 'qr.scan.success',
    haptic: 'qr.scan.success',
    priority: 'critical',
    dedupe: { strategy: 'cooldownMs', cooldownMs: 500, keyField: 'scanSessionId' },
    rollbackId: 'lsx.qr.scan.success',
    scope: 'qr',
  },
  {
    eventId: 'qr.scan.error',
    motion: 'qr.scan.error',
    sonic: 'qr.scan.error',
    haptic: 'qr.scan.error',
    priority: 'high',
    dedupe: { strategy: 'cooldownMs', cooldownMs: 500, keyField: 'scanSessionId' },
    rollbackId: 'lsx.qr.scan.error',
    scope: 'qr',
  },
  {
    eventId: 'payment.success',
    motion: 'payment.success',
    sonic: 'payment.success',
    haptic: 'payment.success',
    priority: 'critical',
    dedupe: { strategy: 'cooldownMs', cooldownMs: 1000, keyField: 'tagId' },
    rollbackId: 'lsx.payment.success',
    scope: 'payment',
  },
  {
    eventId: 'payment.error',
    motion: 'payment.error',
    sonic: 'payment.error',
    haptic: 'payment.error',
    priority: 'high',
    dedupe: { strategy: 'cooldownMs', cooldownMs: 1200 },
    rollbackId: 'lsx.payment.error',
    scope: 'payment',
  },
  {
    eventId: 'trust.connected',
    motion: 'trust.connected',
    sonic: 'trust.connected',
    haptic: 'trust.connected',
    priority: 'high',
    dedupe: { strategy: 'oncePerSessionKey', keyField: 'tagId' },
    rollbackId: 'lsx.trust.connected',
    scope: 'trust',
  },
  {
    eventId: 'rating.complete',
    motion: 'rating.complete',
    sonic: 'rating.complete',
    haptic: 'rating.complete',
    priority: 'normal',
    dedupe: { strategy: 'oncePerSessionKey', keyField: 'tagId' },
    rollbackId: 'lsx.rating.complete',
    scope: 'payment',
  },
  {
    eventId: 'loading',
    motion: 'loading',
    sonic: null,
    haptic: null,
    priority: 'ambient',
    dedupe: { strategy: 'none' },
    rollbackId: 'lsx.loading',
    scope: 'global',
  },
  {
    eventId: 'success',
    motion: 'success',
    sonic: 'success',
    haptic: 'success',
    priority: 'normal',
    dedupe: { strategy: 'cooldownMs', cooldownMs: 800 },
    rollbackId: 'lsx.success',
    scope: 'global',
  },
  {
    eventId: 'warning',
    motion: 'warning',
    sonic: 'warning',
    haptic: 'warning',
    priority: 'normal',
    dedupe: { strategy: 'cooldownMs', cooldownMs: 1200 },
    rollbackId: 'lsx.warning',
    scope: 'global',
  },
  {
    eventId: 'error',
    motion: 'error',
    sonic: 'error',
    haptic: 'error',
    priority: 'high',
    dedupe: { strategy: 'cooldownMs', cooldownMs: 1200 },
    rollbackId: 'lsx.error',
    scope: 'global',
  },
] as const;

const REGISTRY_MAP: ReadonlyMap<LsxEventId, LsxEventBinding> = new Map(
  BINDINGS.map((b) => [b.eventId, b]),
);

export const LSX_EVENT_REGISTRY: readonly LsxEventBinding[] = BINDINGS;

export const LSX_EVENT_IDS: readonly LsxEventId[] = BINDINGS.map((b) => b.eventId);

export function getLsxEventBinding(eventId: LsxEventId): LsxEventBinding {
  const binding = REGISTRY_MAP.get(eventId);
  if (!binding) {
    throw new Error(`LSX event not registered: ${eventId}`);
  }
  return binding;
}

export function tryGetLsxEventBinding(eventId: string): LsxEventBinding | null {
  if (!REGISTRY_MAP.has(eventId as LsxEventId)) {
    return null;
  }
  return REGISTRY_MAP.get(eventId as LsxEventId) ?? null;
}

export function isLsxEventId(value: string): value is LsxEventId {
  return REGISTRY_MAP.has(value as LsxEventId);
}

export function listLsxEventsByScope(scope: LsxEventBinding['scope']): readonly LsxEventBinding[] {
  return BINDINGS.filter((b) => b.scope === scope);
}

export function listLsxEventsByPriority(
  priority: LsxEventBinding['priority'],
): readonly LsxEventBinding[] {
  return BINDINGS.filter((b) => b.priority === priority);
}
