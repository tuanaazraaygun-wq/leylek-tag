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

const { width } = Dimensions.get('window');
const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || 'https://notify-rating.preview.emergentagent.com';

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

  const fetchDashboard = async () => {
    try {
      const response = await fetch(`${API_URL}/api/driver/dashboard?user_id=${userId}`);
      const result = await response.json();
      
      if (result.success) {
        setData(result);
        setRemainingSeconds(result.active_time?.remaining_seconds || 0);
        setRemainingText(result.active_time?.remaining_text || '00:00:00');
      }
    } catch (error) {
      console.error('Dashboard fetch error:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleOnline = async () => {
    if (!data) return;
    
    setToggling(true);
    try {
      const endpoint = data.active_time.is_online ? 'go-offline' : 'go-online';
      const response = await fetch(`${API_URL}/api/driver/${endpoint}?user_id=${userId}`, { method: 'POST' });
      const result = await response.json();
      
      if (result.success) {
        setData(prev => prev ? {
          ...prev,
          active_time: { ...prev.active_time, is_online: !prev.active_time.is_online }
        } : null);
        onToggleOnline?.(!data.active_time.is_online);
      } else if (result.detail?.includes('paket')) {
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
    outputRange: [80, 220],
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
              {data.active_time.is_active ? remainingText : 'Paket yok'}
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
                <Text style={styles.statValue}>{data.stats.rating.toFixed(1)}</Text>
                <Text style={styles.statLabel}>Puan</Text>
              </View>
            </View>

            {/* Günlük Hedef */}
            <View style={styles.goalSection}>
              <View style={styles.goalHeader}>
                <Text style={styles.goalTitle}>Günlük Hedef</Text>
                <Text style={styles.goalPercent}>{data.daily_goal.overall_progress}%</Text>
              </View>
              <View style={styles.progressBar}>
                <View style={[styles.progressFill, { width: `${data.daily_goal.overall_progress}%` }]} />
              </View>
              <Text style={styles.goalSubtext}>
                {data.today.trips_count}/{data.daily_goal.target_trips} yolculuk • {data.today.earnings}/{data.daily_goal.target_earnings} ₺
              </Text>
            </View>

            {/* Paket Satın Al Butonu */}
            {!data.active_time.is_active && (
              <TouchableOpacity style={styles.buyPackageBtn} onPress={onPackagePress}>
                <Ionicons name="flash" size={18} color="#F59E0B" />
                <Text style={styles.buyPackageText}>Paket Satın Al</Text>
              </TouchableOpacity>
            )}
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
    paddingBottom: 14,
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
  goalSection: {
    marginBottom: 12,
  },
  goalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  goalTitle: {
    fontSize: 13,
    color: '#9CA3AF',
  },
  goalPercent: {
    fontSize: 13,
    fontWeight: '600',
    color: '#10B981',
  },
  progressBar: {
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#10B981',
    borderRadius: 3,
  },
  goalSubtext: {
    fontSize: 11,
    color: '#6B7280',
    marginTop: 4,
  },
  buyPackageBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.3)',
  },
  buyPackageText: {
    color: '#F59E0B',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
  },
});
