/**
 * Admin Panel - Leylek TAG
 * Basit ve güvenilir admin paneli
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
  Dimensions,
  FlatList,
} from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

const { width } = Dimensions.get('window');

// API URL - Production
const API_URL = 'https://api.leylektag.com/api';

type TabType = 'dashboard' | 'users' | 'promos' | 'notifications';

export default function AdminScreen() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminPhone, setAdminPhone] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('dashboard');
  
  // Data states
  const [stats, setStats] = useState<any>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [promos, setPromos] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  
  // Modals
  const [promoModal, setPromoModal] = useState(false);
  const [notifModal, setNotifModal] = useState(false);
  const [timeModal, setTimeModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  
  // Form states
  const [promoHours, setPromoHours] = useState('3');
  const [promoCode, setPromoCode] = useState('');
  const [notifTitle, setNotifTitle] = useState('');
  const [notifBody, setNotifBody] = useState('');
  const [notifTarget, setNotifTarget] = useState('all');
  const [addHours, setAddHours] = useState('3');
  const [searchText, setSearchText] = useState('');

  useEffect(() => {
    checkAdmin();
  }, []);

  const checkAdmin = async () => {
    try {
      const userData = await AsyncStorage.getItem('leylek_user');
      if (!userData) {
        Alert.alert('Hata', 'Giriş yapmalısınız');
        router.replace('/');
        return;
      }
      
      const user = JSON.parse(userData);
      const phone = user.phone?.replace(/\D/g, '') || '';
      
      console.log('Admin check for phone:', phone);
      
      const res = await fetch(`${API_URL}/admin/check?phone=${phone}`);
      const data = await res.json();
      
      console.log('Admin check result:', data);
      
      if (data.is_admin) {
        setIsAdmin(true);
        setAdminPhone(phone);
        await loadAllData(phone);
      } else {
        Alert.alert('Yetkisiz', 'Admin değilsiniz');
        router.replace('/');
      }
    } catch (err) {
      console.error('Admin check error:', err);
      Alert.alert('Hata', 'Bağlantı hatası');
    } finally {
      setIsLoading(false);
    }
  };

  const loadAllData = async (phone: string) => {
    setRefreshing(true);
    try {
      // Dashboard
      const dashRes = await fetch(`${API_URL}/admin/dashboard/full?admin_phone=${phone}`);
      const dashData = await dashRes.json();
      console.log('Dashboard data:', dashData);
      if (dashData.success) setStats(dashData.stats);
      
      // Users
      const usersRes = await fetch(`${API_URL}/admin/users/full?admin_phone=${phone}&page=1&limit=50`);
      const usersData = await usersRes.json();
      console.log('Users data:', usersData.users?.length);
      if (usersData.success) setUsers(usersData.users || []);
      
      // Promos
      try {
        const promosRes = await fetch(`${API_URL}/admin/promo/list?admin_phone=${phone}`);
        const promosData = await promosRes.json();
        if (promosData.success) setPromos(promosData.promos || []);
      } catch (e) {
        console.log('Promos not available');
      }
      
      // Notifications
      try {
        const notifsRes = await fetch(`${API_URL}/admin/notifications/history?admin_phone=${phone}`);
        const notifsData = await notifsRes.json();
        if (notifsData.success) setNotifications(notifsData.notifications || []);
      } catch (e) {
        console.log('Notifications not available');
      }
    } catch (err) {
      console.error('Load data error:', err);
    } finally {
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    if (adminPhone) loadAllData(adminPhone);
  };

  const createPromo = async () => {
    try {
      const url = `${API_URL}/admin/promo/create?admin_phone=${adminPhone}&hours=${promoHours}&max_uses=10${promoCode ? `&code=${promoCode}` : ''}`;
      const res = await fetch(url, { method: 'POST' });
      const data = await res.json();
      
      if (data.success) {
        Alert.alert('Başarılı', `Kod: ${data.promo?.code || 'Oluşturuldu'}`);
        setPromoModal(false);
        setPromoCode('');
        onRefresh();
      } else {
        Alert.alert('Hata', data.detail || 'Oluşturulamadı');
      }
    } catch (err) {
      Alert.alert('Hata', 'Bağlantı hatası');
    }
  };

  const sendNotification = async () => {
    if (!notifTitle || !notifBody) {
      Alert.alert('Hata', 'Başlık ve mesaj gerekli');
      return;
    }
    
    try {
      const url = `${API_URL}/admin/notifications/send?admin_phone=${adminPhone}&title=${encodeURIComponent(notifTitle)}&body=${encodeURIComponent(notifBody)}&target=${notifTarget}`;
      const res = await fetch(url, { method: 'POST' });
      const data = await res.json();
      
      if (data.success) {
        Alert.alert('Başarılı', `${data.sent_count} kişiye gönderildi`);
        setNotifModal(false);
        setNotifTitle('');
        setNotifBody('');
        onRefresh();
      } else {
        Alert.alert('Hata', data.detail || 'Gönderilemedi');
      }
    } catch (err) {
      Alert.alert('Hata', 'Bağlantı hatası');
    }
  };

  const addDriverTime = async () => {
    if (!selectedUser) return;
    
    try {
      const url = `${API_URL}/admin/user/add-time?admin_phone=${adminPhone}&user_id=${selectedUser.id}&hours=${addHours}`;
      const res = await fetch(url, { method: 'POST' });
      const data = await res.json();
      
      if (data.success) {
        Alert.alert('Başarılı', `${addHours} saat eklendi`);
        setTimeModal(false);
        setSelectedUser(null);
        onRefresh();
      } else {
        Alert.alert('Hata', data.error || 'Eklenemedi');
      }
    } catch (err) {
      Alert.alert('Hata', 'Bağlantı hatası');
    }
  };

  const banUser = (user: any) => {
    Alert.alert(
      user.is_active ? 'Banla' : 'Ban Kaldır',
      `${user.name} kullanıcısını ${user.is_active ? 'banlamak' : 'aktif etmek'} istiyor musunuz?`,
      [
        { text: 'İptal', style: 'cancel' },
        {
          text: 'Evet',
          onPress: async () => {
            try {
              const url = `${API_URL}/admin/user/ban?admin_phone=${adminPhone}&user_id=${user.id}&is_banned=${user.is_active}`;
              await fetch(url, { method: 'POST' });
              onRefresh();
            } catch (err) {
              Alert.alert('Hata', 'İşlem başarısız');
            }
          }
        }
      ]
    );
  };

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#3FA9F5" />
        <Text style={styles.loadingText}>Yükleniyor...</Text>
      </View>
    );
  }

  if (!isAdmin) return null;

  const filteredUsers = searchText 
    ? users.filter(u => 
        u.name?.toLowerCase().includes(searchText.toLowerCase()) || 
        u.phone?.includes(searchText)
      )
    : users;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      
      {/* Header */}
      <LinearGradient colors={['#0F172A', '#1E293B']} style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="white" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Admin Panel</Text>
        <TouchableOpacity onPress={onRefresh}>
          <Ionicons name="refresh" size={24} color="white" />
        </TouchableOpacity>
      </LinearGradient>
      
      {/* Tabs */}
      <View style={styles.tabs}>
        {[
          { key: 'dashboard', icon: 'grid', label: 'Panel' },
          { key: 'users', icon: 'people', label: 'Kullanıcılar' },
          { key: 'promos', icon: 'gift', label: 'Promosyon' },
          { key: 'notifications', icon: 'notifications', label: 'Bildirim' },
        ].map(tab => (
          <TouchableOpacity
            key={tab.key}
            style={[styles.tab, activeTab === tab.key && styles.activeTab]}
            onPress={() => setActiveTab(tab.key as TabType)}
          >
            <Ionicons 
              name={tab.icon as any} 
              size={20} 
              color={activeTab === tab.key ? '#3FA9F5' : '#9CA3AF'} 
            />
            <Text style={[styles.tabText, activeTab === tab.key && styles.activeTabText]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      
      {/* Dashboard */}
      {activeTab === 'dashboard' && (
        <ScrollView 
          style={styles.content}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          <Text style={styles.sectionTitle}>Özet</Text>
          
          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <Ionicons name="people" size={28} color="#3FA9F5" />
              <Text style={styles.statNum}>{stats?.users?.total || 0}</Text>
              <Text style={styles.statLabel}>Toplam</Text>
            </View>
            <View style={styles.statCard}>
              <Ionicons name="car" size={28} color="#10B981" />
              <Text style={styles.statNum}>{stats?.users?.drivers || 0}</Text>
              <Text style={styles.statLabel}>Sürücü</Text>
            </View>
            <View style={styles.statCard}>
              <Ionicons name="radio-button-on" size={28} color="#F59E0B" />
              <Text style={styles.statNum}>{stats?.users?.online_drivers || 0}</Text>
              <Text style={styles.statLabel}>Online</Text>
            </View>
          </View>
          
          <Text style={styles.sectionTitle}>Yolculuklar</Text>
          
          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <Ionicons name="checkmark-circle" size={28} color="#10B981" />
              <Text style={styles.statNum}>{stats?.trips?.completed_today || 0}</Text>
              <Text style={styles.statLabel}>Bugün</Text>
            </View>
            <View style={styles.statCard}>
              <Ionicons name="time" size={28} color="#F59E0B" />
              <Text style={styles.statNum}>{stats?.trips?.active || 0}</Text>
              <Text style={styles.statLabel}>Aktif</Text>
            </View>
            <View style={styles.statCard}>
              <Ionicons name="hourglass" size={28} color="#EF4444" />
              <Text style={styles.statNum}>{stats?.trips?.waiting || 0}</Text>
              <Text style={styles.statLabel}>Bekleyen</Text>
            </View>
          </View>
          
          <View style={styles.weekCard}>
            <Text style={styles.weekTitle}>Bu Hafta</Text>
            <Text style={styles.weekNum}>{stats?.trips?.completed_week || 0} yolculuk tamamlandı</Text>
          </View>
        </ScrollView>
      )}
      
      {/* Users */}
      {activeTab === 'users' && (
        <View style={styles.content}>
          <View style={styles.searchBox}>
            <Ionicons name="search" size={20} color="#9CA3AF" />
            <TextInput
              style={styles.searchInput}
              placeholder="İsim veya telefon ara..."
              placeholderTextColor="#9CA3AF"
              value={searchText}
              onChangeText={setSearchText}
            />
          </View>
          
          <FlatList
            data={filteredUsers}
            keyExtractor={(item) => item.id}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
            renderItem={({ item }) => (
              <View style={styles.userCard}>
                <View style={styles.userInfo}>
                  <View style={styles.userRow}>
                    <Text style={styles.userName}>{item.name || 'İsimsiz'}</Text>
                    {item.is_driver && (
                      <View style={[styles.badge, item.is_online ? styles.badgeOnline : styles.badgeDriver]}>
                        <Text style={styles.badgeText}>{item.is_online ? 'Online' : 'Sürücü'}</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.userPhone}>{item.phone || 'Telefon yok'}</Text>
                  <Text style={styles.userMeta}>
                    ⭐ {(item.rating || 5).toFixed(1)} • {item.total_trips || 0} trip
                  </Text>
                </View>
                
                <View style={styles.userActions}>
                  {item.is_driver && (
                    <TouchableOpacity
                      style={styles.actionBtn}
                      onPress={() => { setSelectedUser(item); setTimeModal(true); }}
                    >
                      <Ionicons name="time" size={22} color="#10B981" />
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity style={styles.actionBtn} onPress={() => banUser(item)}>
                    <Ionicons 
                      name={item.is_active ? 'ban' : 'checkmark-circle'} 
                      size={22} 
                      color={item.is_active ? '#EF4444' : '#10B981'} 
                    />
                  </TouchableOpacity>
                </View>
              </View>
            )}
            ListEmptyComponent={
              <Text style={styles.empty}>Kullanıcı bulunamadı</Text>
            }
          />
        </View>
      )}
      
      {/* Promos */}
      {activeTab === 'promos' && (
        <View style={styles.content}>
          <TouchableOpacity style={styles.addBtn} onPress={() => setPromoModal(true)}>
            <Ionicons name="add" size={24} color="white" />
            <Text style={styles.addBtnText}>Yeni Promosyon</Text>
          </TouchableOpacity>
          
          <FlatList
            data={promos}
            keyExtractor={(item, idx) => item.id || idx.toString()}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
            renderItem={({ item }) => (
              <View style={styles.promoCard}>
                <Text style={styles.promoCode}>{item.code}</Text>
                <Text style={styles.promoInfo}>{item.hours} Saat • {item.used_count}/{item.max_uses} Kullanım</Text>
              </View>
            )}
            ListEmptyComponent={
              <Text style={styles.empty}>Promosyon kodu yok</Text>
            }
          />
        </View>
      )}
      
      {/* Notifications */}
      {activeTab === 'notifications' && (
        <View style={styles.content}>
          <TouchableOpacity style={styles.addBtn} onPress={() => setNotifModal(true)}>
            <Ionicons name="send" size={24} color="white" />
            <Text style={styles.addBtnText}>Bildirim Gönder</Text>
          </TouchableOpacity>
          
          <FlatList
            data={notifications}
            keyExtractor={(item, idx) => item.id || idx.toString()}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
            renderItem={({ item }) => (
              <View style={styles.notifCard}>
                <Text style={styles.notifTitle}>{item.title}</Text>
                <Text style={styles.notifBody}>{item.body}</Text>
              </View>
            )}
            ListEmptyComponent={
              <Text style={styles.empty}>Bildirim geçmişi boş</Text>
            }
          />
        </View>
      )}
      
      {/* Promo Modal */}
      <Modal visible={promoModal} transparent animationType="slide">
        <View style={styles.modalBg}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Yeni Promosyon Kodu</Text>
            
            <Text style={styles.inputLabel}>Kod (Opsiyonel)</Text>
            <TextInput
              style={styles.input}
              placeholder="Otomatik oluşturulur"
              placeholderTextColor="#9CA3AF"
              value={promoCode}
              onChangeText={text => setPromoCode(text.toUpperCase())}
            />
            
            <Text style={styles.inputLabel}>Süre (Saat)</Text>
            <View style={styles.hoursRow}>
              {['3', '6', '12', '24'].map(h => (
                <TouchableOpacity
                  key={h}
                  style={[styles.hourBtn, promoHours === h && styles.hourBtnActive]}
                  onPress={() => setPromoHours(h)}
                >
                  <Text style={[styles.hourText, promoHours === h && styles.hourTextActive]}>{h}</Text>
                </TouchableOpacity>
              ))}
            </View>
            
            <View style={styles.modalBtns}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setPromoModal(false)}>
                <Text style={styles.cancelText}>İptal</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.submitBtn} onPress={createPromo}>
                <Text style={styles.submitText}>Oluştur</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      
      {/* Notification Modal */}
      <Modal visible={notifModal} transparent animationType="slide">
        <View style={styles.modalBg}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Bildirim Gönder</Text>
            
            <Text style={styles.inputLabel}>Başlık</Text>
            <TextInput
              style={styles.input}
              placeholder="Bildirim başlığı"
              placeholderTextColor="#9CA3AF"
              value={notifTitle}
              onChangeText={setNotifTitle}
            />
            
            <Text style={styles.inputLabel}>Mesaj</Text>
            <TextInput
              style={[styles.input, { height: 80 }]}
              placeholder="Bildirim mesajı"
              placeholderTextColor="#9CA3AF"
              multiline
              value={notifBody}
              onChangeText={setNotifBody}
            />
            
            <Text style={styles.inputLabel}>Hedef</Text>
            <View style={styles.hoursRow}>
              {[
                { key: 'all', label: 'Herkes' },
                { key: 'drivers', label: 'Sürücüler' },
                { key: 'online_drivers', label: 'Online' },
              ].map(t => (
                <TouchableOpacity
                  key={t.key}
                  style={[styles.hourBtn, notifTarget === t.key && styles.hourBtnActive]}
                  onPress={() => setNotifTarget(t.key)}
                >
                  <Text style={[styles.hourText, notifTarget === t.key && styles.hourTextActive]}>{t.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
            
            <View style={styles.modalBtns}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setNotifModal(false)}>
                <Text style={styles.cancelText}>İptal</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.submitBtn} onPress={sendNotification}>
                <Text style={styles.submitText}>Gönder</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      
      {/* Add Time Modal */}
      <Modal visible={timeModal} transparent animationType="slide">
        <View style={styles.modalBg}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Süre Ekle</Text>
            <Text style={styles.modalSub}>{selectedUser?.name}</Text>
            
            <View style={styles.hoursRow}>
              {['3', '6', '12', '24'].map(h => (
                <TouchableOpacity
                  key={h}
                  style={[styles.hourBtn, addHours === h && styles.hourBtnActive]}
                  onPress={() => setAddHours(h)}
                >
                  <Text style={[styles.hourText, addHours === h && styles.hourTextActive]}>{h} Saat</Text>
                </TouchableOpacity>
              ))}
            </View>
            
            <View style={styles.modalBtns}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setTimeModal(false)}>
                <Text style={styles.cancelText}>İptal</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.submitBtn} onPress={addDriverTime}>
                <Text style={styles.submitText}>Ekle</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F172A' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0F172A' },
  loadingText: { color: '#9CA3AF', marginTop: 12 },
  
  header: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between', 
    padding: 16,
    paddingTop: 8,
  },
  headerTitle: { fontSize: 20, fontWeight: '700', color: 'white' },
  
  tabs: { 
    flexDirection: 'row', 
    backgroundColor: '#1E293B', 
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  tab: { 
    flex: 1, 
    alignItems: 'center', 
    paddingVertical: 8,
    borderRadius: 8,
  },
  activeTab: { backgroundColor: 'rgba(63,169,245,0.15)' },
  tabText: { color: '#9CA3AF', fontSize: 11, marginTop: 4 },
  activeTabText: { color: '#3FA9F5', fontWeight: '600' },
  
  content: { flex: 1, padding: 16 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: 'white', marginBottom: 12, marginTop: 8 },
  
  statsRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 },
  statCard: { 
    flex: 1, 
    backgroundColor: '#1E293B', 
    borderRadius: 12, 
    padding: 16, 
    alignItems: 'center',
    marginHorizontal: 4,
  },
  statNum: { fontSize: 24, fontWeight: '700', color: 'white', marginTop: 8 },
  statLabel: { fontSize: 12, color: '#9CA3AF', marginTop: 4 },
  
  weekCard: { 
    backgroundColor: '#1E293B', 
    borderRadius: 12, 
    padding: 20, 
    alignItems: 'center',
    marginTop: 8,
  },
  weekTitle: { fontSize: 14, color: '#9CA3AF' },
  weekNum: { fontSize: 20, fontWeight: '700', color: '#3FA9F5', marginTop: 8 },
  
  searchBox: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: '#1E293B', 
    borderRadius: 12, 
    paddingHorizontal: 12,
    marginBottom: 12,
  },
  searchInput: { flex: 1, color: 'white', paddingVertical: 12, marginLeft: 8 },
  
  userCard: { 
    flexDirection: 'row', 
    backgroundColor: '#1E293B', 
    borderRadius: 12, 
    padding: 14, 
    marginBottom: 10,
  },
  userInfo: { flex: 1 },
  userRow: { flexDirection: 'row', alignItems: 'center' },
  userName: { fontSize: 16, fontWeight: '600', color: 'white' },
  userPhone: { fontSize: 14, color: '#9CA3AF', marginTop: 4 },
  userMeta: { fontSize: 12, color: '#6B7280', marginTop: 4 },
  userActions: { flexDirection: 'row', alignItems: 'center' },
  actionBtn: { padding: 8, marginLeft: 4 },
  
  badge: { marginLeft: 8, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  badgeDriver: { backgroundColor: 'rgba(63,169,245,0.2)' },
  badgeOnline: { backgroundColor: 'rgba(16,185,129,0.2)' },
  badgeText: { fontSize: 10, color: 'white', fontWeight: '600' },
  
  addBtn: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'center',
    backgroundColor: '#3FA9F5', 
    borderRadius: 12, 
    padding: 14, 
    marginBottom: 16,
  },
  addBtnText: { color: 'white', fontSize: 16, fontWeight: '600', marginLeft: 8 },
  
  promoCard: { backgroundColor: '#1E293B', borderRadius: 12, padding: 16, marginBottom: 10 },
  promoCode: { fontSize: 18, fontWeight: '700', color: '#3FA9F5' },
  promoInfo: { fontSize: 14, color: '#9CA3AF', marginTop: 4 },
  
  notifCard: { backgroundColor: '#1E293B', borderRadius: 12, padding: 16, marginBottom: 10 },
  notifTitle: { fontSize: 16, fontWeight: '600', color: 'white' },
  notifBody: { fontSize: 14, color: '#9CA3AF', marginTop: 4 },
  
  empty: { textAlign: 'center', color: '#6B7280', marginTop: 40 },
  
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', padding: 20 },
  modalBox: { backgroundColor: '#1E293B', borderRadius: 16, padding: 20 },
  modalTitle: { fontSize: 20, fontWeight: '700', color: 'white', textAlign: 'center' },
  modalSub: { fontSize: 14, color: '#9CA3AF', textAlign: 'center', marginBottom: 16 },
  
  inputLabel: { fontSize: 14, color: '#9CA3AF', marginTop: 16, marginBottom: 8 },
  input: { backgroundColor: '#0F172A', borderRadius: 12, padding: 14, color: 'white' },
  
  hoursRow: { flexDirection: 'row', marginTop: 8 },
  hourBtn: { 
    flex: 1, 
    backgroundColor: '#0F172A', 
    borderRadius: 8, 
    padding: 12, 
    marginRight: 8, 
    alignItems: 'center',
  },
  hourBtnActive: { backgroundColor: '#3FA9F5' },
  hourText: { color: '#9CA3AF', fontWeight: '500' },
  hourTextActive: { color: 'white' },
  
  modalBtns: { flexDirection: 'row', marginTop: 20 },
  cancelBtn: { 
    flex: 1, 
    backgroundColor: '#374151', 
    borderRadius: 12, 
    padding: 14, 
    marginRight: 8, 
    alignItems: 'center',
  },
  cancelText: { color: 'white', fontWeight: '600' },
  submitBtn: { 
    flex: 1, 
    backgroundColor: '#3FA9F5', 
    borderRadius: 12, 
    padding: 14, 
    marginLeft: 8, 
    alignItems: 'center',
  },
  submitText: { color: 'white', fontWeight: '600' },
});
