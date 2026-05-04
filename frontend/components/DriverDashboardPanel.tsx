import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { API_BASE_URL } from '../lib/backendConfig';

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
        <ActivityIndicator size="small" color="#3FA9F5" />
      </View>
    );
  }

  if (!data) return null;

  const panelHeight = expandAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [92, 186],
  });

  return (
    <Animated.View style={[styles.container, { height: panelHeight }]}>
      <LinearGradient
        colors={['#0c1222', '#151b2e', '#1a1f35', '#12182a']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradient}
      >
        <View style={styles.gradientInnerStroke} pointerEvents="none" />
        {/* Üst Satır - Her zaman görünür */}
        <TouchableOpacity style={styles.topRow} onPress={onExpandToggle} activeOpacity={0.85}>
          {/* Çevrimiçi süre */}
          <View style={styles.timeBox}>
            <Ionicons name="time-outline" size={17} color={data.active_time.is_active ? '#34D399' : '#94A3B8'} />
            <Text style={[styles.timeText, !data.active_time.is_active && styles.timeTextInactive]}>
              {data.active_time.is_active
                ? /ücret/i.test(remainingText)
                  ? 'Ücretsizdir'
                  : remainingText
                : 'Ücretsizdir'}
            </Text>
          </View>

          {/* Bugünkü kazanç */}
          <View style={styles.earningsBox}>
            <Text style={styles.earningsLabel}>Bugün</Text>
            <Text style={styles.earningsValue}>{data.today.earnings} ₺</Text>
          </View>

          {/* Online Toggle */}
          <TouchableOpacity
            style={[styles.onlineBtn, data.active_time.is_online ? styles.onlineBtnActive : styles.onlineBtnInactive]}
            onPress={toggleOnline}
            disabled={toggling || !data.active_time.is_active}
          >
            {toggling ? (
              <ActivityIndicator size="small" color="white" />
            ) : (
              <>
                <View style={[styles.onlineDot, data.active_time.is_online && styles.onlineDotActive]} />
                <Text style={styles.onlineText}>{data.active_time.is_online ? 'ON' : 'OFF'}</Text>
              </>
            )}
          </TouchableOpacity>

          <Ionicons
            name={expanded ? 'chevron-up' : 'chevron-down'}
            size={22}
            color="#CBD5E1"
            style={styles.expandIcon}
          />
        </TouchableOpacity>

        {expanded && (
          <View style={styles.expandedContent}>
            <View style={styles.statsRow}>
              <View style={styles.statColumn}>
                <View style={styles.statIconWrap}>
                  <Ionicons name="car-outline" size={20} color="#38BDF8" />
                </View>
                <Text style={styles.statValue}>{data.today.trips_count}</Text>
                <Text style={styles.statLabel}>Bugünkü sefer</Text>
              </View>

              <View style={styles.statDivider} />

              <View style={styles.statColumn}>
                <View style={[styles.statIconWrap, styles.statIconWrapViolet]}>
                  <Ionicons name="wallet-outline" size={20} color="#C4B5FD" />
                </View>
                <Text style={styles.statValue}>{data.weekly.earnings} ₺</Text>
                <Text style={styles.statLabel}>Haftalık kazanç</Text>
              </View>

              <View style={styles.statDivider} />

              <View style={styles.statColumn}>
                <View style={[styles.statIconWrap, styles.statIconWrapAmber]}>
                  <Ionicons name="star" size={20} color="#FBBF24" />
                </View>
                <Text style={styles.statValue}>
                  {(Number.isFinite(data.stats.rating) ? data.stats.rating : 5).toFixed(1)}
                </Text>
                <Text style={styles.statLabel}>Puan</Text>
              </View>
            </View>
          </View>
        )}
      </LinearGradient>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 10,
    marginTop: 6,
    borderRadius: 22,
    overflow: 'hidden',
    elevation: 14,
    shadowColor: '#020617',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.45,
    shadowRadius: 20,
  },
  gradient: {
    flex: 1,
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: 'rgba(148, 163, 184, 0.22)',
  },
  gradientInnerStroke: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 20,
    margin: 1,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 8,
  },
  timeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    paddingVertical: 8,
    paddingHorizontal: 11,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(52, 211, 153, 0.35)',
    maxWidth: '34%',
  },
  timeText: {
    color: '#6EE7B7',
    fontSize: 13,
    fontWeight: '800',
    marginLeft: 6,
    fontVariant: ['tabular-nums'],
    letterSpacing: 0.2,
  },
  timeTextInactive: {
    color: '#94A3B8',
  },
  earningsBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  earningsLabel: {
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  earningsValue: {
    fontSize: 20,
    fontWeight: '900',
    color: '#F8FAFC',
    marginTop: 2,
    letterSpacing: -0.3,
  },
  onlineBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 14,
    minWidth: 72,
    borderWidth: 1,
  },
  onlineBtnActive: {
    backgroundColor: '#059669',
    borderColor: 'rgba(167, 243, 208, 0.55)',
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.45,
    shadowRadius: 8,
    elevation: 6,
  },
  onlineBtnInactive: {
    backgroundColor: 'rgba(51, 65, 85, 0.95)',
    borderColor: 'rgba(148, 163, 184, 0.35)',
  },
  onlineDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#94A3B8',
    marginRight: 6,
  },
  onlineDotActive: {
    backgroundColor: '#ECFDF5',
  },
  onlineText: {
    color: '#F8FAFC',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  expandIcon: {
    marginLeft: 2,
    opacity: 0.95,
  },
  expandedContent: {
    paddingHorizontal: 12,
    paddingBottom: 12,
    paddingTop: 2,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 6,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.15)',
  },
  statColumn: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'flex-start',
    paddingHorizontal: 4,
  },
  statIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(56, 189, 248, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.28)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  statIconWrapViolet: {
    backgroundColor: 'rgba(139, 92, 246, 0.14)',
    borderColor: 'rgba(196, 181, 253, 0.28)',
  },
  statIconWrapAmber: {
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    borderColor: 'rgba(251, 191, 36, 0.35)',
  },
  statValue: {
    fontSize: 17,
    fontWeight: '900',
    color: '#F8FAFC',
    marginTop: 0,
    letterSpacing: -0.2,
  },
  statLabel: {
    fontSize: 10,
    color: '#94A3B8',
    marginTop: 4,
    fontWeight: '700',
    textAlign: 'center',
    letterSpacing: 0.2,
  },
  statDivider: {
    width: StyleSheet.hairlineWidth,
    alignSelf: 'stretch',
    backgroundColor: 'rgba(148, 163, 184, 0.25)',
    marginVertical: 4,
  },
});
