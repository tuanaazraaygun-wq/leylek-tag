import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Animated,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { API_BASE_URL } from '../lib/backendConfig';
import { GlassSurface, PremiumText } from '../design-system/primitives';
import { LDS_BORDER_COLOR, LDS_BORDER_WIDTH } from '../design-system/tokens/border';
import { LDS_ELEVATION } from '../design-system/tokens/elevation';
import { LDS_RADIUS } from '../design-system/tokens/radius';
import { LDS_SPACING } from '../design-system/tokens/spacing';
import { PREMIUM_AUTH_CYAN, PREMIUM_BORDER_SLATE, PREMIUM_TEXT_MUTED } from './auth/premiumAuthStyles';
import { useDriverTheme } from '../lib/theme/useDriverTheme';
import DriverCockpitQuickStrip from './superUx/DriverCockpitQuickStrip';

interface DriverDashboardPanelProps {
  userId: string;
  onPackagePress: () => void;
  onToggleOnline?: (isOnline: boolean) => void;
  onTrustedPress?: () => void;
  expanded?: boolean;
  onExpandToggle?: () => void;
}

interface DashboardData {
  today: {
    trips_count: number;
    earnings: number;
  };
  weekly: {
    trips_count: number;
    earnings: number;
  };
  active_time: {
    is_active: boolean;
    remaining_seconds: number;
    remaining_text: string;
    is_online: boolean;
  };
  daily_goal: {
    target_trips: number;
    target_earnings: number;
    trips_progress: number;
    earnings_progress: number;
    overall_progress: number;
  };
  stats: {
    rating: number | null;
    total_trips: number;
  };
}

const PANEL_HEIGHT_COLLAPSED = 110;
const PANEL_HEIGHT_EXPANDED = 208;
const ONLINE_STRIP_HEIGHT = 52;

function sessionDisplayText(
  isActive: boolean,
  remainingText: string,
): string {
  if (!isActive) return 'Ücretsiz';
  if (/ücret/i.test(remainingText)) return 'Ücretsiz';
  return remainingText;
}

export default function DriverDashboardPanel({
  userId,
  onPackagePress,
  onToggleOnline,
  onTrustedPress,
  expanded = false,
  onExpandToggle,
}: DriverDashboardPanelProps) {
  const { dashboardPanelSurfaces: dpLt, ui } = useDriverTheme();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<DashboardData | null>(null);
  const [remainingText, setRemainingText] = useState('00:00:00');
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const [toggling, setToggling] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const expandAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    fetchDashboard();
    const refreshInterval = setInterval(fetchDashboard, 60000);

    return () => {
      clearInterval(refreshInterval);
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [userId]);

  useEffect(() => {
    Animated.timing(expandAnim, {
      toValue: expanded ? 1 : 0,
      duration: 300,
      useNativeDriver: false,
    }).start();
  }, [expanded]);

  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);

    if (remainingSeconds > 0 && data?.active_time?.is_active) {
      intervalRef.current = setInterval(() => {
        setRemainingSeconds(prev => {
          if (prev <= 1) return 0;
          const newVal = prev - 1;
          const hours = Math.floor(newVal / 3600);
          const minutes = Math.floor((newVal % 3600) / 60);
          const seconds = newVal % 60;
          setRemainingText(`${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`);
          return newVal;
        });
      }, 1000);
    }

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [remainingSeconds, data?.active_time?.is_active]);

  const normalizeDashboard = (raw: any): DashboardData | null => {
    if (!raw || raw.success !== true || !raw.active_time || typeof raw.active_time !== 'object') {
      return null;
    }
    let rating: number | null = null;
    try {
      const r = raw.stats?.rating;
      if (r != null && r !== '') {
        const n = Number(r);
        if (Number.isFinite(n) && n > 0) rating = n;
      }
    } catch {
      rating = null;
    }
    let totalTrips = 0;
    try {
      const t = raw.stats?.total_trips;
      if (t != null && t !== '') totalTrips = Math.max(0, Math.floor(Number(t)));
      if (!Number.isFinite(totalTrips)) totalTrips = 0;
    } catch {
      totalTrips = 0;
    }
    const dg = raw.daily_goal || {};
    const overall = Math.min(100, Math.max(0, Math.floor(Number(dg.overall_progress) || 0)));
    return {
      today: {
        trips_count: Math.max(0, Math.floor(Number(raw.today?.trips_count) || 0)),
        earnings: Math.max(0, Number(raw.today?.earnings) || 0),
      },
      weekly: {
        trips_count: Math.max(0, Math.floor(Number(raw.weekly?.trips_count) || 0)),
        earnings: Math.max(0, Number(raw.weekly?.earnings) || 0),
      },
      active_time: {
        is_active: !!raw.active_time.is_active,
        remaining_seconds: Math.max(0, Math.floor(Number(raw.active_time.remaining_seconds) || 0)),
        remaining_text: String(raw.active_time.remaining_text || '00:00:00'),
        is_online: !!raw.active_time.is_online,
      },
      daily_goal: {
        target_trips: Math.max(1, Math.floor(Number(dg.target_trips) || 10)),
        target_earnings: Math.max(1, Math.floor(Number(dg.target_earnings) || 500)),
        trips_progress: Math.min(100, Math.max(0, Math.floor(Number(dg.trips_progress) || 0))),
        earnings_progress: Math.min(100, Math.max(0, Math.floor(Number(dg.earnings_progress) || 0))),
        overall_progress: overall,
      },
      stats: { rating, total_trips: totalTrips },
    };
  };

  const fetchDashboard = async () => {
    if (!userId) {
      setLoading(false);
      return;
    }
    try {
      const response = await fetch(`${API_BASE_URL}/driver/dashboard?user_id=${userId}`);
      const result = await response.json();
      const safe = normalizeDashboard(result);
      if (safe) {
        setData(safe);
        setRemainingSeconds(safe.active_time.remaining_seconds);
        setRemainingText(safe.active_time.remaining_text || '00:00:00');
      } else {
        setData(null);
      }
    } catch (error) {
      console.error('Dashboard fetch error:', error);
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  const toggleOnline = async () => {
    if (!data) return;

    setToggling(true);
    try {
      const endpoint = data.active_time.is_online ? 'go-offline' : 'go-online';
      const response = await fetch(`${API_BASE_URL}/driver/${endpoint}?user_id=${userId}`, { method: 'POST' });
      const result = await response.json();

      if (result.success) {
        setData(prev => prev ? {
          ...prev,
          active_time: { ...prev.active_time, is_online: !prev.active_time.is_online }
        } : null);
        onToggleOnline?.(!data.active_time.is_online);
      } else if (String(result.detail ?? '').toLowerCase().includes('paket')) {
        onPackagePress();
      }
    } catch (error) {
      console.error('Toggle online error:', error);
    } finally {
      setToggling(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.stack}>
        <View style={styles.onlineStripWrap}>
          <GlassSurface variant="plain" style={[styles.onlineStripLoading, dpLt?.onlineStripLoading]} borderRadius={LDS_RADIUS.lg}>
            <ActivityIndicator size="small" color={ui.activity} />
          </GlassSurface>
        </View>
        <View style={styles.container}>
          <GlassSurface variant="panel" style={[styles.panelShellLoading, dpLt?.panelShellLoading]} borderRadius={LDS_RADIUS.xl}>
            <ActivityIndicator size="small" color={ui.activity} />
          </GlassSurface>
        </View>
      </View>
    );
  }

  if (!data) return null;

  const panelHeight = expandAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [PANEL_HEIGHT_COLLAPSED, PANEL_HEIGHT_EXPANDED],
  });

  const goalProgress = data.daily_goal.overall_progress;
  const sessionText = sessionDisplayText(data.active_time.is_active, remainingText);
  const isOnline = data.active_time.is_online;
  const availabilityLabel = isOnline ? 'Çevrimiçi' : 'Çevrimdışı';
  const onlineActionLabel = isOnline ? 'Çevrimdışı ol' : 'Çevrimiçi ol';
  const onlineStatusHint = isOnline
    ? 'Yolculuk fırsatlarını almaya hazırsın'
    : 'Çevrimiçi olunca talepler gelir';

  return (
    <View style={styles.stack}>
      <View style={styles.onlineStripWrap}>
        <GlassSurface
          variant="plain"
          style={[
            styles.onlineStrip,
            isOnline ? styles.onlineStripActive : styles.onlineStripInactive,
            isOnline ? dpLt?.onlineStripActive : dpLt?.onlineStripInactive,
          ]}
          borderRadius={LDS_RADIUS.lg}
        >
          <View style={styles.onlineStripLeft}>
            <View
              style={[
                styles.statusDot,
                isOnline ? styles.statusDotOnline : styles.statusDotOffline,
              ]}
            />
            <View style={styles.onlineTextCol}>
              <PremiumText variant="body" style={styles.onlineStatusLabel}>
                {availabilityLabel}
              </PremiumText>
              <PremiumText variant="caption" muted style={styles.onlineStatusHint} numberOfLines={1}>
                {onlineStatusHint}
              </PremiumText>
            </View>
          </View>

          <TouchableOpacity
            style={[
              styles.switchTrack,
              isOnline ? styles.switchTrackOn : styles.switchTrackOff,
              isOnline ? dpLt?.switchTrackOn : dpLt?.switchTrackOff,
              (toggling || !data.active_time.is_active) && styles.switchTrackDisabled,
            ]}
            onPress={toggleOnline}
            disabled={toggling || !data.active_time.is_active}
            activeOpacity={0.92}
            accessibilityRole="switch"
            accessibilityLabel={onlineActionLabel}
            accessibilityState={{
              checked: isOnline,
              disabled: toggling || !data.active_time.is_active,
            }}
          >
            {toggling ? (
              <ActivityIndicator size="small" color={ui.textSoft} style={styles.switchSpinner} />
            ) : (
              <View
                style={[
                  styles.switchThumb,
                  isOnline ? styles.switchThumbOn : styles.switchThumbOff,
                  isOnline && dpLt?.switchThumbOn,
                ]}
              />
            )}
          </TouchableOpacity>
        </GlassSurface>
      </View>

      <Animated.View style={[styles.container, { height: panelHeight }]}>
        <GlassSurface variant="panel" style={[styles.panelShell, dpLt?.panelShell]} borderRadius={LDS_RADIUS.xl}>
          <View style={styles.collapsedHud}>
            <View style={styles.cockpitGrid}>
              <View
                style={styles.todayCol}
                accessibilityRole="summary"
                accessibilityLabel={`Bugünkü katkılar ${data.today.earnings} lira, ${data.today.trips_count} sefer. Hedef yüzde ${goalProgress}.`}
              >
                <PremiumText variant="caption" muted style={styles.instrumentLabel}>
                  Bugünkü katkılar
                </PremiumText>
                <PremiumText variant="title" style={[styles.instrumentAmount, dpLt?.instrumentAmount]}>
                  {data.today.earnings} ₺
                </PremiumText>
                <View style={styles.instrumentMetaRow}>
                  <PremiumText variant="caption" muted style={styles.instrumentMeta}>
                    {data.today.trips_count} sefer
                  </PremiumText>
                  <PremiumText variant="caption" muted style={styles.instrumentMeta}>
                    Hedef %{goalProgress}
                  </PremiumText>
                </View>
                <View style={styles.progressTrack}>
                  <View style={[styles.progressFill, dpLt?.progressFill, { width: `${goalProgress}%` }]} />
                </View>
              </View>

              <View style={styles.gridDivider} />

              <DriverCockpitQuickStrip embedded onTrustedPress={onTrustedPress} />
            </View>

            <View style={styles.footerRow}>
              <TouchableOpacity
                style={styles.footerCell}
                onPress={onExpandToggle}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityLabel={`Seans ${sessionText}. Detayları ${expanded ? 'gizle' : 'göster'}.`}
              >
                <Ionicons
                  name="time-outline"
                  size={14}
                  color={
                    data.active_time.is_active
                      ? ui.sessionActive
                      : ui.sessionInactive
                  }
                />
                <View style={styles.footerTextCol}>
                  <PremiumText variant="caption" muted style={styles.footerMetaLabel}>
                    Seans
                  </PremiumText>
                  <PremiumText variant="caption" style={[styles.footerValue, dpLt?.footerValue]}>
                    {sessionText}
                  </PremiumText>
                </View>
                <Ionicons
                  name={expanded ? 'chevron-up' : 'chevron-down'}
                  size={16}
                  color={ui.chevron}
                />
              </TouchableOpacity>

              <View style={styles.footerDivider} />

              <TouchableOpacity
                style={styles.footerCell}
                onPress={onPackagePress}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityLabel="Paket yönetimi"
              >
                <Ionicons name="cube-outline" size={14} color={ui.iconMuted} />
                <View style={styles.footerTextCol}>
                  <PremiumText variant="caption" muted style={styles.footerMetaLabel}>
                    Paket
                  </PremiumText>
                  <PremiumText variant="caption" style={[styles.footerValue, dpLt?.footerValue]}>
                    Yönet
                  </PremiumText>
                </View>
                <Ionicons name="chevron-forward" size={14} color={ui.chevron} />
              </TouchableOpacity>
            </View>
          </View>

          {expanded && (
            <View style={styles.expandedContent}>
              <View style={styles.statsRow}>
                <View style={styles.statColumn}>
                  <View style={[styles.statIconWrap, dpLt?.statIconWrap]}>
                    <Ionicons name="car-outline" size={20} color={ui.statCar} />
                  </View>
                  <PremiumText variant="title" style={[styles.statValue, dpLt?.statValue]}>
                    {data.today.trips_count}
                  </PremiumText>
                  <PremiumText variant="caption" muted style={styles.statLabel}>
                    Bugünkü sefer
                  </PremiumText>
                </View>

                <View style={styles.statDivider} />

                <View style={styles.statColumn}>
                  <View style={[styles.statIconWrap, styles.statIconWrapViolet]}>
                    <Ionicons name="wallet-outline" size={20} color="rgba(226,232,240,0.88)" />
                  </View>
                  <PremiumText variant="title" style={[styles.statValue, dpLt?.statValue]}>
                    {data.weekly.earnings} ₺
                  </PremiumText>
                  <PremiumText variant="caption" muted style={styles.statLabel}>
                    Haftalık paylaşım katkıları
                  </PremiumText>
                </View>

                <View style={styles.statDivider} />

                <View style={styles.statColumn}>
                  <View style={[styles.statIconWrap, styles.statIconWrapAmber]}>
                    <Ionicons name="star" size={20} color="rgba(251,211,141,0.95)" />
                  </View>
                  <PremiumText variant="title" style={[styles.statValue, dpLt?.statValue]}>
                    {data.stats.rating != null && Number.isFinite(data.stats.rating) && data.stats.rating > 0
                      ? data.stats.rating.toFixed(1)
                      : '—'}
                  </PremiumText>
                  <PremiumText variant="caption" muted style={styles.statLabel}>
                    {data.stats.rating != null && Number.isFinite(data.stats.rating) && data.stats.rating > 0
                      ? 'Puan'
                      : 'Henüz değerlendirme yok'}
                  </PremiumText>
                </View>
              </View>
            </View>
          )}
        </GlassSurface>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: LDS_SPACING.xxs,
  },
  onlineStripWrap: {
    marginHorizontal: LDS_SPACING.sm,
  },
  onlineStrip: {
    minHeight: ONLINE_STRIP_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: LDS_SPACING.xs,
    paddingHorizontal: LDS_SPACING.sm,
    gap: LDS_SPACING.sm,
    borderWidth: LDS_BORDER_WIDTH.standard,
  },
  onlineStripActive: {
    borderColor: 'rgba(34,211,238,0.22)',
    borderTopColor: 'rgba(34,211,238,0.28)',
    backgroundColor: 'rgba(6,55,52,0.18)',
  },
  onlineStripInactive: {
    borderColor: LDS_BORDER_COLOR.cockpitPanel,
    backgroundColor: 'rgba(8,17,31,0.42)',
  },
  onlineStripLoading: {
    minHeight: ONLINE_STRIP_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  onlineStripLeft: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: LDS_SPACING.sm,
  },
  onlineTextCol: {
    flex: 1,
    minWidth: 0,
    gap: 1,
  },
  onlineStatusLabel: {
    fontWeight: '700',
    letterSpacing: 0.06,
  },
  onlineStatusHint: {
    letterSpacing: 0.04,
    lineHeight: 14,
  },
  switchTrack: {
    width: 52,
    height: 30,
    borderRadius: LDS_RADIUS.full,
    borderWidth: LDS_BORDER_WIDTH.standard,
    justifyContent: 'center',
    paddingHorizontal: 3,
    flexShrink: 0,
  },
  switchTrackOn: {
    backgroundColor: 'rgba(6,55,52,0.95)',
    borderColor: 'rgba(34,211,238,0.35)',
    alignItems: 'flex-end',
  },
  switchTrackOff: {
    backgroundColor: 'rgba(16,26,43,0.95)',
    borderColor: PREMIUM_BORDER_SLATE,
    alignItems: 'flex-start',
  },
  switchTrackDisabled: {
    opacity: 0.55,
  },
  switchThumb: {
    width: 22,
    height: 22,
    borderRadius: LDS_RADIUS.full,
    borderWidth: LDS_BORDER_WIDTH.hairline,
  },
  switchThumbOn: {
    backgroundColor: PREMIUM_AUTH_CYAN,
    borderColor: 'rgba(243,248,255,0.45)',
    ...Platform.select({
      ios: {
        shadowColor: PREMIUM_AUTH_CYAN,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.45,
        shadowRadius: 6,
      },
      android: { elevation: 3 },
      default: {},
    }),
  },
  switchThumbOff: {
    backgroundColor: 'rgba(148,163,184,0.72)',
    borderColor: 'rgba(148,163,184,0.35)',
  },
  switchSpinner: {
    alignSelf: 'center',
  },
  container: {
    marginHorizontal: LDS_SPACING.sm,
    overflow: 'hidden',
    ...LDS_ELEVATION.panel,
  },
  panelShell: {
    flex: 1,
  },
  panelShellLoading: {
    minHeight: PANEL_HEIGHT_COLLAPSED,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: LDS_SPACING.lg,
  },
  collapsedHud: {
    paddingHorizontal: LDS_SPACING.sm,
    paddingTop: LDS_SPACING.xs,
    paddingBottom: LDS_SPACING.xs,
    gap: LDS_SPACING.xxs,
  },
  cockpitGrid: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: LDS_SPACING.sm,
  },
  todayCol: {
    flex: 1,
    minWidth: 0,
    gap: 2,
    paddingVertical: LDS_SPACING.xxs,
  },
  gridDivider: {
    width: LDS_BORDER_WIDTH.hairline,
    alignSelf: 'stretch',
    backgroundColor: LDS_BORDER_COLOR.cockpitPanel,
    marginVertical: LDS_SPACING.xxs,
  },
  instrumentLabel: {
    letterSpacing: 0.12,
    fontSize: 10,
  },
  instrumentAmount: {
    fontSize: 22,
    lineHeight: 26,
    fontWeight: '800',
    letterSpacing: -0.35,
    fontVariant: ['tabular-nums'],
    color: 'rgba(94,229,209,0.96)',
  },
  instrumentMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: LDS_SPACING.xs,
    marginTop: 1,
  },
  instrumentMeta: {
    letterSpacing: 0.06,
    fontSize: 10,
  },
  progressTrack: {
    height: 4,
    borderRadius: LDS_RADIUS.full,
    backgroundColor: 'rgba(8,17,31,0.72)',
    borderWidth: LDS_BORDER_WIDTH.hairline,
    borderColor: LDS_BORDER_COLOR.cockpitPanel,
    overflow: 'hidden',
    marginTop: LDS_SPACING.xxs,
  },
  progressFill: {
    height: '100%',
    borderRadius: LDS_RADIUS.full,
    backgroundColor: PREMIUM_AUTH_CYAN,
    minWidth: 0,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    borderRadius: LDS_RADIUS.md,
    backgroundColor: 'rgba(8,17,31,0.32)',
    borderWidth: LDS_BORDER_WIDTH.hairline,
    borderColor: LDS_BORDER_COLOR.cockpitPanel,
    overflow: 'hidden',
  },
  footerCell: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: LDS_SPACING.xs,
    paddingVertical: LDS_SPACING.xs,
    paddingHorizontal: LDS_SPACING.sm,
    minWidth: 0,
  },
  footerDivider: {
    width: LDS_BORDER_WIDTH.hairline,
    alignSelf: 'stretch',
    backgroundColor: LDS_BORDER_COLOR.cockpitPanel,
  },
  footerTextCol: {
    flex: 1,
    minWidth: 0,
    gap: 1,
  },
  footerMetaLabel: {
    letterSpacing: 0.1,
    lineHeight: 13,
    fontSize: 10,
  },
  footerValue: {
    fontVariant: ['tabular-nums'],
    letterSpacing: 0.06,
    fontSize: 11,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: LDS_RADIUS.full,
    borderWidth: LDS_BORDER_WIDTH.hairline,
    borderColor: LDS_BORDER_COLOR.cockpitPanel,
    flexShrink: 0,
  },
  statusDotOnline: {
    backgroundColor: PREMIUM_AUTH_CYAN,
    borderColor: 'rgba(243,248,255,0.35)',
  },
  statusDotOffline: {
    backgroundColor: 'rgba(148,163,184,0.55)',
  },
  expandedContent: {
    paddingHorizontal: LDS_SPACING.sm,
    paddingBottom: LDS_SPACING.sm,
    paddingTop: LDS_SPACING.xxs,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(8,17,31,0.48)',
    borderRadius: LDS_RADIUS.md,
    paddingVertical: LDS_SPACING.sm + 1,
    paddingHorizontal: LDS_SPACING.xs,
    borderWidth: LDS_BORDER_WIDTH.standard,
    borderColor: LDS_BORDER_COLOR.cockpitPanel,
    borderTopColor: 'rgba(34,211,238,0.09)',
    ...LDS_ELEVATION.chip,
  },
  statColumn: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'flex-start',
    paddingHorizontal: LDS_SPACING.xxs,
  },
  statIconWrap: {
    width: LDS_SPACING.xxl + LDS_SPACING.xs,
    height: LDS_SPACING.xxl + LDS_SPACING.xs,
    borderRadius: LDS_RADIUS.sm,
    backgroundColor: 'rgba(34,211,238,0.08)',
    borderWidth: LDS_BORDER_WIDTH.standard,
    borderColor: 'rgba(34,211,238,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: LDS_SPACING.xs,
  },
  statIconWrapViolet: {
    backgroundColor: 'rgba(148,163,184,0.08)',
    borderColor: 'rgba(148,163,184,0.22)',
  },
  statIconWrapAmber: {
    backgroundColor: 'rgba(251,191,36,0.08)',
    borderColor: 'rgba(251,191,36,0.22)',
  },
  statValue: {
    letterSpacing: -0.22,
    fontVariant: ['tabular-nums'],
    textAlign: 'center',
  },
  statLabel: {
    marginTop: LDS_SPACING.xxs,
    textAlign: 'center',
    opacity: 0.9,
  },
  statDivider: {
    width: LDS_BORDER_WIDTH.hairline,
    alignSelf: 'stretch',
    backgroundColor: LDS_BORDER_COLOR.cockpitPanel,
    marginVertical: LDS_SPACING.xxs,
  },
});
