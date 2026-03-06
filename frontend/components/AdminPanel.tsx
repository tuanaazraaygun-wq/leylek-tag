import React, { useState, useEffect } from 'react';
import { 
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Pressable,
  TextInput, Alert, Modal, FlatList, Dimensions, ActivityIndicator,
  RefreshControl, Platform, Image
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';
const API_URL = `${BACKEND_URL}/api`;

const COLORS = {
  primary: '#3FA9F5',
  primaryDark: '#1E3A5F',
  secondary: '#2563EB',
  background: '#0F172A',
  card: '#1E293B',
  cardLight: '#334155',
  text: '#FFFFFF',
  textSecondary: 'rgba(255,255,255,0.7)',
  success: '#10B981',
  danger: '#EF4444',
  warning: '#F59E0B',
  info: '#3B82F6',
};

interface AdminPanelProps {
  adminPhone: string;
  onClose: () => void;
}

type TabType = 'dashboard' | 'users' | 'trips' | 'drivers' | 'promos' | 'notifications' | 'logs' | 'settings';

export default function AdminPanel({ adminPhone, onClose }: AdminPanelProps) {
  const [activeTab, setActiveTab] = useState<TabType>('dashboard');
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  
  // Dashboard
  const [stats, setStats] = useState<any>(null);
  
  // Users
  const [users, setUsers] = useState<any[]>([]);
  const [userSearch, setUserSearch] = useState('');
  
  // Trips
  const [trips, setTrips] = useState<any[]>([]);
  const [activeTrips, setActiveTrips] = useState<any[]>([]);
  
  // Online Drivers
  const [onlineDrivers, setOnlineDrivers] = useState<any[]>([]);
  
  // Promotions
  const [promotions, setPromotions] = useState<any[]>([]);
  const [newPromoCode, setNewPromoCode] = useState('');
  const [newPromoHours, setNewPromoHours] = useState('3');
  const [newPromoMaxUses, setNewPromoMaxUses] = useState('100');
  
  // Notifications
  const [notifTitle, setNotifTitle] = useState('');
  const [notifMessage, setNotifMessage] = useState('');
  const [notifTarget, setNotifTarget] = useState<'all' | 'drivers' | 'passengers'>('all');
  
  // Login Logs
  const [loginLogs, setLoginLogs] = useState<any[]>([]);
  const [logFilter, setLogFilter] = useState<'all' | 'TR' | 'FOREIGN'>('all');
  
  // Settings
  const [settings, setSettings] = useState<any>({});
  
  useEffect(() => {
    loadData();
  }, [activeTab]);
  
  const loadData = async () => {
    setLoading(true);
    try {
      switch(activeTab) {
        case 'dashboard': await loadDashboard(); break;
        case 'users': await loadUsers(); break;
        case 'trips': await loadTrips(); await loadActiveTrips(); break;
        case 'drivers': await loadOnlineDrivers(); break;
        case 'promos': await loadPromotions(); break;
        case 'logs': await loadLoginLogs(); break;
        case 'settings': await loadSettings(); break;
      }
    } catch (e) {
      console.error('Veri yukleme hatasi:', e);
    }
    setLoading(false);
    setRefreshing(false);
  };
  
  // ==================== API CALLS ====================
  
  const loadDashboard = async () => {
    try {
      const res = await fetch(`${API_URL}/admin/dashboard/full?admin_phone=${adminPhone}`);
      const data = await res.json();
      if (data.success) {
        setStats(data.stats);
      }
    } catch (e) { console.error('[Dashboard]', e); }
  };
  
  const loadUsers = async () => {
    try {
      const res = await fetch(`${API_URL}/admin/users/full?admin_phone=${adminPhone}&page=1&limit=200`);
      const data = await res.json();
      if (data.success) setUsers(data.users || []);
    } catch (e) { console.error('[Users]', e); }
  };
  
  const loadTrips = async () => {
    try {
      const res = await fetch(`${API_URL}/admin/trips?admin_phone=${adminPhone}&page=1&limit=100`);
      const data = await res.json();
      if (data.success) setTrips(data.trips || []);
    } catch (e) { console.error('[Trips]', e); }
  };
  
  const loadActiveTrips = async () => {
    try {
      const res = await fetch(`${API_URL}/admin/active-trips?admin_phone=${adminPhone}`);
      const data = await res.json();
      if (data.success) setActiveTrips(data.trips || []);
    } catch (e) { console.error('[ActiveTrips]', e); }
  };
  
  const loadOnlineDrivers = async () => {
    try {
      const res = await fetch(`${API_URL}/admin/online-drivers?admin_phone=${adminPhone}`);
      const data = await res.json();
      if (data.success) setOnlineDrivers(data.drivers || []);
    } catch (e) { console.error('[OnlineDrivers]', e); }
  };
  
  const loadPromotions = async () => {
    try {
      const res = await fetch(`${API_URL}/admin/promotions?admin_phone=${adminPhone}`);
      const data = await res.json();
      if (data.success) setPromotions(data.promotions || []);
    } catch (e) { console.error('[Promotions]', e); }
  };
  
  const loadLoginLogs = async () => {
    try {
      const filter = logFilter !== 'all' ? `&filter_country=${logFilter}` : '';
      const res = await fetch(`${API_URL}/admin/login-logs-full?admin_phone=${adminPhone}&limit=100${filter}`);
      const data = await res.json();
      if (data.success) setLoginLogs(data.logs || []);
    } catch (e) { console.error('[LoginLogs]', e); }
  };
  
  const loadSettings = async () => {
    try {
      const res = await fetch(`${API_URL}/admin/pricing?phone=${adminPhone}`);
      const data = await res.json();
      if (data.success) setSettings(data.settings || {});
    } catch (e) { console.error('[Settings]', e); }
  };
  
  // ==================== ACTIONS ====================
  
  const softDeleteUser = async (userId: string, userName: string) => {
    Alert.alert(
      'Kullanici Sil',
      `${userName} kullanicisini silmek istediginize emin misiniz?\n\nNot: Kullanici Supabase'de kalir ama giris yapamaz.`,
      [
        { text: 'Iptal', style: 'cancel' },
        {
          text: 'Sil',
          style: 'destructive',
          onPress: async () => {
            try {
              const res = await fetch(`${API_URL}/admin/soft-delete-user?admin_phone=${adminPhone}&user_id=${userId}`, {
                method: 'POST'
              });
              const data = await res.json();
              if (data.success) {
                Alert.alert('Basarili', 'Kullanici silindi');
                loadUsers();
              }
            } catch (e) {
              Alert.alert('Hata', 'Silme islemi basarisiz');
            }
          }
        }
      ]
    );
  };
  
  const toggleUserStatus = async (userId: string, currentStatus: boolean) => {
    try {
      const res = await fetch(`${API_URL}/admin/toggle-user?admin_phone=${adminPhone}&user_id=${userId}&is_active=${!currentStatus}`, {
        method: 'POST'
      });
      const data = await res.json();
      if (data.success) {
        loadUsers();
      }
    } catch (e) {
      Alert.alert('Hata', 'Islem basarisiz');
    }
  };
  
  const setDriverOffline = async (driverId: string, driverName: string) => {
    Alert.alert(
      'Surucu Offline Yap',
      `${driverName} surucusunu offline yapmak istediginize emin misiniz?`,
      [
        { text: 'Iptal', style: 'cancel' },
        {
          text: 'Offline Yap',
          onPress: async () => {
            try {
              const res = await fetch(`${API_URL}/admin/set-driver-offline?admin_phone=${adminPhone}&driver_id=${driverId}`, {
                method: 'POST'
              });
              const data = await res.json();
              if (data.success) {
                Alert.alert('Basarili', 'Surucu offline yapildi');
                loadOnlineDrivers();
              }
            } catch (e) {
              Alert.alert('Hata', 'Islem basarisiz');
            }
          }
        }
      ]
    );
  };
  
  const createPromotion = async () => {
    if (!newPromoHours) {
      Alert.alert('Hata', 'Saat degeri giriniz');
      return;
    }
    
    try {
      const code = newPromoCode || '';
      const res = await fetch(`${API_URL}/admin/promotions/create?admin_phone=${adminPhone}&code=${code}&hours=${newPromoHours}&max_uses=${newPromoMaxUses}`, {
        method: 'POST'
      });
      const data = await res.json();
      if (data.success) {
        Alert.alert('Basarili', `Promosyon kodu: ${data.promotion?.code || 'Olusturuldu'}`);
        setNewPromoCode('');
        setNewPromoHours('3');
        setNewPromoMaxUses('100');
        loadPromotions();
      }
    } catch (e) {
      Alert.alert('Hata', 'Promosyon olusturulamadi');
    }
  };
  
  const togglePromotion = async (promoId: string, currentStatus: boolean) => {
    try {
      const res = await fetch(`${API_URL}/admin/promotions/toggle?admin_phone=${adminPhone}&promo_id=${promoId}&is_active=${!currentStatus}`, {
        method: 'POST'
      });
      const data = await res.json();
      if (data.success) {
        loadPromotions();
      }
    } catch (e) {
      Alert.alert('Hata', 'Islem basarisiz');
    }
  };
  
  const sendNotification = async () => {
    if (!notifTitle || !notifMessage) {
      Alert.alert('Hata', 'Baslik ve mesaj giriniz');
      return;
    }
    
    try {
      const res = await fetch(`${API_URL}/admin/push/send?admin_phone=${adminPhone}&title=${encodeURIComponent(notifTitle)}&message=${encodeURIComponent(notifMessage)}&target=${notifTarget}`, {
        method: 'POST'
      });
      const data = await res.json();
      if (data.success) {
        Alert.alert('Basarili', `${data.sent} kisi bildirim aldi, ${data.failed} basarisiz`);
        setNotifTitle('');
        setNotifMessage('');
      }
    } catch (e) {
      Alert.alert('Hata', 'Bildirim gonderilemedi');
    }
  };
  
  const formatDate = (dateStr: string) => {
    if (!dateStr) return '-';
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('tr-TR') + ' ' + date.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
    } catch {
      return dateStr;
    }
  };
  
  // ==================== TAB MENU ====================
  
  const tabs: { key: TabType; icon: string; label: string }[] = [
    { key: 'dashboard', icon: 'stats-chart', label: 'Dashboard' },
    { key: 'users', icon: 'people', label: 'Kullanicilar' },
    { key: 'trips', icon: 'car', label: 'Yolculuklar' },
    { key: 'drivers', icon: 'location', label: 'Online Suruculer' },
    { key: 'promos', icon: 'pricetag', label: 'Promosyonlar' },
    { key: 'notifications', icon: 'notifications', label: 'Bildirimler' },
    { key: 'logs', icon: 'document-text', label: 'Giris Loglari' },
    { key: 'settings', icon: 'settings', label: 'Ayarlar' },
  ];
  
  // ==================== RENDERS ====================
  
  const renderDashboard = () => (
    <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
      <Text style={styles.sectionTitle}>Genel Bakis</Text>
      
      <View style={styles.statsGrid}>
        <View style={[styles.statCard, { backgroundColor: COLORS.info }]}>
          <Ionicons name="people" size={28} color="#FFF" />
          <Text style={styles.statValue}>{stats?.users?.total || 0}</Text>
          <Text style={styles.statLabel}>Toplam Kullanici</Text>
        </View>
        
        <View style={[styles.statCard, { backgroundColor: COLORS.success }]}>
          <Ionicons name="car" size={28} color="#FFF" />
          <Text style={styles.statValue}>{stats?.users?.drivers || 0}</Text>
          <Text style={styles.statLabel}>Surucu</Text>
        </View>
        
        <View style={[styles.statCard, { backgroundColor: COLORS.warning }]}>
          <Ionicons name="person" size={28} color="#FFF" />
          <Text style={styles.statValue}>{stats?.users?.passengers || 0}</Text>
          <Text style={styles.statLabel}>Yolcu</Text>
        </View>
        
        <View style={[styles.statCard, { backgroundColor: COLORS.primary }]}>
          <Ionicons name="radio-button-on" size={28} color="#FFF" />
          <Text style={styles.statValue}>{stats?.users?.online_drivers || 0}</Text>
          <Text style={styles.statLabel}>Online Surucu</Text>
        </View>
        
        <View style={[styles.statCard, { backgroundColor: '#8B5CF6' }]}>
          <Ionicons name="checkmark-circle" size={28} color="#FFF" />
          <Text style={styles.statValue}>{stats?.trips?.completed_today || 0}</Text>
          <Text style={styles.statLabel}>Bugun Tamamlanan</Text>
        </View>
        
        <View style={[styles.statCard, { backgroundColor: '#EC4899' }]}>
          <Ionicons name="time" size={28} color="#FFF" />
          <Text style={styles.statValue}>{stats?.trips?.waiting || 0}</Text>
          <Text style={styles.statLabel}>Bekleyen</Text>
        </View>
        
        <View style={[styles.statCard, { backgroundColor: '#14B8A6' }]}>
          <Ionicons name="navigate" size={28} color="#FFF" />
          <Text style={styles.statValue}>{stats?.trips?.active || 0}</Text>
          <Text style={styles.statLabel}>Aktif Yolculuk</Text>
        </View>
        
        <View style={[styles.statCard, { backgroundColor: COLORS.danger }]}>
          <Ionicons name="calendar" size={28} color="#FFF" />
          <Text style={styles.statValue}>{stats?.trips?.completed_week || 0}</Text>
          <Text style={styles.statLabel}>Bu Hafta</Text>
        </View>
      </View>
    </ScrollView>
  );
  
  const renderUsers = () => {
    const filteredUsers = users.filter(u => 
      u.name?.toLowerCase().includes(userSearch.toLowerCase()) ||
      u.phone?.includes(userSearch)
    );
    
    return (
      <View style={styles.content}>
        <TextInput
          style={styles.searchInput}
          placeholder="Kullanici ara (isim veya telefon)..."
          placeholderTextColor={COLORS.textSecondary}
          value={userSearch}
          onChangeText={setUserSearch}
        />
        
        <Text style={styles.countText}>{filteredUsers.length} kullanici bulundu</Text>
        
        <ScrollView showsVerticalScrollIndicator={false}>
          {filteredUsers.length === 0 ? (
            <Text style={styles.emptyText}>Kullanici bulunamadi</Text>
          ) : (
            filteredUsers.slice(0, 50).map((item) => (
              <View key={item.id} style={styles.userCard}>
                <View style={styles.userInfo}>
                  <View style={styles.userAvatar}>
                    <Text style={styles.userAvatarText}>{item.name?.charAt(0) || '?'}</Text>
                  </View>
                  <View style={styles.userDetails}>
                    <Text style={styles.userName}>{item.name || 'Isimsiz'}</Text>
                    <Text style={styles.userPhone}>{item.phone || '-'}</Text>
                    <View style={styles.userMeta}>
                      <Text style={styles.userMetaText}>
                        {item.is_driver ? 'Surucu' : 'Yolcu'} | {item.city || '-'}
                      </Text>
                      <Text style={styles.userMetaText}>
                        {(item.rating || 5).toFixed(1)} | {item.total_trips || 0} yolculuk
                        {item.is_online ? ' | Online' : ''}
                      </Text>
                      {item.last_ip && (
                        <Text style={styles.userMetaText}>IP: {item.last_ip}</Text>
                      )}
                    </View>
                  </View>
                </View>
                
                <View style={styles.userActions}>
                  <TouchableOpacity
                    style={[styles.userActionBtn, item.is_active !== false ? styles.btnWarning : styles.btnSuccess]}
                    onPress={() => toggleUserStatus(item.id, item.is_active !== false)}
                  >
                    <Ionicons name={item.is_active !== false ? "pause" : "play"} size={14} color="#FFF" />
                  </TouchableOpacity>
                  
                  <TouchableOpacity
                    style={[styles.userActionBtn, styles.btnDanger]}
                    onPress={() => softDeleteUser(item.id, item.name)}
                  >
                    <Ionicons name="trash" size={14} color="#FFF" />
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )}
        </ScrollView>
      </View>
    );
  };
  
  const renderTrips = () => (
    <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
      {activeTrips.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>Aktif Yolculuklar ({activeTrips.length})</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 20 }}>
            {activeTrips.map((item, index) => (
              <View key={item.id || index} style={[styles.tripCard, { backgroundColor: COLORS.primary, width: 280, marginRight: 12 }]}>
                <View style={styles.tripHeader}>
                  <Ionicons name="navigate" size={18} color="#FFF" />
                  <Text style={styles.tripStatus}>{item.status}</Text>
                </View>
                <Text style={styles.tripText}>Yolcu: {item.passenger || '-'}</Text>
                <Text style={styles.tripText}>Surucu: {item.driver || '-'}</Text>
                <Text style={styles.tripText}>Baslangic: {item.pickup || '-'}</Text>
                <Text style={styles.tripText}>Hedef: {item.dropoff || '-'}</Text>
              </View>
            ))}
          </ScrollView>
        </>
      )}
      
      <Text style={styles.sectionTitle}>Tum Yolculuklar ({trips.length})</Text>
      {trips.length === 0 ? (
        <Text style={styles.emptyText}>Yolculuk bulunamadi</Text>
      ) : (
        trips.map((item, index) => (
          <View key={item.id || index} style={styles.tripCard}>
            <View style={styles.tripHeader}>
              <Ionicons 
                name={item.status === 'completed' ? 'checkmark-circle' : item.status === 'cancelled' ? 'close-circle' : 'navigate'} 
                size={18} 
                color={item.status === 'completed' ? COLORS.success : item.status === 'cancelled' ? COLORS.danger : COLORS.primary} 
              />
              <Text style={styles.tripStatus}>
                {item.status === 'completed' ? 'Tamamlandi' : item.status === 'cancelled' ? 'Iptal' : item.status === 'matched' ? 'Eslesti' : 'Bekliyor'}
              </Text>
              <Text style={styles.tripTime}>{formatDate(item.created_at)}</Text>
            </View>
            <Text style={styles.tripText}>Yolcu: {item.passenger_name || '-'}</Text>
            <Text style={styles.tripText}>Surucu: {item.driver_name || '-'}</Text>
            <Text style={styles.tripText}>Fiyat: {item.final_price || 0} TL</Text>
            {item.end_method && <Text style={styles.tripText}>Bitirme: {item.end_method}</Text>}
          </View>
        ))
      )}
    </ScrollView>
  );
  
  const renderOnlineDrivers = () => (
    <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
      <Text style={styles.sectionTitle}>Online Suruculer ({onlineDrivers.length})</Text>
      
      {onlineDrivers.length === 0 ? (
        <Text style={styles.emptyText}>Online surucu yok</Text>
      ) : (
        onlineDrivers.map((item) => (
          <View key={item.id} style={styles.driverCard}>
            <View style={styles.driverInfo}>
              <View style={[styles.onlineDot, { backgroundColor: COLORS.success }]} />
              <View>
                <Text style={styles.driverName}>{item.name || 'Isimsiz'}</Text>
                <Text style={styles.driverPhone}>{item.phone}</Text>
                <Text style={styles.driverMeta}>
                  {item.city || '-'} | {(item.rating || 5).toFixed(1)}
                </Text>
                {item.active_until && (
                  <Text style={styles.driverMeta}>Paket: {formatDate(item.active_until)}</Text>
                )}
              </View>
            </View>
            
            <TouchableOpacity
              style={[styles.userActionBtn, styles.btnDanger]}
              onPress={() => setDriverOffline(item.id, item.name)}
            >
              <Ionicons name="power" size={16} color="#FFF" />
              <Text style={{ color: '#FFF', fontSize: 10, marginTop: 2 }}>Offline</Text>
            </TouchableOpacity>
          </View>
        ))
      )}
    </ScrollView>
  );
  
  const renderPromotions = () => (
    <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
      <Text style={styles.sectionTitle}>Yeni Promosyon Olustur</Text>
      
      <View style={styles.formCard}>
        <TextInput
          style={styles.input}
          placeholder="Kod (bos birakilirsa otomatik)"
          placeholderTextColor={COLORS.textSecondary}
          value={newPromoCode}
          onChangeText={setNewPromoCode}
          autoCapitalize="characters"
        />
        
        <View style={styles.inputRow}>
          <TextInput
            style={[styles.input, { flex: 1, marginRight: 8 }]}
            placeholder="Saat"
            placeholderTextColor={COLORS.textSecondary}
            value={newPromoHours}
            onChangeText={setNewPromoHours}
            keyboardType="numeric"
          />
          <TextInput
            style={[styles.input, { flex: 1 }]}
            placeholder="Max Kullanim"
            placeholderTextColor={COLORS.textSecondary}
            value={newPromoMaxUses}
            onChangeText={setNewPromoMaxUses}
            keyboardType="numeric"
          />
        </View>
        
        <TouchableOpacity style={styles.primaryBtn} onPress={createPromotion}>
          <Text style={styles.primaryBtnText}>Promosyon Olustur</Text>
        </TouchableOpacity>
      </View>
      
      <Text style={styles.sectionTitle}>Mevcut Promosyonlar ({promotions.length})</Text>
      
      {promotions.map((promo, index) => (
        <View key={promo.id || index} style={styles.promoCard}>
          <View style={styles.promoInfo}>
            <Text style={styles.promoCode}>{promo.code}</Text>
            <Text style={styles.promoMeta}>{promo.hours} saat | {promo.used_count}/{promo.max_uses} kullanim</Text>
            <Text style={styles.promoMeta}>{formatDate(promo.created_at)}</Text>
          </View>
          <TouchableOpacity
            style={[styles.userActionBtn, promo.is_active ? styles.btnDanger : styles.btnSuccess]}
            onPress={() => togglePromotion(promo.id, promo.is_active)}
          >
            <Ionicons name={promo.is_active ? "close" : "checkmark"} size={16} color="#FFF" />
          </TouchableOpacity>
        </View>
      ))}
    </ScrollView>
  );
  
  const renderNotifications = () => (
    <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
      <Text style={styles.sectionTitle}>Push Bildirim Gonder</Text>
      
      <View style={styles.formCard}>
        <TextInput
          style={styles.input}
          placeholder="Baslik"
          placeholderTextColor={COLORS.textSecondary}
          value={notifTitle}
          onChangeText={setNotifTitle}
        />
        
        <TextInput
          style={[styles.input, { height: 100, textAlignVertical: 'top' }]}
          placeholder="Mesaj"
          placeholderTextColor={COLORS.textSecondary}
          value={notifMessage}
          onChangeText={setNotifMessage}
          multiline
        />
        
        <Text style={styles.label}>Hedef Kitle</Text>
        <View style={styles.targetButtons}>
          {(['all', 'drivers', 'passengers'] as const).map(target => (
            <TouchableOpacity
              key={target}
              style={[styles.targetBtn, notifTarget === target && styles.targetBtnActive]}
              onPress={() => setNotifTarget(target)}
            >
              <Text style={[styles.targetBtnText, notifTarget === target && styles.targetBtnTextActive]}>
                {target === 'all' ? 'Herkes' : target === 'drivers' ? 'Suruculer' : 'Yolcular'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        
        <TouchableOpacity style={styles.primaryBtn} onPress={sendNotification}>
          <Ionicons name="send" size={18} color="#FFF" />
          <Text style={styles.primaryBtnText}> Bildirim Gonder</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
  
  const renderLogs = () => (
    <View style={styles.content}>
      <Text style={styles.sectionTitle}>Giris Loglari</Text>
      
      <View style={styles.filterButtons}>
        {(['all', 'TR', 'FOREIGN'] as const).map(filter => (
          <TouchableOpacity
            key={filter}
            style={[styles.filterBtn, logFilter === filter && styles.filterBtnActive]}
            onPress={() => { setLogFilter(filter); }}
          >
            <Text style={[styles.filterBtnText, logFilter === filter && styles.filterBtnTextActive]}>
              {filter === 'all' ? 'Tumu' : filter === 'TR' ? 'Turkiye' : 'Yabanci'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      
      <ScrollView showsVerticalScrollIndicator={false}>
        {loginLogs.length === 0 ? (
          <Text style={styles.emptyText}>Log bulunamadi</Text>
        ) : (
          loginLogs.slice(0, 50).map((item, index) => (
            <View key={item.id || index} style={[styles.logCard, { borderLeftColor: item.success ? COLORS.success : COLORS.danger, borderLeftWidth: 3 }]}>
              <View style={styles.logHeader}>
                <Ionicons 
                  name={item.success ? "checkmark-circle" : "close-circle"} 
                  size={16} 
                  color={item.success ? COLORS.success : COLORS.danger} 
                />
                <Text style={styles.logPhone}>{item.phone || '-'}</Text>
                <Text style={[styles.logCountry, { color: item.country === 'TR' ? COLORS.success : COLORS.danger }]}>
                  {item.country || '-'}
                </Text>
              </View>
              <Text style={styles.logText}>IP: {item.ip_address || '-'}</Text>
              <Text style={styles.logText}>Cihaz: {item.device_id?.slice(0, 20) || '-'}...</Text>
              {item.fail_reason && <Text style={[styles.logText, { color: COLORS.danger }]}>Hata: {item.fail_reason}</Text>}
              <Text style={styles.logTime}>{formatDate(item.created_at)}</Text>
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
  
  const renderSettings = () => (
    <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
      <Text style={styles.sectionTitle}>Sistem Ayarlari</Text>
      
      <View style={styles.formCard}>
        <Text style={styles.label}>Fiyatlandirma</Text>
        <Text style={styles.settingText}>Minimum Fiyat: {settings.minimum_price || 0} TL</Text>
        <Text style={styles.settingText}>KM Basina (Normal): {settings.min_price_per_km_normal || 0} TL</Text>
        <Text style={styles.settingText}>KM Basina (Gece): {settings.min_price_per_km_night || 0} TL</Text>
        <Text style={styles.settingText}>KM Basina (Yagmur): {settings.min_price_per_km_rain || 0} TL</Text>
      </View>
      
      <View style={styles.formCard}>
        <Text style={styles.label}>Dispatch Ayarlari</Text>
        <Text style={styles.settingText}>Surucu Arama Mesafesi: {settings.driver_search_radius || 10} km</Text>
        <Text style={styles.settingText}>Teklif Suresi: {settings.offer_timeout || 30} sn</Text>
      </View>
    </ScrollView>
  );
  
  const renderContent = () => {
    if (loading) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Yukleniyor...</Text>
        </View>
      );
    }
    
    switch(activeTab) {
      case 'dashboard': return renderDashboard();
      case 'users': return renderUsers();
      case 'trips': return renderTrips();
      case 'drivers': return renderOnlineDrivers();
      case 'promos': return renderPromotions();
      case 'notifications': return renderNotifications();
      case 'logs': return renderLogs();
      case 'settings': return renderSettings();
      default: return null;
    }
  };
  
  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <View style={styles.container}>
        {/* Header */}
        <LinearGradient colors={[COLORS.primaryDark, COLORS.background]} style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <Ionicons name="close" size={24} color="#FFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Admin Panel</Text>
          <TouchableOpacity onPress={() => loadData()} style={styles.refreshBtn}>
            <Ionicons name="refresh" size={22} color="#FFF" />
          </TouchableOpacity>
        </LinearGradient>
        
        {/* Tab Menu */}
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false} 
          style={styles.tabBar}
          contentContainerStyle={styles.tabBarContent}
        >
          {tabs.map(tab => (
            <TouchableOpacity
              key={tab.key}
              style={[styles.tab, activeTab === tab.key && styles.tabActive]}
              onPress={() => setActiveTab(tab.key)}
            >
              <Ionicons 
                name={tab.icon as any} 
                size={18} 
                color={activeTab === tab.key ? '#FFF' : COLORS.textSecondary} 
              />
              <Text style={[styles.tabText, activeTab === tab.key && styles.tabTextActive]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
        
        {/* Content */}
        {renderContent()}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: Platform.OS === 'ios' ? 50 : 30,
    paddingBottom: 15,
    paddingHorizontal: 16,
  },
  closeBtn: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFF',
  },
  refreshBtn: {
    padding: 8,
  },
  tabBar: {
    maxHeight: 50,
    backgroundColor: COLORS.card,
  },
  tabBarContent: {
    paddingHorizontal: 8,
    alignItems: 'center',
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginHorizontal: 4,
    borderRadius: 8,
  },
  tabActive: {
    backgroundColor: COLORS.primary,
  },
  tabText: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginLeft: 6,
  },
  tabTextActive: {
    color: '#FFF',
    fontWeight: '600',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: COLORS.textSecondary,
    marginTop: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFF',
    marginBottom: 12,
  },
  countText: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginBottom: 12,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  statCard: {
    width: '48%',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFF',
    marginTop: 8,
  },
  statLabel: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 4,
    textAlign: 'center',
  },
  searchInput: {
    backgroundColor: COLORS.card,
    borderRadius: 10,
    padding: 12,
    color: '#FFF',
    marginBottom: 12,
    fontSize: 14,
  },
  userCard: {
    backgroundColor: COLORS.card,
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  userInfo: {
    flexDirection: 'row',
    flex: 1,
  },
  userAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  userAvatarText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
  },
  userDetails: {
    flex: 1,
  },
  userName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFF',
  },
  userPhone: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  userMeta: {
    marginTop: 4,
  },
  userMetaText: {
    fontSize: 10,
    color: COLORS.textSecondary,
  },
  userActions: {
    flexDirection: 'row',
  },
  userActionBtn: {
    width: 32,
    height: 32,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 6,
  },
  btnSuccess: { backgroundColor: COLORS.success },
  btnDanger: { backgroundColor: COLORS.danger },
  btnWarning: { backgroundColor: COLORS.warning },
  emptyText: {
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: 40,
    fontSize: 14,
  },
  tripCard: {
    backgroundColor: COLORS.card,
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
  },
  tripHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  tripStatus: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFF',
    marginLeft: 8,
    flex: 1,
  },
  tripTime: {
    fontSize: 10,
    color: COLORS.textSecondary,
  },
  tripText: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginBottom: 2,
  },
  driverCard: {
    backgroundColor: COLORS.card,
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  driverInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  onlineDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 12,
  },
  driverName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFF',
  },
  driverPhone: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  driverMeta: {
    fontSize: 10,
    color: COLORS.textSecondary,
  },
  formCard: {
    backgroundColor: COLORS.card,
    borderRadius: 10,
    padding: 16,
    marginBottom: 16,
  },
  input: {
    backgroundColor: COLORS.cardLight,
    borderRadius: 8,
    padding: 12,
    color: '#FFF',
    marginBottom: 12,
    fontSize: 14,
  },
  inputRow: {
    flexDirection: 'row',
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFF',
    marginBottom: 8,
  },
  primaryBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 8,
    padding: 14,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  primaryBtnText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
  },
  targetButtons: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  targetBtn: {
    flex: 1,
    padding: 10,
    borderRadius: 8,
    backgroundColor: COLORS.cardLight,
    marginRight: 8,
    alignItems: 'center',
  },
  targetBtnActive: {
    backgroundColor: COLORS.primary,
  },
  targetBtnText: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  targetBtnTextActive: {
    color: '#FFF',
    fontWeight: '600',
  },
  promoCard: {
    backgroundColor: COLORS.card,
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  promoInfo: {
    flex: 1,
  },
  promoCode: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.primary,
  },
  promoMeta: {
    fontSize: 11,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  filterButtons: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  filterBtn: {
    flex: 1,
    padding: 10,
    borderRadius: 8,
    backgroundColor: COLORS.card,
    marginRight: 8,
    alignItems: 'center',
  },
  filterBtnActive: {
    backgroundColor: COLORS.primary,
  },
  filterBtnText: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  filterBtnTextActive: {
    color: '#FFF',
    fontWeight: '600',
  },
  logCard: {
    backgroundColor: COLORS.card,
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
  },
  logHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  logPhone: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFF',
    marginLeft: 8,
    flex: 1,
  },
  logCountry: {
    fontSize: 12,
    fontWeight: '700',
  },
  logText: {
    fontSize: 11,
    color: COLORS.textSecondary,
    marginBottom: 2,
  },
  logTime: {
    fontSize: 10,
    color: COLORS.textSecondary,
    marginTop: 4,
  },
  settingText: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginBottom: 6,
  },
});
