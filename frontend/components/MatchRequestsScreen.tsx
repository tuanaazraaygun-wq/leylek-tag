/**
 * Muhabbet — teklif sahibine gelen talepler (/listing-match-requests/me).
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, type Href } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { ScreenHeaderGradient } from './ScreenHeaderGradient';
import { GradientButton } from './GradientButton';
import { CockpitBackground, GlassSurface, PremiumText } from '../design-system/primitives';
import { LDS_BORDER_COLOR } from '../design-system/tokens/border';
import { PREMIUM_AUTH_CYAN, PREMIUM_TEXT_SOFT } from '../design-system/tokens/color';
import { LDS_ELEVATION } from '../design-system/tokens/elevation';
import { LDS_RADIUS } from '../design-system/tokens/radius';
import { LDS_SPACING } from '../design-system/tokens/spacing';
import { getPersistedAccessToken } from '../lib/sessionToken';
import { handleUnauthorizedAndMaybeRedirect } from '../lib/muhabbetAuthRedirect';
import { appAlert } from '../contexts/AppAlertContext';

const PRIMARY_GRAD = ['#3B82F6', '#60A5FA'] as const;

export type MatchRequestMeRow = {
  id: string;
  sender_user_id?: string;
  sender_name?: string | null;
  sender_user_name?: string | null;
  sender_rating?: number | null;
  sender_total_trips?: number | null;
  message?: string | null;
  time_match_hint?: string | null;
  status?: string | null;
  conversation_id?: string | null;
  listing?: { from_text?: string | null; to_text?: string | null } | null;
};

function routeLine(from?: string | null, to?: string | null): string {
  return `${(from && String(from).trim()) || '—'} → ${(to && String(to).trim()) || '—'}`;
}

function formatSenderRating(rating: number | null | undefined): string | null {
  const n = Number(rating);
  return Number.isFinite(n) && n > 0 ? n.toFixed(1) : null;
}

function formatSenderTrips(trips: number | null | undefined): string | null {
  if (trips == null) return null;
  const n = Number(trips);
  return Number.isFinite(n) && n >= 0 ? String(n) : null;
}

function pushToChat(
  router: { push: (h: Href) => void },
  p: { conversationId: string; otherUserName: string; fromText: string; toText: string; otherUserId?: string }
) {
  const q = new URLSearchParams();
  if (p.otherUserName) q.set('n', p.otherUserName);
  if (p.fromText) q.set('f', p.fromText);
  if (p.toText) q.set('t', p.toText);
  if (p.otherUserId) q.set('ou', p.otherUserId);
  const s = q.toString();
  const path = s
    ? (`/muhabbet-chat/${encodeURIComponent(p.conversationId)}?${s}` as const)
    : (`/muhabbet-chat/${encodeURIComponent(p.conversationId)}` as const);
  router.push(path as Href);
}

export type MatchRequestsScreenProps = {
  apiBaseUrl: string;
  onBack?: () => void;
};

export default function MatchRequestsScreen({ apiBaseUrl, onBack }: MatchRequestsScreenProps) {
  const router = useRouter();
  const base = apiBaseUrl.replace(/\/$/, '');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [rows, setRows] = useState<MatchRequestMeRow[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<'accept' | 'reject' | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const token = (await getPersistedAccessToken())?.trim();
      if (!token) {
        setRows([]);
        return;
      }
      let res = await fetch(`${base}/muhabbet/listing-match-requests/me?status=pending&limit=80`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 404) {
        res = await fetch(`${base}/muhabbet/match-requests/incoming?status=pending&limit=80`, {
          headers: { Authorization: `Bearer ${token}` },
        });
      }
      if (handleUnauthorizedAndMaybeRedirect(res)) {
        setRows([]);
        return;
      }
      const d = (await res.json().catch(() => ({}))) as { success?: boolean; requests?: MatchRequestMeRow[] };
      if (res.ok && d.success && Array.isArray(d.requests)) setRows(d.requests);
      else setRows([]);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [base]);

  useEffect(() => {
    void load();
  }, [load]);

  const onPull = async () => {
    setRefreshing(true);
    try {
      await load();
    } finally {
      setRefreshing(false);
    }
  };

  const onAccept = async (row: MatchRequestMeRow) => {
    const token = (await getPersistedAccessToken())?.trim();
    if (!token) return;
    setBusyId(row.id);
    setBusyAction('accept');
    try {
      const res = await fetch(`${base}/muhabbet/match-requests/${encodeURIComponent(row.id)}/accept`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: '{}',
      });
      if (handleUnauthorizedAndMaybeRedirect(res)) return;
      const d = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        conversation_id?: string;
        detail?: string;
      };
      if (!res.ok || !d.success || !d.conversation_id) {
        appAlert(
          'Talep kabul edilemedi',
          typeof d.detail === 'string' && d.detail ? d.detail : 'İstek tamamlanamadı. Lütfen tekrar deneyin.',
          [{ text: 'Tamam' }],
          { tone: 'error' },
        );
        return;
      }
      const sid = String(row.sender_user_id || '').trim();
      pushToChat(router, {
        conversationId: d.conversation_id,
        otherUserName: (row.sender_user_name || row.sender_name || 'Kullanıcı').trim(),
        fromText: String(row.listing?.from_text || ''),
        toText: String(row.listing?.to_text || ''),
        otherUserId: sid || undefined,
      });
      void load();
    } catch {
      appAlert(
        'Bağlantı hatası',
        'İstek tamamlanamadı. Lütfen tekrar deneyin.',
        [{ text: 'Tamam' }],
        { tone: 'error' },
      );
    } finally {
      setBusyId(null);
      setBusyAction(null);
    }
  };

  const onReject = async (row: MatchRequestMeRow) => {
    const token = (await getPersistedAccessToken())?.trim();
    if (!token) return;
    setBusyId(row.id);
    setBusyAction('reject');
    try {
      const res = await fetch(`${base}/muhabbet/match-requests/${encodeURIComponent(row.id)}/reject`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: '{}',
      });
      const d = (await res.json().catch(() => ({}))) as { success?: boolean; detail?: string };
      if (!res.ok || !d.success) {
        appAlert(
          'Talep reddedilemedi',
          typeof d.detail === 'string' && d.detail ? d.detail : 'İstek tamamlanamadı. Lütfen tekrar deneyin.',
          [{ text: 'Tamam' }],
          { tone: 'error' },
        );
        return;
      }
      void load();
    } catch {
      appAlert(
        'Bağlantı hatası',
        'İstek tamamlanamadı. Lütfen tekrar deneyin.',
        [{ text: 'Tamam' }],
        { tone: 'error' },
      );
    } finally {
      setBusyId(null);
      setBusyAction(null);
    }
  };

  const openProfile = (userId: string | undefined) => {
    const id = (userId || '').trim();
    if (!id) return;
    router.push(`/muhabbet-profile/${encodeURIComponent(id)}` as Href);
  };

  return (
    <SafeAreaView style={styles.root} edges={['left', 'right', 'bottom']}>
      <CockpitBackground />
      <ScreenHeaderGradient
        title="Gelen talepler"
        onBack={onBack ?? (() => router.back())}
        gradientColors={PRIMARY_GRAD}
      />
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={PREMIUM_AUTH_CYAN} />
          <PremiumText variant="body" muted style={styles.loadingText}>
            Talepler yükleniyor
          </PremiumText>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scroll}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => void onPull()} tintColor={PREMIUM_AUTH_CYAN} />
          }
        >
          <GlassSurface variant="plain" borderRadius={LDS_RADIUS.md} style={styles.leadPanel}>
            <GlassSurface variant="plain" borderRadius={LDS_RADIUS.full} style={styles.guardianChip}>
              <Ionicons name="compass-outline" size={14} color="rgba(34,211,238,0.82)" />
              <PremiumText variant="caption" style={styles.guardianChipText}>
                Talep değerlendirme
              </PremiumText>
            </GlassSurface>
            <PremiumText variant="body" muted style={styles.lead}>
              Gelen talepler değerlendiriliyor. Kabul ettiğinizde sohbet açılır.
            </PremiumText>
          </GlassSurface>

          {rows.length === 0 ? (
            <GlassSurface variant="plain" borderRadius={LDS_RADIUS.lg} style={styles.emptyPanel}>
              <PremiumText variant="title" style={styles.emptyTitle}>
                Eşleşme bekleniyor
              </PremiumText>
              <PremiumText variant="body" muted style={styles.emptyBody}>
                Uygun talep gelince burada görünür.
              </PremiumText>
            </GlassSurface>
          ) : (
            rows.map((r) => {
              const name = (r.sender_user_name || r.sender_name || 'Kullanıcı').trim();
              const ratingText = formatSenderRating(r.sender_rating);
              const tripsText = formatSenderTrips(r.sender_total_trips);
              const acceptBusy = busyId === r.id && busyAction === 'accept';
              const rejectBusy = busyId === r.id && busyAction === 'reject';
              const timeHint = String(r.time_match_hint || '').trim();
              return (
                <GlassSurface key={r.id} variant="plain" borderRadius={LDS_RADIUS.lg} style={styles.card}>
                  <GlassSurface variant="plain" borderRadius={LDS_RADIUS.full} style={styles.statusChip}>
                    <PremiumText variant="caption" style={styles.statusChipText}>
                      Değerlendirme bekliyor
                    </PremiumText>
                  </GlassSurface>
                  <PremiumText variant="title" style={styles.name}>
                    {name}
                  </PremiumText>
                  {ratingText || tripsText ? (
                    <View style={styles.metaRow}>
                      {ratingText ? (
                        <View style={styles.metaItem}>
                          <Ionicons name="star" size={13} color={PREMIUM_AUTH_CYAN} />
                          <PremiumText variant="caption" muted style={styles.metaText}>
                            {ratingText}
                          </PremiumText>
                        </View>
                      ) : null}
                      {tripsText ? (
                        <View style={styles.metaItem}>
                          <Ionicons name="navigate-outline" size={13} color={PREMIUM_AUTH_CYAN} />
                          <PremiumText variant="caption" muted style={styles.metaText}>
                            {tripsText} yolculuk
                          </PremiumText>
                        </View>
                      ) : null}
                    </View>
                  ) : null}
                  <PremiumText variant="body" style={styles.route}>
                    {routeLine(r.listing?.from_text, r.listing?.to_text)}
                  </PremiumText>
                  {r.message ? (
                    <PremiumText variant="body" muted style={styles.msg} numberOfLines={4}>
                      “{r.message}”
                    </PremiumText>
                  ) : null}
                  {timeHint ? (
                    <PremiumText variant="caption" muted style={styles.hint}>
                      Zaman uyumu: {timeHint}
                    </PremiumText>
                  ) : null}
                  <View style={styles.row}>
                    <Pressable onPress={() => openProfile(r.sender_user_id)} style={styles.linkBtn}>
                      <PremiumText variant="body" style={styles.linkText}>
                        Profili gör
                      </PremiumText>
                    </Pressable>
                    <Pressable onPress={() => void onReject(r)} disabled={!!busyId}>
                      <PremiumText variant="body" muted style={styles.reject}>
                        {rejectBusy ? '…' : 'Reddet'}
                      </PremiumText>
                    </Pressable>
                    <GradientButton
                      label="Kabul et"
                      loading={acceptBusy}
                      onPress={() => void onAccept(r)}
                      style={{ minWidth: 112 }}
                    />
                  </View>
                </GlassSurface>
              );
            })
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: LDS_SPACING.sm,
  },
  loadingText: {
    textAlign: 'center',
  },
  scroll: {
    padding: LDS_SPACING.md,
    paddingBottom: LDS_SPACING.xl,
    gap: LDS_SPACING.sm,
  },
  leadPanel: {
    padding: LDS_SPACING.md,
    marginBottom: LDS_SPACING.xs,
    backgroundColor: 'rgba(16,26,43,0.88)',
    borderColor: LDS_BORDER_COLOR.card,
    ...LDS_ELEVATION.chip,
  },
  guardianChip: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: LDS_SPACING.xxs,
    paddingHorizontal: LDS_SPACING.sm,
    paddingVertical: LDS_SPACING.xxs,
    marginBottom: LDS_SPACING.sm,
    backgroundColor: 'rgba(5,11,24,0.55)',
    borderColor: LDS_BORDER_COLOR.card,
    borderTopColor: LDS_BORDER_COLOR.cardTopCyan,
    ...LDS_ELEVATION.flat,
  },
  guardianChipText: {
    fontWeight: '700',
    letterSpacing: 0.2,
    color: 'rgba(186, 230, 253, 0.92)',
  },
  lead: {
    lineHeight: 20,
  },
  emptyPanel: {
    padding: LDS_SPACING.lg,
    alignItems: 'center',
    backgroundColor: 'rgba(16,26,43,0.88)',
    borderColor: LDS_BORDER_COLOR.card,
    ...LDS_ELEVATION.chip,
  },
  emptyTitle: {
    fontWeight: '700',
    color: PREMIUM_TEXT_SOFT,
    textAlign: 'center',
    marginBottom: LDS_SPACING.xs,
  },
  emptyBody: {
    textAlign: 'center',
    lineHeight: 20,
  },
  card: {
    padding: LDS_SPACING.md,
    marginBottom: LDS_SPACING.sm,
    backgroundColor: 'rgba(16,26,43,0.92)',
    borderColor: LDS_BORDER_COLOR.card,
    ...LDS_ELEVATION.chip,
  },
  statusChip: {
    alignSelf: 'flex-start',
    paddingHorizontal: LDS_SPACING.sm,
    paddingVertical: LDS_SPACING.xxs,
    marginBottom: LDS_SPACING.sm,
    backgroundColor: 'rgba(5,11,24,0.55)',
    borderColor: LDS_BORDER_COLOR.card,
    ...LDS_ELEVATION.flat,
  },
  statusChipText: {
    fontWeight: '700',
    color: 'rgba(186, 230, 253, 0.92)',
    letterSpacing: 0.1,
  },
  name: {
    fontWeight: '700',
    color: PREMIUM_TEXT_SOFT,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: LDS_SPACING.sm,
    marginTop: LDS_SPACING.xxs,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: LDS_SPACING.xxs,
  },
  metaText: {
    fontWeight: '600',
  },
  route: {
    marginTop: LDS_SPACING.xs,
    fontWeight: '600',
    lineHeight: 22,
    color: PREMIUM_TEXT_SOFT,
  },
  msg: {
    marginTop: LDS_SPACING.xs,
    lineHeight: 20,
  },
  hint: {
    marginTop: LDS_SPACING.xs,
  },
  row: {
    marginTop: LDS_SPACING.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: LDS_SPACING.xs,
    flexWrap: 'wrap',
  },
  linkBtn: {
    paddingVertical: LDS_SPACING.xxs,
    paddingHorizontal: LDS_SPACING.xxs,
  },
  linkText: {
    color: PREMIUM_AUTH_CYAN,
    fontWeight: '700',
  },
  reject: {
    fontWeight: '600',
    paddingHorizontal: LDS_SPACING.xs,
  },
});
