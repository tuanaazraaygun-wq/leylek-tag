/**
 * Admin Panel - Leylek TAG
 * Tam Kapsamlı Yönetim Paneli
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
  SafeAreaView,
  StatusBar,
} from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';

// SABIT API URL - Değişmez
const API_BASE = 'https://api.leylektag.com/api';

type Tab = 'dashboard' | 'users' | 'trips' | 'promos' | 'notifs';

export default function AdminPanel() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [phone, setPhone] = useState('');
  const [tab, setTab] = useState<Tab>('dashboard');
  
  // Data
  const [stats, setStats] = useState<any>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [trips, setTrips] = useState<any[]>([]);
  const [promos, setPromos] = useState<any[]>([]);
  
  // Search
  const [search, setSearch] = useState('');
  
  // Modals
  const [showPromoModal, setShowPromoModal] = useState(false);
  const [showNotifModal, setShowNotifModal] = useState(false);
  const [showTimeModal, setShowTimeModal] = useState(false);
  const [showTripModal, setShowTripModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [selectedTrip, setSelectedTrip] = useState<any>(null);
  
  // Forms
  const [promoHours, setPromoHours] = useState('3');
  const [notifTitle, setNotifTitle] = useState('');
  const [notifBody, setNotifBody] = useState('');
  const [addHours, setAddHours] = useState('3');

  useEffect(() => {
    initAdmin();
  }, []);

  const initAdmin = async () => {
    try {
      console.log('[ADMIN] Başlatılıyor...');
      
      const userData = await AsyncStorage.getItem('leylek_user');
      console.log('[ADMIN] User data:', userData ? 'var' : 'yok');
      
      if (!userData) {
        Alert.alert('Hata', 'Giriş yapmalısınız');
        router.replace('/');
        return;
      }
      
      const user = JSON.parse(userData);
      const userPhone = (user.phone || '').replace(/\D/g, '');
      console.log('[ADMIN] Phone:', userPhone);
      
      // Admin check
      const checkUrl = `${API_BASE}/admin/check?phone=${userPhone}`;
      console.log('[ADMIN] Check URL:', checkUrl);
      
      const res = await fetch(checkUrl);
      const data = await res.json();
      console.log('[ADMIN] Check result:', data);
      
      if (data.is_admin) {
        setIsAdmin(true);
        setPhone(userPhone);
        await loadData(userPhone);
      } else {
        Alert.alert('Yetkisiz', 'Admin değilsiniz');
        router.replace('/');
      }
    } catch (err) {
      console.error('[ADMIN] Init error:', err);
      Alert.alert('Hata', 'Bağlantı hatası');
    } finally {
      setLoading(false);
    }
  };

  const loadData = async (adminPhone: string) => {
    console.log('[ADMIN] loadData başladı, phone:', adminPhone);
    setRefreshing(true);
    
    try {
      // Dashboard
      const dashUrl = `${API_BASE}/admin/dashboard/full?admin_phone=${adminPhone}`;
      console.log('[ADMIN] Dashboard URL:', dashUrl);
      const dashRes = await fetch(dashUrl);
      const dashData = await dashRes.json();
      console.log('[ADMIN] Dashboard:', dashData.success, dashData.stats?.users?.total);
      if (dashData.success) setStats(dashData.stats);
      
      // Users
      const usersUrl = `${API_BASE}/admin/users/full?admin_phone=${adminPhone}&page=1&limit=100`;
      console.log('[ADMIN] Users URL:', usersUrl);
      const usersRes = await fetch(usersUrl);
      const usersData = await usersRes.json();
      console.log('[ADMIN] Users:', usersData.success, usersData.users?.length);
      if (usersData.success && usersData.users) {
        setUsers(usersData.users);
      }
      
      // Trips
      const tripsUrl = `${API_BASE}/admin/trips?admin_phone=${adminPhone}&page=1&limit=100`;
      console.log('[ADMIN] Trips URL:', tripsUrl);
      const tripsRes = await fetch(tripsUrl);
      const tripsData = await tripsRes.json();
      console.log('[ADMIN] Trips:', tripsData.success, tripsData.trips?.length);
      if (tripsData.success && tripsData.trips) {
        setTrips(tripsData.trips);
      }
      
      // Promos
      try {
        const promosUrl = `${API_BASE}/admin/promo/list?admin_phone=${adminPhone}`;
        const promosRes = await fetch(promosUrl);
        const promosData = await promosRes.json();
        if (promosData.success) setPromos(promosData.promos || []);
      } catch (e) {
        console.log('[ADMIN] Promos yüklenemedi');
      }
      
    } catch (err) {
      console.error('[ADMIN] loadData error:', err);
      Alert.alert('Hata', 'Veri yüklenemedi');
    } finally {
      setRefreshing(false);
    }
  };

  const refresh = () => {
    if (phone) loadData(phone);
  };

  const createPromo = async () => {
    try {
      const url = `${API_BASE}/admin/promo/create?admin_phone=${phone}&hours=${promoHours}&max_uses=100`;
      const res = await fetch(url, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        Alert.alert('Başarılı', `Kod: ${data.promo?.code}`);
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
      const url = `${API_BASE}/admin/notifications/send?admin_phone=${phone}&title=${encodeURIComponent(notifTitle)}&body=${encodeURIComponent(notifBody)}&target=all`;
      const res = await fetch(url, { method: 'POST' });
      const data = await res.json();
      Alert.alert('Başarılı', `${data.sent_count || 0} kişiye gönderildi`);
      setShowNotifModal(false);
      setNotifTitle('');
      setNotifBody('');
    } catch (err) {
      Alert.alert('Hata', 'Gönderilemedi');
    }
  };

  const addTime = async () => {
    if (!selectedUser) return;
    try {
      const url = `${API_BASE}/admin/user/add-time?admin_phone=${phone}&user_id=${selectedUser.id}&hours=${addHours}`;
      const res = await fetch(url, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        Alert.alert('Başarılı', `${addHours} saat eklendi`);
        setShowTimeModal(false);
        refresh();
      }
    } catch (err) {
      Alert.alert('Hata', 'Eklenemedi');
    }
  };

  if (loading) {
    return (
      <View style={s.center}>
        <ActivityIndicator size="large" color="#3FA9F5" />
        <Text style={s.loadingText}>Admin Panel Yükleniyor...</Text>
      </View>
    );
  }

  if (!isAdmin) return null;

  // Filter users
  const filteredUsers = search 
    ? users.filter(u => 
        (u.name || '').toLowerCase().includes(search.toLowerCase()) ||
        (u.phone || '').includes(search)
      )
    : users;

  // Drivers only
  const drivers = users.filter(u => u.is_driver);

  return (
    <SafeAreaView style={s.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0F172A" />
      
      {/* Header - Basit View */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={s.title}>Admin Panel</Text>
        <TouchableOpacity onPress={refresh}>
          <Ionicons name="refresh" size={24} color="#fff" />
        </TouchableOpacity>
      </View>
      
      {/* Tabs */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.tabs}>
        {[
          { k: 'dashboard', i: 'grid', t: 'Panel' },
          { k: 'users', i: 'people', t: 'Kullanıcılar' },
          { k: 'trips', i: 'car', t: 'Yolculuklar' },
          { k: 'promos', i: 'gift', t: 'Promosyon' },
          { k: 'notifs', i: 'notifications', t: 'Bildirim' },
        ].map(x => (
          <TouchableOpacity
            key={x.k}
            style={[s.tab, tab === x.k && s.tabActive]}
            onPress={() => setTab(x.k as Tab)}
          >
            <Ionicons name={x.i as any} size={18} color={tab === x.k ? '#3FA9F5' : '#9CA3AF'} />
            <Text style={[s.tabText, tab === x.k && s.tabTextActive]}>{x.t}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
      
      {/* DASHBOARD */}
      {tab === 'dashboard' && (
        <ScrollView style={s.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}>
          <Text style={s.section}>Genel Bakış</Text>
          
          <View style={s.row}>
            <View style={s.card}>
              <Ionicons name="people" size={24} color="#3FA9F5" />
              <Text style={s.cardNum}>{stats?.users?.total || 0}</Text>
              <Text style={s.cardLabel}>Toplam Kullanıcı</Text>
            </View>
            <View style={s.card}>
              <Ionicons name="car" size={24} color="#10B981" />
              <Text style={s.cardNum}>{stats?.users?.drivers || 0}</Text>
              <Text style={s.cardLabel}>Sürücü</Text>
            </View>
          </View>
          
          <View style={s.row}>
            <View style={s.card}>
              <Ionicons name="radio-button-on" size={24} color="#F59E0B" />
              <Text style={s.cardNum}>{stats?.users?.online_drivers || 0}</Text>
              <Text style={s.cardLabel}>Online Sürücü</Text>
            </View>
            <View style={s.card}>
              <Ionicons name="person-add" size={24} color="#8B5CF6" />
              <Text style={s.cardNum}>{stats?.users?.new_today || 0}</Text>
              <Text style={s.cardLabel}>Bugün Kayıt</Text>
            </View>
          </View>
          
          <Text style={s.section}>Yolculuklar</Text>
          
          <View style={s.row}>
            <View style={s.card}>
              <Ionicons name="checkmark-circle" size={24} color="#10B981" />
              <Text style={s.cardNum}>{stats?.trips?.completed_today || 0}</Text>
              <Text style={s.cardLabel}>Bugün Tamamlanan</Text>
            </View>
            <View style={s.card}>
              <Ionicons name="time" size={24} color="#F59E0B" />
              <Text style={s.cardNum}>{stats?.trips?.active || 0}</Text>
              <Text style={s.cardLabel}>Aktif</Text>
            </View>
          </View>
          
          <View style={s.row}>
            <View style={s.card}>
              <Ionicons name="hourglass" size={24} color="#EF4444" />
              <Text style={s.cardNum}>{stats?.trips?.waiting || 0}</Text>
              <Text style={s.cardLabel}>Bekleyen</Text>
            </View>
            <View style={s.card}>
              <Ionicons name="calendar" size={24} color="#3FA9F5" />
              <Text style={s.cardNum}>{stats?.trips?.completed_week || 0}</Text>
              <Text style={s.cardLabel}>Bu Hafta</Text>
            </View>
          </View>
          
          <Text style={s.section}>Sürücüler ({drivers.length})</Text>
          {drivers.map(d => (
            <View key={d.id} style={s.driverCard}>
              <View style={s.driverInfo}>
                <Text style={s.driverName}>{d.name || 'İsimsiz'}</Text>
                <Text style={s.driverPhone}>{d.phone}</Text>
                {d.driver_active_until && (
                  <Text style={s.driverTime}>
                    Aktif: {new Date(d.driver_active_until).toLocaleString('tr-TR')}
                  </Text>
                )}
              </View>
              <View style={[s.badge, d.is_online ? s.badgeOn : s.badgeOff]}>
                <Text style={s.badgeText}>{d.is_online ? 'Online' : 'Offline'}</Text>
              </View>
            </View>
          ))}
        </ScrollView>
      )}
      
      {/* USERS - ScrollView ile */}
      {tab === 'users' && (
        <ScrollView style={s.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}>
          <View style={s.searchBox}>
            <Ionicons name="search" size={20} color="#9CA3AF" />
            <TextInput
              style={s.searchInput}
              placeholder="İsim veya telefon ara..."
              placeholderTextColor="#9CA3AF"
              value={search}
              onChangeText={setSearch}
            />
          </View>
          
          <Text style={s.countText}>{filteredUsers.length} kullanıcı</Text>
          
          {filteredUsers.length === 0 ? (
            <Text style={s.empty}>Kullanıcı yok</Text>
          ) : (
            filteredUsers.map((item) => (
              <TouchableOpacity 
                key={item.id}
                style={s.userCard}
                onPress={() => {
                  if (item.is_driver) {
                    setSelectedUser(item);
                    setShowTimeModal(true);
                  }
                }}
              >
                <View style={s.userInfo}>
                  <View style={s.userRow}>
                    <Text style={s.userName}>{item.name || 'İsimsiz'}</Text>
                    {item.is_driver && (
                      <View style={[s.smallBadge, item.is_online ? s.badgeOn : s.badgeDriver]}>
                        <Text style={s.smallBadgeText}>{item.is_online ? 'Online' : 'Sürücü'}</Text>
                      </View>
                    )}
                  </View>
                  <Text style={s.userPhone}>{item.phone || '-'}</Text>
                  <Text style={s.userMeta}>
                    ⭐ {(item.rating || 5).toFixed(1)} • {item.total_trips || 0} trip • {item.city || '-'}
                  </Text>
                </View>
                {item.is_driver && (
                  <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
                )}
              </TouchableOpacity>
            ))
          )}
        </ScrollView>
      )}
      
      {/* TRIPS - ScrollView ile */}
      {tab === 'trips' && (
        <ScrollView style={s.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}>
          <Text style={s.countText}>{trips.length} yolculuk</Text>
          
          {trips.length === 0 ? (
            <Text style={s.empty}>Yolculuk yok</Text>
          ) : (
            trips.map((item) => (
              <TouchableOpacity 
                key={item.id}
                style={s.tripCard}
                onPress={() => {
                  setSelectedTrip(item);
                  setShowTripModal(true);
                }}
              >
                <View style={s.tripHeader}>
                  <View style={[s.statusBadge, 
                    item.status === 'completed' ? s.statusComplete :
                    item.status === 'cancelled' ? s.statusCancel :
                    item.status === 'matched' ? s.statusMatch :
                    s.statusWait
                  ]}>
                    <Text style={s.statusText}>
                      {item.status === 'completed' ? 'Tamamlandı' :
                       item.status === 'cancelled' ? 'İptal' :
                       item.status === 'matched' ? 'Eşleşti' :
                       item.status === 'in_progress' ? 'Devam' : 'Bekliyor'}
                    </Text>
                  </View>
                  <Text style={s.tripPrice}>{item.final_price || item.offered_price || 0} ₺</Text>
                </View>
                
                <Text style={s.tripRoute} numberOfLines={1}>
                  📍 {item.pickup_location || 'Başlangıç'} → {item.dropoff_location || 'Varış'}
                </Text>
                
                <Text style={s.tripDate}>
                  {item.created_at ? new Date(item.created_at).toLocaleString('tr-TR') : '-'}
                </Text>
              </TouchableOpacity>
            ))
          )}
        </ScrollView>
      )}
      
      {/* PROMOS - ScrollView ile */}
      {tab === 'promos' && (
        <ScrollView style={s.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}>
          <TouchableOpacity style={s.addBtn} onPress={() => setShowPromoModal(true)}>
            <Ionicons name="add" size={24} color="#fff" />
            <Text style={s.addBtnText}>Yeni Promosyon Kodu</Text>
          </TouchableOpacity>
          
          {promos.length === 0 ? (
            <Text style={s.empty}>Promosyon kodu yok</Text>
          ) : (
            promos.map((item, idx) => (
              <View key={item.id || idx.toString()} style={s.promoCard}>
                <Text style={s.promoCode}>{item.code}</Text>
                <Text style={s.promoInfo}>{item.hours} Saat • {item.used_count}/{item.max_uses} Kullanım</Text>
              </View>
            ))
          )}
        </ScrollView>
      )}
      
      {/* NOTIFICATIONS */}
      {tab === 'notifs' && (
        <View style={s.content}>
          <TouchableOpacity style={s.addBtn} onPress={() => setShowNotifModal(true)}>
            <Ionicons name="send" size={24} color="#fff" />
            <Text style={s.addBtnText}>Bildirim Gönder</Text>
          </TouchableOpacity>
          
          <View style={s.infoBox}>
            <Ionicons name="information-circle" size={24} color="#3FA9F5" />
            <Text style={s.infoText}>
              Tüm kullanıcılara push bildirim gönderebilirsiniz.
            </Text>
          </View>
        </View>
      )}
      
      {/* PROMO MODAL */}
      <Modal visible={showPromoModal} transparent animationType="slide">
        <View style={s.modalBg}>
          <View style={s.modal}>
            <Text style={s.modalTitle}>Yeni Promosyon</Text>
            
            <Text style={s.label}>Süre Seç</Text>
            <View style={s.optRow}>
              {['3', '6', '12', '24'].map(h => (
                <TouchableOpacity
                  key={h}
                  style={[s.optBtn, promoHours === h && s.optBtnActive]}
                  onPress={() => setPromoHours(h)}
                >
                  <Text style={[s.optText, promoHours === h && s.optTextActive]}>{h} Saat</Text>
                </TouchableOpacity>
              ))}
            </View>
            
            <View style={s.modalBtns}>
              <TouchableOpacity style={s.cancelBtn} onPress={() => setShowPromoModal(false)}>
                <Text style={s.cancelText}>İptal</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.submitBtn} onPress={createPromo}>
                <Text style={s.submitText}>Oluştur</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      
      {/* NOTIF MODAL */}
      <Modal visible={showNotifModal} transparent animationType="slide">
        <View style={s.modalBg}>
          <View style={s.modal}>
            <Text style={s.modalTitle}>Bildirim Gönder</Text>
            
            <Text style={s.label}>Başlık</Text>
            <TextInput
              style={s.input}
              placeholder="Bildirim başlığı"
              placeholderTextColor="#9CA3AF"
              value={notifTitle}
              onChangeText={setNotifTitle}
            />
            
            <Text style={s.label}>Mesaj</Text>
            <TextInput
              style={[s.input, { height: 80 }]}
              placeholder="Bildirim mesajı"
              placeholderTextColor="#9CA3AF"
              multiline
              value={notifBody}
              onChangeText={setNotifBody}
            />
            
            <View style={s.modalBtns}>
              <TouchableOpacity style={s.cancelBtn} onPress={() => setShowNotifModal(false)}>
                <Text style={s.cancelText}>İptal</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.submitBtn} onPress={sendNotif}>
                <Text style={s.submitText}>Gönder</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      
      {/* TIME MODAL */}
      <Modal visible={showTimeModal} transparent animationType="slide">
        <View style={s.modalBg}>
          <View style={s.modal}>
            <Text style={s.modalTitle}>Süre Ekle</Text>
            <Text style={s.modalSub}>{selectedUser?.name}</Text>
            
            <View style={s.optRow}>
              {['3', '6', '12', '24'].map(h => (
                <TouchableOpacity
                  key={h}
                  style={[s.optBtn, addHours === h && s.optBtnActive]}
                  onPress={() => setAddHours(h)}
                >
                  <Text style={[s.optText, addHours === h && s.optTextActive]}>{h}h</Text>
                </TouchableOpacity>
              ))}
            </View>
            
            <View style={s.modalBtns}>
              <TouchableOpacity style={s.cancelBtn} onPress={() => setShowTimeModal(false)}>
                <Text style={s.cancelText}>İptal</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.submitBtn} onPress={addTime}>
                <Text style={s.submitText}>Ekle</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      
      {/* TRIP DETAIL MODAL */}
      <Modal visible={showTripModal} transparent animationType="slide">
        <View style={s.modalBg}>
          <View style={s.modal}>
            <Text style={s.modalTitle}>Yolculuk Detayı</Text>
            
            {selectedTrip && (
              <>
                <View style={s.detailRow}>
                  <Text style={s.detailLabel}>Durum:</Text>
                  <Text style={s.detailValue}>{selectedTrip.status}</Text>
                </View>
                <View style={s.detailRow}>
                  <Text style={s.detailLabel}>Fiyat:</Text>
                  <Text style={s.detailValue}>{selectedTrip.final_price || selectedTrip.offered_price} ₺</Text>
                </View>
                <View style={s.detailRow}>
                  <Text style={s.detailLabel}>Mesafe:</Text>
                  <Text style={s.detailValue}>{selectedTrip.distance_km || '-'} km</Text>
                </View>
                <View style={s.detailRow}>
                  <Text style={s.detailLabel}>Yolcu ID:</Text>
                  <Text style={s.detailValue} numberOfLines={1}>{selectedTrip.passenger_id || '-'}</Text>
                </View>
                <View style={s.detailRow}>
                  <Text style={s.detailLabel}>Sürücü ID:</Text>
                  <Text style={s.detailValue} numberOfLines={1}>{selectedTrip.driver_id || '-'}</Text>
                </View>
                <View style={s.detailRow}>
                  <Text style={s.detailLabel}>Başlangıç:</Text>
                  <Text style={s.detailValue} numberOfLines={2}>{selectedTrip.pickup_location || '-'}</Text>
                </View>
                <View style={s.detailRow}>
                  <Text style={s.detailLabel}>Varış:</Text>
                  <Text style={s.detailValue} numberOfLines={2}>{selectedTrip.dropoff_location || '-'}</Text>
                </View>
                <View style={s.detailRow}>
                  <Text style={s.detailLabel}>Tarih:</Text>
                  <Text style={s.detailValue}>
                    {selectedTrip.created_at ? new Date(selectedTrip.created_at).toLocaleString('tr-TR') : '-'}
                  </Text>
                </View>
              </>
            )}
            
            <TouchableOpacity style={[s.submitBtn, { marginTop: 20 }]} onPress={() => setShowTripModal(false)}>
              <Text style={s.submitText}>Kapat</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F172A' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0F172A' },
  loadingText: { color: '#9CA3AF', marginTop: 12 },
  
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, backgroundColor: '#0F172A' },
  title: { fontSize: 20, fontWeight: '700', color: '#fff' },
  
  tabs: { backgroundColor: '#1E293B', paddingVertical: 8 },
  tab: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 8, marginHorizontal: 4, borderRadius: 8 },
  tabActive: { backgroundColor: 'rgba(63,169,245,0.15)' },
  tabText: { color: '#9CA3AF', marginLeft: 6, fontSize: 13 },
  tabTextActive: { color: '#3FA9F5', fontWeight: '600' },
  
  content: { flex: 1, padding: 16 },
  section: { fontSize: 18, fontWeight: '700', color: '#fff', marginVertical: 12 },
  countText: { color: '#9CA3AF', marginBottom: 12 },
  
  row: { flexDirection: 'row', marginBottom: 12 },
  card: { flex: 1, backgroundColor: '#1E293B', borderRadius: 12, padding: 16, alignItems: 'center', marginHorizontal: 4 },
  cardNum: { fontSize: 24, fontWeight: '700', color: '#fff', marginTop: 8 },
  cardLabel: { fontSize: 11, color: '#9CA3AF', marginTop: 4, textAlign: 'center' },
  
  driverCard: { flexDirection: 'row', backgroundColor: '#1E293B', borderRadius: 12, padding: 14, marginBottom: 8, alignItems: 'center' },
  driverInfo: { flex: 1 },
  driverName: { fontSize: 16, fontWeight: '600', color: '#fff' },
  driverPhone: { fontSize: 14, color: '#9CA3AF', marginTop: 2 },
  driverTime: { fontSize: 12, color: '#10B981', marginTop: 4 },
  
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  badgeOn: { backgroundColor: 'rgba(16,185,129,0.2)' },
  badgeOff: { backgroundColor: 'rgba(239,68,68,0.2)' },
  badgeDriver: { backgroundColor: 'rgba(63,169,245,0.2)' },
  badgeText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  
  searchBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1E293B', borderRadius: 12, paddingHorizontal: 12, marginBottom: 12 },
  searchInput: { flex: 1, color: '#fff', paddingVertical: 12, marginLeft: 8 },
  
  userCard: { flexDirection: 'row', backgroundColor: '#1E293B', borderRadius: 12, padding: 14, marginBottom: 8, alignItems: 'center' },
  userInfo: { flex: 1 },
  userRow: { flexDirection: 'row', alignItems: 'center' },
  userName: { fontSize: 16, fontWeight: '600', color: '#fff' },
  userPhone: { fontSize: 14, color: '#9CA3AF', marginTop: 2 },
  userMeta: { fontSize: 12, color: '#6B7280', marginTop: 4 },
  
  smallBadge: { marginLeft: 8, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8 },
  smallBadgeText: { color: '#fff', fontSize: 10, fontWeight: '600' },
  
  tripCard: { backgroundColor: '#1E293B', borderRadius: 12, padding: 14, marginBottom: 8 },
  tripHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  tripPrice: { fontSize: 18, fontWeight: '700', color: '#10B981' },
  tripRoute: { fontSize: 14, color: '#9CA3AF', marginTop: 8 },
  tripDate: { fontSize: 12, color: '#6B7280', marginTop: 6 },
  
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  statusComplete: { backgroundColor: 'rgba(16,185,129,0.2)' },
  statusCancel: { backgroundColor: 'rgba(239,68,68,0.2)' },
  statusMatch: { backgroundColor: 'rgba(63,169,245,0.2)' },
  statusWait: { backgroundColor: 'rgba(245,158,11,0.2)' },
  statusText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  
  addBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#3FA9F5', borderRadius: 12, padding: 14, marginBottom: 16 },
  addBtnText: { color: '#fff', fontSize: 16, fontWeight: '600', marginLeft: 8 },
  
  promoCard: { backgroundColor: '#1E293B', borderRadius: 12, padding: 16, marginBottom: 8 },
  promoCode: { fontSize: 18, fontWeight: '700', color: '#3FA9F5' },
  promoInfo: { fontSize: 14, color: '#9CA3AF', marginTop: 4 },
  
  infoBox: { flexDirection: 'row', backgroundColor: '#1E293B', borderRadius: 12, padding: 16, alignItems: 'center' },
  infoText: { flex: 1, color: '#9CA3AF', marginLeft: 12, fontSize: 14 },
  
  empty: { textAlign: 'center', color: '#6B7280', marginTop: 40 },
  
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', padding: 20 },
  modal: { backgroundColor: '#1E293B', borderRadius: 16, padding: 20 },
  modalTitle: { fontSize: 20, fontWeight: '700', color: '#fff', textAlign: 'center' },
  modalSub: { fontSize: 14, color: '#9CA3AF', textAlign: 'center', marginTop: 4, marginBottom: 16 },
  
  label: { fontSize: 14, color: '#9CA3AF', marginTop: 16, marginBottom: 8 },
  input: { backgroundColor: '#0F172A', borderRadius: 12, padding: 14, color: '#fff' },
  
  optRow: { flexDirection: 'row', marginTop: 8 },
  optBtn: { flex: 1, backgroundColor: '#0F172A', borderRadius: 8, padding: 12, marginRight: 8, alignItems: 'center' },
  optBtnActive: { backgroundColor: '#3FA9F5' },
  optText: { color: '#9CA3AF', fontWeight: '500' },
  optTextActive: { color: '#fff' },
  
  modalBtns: { flexDirection: 'row', marginTop: 20 },
  cancelBtn: { flex: 1, backgroundColor: '#374151', borderRadius: 12, padding: 14, marginRight: 8, alignItems: 'center' },
  cancelText: { color: '#fff', fontWeight: '600' },
  submitBtn: { flex: 1, backgroundColor: '#3FA9F5', borderRadius: 12, padding: 14, marginLeft: 8, alignItems: 'center' },
  submitText: { color: '#fff', fontWeight: '600' },
  
  detailRow: { flexDirection: 'row', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#374151' },
  detailLabel: { width: 80, color: '#9CA3AF', fontSize: 14 },
  detailValue: { flex: 1, color: '#fff', fontSize: 14 },
});
