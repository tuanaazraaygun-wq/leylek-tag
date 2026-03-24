import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Animated,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { API_BASE_URL } from '../lib/backendConfig';

const { width } = Dimensions.get('window');

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
    outputRange: [80, 150],
  });

  return (
    <Animated.View style={[styles.container, { height: panelHeight }]}>
      <LinearGradient
        colors={['rgba(26, 26, 46, 0.98)', 'rgba(26, 26, 46, 0.95)']}
        style={styles.gradient}
      >
        {/* Üst Satır - Her zaman görünür */}
        <TouchableOpacity style={styles.topRow} onPress={onExpandToggle} activeOpacity={0.8}>
          {/* Kalan Süre */}
          <View style={styles.timeBox}>
            <Ionicons name="time-outline" size={16} color={data.active_time.is_active ? '#10B981' : '#9CA3AF'} />
            <Text style={[styles.timeText, !data.active_time.is_active && styles.timeTextInactive]}>
              {data.active_time.is_active
                ? /ücret/i.test(remainingText)
                  ? 'Ücretsizdir'
                  : remainingText
                : 'Ücretsizdir'}
            </Text>
          </View>

          {/* Bugünkü Kazanç */}
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

          {/* Expand Icon */}
          <Ionicons 
            name={expanded ? 'chevron-up' : 'chevron-down'} 
            size={20} 
            color="#9CA3AF" 
            style={styles.expandIcon}
          />
        </TouchableOpacity>

        {/* Genişletilmiş İçerik */}
        {expanded && (
          <View style={styles.expandedContent}>
            {/* İstatistikler */}
            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <Ionicons name="car-outline" size={18} color="#3FA9F5" />
                <Text style={styles.statValue}>{data.today.trips_count}</Text>
                <Text style={styles.statLabel}>Bugün</Text>
              </View>
              
              <View style={styles.statDivider} />
              
              <View style={styles.statItem}>
                <Ionicons name="calendar-outline" size={18} color="#8B5CF6" />
                <Text style={styles.statValue}>{data.weekly.earnings} ₺</Text>
                <Text style={styles.statLabel}>Bu Hafta</Text>
              </View>
              
              <View style={styles.statDivider} />
              
              <View style={styles.statItem}>
                <Ionicons name="star" size={18} color="#F59E0B" />
                <Text style={styles.statValue}>{(Number.isFinite(data.stats.rating) ? data.stats.rating : 5).toFixed(1)}</Text>
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
    marginHorizontal: 12,
    marginTop: 8,
    borderRadius: 16,
    overflow: 'hidden',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  gradient: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  timeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  timeText: {
    color: '#10B981',
    fontSize: 14,
    fontWeight: '700',
    marginLeft: 5,
    fontVariant: ['tabular-nums'],
  },
  timeTextInactive: {
    color: '#9CA3AF',
  },
  earningsBox: {
    flex: 1,
    alignItems: 'center',
  },
  earningsLabel: {
    fontSize: 11,
    color: '#9CA3AF',
  },
  earningsValue: {
    fontSize: 18,
    fontWeight: '700',
    color: 'white',
  },
  onlineBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
  },
  onlineBtnActive: {
    backgroundColor: '#10B981',
  },
  onlineBtnInactive: {
    backgroundColor: '#4B5563',
  },
  onlineDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#9CA3AF',
    marginRight: 5,
  },
  onlineDotActive: {
    backgroundColor: 'white',
  },
  onlineText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '700',
  },
  expandIcon: {
    marginLeft: 8,
  },
  expandedContent: {
    paddingHorizontal: 14,
    paddingBottom: 10,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    paddingVertical: 12,
    marginBottom: 12,
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statValue: {
    fontSize: 16,
    fontWeight: '700',
    color: 'white',
    marginTop: 4,
  },
  statLabel: {
    fontSize: 11,
    color: '#9CA3AF',
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: 30,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
});
