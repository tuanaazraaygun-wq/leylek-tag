import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Colors, Spacing, BorderRadius, FontSize } from '../constants/Colors';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';
const API_URL = `${BACKEND_URL}/api`;

interface Tag {
  id: string;
  passenger_id: string;
  passenger_name: string;
  driver_name?: string;
  pickup_location: string;
  dropoff_location: string;
  final_price?: number;
  status: string;
  created_at: string;
  completed_at?: string;
}

interface User {
  id: string;
  role: 'passenger' | 'driver';
}

export default function HistoryScreen() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [history, setHistory] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {

    loadUser();
  }, []);

  const loadUser = async () => {
    try {
      const userData = await AsyncStorage.getItem('user');
      if (userData) {
        const parsed = JSON.parse(userData);
        setUser(parsed);
        loadHistory(parsed);
      } else {
        router.back();
      }
    } catch (error) {
      console.error('Kullanıcı yüklenemedi:', error);
    }
  };

  const loadHistory = async (currentUser: User) => {
    try {
      const endpoint = currentUser.role === 'passenger'
        ? `${API_URL}/passenger/history?user_id=${currentUser.id}`
        : `${API_URL}/driver/history?user_id=${currentUser.id}`;
      
      const response = await fetch(endpoint);
      const data = await response.json();
      
      if (data.success) {
        setHistory(data.history);
      }
    } catch (error) {
      console.error('Geçmiş yüklenemedi:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    if (user) {
      setRefreshing(true);
      loadHistory(user);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('tr-TR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={28} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Geçmiş Yolculuklar</Text>
        <View style={{ width: 28 }} />
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[Colors.primary]}
          />
        }
      >
        {loading ? (
          <Text style={styles.emptyText}>Yükleniyor...</Text>
        ) : history.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="time-outline" size={80} color={Colors.gray300} />
            <Text style={styles.emptyText}>Henüz yolculuk geçmişiniz yok</Text>
          </View>
        ) : (
          history.map((tag) => (
            <View key={tag.id} style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.dateText}>
                  {formatDate(tag.completed_at || tag.created_at)}
                </Text>
                <View style={[styles.statusBadge, { backgroundColor: Colors.success + '20' }]}>
                  <Text style={[styles.statusText, { color: Colors.success }]}>
                    ✓ Tamamlandı
                  </Text>
                </View>
              </View>

              <View style={styles.locationRow}>
                <Ionicons name="location" size={18} color={Colors.primary} />
                <Text style={styles.locationText}>{tag.pickup_location}</Text>
              </View>

              <View style={styles.locationRow}>
                <Ionicons name="flag" size={18} color={Colors.secondary} />
                <Text style={styles.locationText}>{tag.dropoff_location}</Text>
              </View>

              <View style={styles.cardFooter}>
                <Text style={styles.participantText}>
                  {user?.role === 'passenger'
                    ? `Sürücü: ${tag.driver_name || 'Bilinmiyor'}`
                    : `Yolcu: ${tag.passenger_name}`}
                </Text>
                {tag.final_price && (
                  <Text style={styles.priceText}>₺{tag.final_price}</Text>
                )}
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border
  },
  headerTitle: {
    fontSize: FontSize.xl,
    fontWeight: 'bold',
    color: Colors.text
  },
  content: {
    flex: 1,
    padding: Spacing.md
  },
  card: {
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md
  },
  dateText: {
    fontSize: FontSize.sm,
    color: Colors.gray500
  },
  statusBadge: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm
  },
  statusText: {
    fontSize: FontSize.xs,
    fontWeight: '600'
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.sm
  },
  locationText: {
    fontSize: FontSize.md,
    color: Colors.text,
    marginLeft: Spacing.sm,
    flex: 1
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: Spacing.md,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.border
  },
  participantText: {
    fontSize: FontSize.sm,
    color: Colors.gray600,
    fontWeight: '500'
  },
  priceText: {
    fontSize: FontSize.lg,
    fontWeight: 'bold',
    color: Colors.primary
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: Spacing.xxl * 2
  },
  emptyText: {
    fontSize: FontSize.md,
    color: Colors.gray400,
    textAlign: 'center',
    marginTop: Spacing.lg
  }
});
