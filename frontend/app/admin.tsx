/**
 * Admin Panel - Leylek TAG
 * v8 - ERROR BOUNDARY İLE SARMALANMIŞ VERSİYON
 */

import React, { useState, useEffect, Component } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  RefreshControl,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_BASE = 'https://api.leylektag.com/api';

// Error Boundary Class Component
class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.log('Admin Error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={errorStyles.container}>
          <Text style={errorStyles.title}>Bir hata oluştu</Text>
          <Text style={errorStyles.message}>{String(this.state.error)}</Text>
          <TouchableOpacity 
            style={errorStyles.button} 
            onPress={() => this.setState({ hasError: false, error: null })}
          >
            <Text style={errorStyles.buttonText}>Tekrar Dene</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return this.props.children;
  }
}

const errorStyles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#111', justifyContent: 'center', alignItems: 'center', padding: 20 },
  title: { color: '#F00', fontSize: 20, fontWeight: 'bold', marginBottom: 10 },
  message: { color: '#FFF', fontSize: 14, textAlign: 'center', marginBottom: 20 },
  button: { backgroundColor: '#3B82F6', paddingHorizontal: 30, paddingVertical: 15, borderRadius: 8 },
  buttonText: { color: '#FFF', fontSize: 16, fontWeight: '600' },
});

// Main Admin Component
function AdminContent() {
  const router = useRouter();
  const [state, setState] = useState({
    loading: true,
    error: '',
    isAdmin: false,
    phone: '',
    tab: 'dashboard',
    stats: null,
    users: [],
    trips: [],
    search: '',
    refreshing: false,
  });

  useEffect(() => {
    init();
  }, []);

  const init = async () => {
    try {
      const userData = await AsyncStorage.getItem('leylek_user');
      
      if (!userData) {
        setState(s => ({ ...s, loading: false, error: 'Giriş yapmalısınız' }));
        return;
      }
      
      let user;
      try {
        user = JSON.parse(userData);
      } catch (e) {
        setState(s => ({ ...s, loading: false, error: 'Kullanıcı verisi okunamadı' }));
        return;
      }
      
      const userPhone = String(user.phone || '').replace(/\D/g, '');
      
      const checkRes = await fetch(`${API_BASE}/admin/check?phone=${userPhone}`);
      const checkData = await checkRes.json();
      
      if (checkData.is_admin !== true) {
        setState(s => ({ ...s, loading: false, error: 'Admin yetkisi yok' }));
        return;
      }
      
      setState(s => ({ ...s, isAdmin: true, phone: userPhone }));
      await loadData(userPhone);
      
    } catch (err) {
      setState(s => ({ ...s, loading: false, error: 'Bağlantı hatası: ' + String(err.message || err) }));
    }
  };

  const loadData = async (adminPhone) => {
    try {
      // Dashboard
      let stats = null;
      try {
        const dashRes = await fetch(`${API_BASE}/admin/dashboard/full?admin_phone=${adminPhone}`);
        const dashData = await dashRes.json();
        if (dashData.success) stats = dashData.stats;
      } catch (e) {}
      
      // Users
      let users = [];
      try {
        const usersRes = await fetch(`${API_BASE}/admin/users/full?admin_phone=${adminPhone}&page=1&limit=50`);
        const usersData = await usersRes.json();
        if (usersData.success && Array.isArray(usersData.users)) users = usersData.users;
      } catch (e) {}
      
      // Trips
      let trips = [];
      try {
        const tripsRes = await fetch(`${API_BASE}/admin/trips?admin_phone=${adminPhone}&page=1&limit=50`);
        const tripsData = await tripsRes.json();
        if (tripsData.success && Array.isArray(tripsData.trips)) trips = tripsData.trips;
      } catch (e) {}
      
      setState(s => ({ ...s, loading: false, refreshing: false, stats, users, trips }));
    } catch (err) {
      setState(s => ({ ...s, loading: false, refreshing: false }));
    }
  };

  const refresh = () => {
    setState(s => ({ ...s, refreshing: true }));
    loadData(state.phone);
  };

  const goBack = () => {
    try { router.back(); } catch (e) { router.replace('/'); }
  };

  const setTab = (tab) => setState(s => ({ ...s, tab }));
  const setSearch = (search) => setState(s => ({ ...s, search }));

  // LOADING
  if (state.loading) {
    return (
      <View style={styles.screen}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#3B82F6" />
          <Text style={styles.loadingText}>Yükleniyor...</Text>
        </View>
      </View>
    );
  }

  // ERROR
  if (state.error) {
    return (
      <View style={styles.screen}>
        <View style={styles.centered}>
          <Text style={styles.errorText}>{state.error}</Text>
          <TouchableOpacity style={styles.blueBtn} onPress={goBack}>
            <Text style={styles.blueBtnText}>Geri Dön</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // NOT ADMIN
  if (!state.isAdmin) {
    return (
      <View style={styles.screen}>
        <View style={styles.centered}>
          <Text style={styles.errorText}>Yetkisiz</Text>
          <TouchableOpacity style={styles.blueBtn} onPress={goBack}>
            <Text style={styles.blueBtnText}>Geri Dön</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // Filter users
  const filteredUsers = state.search
    ? state.users.filter(u => {
        const n = String(u.name || '').toLowerCase();
        const p = String(u.phone || '');
        return n.includes(state.search.toLowerCase()) || p.includes(state.search);
      })
    : state.users;

  // MAIN PANEL
  return (
    <View style={styles.screen}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={goBack} style={styles.headerBtn}>
          <Text style={styles.headerBtnText}>{'<'}</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Admin</Text>
        <TouchableOpacity onPress={refresh} style={styles.headerBtn}>
          <Text style={styles.headerBtnText}>R</Text>
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        {['dashboard', 'users', 'trips'].map(t => (
          <TouchableOpacity 
            key={t}
            style={[styles.tabBtn, state.tab === t && styles.tabActive]}
            onPress={() => setTab(t)}
          >
            <Text style={[styles.tabText, state.tab === t && styles.tabTextActive]}>
              {t === 'dashboard' ? 'Panel' : t === 'users' ? 'Kullanıcılar' : 'Yolculuklar'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Content */}
      <ScrollView
        style={styles.content}
        refreshControl={<RefreshControl refreshing={state.refreshing} onRefresh={refresh} />}
      >
        {/* Dashboard */}
        {state.tab === 'dashboard' && (
          <View style={styles.section}>
            <View style={styles.row}>
              <View style={styles.statCard}>
                <Text style={styles.statNum}>{state.stats?.users?.total || 0}</Text>
                <Text style={styles.statLabel}>Kullanıcı</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statNum}>{state.stats?.users?.drivers || 0}</Text>
                <Text style={styles.statLabel}>Sürücü</Text>
              </View>
            </View>
            <View style={styles.row}>
              <View style={styles.statCard}>
                <Text style={styles.statNum}>{state.stats?.users?.online_drivers || 0}</Text>
                <Text style={styles.statLabel}>Online</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statNum}>{state.stats?.trips?.completed_today || 0}</Text>
                <Text style={styles.statLabel}>Bugün</Text>
              </View>
            </View>
          </View>
        )}

        {/* Users */}
        {state.tab === 'users' && (
          <View style={styles.section}>
            <TextInput
              style={styles.input}
              placeholder="Ara..."
              placeholderTextColor="#666"
              value={state.search}
              onChangeText={setSearch}
            />
            <Text style={styles.countText}>{filteredUsers.length} kullanıcı</Text>
            {filteredUsers.slice(0, 30).map((u, i) => (
              <View key={u.id || i} style={styles.card}>
                <Text style={styles.cardTitle}>{u.name || 'İsimsiz'}</Text>
                <Text style={styles.cardSub}>{u.phone || ''}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Trips */}
        {state.tab === 'trips' && (
          <View style={styles.section}>
            <Text style={styles.countText}>{state.trips.length} yolculuk</Text>
            {state.trips.slice(0, 30).map((t, i) => (
              <View key={t.id || i} style={styles.card}>
                <Text style={styles.cardTitle}>{t.pickup_location || 'Bilinmiyor'}</Text>
                <Text style={styles.cardSub}>{t.final_price || t.offered_price || 0} TL</Text>
              </View>
            ))}
          </View>
        )}

        <View style={styles.spacer} />
      </ScrollView>
    </View>
  );
}

// Wrap with Error Boundary
export default function AdminPanel() {
  return (
    <ErrorBoundary>
      <AdminContent />
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    color: '#FFF',
    marginTop: 15,
    fontSize: 16,
  },
  errorText: {
    color: '#EF4444',
    fontSize: 18,
    marginBottom: 20,
    textAlign: 'center',
  },
  blueBtn: {
    backgroundColor: '#3B82F6',
    paddingHorizontal: 30,
    paddingVertical: 12,
    borderRadius: 8,
  },
  blueBtnText: {
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
  headerBtn: {
    width: 44,
    height: 44,
    backgroundColor: '#334155',
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerBtnText: {
    color: '#FFF',
    fontSize: 20,
    fontWeight: 'bold',
  },
  headerTitle: {
    color: '#FFF',
    fontSize: 20,
    fontWeight: '700',
  },
  tabs: {
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
  row: {
    flexDirection: 'row',
    marginBottom: 10,
  },
  statCard: {
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
  input: {
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
  spacer: {
    height: 50,
  },
});
