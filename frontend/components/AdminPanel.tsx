/**
 * AdminPanel Component - Leylek TAG
 * v9 - MODAL İÇİN ULTRA MİNİMAL VERSİYON
 * Tüm Android cihazlarla uyumlu
 */

import React, { useState, useEffect, Component } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  RefreshControl,
  Platform,
} from 'react-native';

const API_URL = 'https://api.leylektag.com/api';

// Error Boundary
class ErrorBoundary extends Component<{children: React.ReactNode}, {hasError: boolean, error: string}> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: '' };
  }
  
  static getDerivedStateFromError(error: any) {
    return { hasError: true, error: String(error) };
  }
  
  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.errorBox}>
          <Text style={styles.errorTitle}>Hata Oluştu</Text>
          <Text style={styles.errorMsg}>{this.state.error}</Text>
          <TouchableOpacity 
            style={styles.retryBtn}
            onPress={() => this.setState({ hasError: false, error: '' })}
          >
            <Text style={styles.retryText}>Tekrar Dene</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return this.props.children;
  }
}

interface Props {
  adminPhone: string;
  onClose: () => void;
}

function AdminContent({ adminPhone, onClose }: Props) {
  const [tab, setTab] = useState('dashboard');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState<any>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [trips, setTrips] = useState<any[]>([]);
  const [search, setSearch] = useState('');

  useEffect(() => {
    loadAll();
  }, []);

  const loadAll = async () => {
    setLoading(true);
    try {
      // Dashboard
      const dashRes = await fetch(`${API_URL}/admin/dashboard/full?admin_phone=${adminPhone}`);
      const dashData = await dashRes.json();
      if (dashData.success) setStats(dashData.stats);
      
      // Users
      const usersRes = await fetch(`${API_URL}/admin/users/full?admin_phone=${adminPhone}&page=1&limit=50`);
      const usersData = await usersRes.json();
      if (usersData.success && usersData.users) setUsers(usersData.users);
      
      // Trips
      const tripsRes = await fetch(`${API_URL}/admin/trips?admin_phone=${adminPhone}&page=1&limit=50`);
      const tripsData = await tripsRes.json();
      if (tripsData.success && tripsData.trips) setTrips(tripsData.trips);
    } catch (e) {
      console.log('Load error:', e);
    }
    setLoading(false);
    setRefreshing(false);
  };

  const refresh = () => {
    setRefreshing(true);
    loadAll();
  };

  const filteredUsers = search
    ? users.filter(u => 
        String(u.name || '').toLowerCase().includes(search.toLowerCase()) ||
        String(u.phone || '').includes(search)
      )
    : users;

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#3B82F6" />
        <Text style={styles.loadingText}>Yükleniyor...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
          <Text style={styles.closeBtnText}>X</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Admin Panel</Text>
        <TouchableOpacity onPress={refresh} style={styles.closeBtn}>
          <Text style={styles.closeBtnText}>R</Text>
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={styles.tabRow}>
        <TouchableOpacity 
          style={[styles.tabBtn, tab === 'dashboard' && styles.tabActive]}
          onPress={() => setTab('dashboard')}
        >
          <Text style={[styles.tabText, tab === 'dashboard' && styles.tabTextActive]}>Panel</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.tabBtn, tab === 'users' && styles.tabActive]}
          onPress={() => setTab('users')}
        >
          <Text style={[styles.tabText, tab === 'users' && styles.tabTextActive]}>Kullanıcılar</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.tabBtn, tab === 'trips' && styles.tabActive]}
          onPress={() => setTab('trips')}
        >
          <Text style={[styles.tabText, tab === 'trips' && styles.tabTextActive]}>Yolculuklar</Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      <ScrollView 
        style={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
      >
        {/* Dashboard */}
        {tab === 'dashboard' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Genel Bakış</Text>
            <View style={styles.statsRow}>
              <View style={styles.statBox}>
                <Text style={styles.statNum}>{stats?.users?.total || 0}</Text>
                <Text style={styles.statLabel}>Kullanıcı</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={styles.statNum}>{stats?.users?.drivers || 0}</Text>
                <Text style={styles.statLabel}>Sürücü</Text>
              </View>
            </View>
            <View style={styles.statsRow}>
              <View style={styles.statBox}>
                <Text style={styles.statNum}>{stats?.users?.online_drivers || 0}</Text>
                <Text style={styles.statLabel}>Online</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={styles.statNum}>{stats?.trips?.completed_today || 0}</Text>
                <Text style={styles.statLabel}>Bugün</Text>
              </View>
            </View>
            
            <Text style={styles.sectionTitle}>Son Yolculuklar</Text>
            {trips.slice(0, 5).map((t, i) => (
              <View key={t.id || i} style={styles.card}>
                <Text style={styles.cardTitle}>{t.pickup_location || '-'}</Text>
                <Text style={styles.cardSub}>{t.final_price || t.offered_price || 0} TL</Text>
              </View>
            ))}
          </View>
        )}

        {/* Users */}
        {tab === 'users' && (
          <View style={styles.section}>
            <TextInput
              style={styles.searchInput}
              placeholder="Ara..."
              placeholderTextColor="#888"
              value={search}
              onChangeText={setSearch}
            />
            <Text style={styles.countText}>{filteredUsers.length} kullanıcı</Text>
            {filteredUsers.slice(0, 50).map((u, i) => (
              <View key={u.id || i} style={styles.card}>
                <View style={styles.cardRow}>
                  <View style={styles.cardLeft}>
                    <Text style={styles.cardTitle}>{u.name || 'İsimsiz'}</Text>
                    <Text style={styles.cardSub}>{u.phone || ''}</Text>
                    <Text style={styles.cardMeta}>
                      {u.is_driver ? 'Sürücü' : 'Yolcu'} - {u.total_trips || 0} trip
                    </Text>
                  </View>
                  {u.is_online && (
                    <View style={styles.onlineBadge}>
                      <Text style={styles.onlineText}>Online</Text>
                    </View>
                  )}
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Trips */}
        {tab === 'trips' && (
          <View style={styles.section}>
            <Text style={styles.countText}>{trips.length} yolculuk</Text>
            {trips.slice(0, 50).map((t, i) => (
              <View key={t.id || i} style={styles.card}>
                <View style={styles.cardRow}>
                  <View style={styles.cardLeft}>
                    <Text style={styles.cardTitle} numberOfLines={1}>{t.pickup_location || '-'}</Text>
                    <Text style={styles.cardSub} numberOfLines={1}>{t.dropoff_location || '-'}</Text>
                  </View>
                  <View style={styles.cardRight}>
                    <Text style={styles.priceText}>{t.final_price || t.offered_price || 0} TL</Text>
                    <Text style={[
                      styles.statusText,
                      t.status === 'completed' ? styles.statusGreen : 
                      t.status === 'cancelled' ? styles.statusRed : styles.statusOrange
                    ]}>
                      {t.status === 'completed' ? 'Tamamlandı' : 
                       t.status === 'cancelled' ? 'İptal' : 
                       t.status === 'matched' ? 'Eşleşti' : 'Bekliyor'}
                    </Text>
                  </View>
                </View>
              </View>
            ))}
          </View>
        )}

        <View style={styles.bottomPadding} />
      </ScrollView>
    </View>
  );
}

export default function AdminPanel(props: Props) {
  return (
    <ErrorBoundary>
      <AdminContent {...props} />
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  center: {
    flex: 1,
    backgroundColor: '#0F172A',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#FFF',
    marginTop: 15,
    fontSize: 16,
  },
  errorBox: {
    flex: 1,
    backgroundColor: '#0F172A',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorTitle: {
    color: '#EF4444',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  errorMsg: {
    color: '#FFF',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 20,
  },
  retryBtn: {
    backgroundColor: '#3B82F6',
    paddingHorizontal: 30,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1E293B',
    paddingTop: Platform.OS === 'ios' ? 50 : 40,
    paddingBottom: 15,
    paddingHorizontal: 15,
  },
  closeBtn: {
    width: 44,
    height: 44,
    backgroundColor: '#334155',
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeBtnText: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  title: {
    color: '#FFF',
    fontSize: 20,
    fontWeight: '700',
  },
  tabRow: {
    flexDirection: 'row',
    backgroundColor: '#1E293B',
    paddingHorizontal: 10,
    paddingBottom: 10,
  },
  tabBtn: {
    flex: 1,
    backgroundColor: '#334155',
    marginHorizontal: 3,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  tabActive: {
    backgroundColor: '#3B82F6',
  },
  tabText: {
    color: '#94A3B8',
    fontSize: 13,
    fontWeight: '600',
  },
  tabTextActive: {
    color: '#FFF',
  },
  content: {
    flex: 1,
  },
  section: {
    padding: 15,
  },
  sectionTitle: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 15,
    marginTop: 5,
  },
  statsRow: {
    flexDirection: 'row',
    marginBottom: 10,
  },
  statBox: {
    flex: 1,
    backgroundColor: '#1E293B',
    marginHorizontal: 5,
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
  },
  statNum: {
    color: '#FFF',
    fontSize: 26,
    fontWeight: '700',
  },
  statLabel: {
    color: '#94A3B8',
    fontSize: 12,
    marginTop: 5,
  },
  searchInput: {
    backgroundColor: '#1E293B',
    color: '#FFF',
    paddingHorizontal: 15,
    paddingVertical: 12,
    borderRadius: 8,
    fontSize: 16,
    marginBottom: 10,
  },
  countText: {
    color: '#94A3B8',
    fontSize: 14,
    marginBottom: 10,
  },
  card: {
    backgroundColor: '#1E293B',
    padding: 15,
    borderRadius: 10,
    marginBottom: 10,
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cardLeft: {
    flex: 1,
  },
  cardRight: {
    alignItems: 'flex-end',
  },
  cardTitle: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  cardSub: {
    color: '#94A3B8',
    fontSize: 14,
    marginTop: 3,
  },
  cardMeta: {
    color: '#64748B',
    fontSize: 12,
    marginTop: 5,
  },
  priceText: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '700',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 5,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 5,
    overflow: 'hidden',
  },
  statusGreen: {
    backgroundColor: '#059669',
    color: '#FFF',
  },
  statusOrange: {
    backgroundColor: '#D97706',
    color: '#FFF',
  },
  statusRed: {
    backgroundColor: '#DC2626',
    color: '#FFF',
  },
  onlineBadge: {
    backgroundColor: '#059669',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
  },
  onlineText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '600',
  },
  bottomPadding: {
    height: 50,
  },
});
