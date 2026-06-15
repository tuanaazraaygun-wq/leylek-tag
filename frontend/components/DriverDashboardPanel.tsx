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

interface DriverDashboardPanelProps {
  userId: string;
  onPackagePress: () => void;
  onToggleOnline?: (isOnline: boolean) => void;
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
    rating: number;
    total_trips: number;
  };
}

const PANEL_HEIGHT_COLLAPSED = 188;
const PANEL_HEIGHT_EXPANDED = 272;

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
  expanded = false,
  onExpandToggle,
}: DriverDashboardPanelProps) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<DashboardData | null>(null);
  const [remainingText, setRemainingText] = useState('00:00:00');
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const [toggling, setToggling] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const expandAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    fetchDashboard();
    const refreshInterval = setInterval(fetchDashboard, 60000); // Her dakika güncelle
    
    return () => {
      clearInterval(refreshInterval);
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [userId]);

  // Expand animation
  useEffect(() => {
    Animated.timing(expandAnim, {
      toValue: expanded ? 1 : 0,
      duration: 300,
      useNativeDriver: false,
    }).start();
  }, [expanded]);

  // Countdown timer
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
    let rating = 5;
    try {
      const r = raw.stats?.rating;
      if (r != null && r !== '') rating = Number(r);
      if (!Number.isFinite(rating)) rating = 5;
    } catch {
      rating = 5;
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
      <View style={styles.container}>
        <GlassSurface variant="panel" style={styles.panelShellLoading} borderRadius={LDS_RADIUS.xl}>
          <ActivityIndicator size="small" color={PREMIUM_AUTH_CYAN} />
        </GlassSurface>
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
  const availabilityLabel = data.active_time.is_online ? 'Çevrimiçi' : 'Çevrimdışı';
  const onlineActionLabel = data.active_time.is_online ? 'Çevrimdışı ol' : 'Çevrimiçi ol';

  return (
    <Animated.View style={[styles.container, { height: panelHeight }]}>
      <GlassSurface variant="panel" style={styles.panelShell} borderRadius={LDS_RADIUS.xl}>
        <View style={styles.collapsedHud}>
          <View
            style={styles.revenueHeroShell}
            accessibilityRole="summary"
            accessibilityLabel={`Bugün ${data.today.earnings} lira, ${data.today.trips_count} sefer. Hedef yüzde ${goalProgress}.`}
          >
            <PremiumText variant="caption" muted style={styles.revenueLabel}>
              Bugün
            </PremiumText>
            <PremiumText variant="headline" style={styles.revenueAmount}>
              {data.today.earnings} ₺
            </PremiumText>
            <View style={styles.revenueMetaRow}>
              <PremiumText variant="caption" muted style={styles.revenueTrips}>
                {data.today.trips_count} sefer
              </PremiumText>
              <PremiumText variant="caption" muted style={styles.progressCaption}>
                Hedef %{goalProgress}
              </PremiumText>
            </View>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${goalProgress}%` }]} />
            </View>
          </View>

          <View style={styles.opsRail}>
            <View style={styles.availabilityStatus}>
              <View
                style={[
                  styles.statusDot,
                  data.active_time.is_online ? styles.statusDotOnline : styles.statusDotOffline,
                ]}
              />
              <View style={styles.availabilityTextCol}>
                <PremiumText variant="caption" muted style={styles.opsMetaLabel}>
                  Durum
                </PremiumText>
                <PremiumText variant="body" style={styles.availabilityLabel}>
                  {availabilityLabel}
                </PremiumText>
              </View>
            </View>
            <TouchableOpacity
              style={[
                styles.onlineBtn,
                data.active_time.is_online ? styles.onlineBtnActive : styles.onlineBtnInactive,
              ]}
              onPress={toggleOnline}
              disabled={toggling || !data.active_time.is_active}
              accessibilityRole="button"
              accessibilityLabel={onlineActionLabel}
              accessibilityState={{
                disabled: toggling || !data.active_time.is_active,
              }}
            >
              {toggling ? (
                <ActivityIndicator size="small" color="rgba(243,248,255,0.94)" />
              ) : (
                <PremiumText variant="caption" style={styles.onlineText}>
                  {onlineActionLabel}
                </PremiumText>
              )}
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={styles.sessionRow}
            onPress={onExpandToggle}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel={`Seans ${sessionText}. Detayları ${expanded ? 'gizle' : 'göster'}.`}
          >
            <Ionicons
              name="time-outline"
              size={15}
              color={
                data.active_time.is_active
                  ? 'rgba(34,211,238,0.88)'
                  : 'rgba(148,163,184,0.72)'
              }
            />
            <View style={styles.sessionTextCol}>
              <PremiumText variant="caption" muted style={styles.opsMetaLabel}>
                Seans
              </PremiumText>
              <PremiumText variant="caption" style={styles.sessionText}>
                {sessionText}
              </PremiumText>
            </View>
            <Ionicons
              name={expanded ? 'chevron-up' : 'chevron-down'}
              size={18}
              color={PREMIUM_TEXT_MUTED}
            />
          </TouchableOpacity>
        </View>

        {expanded && (
          <View style={styles.expandedContent}>
            <View style={styles.statsRow}>
              <View style={styles.statColumn}>
                <View style={styles.statIconWrap}>
                  <Ionicons name="car-outline" size={20} color="rgba(34,211,238,0.88)" />
                </View>
                <PremiumText variant="title" style={styles.statValue}>
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
                <PremiumText variant="title" style={styles.statValue}>
                  {data.weekly.earnings} ₺
                </PremiumText>
                <PremiumText variant="caption" muted style={styles.statLabel}>
                  Haftalık kazanç
                </PremiumText>
              </View>

              <View style={styles.statDivider} />

              <View style={styles.statColumn}>
                <View style={[styles.statIconWrap, styles.statIconWrapAmber]}>
                  <Ionicons name="star" size={20} color="rgba(251,211,141,0.95)" />
                </View>
                <PremiumText variant="title" style={styles.statValue}>
                  {(Number.isFinite(data.stats.rating) ? data.stats.rating : 5).toFixed(1)}
                </PremiumText>
                <PremiumText variant="caption" muted style={styles.statLabel}>
                  Puan
                </PremiumText>
              </View>
            </View>
          </View>
        )}
      </GlassSurface>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: LDS_SPACING.sm,
    marginTop: LDS_SPACING.xxs,
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
    paddingHorizontal: LDS_SPACING.md,
    paddingTop: LDS_SPACING.md,
    paddingBottom: LDS_SPACING.sm,
    gap: LDS_SPACING.sm,
  },
  revenueHeroShell: {
    gap: LDS_SPACING.xs,
    paddingVertical: LDS_SPACING.md,
    paddingHorizontal: LDS_SPACING.md,
    borderRadius: LDS_RADIUS.lg,
    backgroundColor: 'rgba(8,17,31,0.52)',
    borderWidth: LDS_BORDER_WIDTH.standard,
    borderColor: LDS_BORDER_COLOR.cockpitPanel,
    borderTopColor: 'rgba(34,211,238,0.14)',
    ...LDS_ELEVATION.chip,
  },
  opsRail: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: LDS_SPACING.sm,
    paddingVertical: LDS_SPACING.xxs,
  },
  availabilityStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: LDS_SPACING.sm,
    flex: 1,
    minWidth: 0,
  },
  availabilityTextCol: {
    flex: 1,
    minWidth: 0,
    gap: 1,
  },
  opsMetaLabel: {
    letterSpacing: 0.12,
    lineHeight: 14,
  },
  statusDot: {
    width: LDS_SPACING.xs,
    height: LDS_SPACING.xs,
    borderRadius: LDS_RADIUS.full,
    borderWidth: LDS_BORDER_WIDTH.hairline,
    borderColor: LDS_BORDER_COLOR.cockpitPanel,
  },
  statusDotOnline: {
    backgroundColor: PREMIUM_AUTH_CYAN,
    borderColor: 'rgba(243,248,255,0.35)',
  },
  statusDotOffline: {
    backgroundColor: 'rgba(148,163,184,0.55)',
  },
  availabilityLabel: {
    letterSpacing: 0.1,
    fontWeight: '700',
  },
  onlineBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: LDS_SPACING.sm,
    paddingHorizontal: LDS_SPACING.md,
    borderRadius: LDS_RADIUS.md,
    borderWidth: LDS_BORDER_WIDTH.standard,
    flexShrink: 0,
  },
  onlineBtnActive: {
    backgroundColor: 'rgba(6,55,52,0.92)',
    borderColor: 'rgba(34,211,238,0.22)',
    ...Platform.select({
      ios: {
        shadowColor: '#01060e',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.35,
        shadowRadius: 10,
      },
      android: { elevation: 5 },
      default: {},
    }),
  },
  onlineBtnInactive: {
    backgroundColor: 'rgba(16,26,43,0.95)',
    borderColor: PREMIUM_BORDER_SLATE,
  },
  onlineText: {
    letterSpacing: 0.12,
    fontWeight: '700',
    textAlign: 'center',
  },
  revenueLabel: {
    letterSpacing: 0.15,
  },
  revenueMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: LDS_SPACING.sm,
    marginTop: LDS_SPACING.xxs,
  },
  revenueAmount: {
    fontSize: 32,
    lineHeight: 36,
    fontWeight: '800',
    letterSpacing: -0.5,
    fontVariant: ['tabular-nums'],
    color: 'rgba(94,229,209,0.98)',
  },
  revenueTrips: {
    flex: 1,
  },
  progressTrack: {
    height: 6,
    borderRadius: LDS_RADIUS.full,
    backgroundColor: 'rgba(8,17,31,0.72)',
    borderWidth: LDS_BORDER_WIDTH.hairline,
    borderColor: LDS_BORDER_COLOR.cockpitPanel,
    overflow: 'hidden',
    marginTop: LDS_SPACING.xs,
  },
  progressFill: {
    height: '100%',
    borderRadius: LDS_RADIUS.full,
    backgroundColor: PREMIUM_AUTH_CYAN,
    minWidth: 0,
  },
  progressCaption: {
    letterSpacing: 0.1,
    textAlign: 'right',
  },
  sessionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: LDS_SPACING.sm,
    paddingVertical: LDS_SPACING.sm,
    paddingHorizontal: LDS_SPACING.sm,
    borderRadius: LDS_RADIUS.md,
    backgroundColor: 'rgba(8,17,31,0.38)',
    borderWidth: LDS_BORDER_WIDTH.hairline,
    borderColor: LDS_BORDER_COLOR.cockpitPanel,
  },
  sessionTextCol: {
    flex: 1,
    minWidth: 0,
    gap: 1,
  },
  sessionText: {
    fontVariant: ['tabular-nums'],
    letterSpacing: 0.08,
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
