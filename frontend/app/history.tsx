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
import { API_BASE_URL } from '../lib/backendConfig';

/** Normalized ride log row — monetary fields from API are intentionally omitted. */
interface HistoryTripRow {
  id: string;
  pickup: string;
  dropoff: string;
  passengerName: string | null;
  driverName: string | null;
  status: string;
  occurredAt: string;
  rating: number | null;
  distanceKm: number | null;
  durationMin: number | null;
  vehicleLabel: string | null;
}

interface User {
  id: string;
  role: 'passenger' | 'driver';
}

const LOCATION_FALLBACK = 'Konum bilgisi yok';
const PARTICIPANT_UNKNOWN = 'Bilinmiyor';

function readString(raw: Record<string, unknown>, ...keys: string[]): string {
  for (const key of keys) {
    const value = raw[key];
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }
  return '';
}

function readNumber(raw: Record<string, unknown>, ...keys: string[]): number | null {
  for (const key of keys) {
    const value = raw[key];
    if (value == null || value === '') continue;
    const n = Number(value);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return null;
}

function resolveVehicleLabel(raw: Record<string, unknown>): string | null {
  const kind = readString(raw, 'passenger_vehicle_kind', 'vehicle_kind', 'vehicle_type');
  if (!kind) return null;
  const normalized = kind.toLowerCase();
  if (normalized === 'motorcycle' || normalized === 'motor') return 'Motosiklet';
  if (normalized === 'car') return 'Otomobil';
  return kind;
}

function resolveStatusLabel(status: string): string {
  const s = String(status || '').trim().toLowerCase();
  if (s === 'completed') return 'Tamamlandı';
  if (s === 'cancelled' || s === 'canceled') return 'İptal';
  if (!s) return 'Yolculuk geçmişi';
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function resolveStatusColors(status: string): { bg: string; fg: string } {
  const s = String(status || '').trim().toLowerCase();
  if (s === 'cancelled' || s === 'canceled') {
    return { bg: Colors.gray300 + '40', fg: Colors.gray600 };
  }
  if (s === 'completed') {
    return { bg: Colors.success + '20', fg: Colors.success };
  }
  return { bg: Colors.primary + '18', fg: Colors.primary };
}

function normalizeHistoryRecord(raw: unknown): HistoryTripRow | null {
  if (!raw || typeof raw !== 'object') return null;
  const record = raw as Record<string, unknown>;
  const id = readString(record, 'id', 'tag_id');
  if (!id) return null;

  const pickup =
    readString(record, 'pickup', 'pickup_location', 'pickup_address') || LOCATION_FALLBACK;
  const dropoff =
    readString(record, 'dropoff', 'dropoff_location', 'dropoff_address', 'destination') ||
    LOCATION_FALLBACK;

  const occurredAt =
    readString(record, 'date', 'completed_at', 'cancelled_at', 'created_at') ||
    new Date(0).toISOString();

  const status = readString(record, 'status') || 'completed';
  const ratingRaw = readNumber(record, 'rating', 'driver_rating', 'passenger_rating');

  const passengerName = readString(record, 'passenger_name') || null;
  const driverName = readString(record, 'driver_name') || null;

  return {
    id,
    pickup,
    dropoff,
    passengerName,
    driverName,
    status,
    occurredAt,
    rating: ratingRaw,
    distanceKm: readNumber(record, 'distance_km', 'trip_distance_km'),
    durationMin: readNumber(record, 'estimated_minutes', 'trip_duration_min', 'duration_minutes'),
    vehicleLabel: resolveVehicleLabel(record),
  };
}

/** Supports legacy `history[]` and current backend `trips[]` without API changes. */
function adaptHistoryPayload(data: unknown): HistoryTripRow[] {
  if (!data || typeof data !== 'object') return [];
  const payload = data as Record<string, unknown>;
  const rows = Array.isArray(payload.history)
    ? payload.history
    : Array.isArray(payload.trips)
      ? payload.trips
      : [];
  return rows
    .map(normalizeHistoryRecord)
    .filter((row): row is HistoryTripRow => row != null);
}

function formatTripMeta(row: HistoryTripRow): string | null {
  const parts: string[] = [];
  if (row.vehicleLabel) parts.push(row.vehicleLabel);
  if (row.distanceKm != null) parts.push(`${row.distanceKm} km`);
  if (row.durationMin != null) parts.push(`${Math.round(row.durationMin)} dk`);
  if (row.rating != null) parts.push(`Puan ${row.rating.toFixed(1)}`);
  return parts.length > 0 ? parts.join(' · ') : null;
}

export default function HistoryScreen() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [history, setHistory] = useState<HistoryTripRow[]>([]);
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
      setLoading(false);
    }
  };

  const loadHistory = async (currentUser: User) => {
    try {
      const endpoint =
        currentUser.role === 'passenger'
          ? `${API_BASE_URL}/passenger/history?user_id=${currentUser.id}`
          : `${API_BASE_URL}/driver/history?user_id=${currentUser.id}`;

      const response = await fetch(endpoint);
      const data = await response.json();

      if (data.success) {
        setHistory(adaptHistoryPayload(data));
      } else {
        setHistory([]);
      }
    } catch (error) {
      console.error('Geçmiş yüklenemedi:', error);
      setHistory([]);
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
    if (Number.isNaN(date.getTime())) {
      return 'Tarih bilgisi yok';
    }
    return date.toLocaleDateString('tr-TR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={28} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Yolculuk geçmişi</Text>
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
          history.map((trip) => {
            const statusLabel = resolveStatusLabel(trip.status);
            const statusColors = resolveStatusColors(trip.status);
            const metaLine = formatTripMeta(trip);
            const participantLabel =
              user?.role === 'passenger'
                ? `Sürücü: ${trip.driverName || PARTICIPANT_UNKNOWN}`
                : `Yolcu: ${trip.passengerName || PARTICIPANT_UNKNOWN}`;

            return (
              <View key={trip.id} style={styles.card}>
                <View style={styles.cardHeader}>
                  <Text style={styles.dateText}>{formatDate(trip.occurredAt)}</Text>
                  <View style={[styles.statusBadge, { backgroundColor: statusColors.bg }]}>
                    <Text style={[styles.statusText, { color: statusColors.fg }]}>
                      {statusLabel}
                    </Text>
                  </View>
                </View>

                <View style={styles.locationRow}>
                  <Ionicons name="location" size={18} color={Colors.primary} />
                  <Text style={styles.locationText} numberOfLines={2}>
                    {trip.pickup}
                  </Text>
                </View>

                <View style={styles.routeArrowRow}>
                  <Ionicons name="arrow-down" size={14} color={Colors.gray400} />
                </View>

                <View style={styles.locationRow}>
                  <Ionicons name="flag" size={18} color={Colors.secondary} />
                  <Text style={styles.locationText} numberOfLines={2}>
                    {trip.dropoff}
                  </Text>
                </View>

                <View style={styles.cardFooter}>
                  <Text style={styles.participantText}>{participantLabel}</Text>
                  {metaLine ? (
                    <Text style={styles.metaText} numberOfLines={2}>
                      {metaLine}
                    </Text>
                  ) : null}
                </View>
              </View>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerTitle: {
    fontSize: FontSize.xl,
    fontWeight: 'bold',
    color: Colors.text,
  },
  content: {
    flex: 1,
    padding: Spacing.md,
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
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
    gap: Spacing.sm,
  },
  dateText: {
    fontSize: FontSize.sm,
    color: Colors.gray500,
    flex: 1,
  },
  statusBadge: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
    flexShrink: 0,
  },
  statusText: {
    fontSize: FontSize.xs,
    fontWeight: '600',
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: Spacing.xs,
  },
  routeArrowRow: {
    paddingLeft: 2,
    marginBottom: Spacing.xs,
  },
  locationText: {
    fontSize: FontSize.md,
    color: Colors.text,
    marginLeft: Spacing.sm,
    flex: 1,
  },
  cardFooter: {
    marginTop: Spacing.md,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    gap: Spacing.xs,
  },
  participantText: {
    fontSize: FontSize.sm,
    color: Colors.gray600,
    fontWeight: '500',
  },
  metaText: {
    fontSize: FontSize.sm,
    color: Colors.gray500,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: Spacing.xxl * 2,
  },
  emptyText: {
    fontSize: FontSize.md,
    color: Colors.gray400,
    textAlign: 'center',
    marginTop: Spacing.lg,
  },
});
