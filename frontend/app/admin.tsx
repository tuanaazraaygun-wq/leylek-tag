/**
 * Admin Panel - Leylek TAG
 * v7 - TÜM CİHAZLARLA UYUMLU MİNİMAL VERSİYON
 * Sadece temel React Native componentleri kullanılıyor
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  RefreshControl,
  ActivityIndicator,
  Modal,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';

// API URL
const API_BASE = 'https://api.leylektag.com/api';

export default function AdminPanel() {
  const router = useRouter();
  
  // State
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [phone, setPhone] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  
  const [tab, setTab] = useState('dashboard');
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [trips, setTrips] = useState([]);
  const [search, setSearch] = useState('');

  // Init
  useEffect(() => {
    checkAdmin();
  }, []);

  const checkAdmin = async () => {
    try {
      const userData = await AsyncStorage.getItem('leylek_user');
      if (!userData) {
        setError('Giriş yapmalısınız');
        setLoading(false);
        return;
      }
      
      const user = JSON.parse(userData);
      const userPhone = String(user.phone || '').replace(/\D/g, '');
      
      console.log('[Admin] Checking phone:', userPhone);
      
      const res = await fetch(`${API_BASE}/admin/check?phone=${userPhone}`);
      const data = await res.json();
      
      console.log('[Admin] Check result:', data);
      
      if (data.is_admin === true) {
        setIsAdmin(true);
        setPhone(userPhone);
        loadData(userPhone);
      } else {
        setError('Admin yetkisi yok');
        setLoading(false);
      }
    } catch (err) {
      console.log('[Admin] Error:', err);
      setError('Bağlantı hatası');
      setLoading(false);
    }
  };

  const loadData = async (adminPhone) => {
    try {
      // Dashboard
      const dashRes = await fetch(`${API_BASE}/admin/dashboard/full?admin_phone=${adminPhone}`);
      const dashData = await dashRes.json();
      if (dashData.success && dashData.stats) {
        setStats(dashData.stats);
      }
      
      // Users
      const usersRes = await fetch(`${API_BASE}/admin/users/full?admin_phone=${adminPhone}&page=1&limit=50`);
      const usersData = await usersRes.json();
      if (usersData.success && usersData.users) {
        setUsers(usersData.users);
      }
      
      // Trips
      const tripsRes = await fetch(`${API_BASE}/admin/trips?admin_phone=${adminPhone}&page=1&limit=50`);
      const tripsData = await tripsRes.json();
      if (tripsData.success && tripsData.trips) {
        setTrips(tripsData.trips);
      }
    } catch (err) {
      console.log('[Admin] Load error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const refresh = () => {
    setRefreshing(true);
    loadData(phone);
  };

  const goBack = () => {
    try {
      router.back();
    } catch (e) {
      router.replace('/');
    }
  };

  // LOADING SCREEN
  if (loading) {
    return (
      <View style={styles.fullScreen}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#3B82F6" />
          <Text style={styles.loadingText}>Yükleniyor...</Text>
        </View>
      </View>
    );
  }

  // ERROR SCREEN
  if (error) {
    return (
      <View style={styles.fullScreen}>
        <View style={styles.center}>
          <Text style={styles.errorIcon}>!</Text>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.btn} onPress={goBack}>
            <Text style={styles.btnText}>Geri Dön</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // NOT ADMIN
  if (!isAdmin) {
    return (
      <View style={styles.fullScreen}>
        <View style={styles.center}>
          <Text style={styles.errorText}>Yetkisiz erişim</Text>
          <TouchableOpacity style={styles.btn} onPress={goBack}>
            <Text style={styles.btnText}>Geri Dön</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // Filter users
  const filteredUsers = search.length > 0
    ? users.filter(u => {
        const name = String(u.name || '').toLowerCase();
        const ph = String(u.phone || '');
        return name.includes(search.toLowerCase()) || ph.includes(search);
      })
    : users;

  // MAIN ADMIN PANEL
  return (
    <View style={styles.fullScreen}>
      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity onPress={goBack} style={styles.headerBtn}>
          <Text style={styles.headerBtnText}>{'<'}</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Admin Panel</Text>
        <TouchableOpacity onPress={refresh} style={styles.headerBtn}>
          <Text style={styles.headerBtnText}>↻</Text>
        </TouchableOpacity>
      </View>
      
      {/* TABS */}
      <View style={styles.tabsRow}>
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
      
      {/* CONTENT */}
      <ScrollView 
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={refresh} />
        }
      >
        {/* DASHBOARD TAB */}
        {tab === 'dashboard' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Genel Bakış</Text>
            
            <View style={styles.statsGrid}>
              <View style={styles.statBox}>
                <Text style={styles.statNum}>{stats?.users?.total || 0}</Text>
                <Text style={styles.statLabel}>Kullanıcı</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={styles.statNum}>{stats?.users?.drivers || 0}</Text>
                <Text style={styles.statLabel}>Sürücü</Text>
              </View>
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
            {trips.slice(0, 5).map((trip, idx) => (
              <View key={trip.id || idx} style={styles.listItem}>
                <View style={styles.listItemLeft}>
                  <Text style={styles.listItemTitle}>{trip.pickup_location || 'Bilinmiyor'}</Text>
                  <Text style={styles.listItemSub}>{trip.dropoff_location || ''}</Text>
                </View>
                <View style={styles.listItemRight}>
                  <Text style={styles.listItemPrice}>{trip.final_price || trip.offered_price || 0} ₺</Text>
                  <Text style={[
                    styles.listItemStatus,
                    trip.status === 'completed' ? styles.statusGreen : styles.statusOrange
                  ]}>
                    {trip.status === 'completed' ? 'Tamamlandı' : 
                     trip.status === 'cancelled' ? 'İptal' : 
                     trip.status === 'matched' ? 'Eşleşti' : 'Bekliyor'}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}
        
        {/* USERS TAB */}
        {tab === 'users' && (
          <View style={styles.section}>
            <TextInput
              style={styles.searchInput}
              placeholder="İsim veya telefon ara..."
              placeholderTextColor="#888"
              value={search}
              onChangeText={setSearch}
            />
            
            <Text style={styles.countText}>{filteredUsers.length} kullanıcı</Text>
            
            {filteredUsers.map((user, idx) => (
              <View key={user.id || idx} style={styles.listItem}>
                <View style={styles.listItemLeft}>
                  <Text style={styles.listItemTitle}>{user.name || 'İsimsiz'}</Text>
                  <Text style={styles.listItemSub}>{user.phone || ''}</Text>
                  <Text style={styles.listItemMeta}>
                    {user.is_driver ? 'Sürücü' : 'Yolcu'} • {user.total_trips || 0} trip
                  </Text>
                </View>
                <View style={styles.listItemRight}>
                  {user.is_online && (
                    <View style={styles.onlineBadge}>
                      <Text style={styles.onlineText}>Online</Text>
                    </View>
                  )}
                </View>
              </View>
            ))}
          </View>
        )}
        
        {/* TRIPS TAB */}
        {tab === 'trips' && (
          <View style={styles.section}>
            <Text style={styles.countText}>{trips.length} yolculuk</Text>
            
            {trips.map((trip, idx) => (
              <View key={trip.id || idx} style={styles.listItem}>
                <View style={styles.listItemLeft}>
                  <Text style={styles.listItemTitle} numberOfLines={1}>
                    {trip.pickup_location || 'Başlangıç'}
                  </Text>
                  <Text style={styles.listItemSub} numberOfLines={1}>
                    → {trip.dropoff_location || 'Varış'}
                  </Text>
                  <Text style={styles.listItemMeta}>
                    {trip.created_at ? new Date(trip.created_at).toLocaleDateString('tr-TR') : ''}
                  </Text>
                </View>
                <View style={styles.listItemRight}>
                  <Text style={styles.listItemPrice}>{trip.final_price || trip.offered_price || 0} ₺</Text>
                  <Text style={[
                    styles.listItemStatus,
                    trip.status === 'completed' ? styles.statusGreen : 
                    trip.status === 'cancelled' ? styles.statusRed : styles.statusOrange
                  ]}>
                    {trip.status === 'completed' ? 'Tamamlandı' : 
                     trip.status === 'cancelled' ? 'İptal' : 
                     trip.status === 'matched' ? 'Eşleşti' : 'Bekliyor'}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}
        
        <View style={styles.bottomSpace} />
      </ScrollView>
    </View>
  );
}

// MINIMAL STYLES - No complex properties
const styles = StyleSheet.create({
  fullScreen: {
    flex: 1,
    backgroundColor: '#111827',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    color: '#FFF',
    marginTop: 16,
    fontSize: 16,
  },
  errorIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#EF4444',
    color: '#FFF',
    fontSize: 36,
    fontWeight: 'bold',
    textAlign: 'center',
    lineHeight: 60,
    marginBottom: 16,
  },
  errorText: {
    color: '#EF4444',
    fontSize: 18,
    textAlign: 'center',
    marginBottom: 20,
  },
  btn: {
    backgroundColor: '#3B82F6',
    paddingHorizontal: 30,
    paddingVertical: 14,
    borderRadius: 8,
  },
  btnText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  
  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1F2937',
    paddingTop: Platform.OS === 'ios' ? 50 : 35,
    paddingBottom: 15,
    paddingHorizontal: 15,
  },
  headerBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#374151',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerBtnText: {
    color: '#FFF',
    fontSize: 22,
    fontWeight: 'bold',
  },
  headerTitle: {
    color: '#FFF',
    fontSize: 20,
    fontWeight: '700',
  },
  
  // Tabs
  tabsRow: {
    flexDirection: 'row',
    backgroundColor: '#1F2937',
    paddingHorizontal: 10,
    paddingBottom: 10,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    backgroundColor: '#374151',
    marginHorizontal: 4,
    borderRadius: 8,
  },
  tabActive: {
    backgroundColor: '#3B82F6',
  },
  tabText: {
    color: '#9CA3AF',
    fontSize: 14,
    fontWeight: '600',
  },
  tabTextActive: {
    color: '#FFF',
  },
  
  // Content
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
    marginTop: 10,
  },
  
  // Stats
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 10,
  },
  statBox: {
    width: '48%',
    backgroundColor: '#1F2937',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 10,
    marginRight: '2%',
  },
  statNum: {
    color: '#FFF',
    fontSize: 28,
    fontWeight: '700',
  },
  statLabel: {
    color: '#9CA3AF',
    fontSize: 13,
    marginTop: 5,
  },
  
  // Search
  searchInput: {
    backgroundColor: '#1F2937',
    borderRadius: 10,
    paddingHorizontal: 15,
    paddingVertical: 12,
    color: '#FFF',
    fontSize: 16,
    marginBottom: 15,
  },
  countText: {
    color: '#9CA3AF',
    fontSize: 14,
    marginBottom: 10,
  },
  
  // List Items
  listItem: {
    flexDirection: 'row',
    backgroundColor: '#1F2937',
    borderRadius: 10,
    padding: 15,
    marginBottom: 10,
  },
  listItemLeft: {
    flex: 1,
  },
  listItemRight: {
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  listItemTitle: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  listItemSub: {
    color: '#9CA3AF',
    fontSize: 14,
    marginTop: 3,
  },
  listItemMeta: {
    color: '#6B7280',
    fontSize: 12,
    marginTop: 5,
  },
  listItemPrice: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '700',
  },
  listItemStatus: {
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
  
  // Online badge
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
  
  bottomSpace: {
    height: 50,
  },
});
