import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || 'https://qr-trip-end.preview.emergentagent.com';

interface DriverStatusBarProps {
  userId: string;
  onPurchasePress: () => void;
  onStatusChange?: (isActive: boolean) => void;
}

export default function DriverStatusBar({
  userId,
  onPurchasePress,
  onStatusChange,
}: DriverStatusBarProps) {
  const [loading, setLoading] = useState(true);
  const [isActive, setIsActive] = useState(false);
  const [isOnline, setIsOnline] = useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const [remainingText, setRemainingText] = useState('');
  const [toggling, setToggling] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    fetchStatus();
    
    // Her 30 saniyede bir güncelle
    const statusInterval = setInterval(fetchStatus, 30000);
    
    return () => {
      clearInterval(statusInterval);
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [userId]);

  // Countdown timer
  useEffect(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    if (remainingSeconds > 0 && isActive) {
      intervalRef.current = setInterval(() => {
        setRemainingSeconds(prev => {
          if (prev <= 1) {
            setIsActive(false);
            setIsOnline(false);
            onStatusChange?.(false);
            return 0;
          }
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
  }, [remainingSeconds, isActive]);

  const fetchStatus = async () => {
    try {
      const response = await fetch(`${API_URL}/api/driver/status?user_id=${userId}`);
      const data = await response.json();
      
      if (data.success) {
        setIsActive(data.is_active);
        setIsOnline(data.driver_online);
        setRemainingSeconds(data.remaining_seconds || 0);
        setRemainingText(data.remaining_text || '00:00:00');
        onStatusChange?.(data.is_active && data.driver_online);
      }
    } catch (error) {
      console.error('Status fetch error:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleOnlineStatus = async () => {
    setToggling(true);
    try {
      const endpoint = isOnline ? 'go-offline' : 'go-online';
      const response = await fetch(
        `${API_URL}/api/driver/${endpoint}?user_id=${userId}`,
        { method: 'POST' }
      );
      const data = await response.json();
      
      if (data.success) {
        setIsOnline(!isOnline);
        onStatusChange?.(!isOnline && isActive);
      } else {
        // Hata durumunda paket satın almaya yönlendir
        if (data.detail?.includes('paket')) {
          onPurchasePress();
        }
      }
    } catch (error) {
      console.error('Toggle status error:', error);
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

  if (!isActive) {
    return (
      <TouchableOpacity style={styles.container} onPress={onPurchasePress}>
        <View style={styles.inactiveContent}>
          <Ionicons name="flash-outline" size={20} color="#F59E0B" />
          <Text style={styles.inactiveText}>Paket Satın Al</Text>
          <Ionicons name="chevron-forward" size={18} color="#F59E0B" />
        </View>
      </TouchableOpacity>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.activeContent}>
        {/* Kalan Süre */}
        <View style={styles.timeContainer}>
          <Ionicons name="time-outline" size={18} color="#10B981" />
          <Text style={styles.timeText}>{remainingText}</Text>
        </View>

        {/* Online/Offline Toggle */}
        <TouchableOpacity
          style={[styles.toggleBtn, isOnline ? styles.toggleOnline : styles.toggleOffline]}
          onPress={toggleOnlineStatus}
          disabled={toggling}
        >
          {toggling ? (
            <ActivityIndicator size="small" color="white" />
          ) : (
            <>
              <View style={[styles.dot, isOnline ? styles.dotOnline : styles.dotOffline]} />
              <Text style={styles.toggleText}>{isOnline ? 'Online' : 'Offline'}</Text>
            </>
          )}
        </TouchableOpacity>

        {/* Paket Ekle */}
        <TouchableOpacity style={styles.addBtn} onPress={onPurchasePress}>
          <Ionicons name="add-circle-outline" size={22} color="#3FA9F5" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'rgba(26, 26, 46, 0.95)',
    borderRadius: 16,
    marginHorizontal: 16,
    marginVertical: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  inactiveContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  inactiveText: {
    color: '#F59E0B',
    fontSize: 15,
    fontWeight: '600',
    marginHorizontal: 8,
  },
  activeContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  timeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  timeText: {
    color: '#10B981',
    fontSize: 16,
    fontWeight: '700',
    marginLeft: 6,
    fontVariant: ['tabular-nums'],
  },
  toggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    minWidth: 100,
    justifyContent: 'center',
  },
  toggleOnline: {
    backgroundColor: '#10B981',
  },
  toggleOffline: {
    backgroundColor: '#6B7280',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  dotOnline: {
    backgroundColor: '#fff',
  },
  dotOffline: {
    backgroundColor: '#9CA3AF',
  },
  toggleText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  addBtn: {
    padding: 4,
  },
});
