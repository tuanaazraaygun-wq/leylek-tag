/**
 * Admin Panel - Leylek TAG
 * Basitleştirilmiş Android Uyumlu Versiyon
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
import { Ionicons } from '@expo/vector-icons';

const API_BASE = 'https://api.leylektag.com/api';

type Tab = 'dashboard' | 'users' | 'trips' | 'promos' | 'notifs';

export default function AdminPanel() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [phone, setPhone] = useState('');
  const [tab, setTab] = useState<Tab>('dashboard');
  
  const [stats, setStats] = useState<any>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [trips, setTrips] = useState<any[]>([]);
  const [promos, setPromos] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  
  const [showPromoModal, setShowPromoModal] = useState(false);
  const [showNotifModal, setShowNotifModal] = useState(false);
  const [showTimeModal, setShowTimeModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  
  const [promoHours, setPromoHours] = useState('3');
  const [notifTitle, setNotifTitle] = useState('');
  const [notifBody, setNotifBody] = useState('');
  const [addHours, setAddHours] = useState('3');

  useEffect(() => {
    initAdmin();
  }, []);

  const initAdmin = async () => {
    try {
      const userData = await AsyncStorage.getItem('leylek_user');
      if (!userData) {
        setError('Giriş yapmalısınız');
        setLoading(false);
        return;
      }
      
      const user = JSON.parse(userData);
      const userPhone = String(user.phone || '').replace(/\D/g, '');
      
      const res = await fetch(`${API_BASE}/admin/check?phone=${userPhone}`);
      const data = await res.json();
      
      if (data.is_admin) {
        setIsAdmin(true);
        setPhone(userPhone);
        await loadData(userPhone);
      } else {
        setError('Admin değilsiniz');
      }
    } catch (err: any) {
      setError('Bağlantı hatası: ' + (err?.message || 'Bilinmeyen'));
    } finally {
      setLoading(false);
    }
  };

  const loadData = async (adminPhone: string) => {
    setRefreshing(true);
    try {
      // Dashboard
      const dashRes = await fetch(`${API_BASE}/admin/dashboard/full?admin_phone=${adminPhone}`);
      const dashData = await dashRes.json();
      if (dashData.success) setStats(dashData.stats);
      
      // Users
      const usersRes = await fetch(`${API_BASE}/admin/users/full?admin_phone=${adminPhone}&page=1&limit=100`);
      const usersData = await usersRes.json();
      if (usersData.success) setUsers(usersData.users || []);
      
      // Trips
      const tripsRes = await fetch(`${API_BASE}/admin/trips?admin_phone=${adminPhone}&page=1&limit=100`);
      const tripsData = await tripsRes.json();
      if (tripsData.success) setTrips(tripsData.trips || []);
      
      // Promos
      try {
        const promosRes = await fetch(`${API_BASE}/admin/promo/list?admin_phone=${adminPhone}`);
        const promosData = await promosRes.json();
        if (promosData.success) setPromos(promosData.promos || []);
      } catch (e) {}
      
    } catch (err) {
      console.log('loadData error:', err);
    } finally {
      setRefreshing(false);
    }
  };

  const refresh = () => {
    if (phone) loadData(phone);
  };

  const createPromo = async () => {
    try {
      const res = await fetch(`${API_BASE}/admin/promo/create?admin_phone=${phone}&hours=${promoHours}&max_uses=100`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        Alert.alert('Başarılı', 'Kod: ' + (data.promo?.code || ''));
        setShowPromoModal(false);
        refresh();
      }
    } catch (err) {
      Alert.alert('Hata', 'Oluşturulamadı');
    }
  };

  const sendNotif = async () => {
    if (!notifTitle || !notifBody) {
      Alert.alert('Hata', 'Başlık ve mesaj gerekli');
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/admin/notifications/send?admin_phone=${phone}&title=${encodeURIComponent(notifTitle)}&body=${encodeURIComponent(notifBody)}&target=all`, { method: 'POST' });
      const data = await res.json();
      Alert.alert('Başarılı', (data.sent_count || 0) + ' kişiye gönderildi');
      setShowNotifModal(false);
    } catch (err) {
      Alert.alert('Hata', 'Gönderilemedi');
    }
  };

  const addTime = async () => {
    if (!selectedUser) return;
    try {
      const res = await fetch(`${API_BASE}/admin/user/add-time?admin_phone=${phone}&user_id=${selectedUser.id}&hours=${addHours}`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        Alert.alert('Başarılı', addHours + ' saat eklendi');
        setShowTimeModal(false);
        refresh();
      }
    } catch (err) {
      Alert.alert('Hata', 'Eklenemedi');
    }
  };

  // Loading
  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#3FA9F5" />
        <Text style={styles.loadingText}>Yükleniyor...</Text>
      </View>
    );
  }

  // Error
  if (error) {
    return (
      <View style={styles.centerContainer}>
        <Ionicons name="alert-circle" size={48} color="#EF4444" />
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backBtnText}>Geri Dön</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Not admin
  if (!isAdmin) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorText}>Yetkisiz erişim</Text>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backBtnText}>Geri Dön</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const filteredUsers = search 
    ? users.filter(u => 
        String(u.name || '').toLowerCase().includes(search.toLowerCase()) ||
        String(u.phone || '').includes(search)
      )
    : users;

  const drivers = users.filter(u => u.is_driver);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Admin Panel</Text>
        <TouchableOpacity onPress={refresh} style={styles.headerBtn}>
          <Ionicons name="refresh" size={24} color="#fff" />
        </TouchableOpacity>
      </View>
      
      {/* Tabs */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabsContainer}>
        {[
          { k: 'dashboard', i: 'grid', t: 'Panel' },
          { k: 'users', i: 'people', t: 'Kullanıcılar' },
          { k: 'trips', i: 'car', t: 'Yolculuklar' },
          { k: 'promos', i: 'gift', t: 'Promosyon' },
          { k: 'notifs', i: 'notifications', t: 'Bildirim' },
        ].map(x => (
          <TouchableOpacity
            key={x.k}
            style={[styles.tab, tab === x.k && styles.tabActive]}
            onPress={() => setTab(x.k as Tab)}
          >
            <Ionicons name={x.i as any} size={18} color={tab === x.k ? '#3FA9F5' : '#9CA3AF'} />
            <Text style={[styles.tabText, tab === x.k && styles.tabTextActive]}>{x.t}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
      
      {/* DASHBOARD */}
      {tab === 'dashboard' && (
        <ScrollView style={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}>
          <Text style={styles.sectionTitle}>Genel Bakış</Text>
          
          <View style={styles.cardRow}>
            <View style={styles.statCard}>
              <Ionicons name="people" size={24} color="#3FA9F5" />
              <Text style={styles.statNum}>{stats?.users?.total || 0}</Text>
              <Text style={styles.statLabel}>Kullanıcı</Text>
            </View>
            <View style={styles.statCard}>
              <Ionicons name="car" size={24} color="#10B981" />
              <Text style={styles.statNum}>{stats?.users?.drivers || 0}</Text>
              <Text style={styles.statLabel}>Sürücü</Text>
            </View>
          </View>
          
          <View style={styles.cardRow}>
            <View style={styles.statCard}>
              <Ionicons name="radio-button-on" size={24} color="#F59E0B" />
              <Text style={styles.statNum}>{stats?.users?.online_drivers || 0}</Text>
              <Text style={styles.statLabel}>Online</Text>
            </View>
            <View style={styles.statCard}>
              <Ionicons name="checkmark-circle" size={24} color="#10B981" />
              <Text style={styles.statNum}>{stats?.trips?.completed_today || 0}</Text>
              <Text style={styles.statLabel}>Bugün</Text>
            </View>
          </View>
          
          <Text style={styles.sectionTitle}>Sürücüler ({drivers.length})</Text>
          {drivers.map(d => (
            <View key={d.id} style={styles.driverItem}>
              <View style={styles.driverInfo}>
                <Text style={styles.driverName}>{d.name || 'İsimsiz'}</Text>
                <Text style={styles.driverPhone}>{d.phone || ''}</Text>
              </View>
              <View style={[styles.statusBadge, d.is_online ? styles.online : styles.offline]}>
                <Text style={styles.statusText}>{d.is_online ? 'Online' : 'Offline'}</Text>
              </View>
            </View>
          ))}
          
          <View style={styles.spacer} />
        </ScrollView>
      )}
      
      {/* USERS */}
      {tab === 'users' && (
        <ScrollView style={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}>
          <View style={styles.searchBox}>
            <Ionicons name="search" size={20} color="#9CA3AF" />
            <TextInput
              style={styles.searchInput}
              placeholder="Ara..."
              placeholderTextColor="#9CA3AF"
              value={search}
              onChangeText={setSearch}
            />
          </View>
          
          <Text style={styles.countText}>{filteredUsers.length} kullanıcı</Text>
          
          {filteredUsers.map(user => (
            <TouchableOpacity 
              key={user.id}
              style={styles.userItem}
              onPress={() => {
                if (user.is_driver) {
                  setSelectedUser(user);
                  setShowTimeModal(true);
                }
              }}
            >
              <View style={styles.userInfo}>
                <Text style={styles.userName}>{user.name || 'İsimsiz'}</Text>
                <Text style={styles.userPhone}>{user.phone || ''}</Text>
                <Text style={styles.userMeta}>
                  {user.is_driver ? 'Sürücü' : 'Yolcu'} | {user.total_trips || 0} trip
                </Text>
              </View>
              {user.is_driver && (
                <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
              )}
            </TouchableOpacity>
          ))}
          
          <View style={styles.spacer} />
        </ScrollView>
      )}
      
      {/* TRIPS */}
      {tab === 'trips' && (
        <ScrollView style={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}>
          <Text style={styles.countText}>{trips.length} yolculuk</Text>
          
          {trips.map(trip => (
            <View key={trip.id} style={styles.tripItem}>
              <View style={styles.tripHeader}>
                <View style={[
                  styles.tripStatus,
                  trip.status === 'completed' ? styles.completed :
                  trip.status === 'cancelled' ? styles.cancelled :
                  styles.active
                ]}>
                  <Text style={styles.tripStatusText}>
                    {trip.status === 'completed' ? 'Tamamlandı' :
                     trip.status === 'cancelled' ? 'İptal' :
                     trip.status === 'matched' ? 'Eşleşti' : 'Bekliyor'}
                  </Text>
                </View>
                <Text style={styles.tripPrice}>{trip.final_price || trip.offered_price || 0} TL</Text>
              </View>
              <Text style={styles.tripRoute} numberOfLines={1}>
                {trip.pickup_location || 'Başlangıç'} - {trip.dropoff_location || 'Varış'}
              </Text>
              <Text style={styles.tripDate}>
                {trip.created_at ? new Date(trip.created_at).toLocaleString('tr-TR') : ''}
              </Text>
            </View>
          ))}
          
          <View style={styles.spacer} />
        </ScrollView>
      )}
      
      {/* PROMOS */}
      {tab === 'promos' && (
        <ScrollView style={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}>
          <TouchableOpacity style={styles.addBtn} onPress={() => setShowPromoModal(true)}>
            <Ionicons name="add" size={24} color="#fff" />
            <Text style={styles.addBtnText}>Yeni Promosyon</Text>
          </TouchableOpacity>
          
          {promos.length === 0 ? (
            <Text style={styles.emptyText}>Promosyon kodu yok</Text>
          ) : (
            promos.map((p, i) => (
              <View key={p.id || i} style={styles.promoItem}>
                <Text style={styles.promoCode}>{p.code || ''}</Text>
                <Text style={styles.promoInfo}>{p.hours || 0} Saat</Text>
              </View>
            ))
          )}
          
          <View style={styles.spacer} />
        </ScrollView>
      )}
      
      {/* NOTIFS */}
      {tab === 'notifs' && (
        <ScrollView style={styles.content}>
          <TouchableOpacity style={styles.addBtn} onPress={() => setShowNotifModal(true)}>
            <Ionicons name="megaphone" size={24} color="#fff" />
            <Text style={styles.addBtnText}>Bildirim Gönder</Text>
          </TouchableOpacity>
          
          <Text style={styles.infoText}>
            Tüm kullanıcılara anlık bildirim gönderin.
          </Text>
          
          <View style={styles.spacer} />
        </ScrollView>
      )}
      
      {/* PROMO MODAL */}
      <Modal visible={showPromoModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Promosyon Oluştur</Text>
            <Text style={styles.modalLabel}>Saat:</Text>
            <TextInput
              style={styles.modalInput}
              value={promoHours}
              onChangeText={setPromoHours}
              keyboardType="number-pad"
              placeholder="3"
              placeholderTextColor="#9CA3AF"
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.modalCancel} onPress={() => setShowPromoModal(false)}>
                <Text style={styles.modalCancelText}>İptal</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalConfirm} onPress={createPromo}>
                <Text style={styles.modalConfirmText}>Oluştur</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      
      {/* NOTIF MODAL */}
      <Modal visible={showNotifModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Bildirim Gönder</Text>
            <Text style={styles.modalLabel}>Başlık:</Text>
            <TextInput
              style={styles.modalInput}
              value={notifTitle}
              onChangeText={setNotifTitle}
              placeholder="Başlık"
              placeholderTextColor="#9CA3AF"
            />
            <Text style={styles.modalLabel}>Mesaj:</Text>
            <TextInput
              style={[styles.modalInput, styles.textArea]}
              value={notifBody}
              onChangeText={setNotifBody}
              placeholder="Mesaj"
              placeholderTextColor="#9CA3AF"
              multiline
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.modalCancel} onPress={() => setShowNotifModal(false)}>
                <Text style={styles.modalCancelText}>İptal</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalConfirm} onPress={sendNotif}>
                <Text style={styles.modalConfirmText}>Gönder</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      
      {/* TIME MODAL */}
      <Modal visible={showTimeModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Süre Ekle</Text>
            <Text style={styles.modalSubtitle}>{selectedUser?.name || 'Sürücü'}</Text>
            <Text style={styles.modalLabel}>Saat:</Text>
            <TextInput
              style={styles.modalInput}
              value={addHours}
              onChangeText={setAddHours}
              keyboardType="number-pad"
              placeholder="3"
              placeholderTextColor="#9CA3AF"
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.modalCancel} onPress={() => setShowTimeModal(false)}>
                <Text style={styles.modalCancelText}>İptal</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalConfirm} onPress={addTime}>
                <Text style={styles.modalConfirmText}>Ekle</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  centerContainer: {
    flex: 1,
    backgroundColor: '#0F172A',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    color: '#fff',
    marginTop: 16,
    fontSize: 16,
  },
  errorText: {
    color: '#EF4444',
    marginTop: 16,
    fontSize: 16,
    textAlign: 'center',
  },
  backBtn: {
    marginTop: 20,
    backgroundColor: '#3FA9F5',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  backBtnText: {
    color: '#fff',
    fontWeight: '600',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    paddingTop: Platform.OS === 'ios' ? 50 : 40,
    paddingBottom: 16,
    paddingHorizontal: 16,
  },
  headerBtn: {
    padding: 4,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  tabsContainer: {
    backgroundColor: '#1E293B',
    paddingVertical: 8,
    paddingHorizontal: 8,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 8,
    borderRadius: 20,
    backgroundColor: '#0F172A',
  },
  tabActive: {
    backgroundColor: '#1E40AF',
  },
  tabText: {
    color: '#9CA3AF',
    marginLeft: 6,
    fontSize: 14,
  },
  tabTextActive: {
    color: '#fff',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  sectionTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
    marginTop: 8,
  },
  cardRow: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 16,
    marginRight: 8,
    alignItems: 'center',
  },
  statNum: {
    color: '#fff',
    fontSize: 28,
    fontWeight: '700',
    marginTop: 8,
  },
  statLabel: {
    color: '#9CA3AF',
    fontSize: 12,
    marginTop: 4,
  },
  driverItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  driverInfo: {
    flex: 1,
  },
  driverName: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  driverPhone: {
    color: '#9CA3AF',
    fontSize: 14,
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  online: {
    backgroundColor: '#10B981',
  },
  offline: {
    backgroundColor: '#6B7280',
  },
  statusText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    borderRadius: 8,
    paddingHorizontal: 12,
    marginBottom: 12,
  },
  searchInput: {
    flex: 1,
    color: '#fff',
    paddingVertical: 12,
    marginLeft: 8,
    fontSize: 16,
  },
  countText: {
    color: '#9CA3AF',
    marginBottom: 12,
  },
  userItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  userPhone: {
    color: '#9CA3AF',
    fontSize: 14,
  },
  userMeta: {
    color: '#6B7280',
    fontSize: 12,
    marginTop: 4,
  },
  tripItem: {
    backgroundColor: '#1E293B',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  tripHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  tripStatus: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  completed: {
    backgroundColor: '#10B981',
  },
  cancelled: {
    backgroundColor: '#EF4444',
  },
  active: {
    backgroundColor: '#F59E0B',
  },
  tripStatusText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  tripPrice: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  tripRoute: {
    color: '#9CA3AF',
    fontSize: 14,
  },
  tripDate: {
    color: '#6B7280',
    fontSize: 12,
    marginTop: 4,
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#3FA9F5',
    borderRadius: 8,
    padding: 14,
    marginBottom: 16,
  },
  addBtnText: {
    color: '#fff',
    fontWeight: '600',
    marginLeft: 8,
    fontSize: 16,
  },
  emptyText: {
    color: '#9CA3AF',
    textAlign: 'center',
    marginTop: 20,
  },
  infoText: {
    color: '#9CA3AF',
    textAlign: 'center',
    marginTop: 10,
    lineHeight: 22,
  },
  promoItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    borderRadius: 8,
    padding: 16,
    marginBottom: 8,
  },
  promoCode: {
    color: '#10B981',
    fontSize: 18,
    fontWeight: '700',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  promoInfo: {
    color: '#9CA3AF',
    fontSize: 14,
  },
  spacer: {
    height: 40,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 20,
    width: '100%',
    maxWidth: 340,
  },
  modalTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
  },
  modalSubtitle: {
    color: '#9CA3AF',
    fontSize: 14,
    marginBottom: 16,
    textAlign: 'center',
  },
  modalLabel: {
    color: '#9CA3AF',
    fontSize: 14,
    marginBottom: 6,
    marginTop: 12,
  },
  modalInput: {
    backgroundColor: '#0F172A',
    borderRadius: 8,
    padding: 12,
    color: '#fff',
    fontSize: 16,
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  modalButtons: {
    flexDirection: 'row',
    marginTop: 20,
  },
  modalCancel: {
    flex: 1,
    backgroundColor: '#374151',
    padding: 14,
    borderRadius: 8,
    marginRight: 8,
    alignItems: 'center',
  },
  modalCancelText: {
    color: '#fff',
    fontWeight: '600',
  },
  modalConfirm: {
    flex: 1,
    backgroundColor: '#3FA9F5',
    padding: 14,
    borderRadius: 8,
    marginLeft: 8,
    alignItems: 'center',
  },
  modalConfirmText: {
    color: '#fff',
    fontWeight: '600',
  },
});
