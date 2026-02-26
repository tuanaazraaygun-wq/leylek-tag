import React, { useState, useEffect } from 'react';
import { 
  View, Text, StyleSheet, ScrollView, TouchableOpacity, 
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

type TabType = 'dashboard' | 'users' | 'trips' | 'calls' | 'auth' | 'notifications' | 'kyc' | 'settings';

export default function AdminPanel({ adminPhone, onClose }: AdminPanelProps) {
  const [activeTab, setActiveTab] = useState<TabType>('dashboard');
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  
  // Dashboard
  const [stats, setStats] = useState<any>(null);
  
  // Users
  const [users, setUsers] = useState<any[]>([]);
  const [userSearch, setUserSearch] = useState('');
  const [selectedUser, setSelectedUser] = useState<any>(null);
  
  // Trips (Metadata)
  const [trips, setTrips] = useState<any[]>([]);
  
  // Calls (Metadata)
  const [calls, setCalls] = useState<any[]>([]);
  
  // Auth Logs (Metadata)
  const [authLogs, setAuthLogs] = useState<any[]>([]);
  
  // Notifications
  const [notifTitle, setNotifTitle] = useState('');
  const [notifMessage, setNotifMessage] = useState('');
  const [notifTarget, setNotifTarget] = useState<'all' | 'drivers' | 'passengers' | 'user'>('all');
  const [notifUserId, setNotifUserId] = useState('');
  
  // Settings
  const [settings, setSettings] = useState<any>({});
  const [driverRadius, setDriverRadius] = useState('50');
  const [maxCallDuration, setMaxCallDuration] = useState('30');
  
  // KYC
  const [pendingKYCs, setPendingKYCs] = useState<any[]>([]);
  const [approvedKYCs, setApprovedKYCs] = useState<any[]>([]);
  const [rejectedKYCs, setRejectedKYCs] = useState<any[]>([]);
  const [selectedKYC, setSelectedKYC] = useState<any>(null);
  const [kycImageModal, setKycImageModal] = useState<string | null>(null);
  const [kycFilter, setKycFilter] = useState<'pending' | 'approved' | 'rejected'>('pending');
  
  useEffect(() => {
    loadData();
  }, [activeTab]);
  
  const loadData = async () => {
    setLoading(true);
    try {
      switch(activeTab) {
        case 'dashboard': await loadDashboard(); break;
        case 'users': await loadUsers(); break;
        case 'trips': await loadTrips(); break;
        case 'calls': await loadCalls(); break;
        case 'auth': await loadAuthLogs(); break;
        case 'kyc': await loadAllKYCs(); break;
        case 'settings': await loadSettings(); break;
      }
    } catch (e) {
      console.error('Veri yükleme hatası:', e);
    }
    setLoading(false);
    setRefreshing(false);
  };
  
  const loadDashboard = async () => {
    try {
      // Yeni admin/dashboard endpoint'ini kullan
      const res = await fetch(`${API_URL}/admin/dashboard?phone=${adminPhone}`);
      const data = await res.json();
      if (data.success) {
        setStats(data.stats);
        // Aktif TAG'leri de yükle
        if (data.active_tags) {
          setTrips(data.active_tags);
        }
      }
    } catch (e) { console.error(e); }
  };
  
  const loadUsers = async () => {
    try {
      // Yeni admin/users endpoint'ini kullan
      const res = await fetch(`${API_URL}/admin/users?phone=${adminPhone}&limit=100`);
      const data = await res.json();
      if (data.success) setUsers(data.users || []);
    } catch (e) { console.error(e); }
  };
  
  const loadTrips = async () => {
    try {
      // Yeni admin/tags endpoint'ini kullan
      const res = await fetch(`${API_URL}/admin/tags?phone=${adminPhone}&limit=50`);
      const data = await res.json();
      if (data.success) setTrips(data.tags || []);
    } catch (e) { console.error(e); }
  };
  
  const loadCalls = async () => {
    // Calls için şimdilik boş bırak
    setCalls([]);
  };
  
  const loadAuthLogs = async () => {
    // Auth logs için şimdilik boş bırak
    setAuthLogs([]);
  };
  
  const loadSettings = async () => {
    try {
      // Yeni admin/pricing endpoint'ini kullan
      const res = await fetch(`${API_URL}/admin/pricing?phone=${adminPhone}`);
      const data = await res.json();
      if (data.success) {
        setSettings(data.settings || {});
        // Fiyatlandırma ayarlarını settings'e kaydet
        if (data.settings) {
          setDriverRadius(String(data.settings.minimum_price || 100));
          setMaxCallDuration(String(data.settings.min_price_per_km_normal || 20));
        }
      }
    } catch (e) { console.error(e); }
  };

  // KYC Fonksiyonları
  const loadPendingKYCs = async () => {
    try {
      const res = await fetch(`${API_URL}/admin/kyc/pending?admin_phone=${adminPhone}`);
      const data = await res.json();
      if (data.success) {
        setPendingKYCs(data.requests || []);
      }
    } catch (e) { console.error(e); }
  };

  const loadAllKYCs = async () => {
    try {
      console.log('Loading all KYCs...');
      const res = await fetch(`${API_URL}/admin/kyc/all?admin_phone=${adminPhone}`);
      const data = await res.json();
      console.log('All KYCs response:', data);
      if (data.success) {
        setPendingKYCs(data.pending || []);
        setApprovedKYCs(data.approved || []);
        setRejectedKYCs(data.rejected || []);
      }
    } catch (e) { console.error('Load all KYCs error:', e); }
  };

  const approveKYC = async (userId: string) => {
    console.log('approveKYC called with userId:', userId);
    console.log('API_URL:', API_URL);
    console.log('adminPhone:', adminPhone);
    
    const doApprove = async () => {
      try {
        setLoading(true);
        const url = `${API_URL}/admin/kyc/approve?admin_phone=${adminPhone}&user_id=${userId}`;
        console.log('Fetching:', url);
        
        const res = await fetch(url, {
          method: 'POST'
        });
        console.log('Response status:', res.status);
        
        const data = await res.json();
        console.log('Response data:', data);
        
        if (data.success) {
          if (Platform.OS === 'web') {
            window.alert('✅ Sürücü kaydı onaylandı');
          } else {
            Alert.alert('Başarılı', 'Sürücü kaydı onaylandı');
          }
          loadPendingKYCs();
          loadAllKYCs(); // Tüm KYC'leri yenile
        } else {
          if (Platform.OS === 'web') {
            window.alert('Hata: ' + (data.detail || data.message || 'İşlem başarısız'));
          } else {
            Alert.alert('Hata', data.detail || data.message || 'İşlem başarısız');
          }
        }
      } catch (e: any) {
        console.error('Approve error:', e);
        if (Platform.OS === 'web') {
          window.alert('Hata: ' + (e.message || 'İşlem başarısız'));
        } else {
          Alert.alert('Hata', e.message || 'İşlem başarısız');
        }
      } finally {
        setLoading(false);
      }
    };
    
    // Web'de direkt çalıştır, mobile'da confirm sor
    if (Platform.OS === 'web') {
      if (window.confirm('Bu sürücü başvurusunu onaylıyor musunuz?')) {
        await doApprove();
      }
    } else {
      Alert.alert(
        'Onayla',
        'Bu sürücü başvurusunu onaylıyor musunuz?',
        [
          { text: 'İptal', style: 'cancel' },
          { text: 'Onayla', onPress: doApprove }
        ]
      );
    }
  };

  const rejectKYC = async (userId: string) => {
    console.log('rejectKYC called with userId:', userId);
    
    const doReject = async () => {
      try {
        setLoading(true);
        const url = `${API_URL}/admin/kyc/reject?admin_phone=${adminPhone}&user_id=${userId}&reason=Belgeler uygun değil`;
        console.log('Fetching:', url);
        
        const res = await fetch(url, {
          method: 'POST'
        });
        console.log('Response status:', res.status);
        
        const data = await res.json();
        console.log('Response data:', data);
        
        if (data.success) {
          if (Platform.OS === 'web') {
            window.alert('❌ Sürücü kaydı reddedildi');
          } else {
            Alert.alert('Başarılı', 'Sürücü kaydı reddedildi');
          }
          loadPendingKYCs();
          loadAllKYCs(); // Tüm KYC'leri yenile
        } else {
          if (Platform.OS === 'web') {
            window.alert('Hata: ' + (data.detail || data.message || 'İşlem başarısız'));
          } else {
            Alert.alert('Hata', data.detail || data.message || 'İşlem başarısız');
          }
        }
      } catch (e: any) {
        console.error('Reject error:', e);
        if (Platform.OS === 'web') {
          window.alert('Hata: ' + (e.message || 'İşlem başarısız'));
        } else {
          Alert.alert('Hata', e.message || 'İşlem başarısız');
        }
      } finally {
        setLoading(false);
      }
    };
    
    if (Platform.OS === 'web') {
      if (window.confirm('Bu sürücü başvurusunu reddediyor musunuz?')) {
        await doReject();
      }
    } else {
      Alert.alert(
        'Reddet',
        'Bu sürücü başvurusunu reddediyor musunuz?',
        [
          { text: 'İptal', style: 'cancel' },
          { text: 'Reddet', style: 'destructive', onPress: doReject }
        ]
      );
    }
  };
  
  const toggleUserStatus = async (userId: string, currentStatus: boolean) => {
    try {
      // Yeni admin/user/action endpoint'ini kullan
      const res = await fetch(`${API_URL}/admin/user/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          phone: adminPhone, 
          user_id: userId,
          action: currentStatus ? 'unban' : 'ban'
        })
      });
      const data = await res.json();
      if (data.success) {
        Alert.alert('Başarılı', data.message);
        loadUsers();
      }
    } catch (e) { console.error(e); }
  };
  
  const deleteUser = async (userId: string) => {
    Alert.alert(
      'Kullanıcı Sil',
      'Bu kullanıcıyı silmek istediğinize emin misiniz? Bu işlem geri alınamaz.',
      [
        { text: 'İptal', style: 'cancel' },
        { 
          text: 'Sil', 
          style: 'destructive',
          onPress: async () => {
            try {
              // Yeni admin/user/action endpoint'ini kullan
              const res = await fetch(`${API_URL}/admin/user/action`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                  phone: adminPhone, 
                  user_id: userId,
                  action: 'delete'
                })
              });
              const data = await res.json();
              if (data.success) {
                Alert.alert('Başarılı', data.message);
                loadUsers();
              }
            } catch (e) { console.error(e); }
          }
        }
      ]
    );
  };
  
  const cleanupStuckTags = async () => {
    try {
      const res = await fetch(`${API_URL}/admin/cleanup-inactive-tags`, {
        method: 'POST'
      });
      const data = await res.json();
      Alert.alert('Temizlendi', `${data.cleaned_count || 0} takılı eşleşme temizlendi`);
      loadDashboard();
    } catch (e) { console.error(e); }
  };
  
  const saveSettings = async () => {
    try {
      const params = new URLSearchParams({
        admin_phone: adminPhone,
        driver_radius_km: driverRadius,
        max_call_duration_minutes: maxCallDuration
      });
      const res = await fetch(`${API_URL}/admin/settings?${params.toString()}`, {
        method: 'POST',
      });
      const data = await res.json();
      if (data.success) {
        Alert.alert('Kaydedildi', 'Ayarlar başarıyla güncellendi');
      }
    } catch (e) { console.error(e); }
  };
  
  const sendNotification = async () => {
    if (!notifTitle || !notifMessage) {
      Alert.alert('Hata', 'Başlık ve mesaj gerekli');
      return;
    }
    
    try {
      setLoading(true);
      const res = await fetch(`${API_URL}/admin/send-notification`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: adminPhone,
          title: notifTitle,
          body: notifMessage,
          target: notifTarget,
        })
      });
      const data = await res.json();
      if (data.success) {
        Alert.alert('✅ Gönderildi', `${data.sent || 0}/${data.valid_tokens || 0} kişiye bildirim gönderildi`);
        setNotifTitle('');
        setNotifMessage('');
      } else {
        Alert.alert('Hata', data.error || 'Bildirim gönderilemedi');
      }
    } catch (e) { 
      Alert.alert('Hata', 'Bildirim gönderilemedi');
    } finally {
      setLoading(false);
    }
  };
  
  const formatDate = (dateStr: string) => {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    return d.toLocaleString('tr-TR');
  };
  
  const renderTab = (tab: TabType, icon: string, label: string) => (
    <TouchableOpacity
      style={[styles.tab, activeTab === tab && styles.tabActive]}
      onPress={() => setActiveTab(tab)}
    >
      <Ionicons name={icon as any} size={20} color={activeTab === tab ? COLORS.primary : COLORS.textSecondary} />
      <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
  
  // ========== DASHBOARD ==========
  const renderDashboard = () => (
    <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
      <Text style={styles.sectionTitle}>Genel Bakış</Text>
      
      <View style={styles.statsGrid}>
        <View style={[styles.statCard, { backgroundColor: COLORS.info }]}>
          <Ionicons name="people" size={32} color="#FFF" />
          <Text style={styles.statValue}>{stats?.total_users || 0}</Text>
          <Text style={styles.statLabel}>Toplam Kullanıcı</Text>
        </View>
        
        <View style={[styles.statCard, { backgroundColor: COLORS.success }]}>
          <Ionicons name="car" size={32} color="#FFF" />
          <Text style={styles.statValue}>{stats?.total_drivers || 0}</Text>
          <Text style={styles.statLabel}>Şoför</Text>
        </View>
        
        <View style={[styles.statCard, { backgroundColor: COLORS.warning }]}>
          <Ionicons name="person" size={32} color="#FFF" />
          <Text style={styles.statValue}>{stats?.total_passengers || 0}</Text>
          <Text style={styles.statLabel}>Yolcu</Text>
        </View>
        
        <View style={[styles.statCard, { backgroundColor: COLORS.primary }]}>
          <Ionicons name="navigate" size={32} color="#FFF" />
          <Text style={styles.statValue}>{stats?.active_trips || 0}</Text>
          <Text style={styles.statLabel}>Aktif Yolculuk</Text>
        </View>
        
        <View style={[styles.statCard, { backgroundColor: '#8B5CF6' }]}>
          <Ionicons name="call" size={32} color="#FFF" />
          <Text style={styles.statValue}>{stats?.total_calls || 0}</Text>
          <Text style={styles.statLabel}>Toplam Arama</Text>
        </View>
        
        <View style={[styles.statCard, { backgroundColor: COLORS.danger }]}>
          <Ionicons name="warning" size={32} color="#FFF" />
          <Text style={styles.statValue}>{stats?.stuck_tags || 0}</Text>
          <Text style={styles.statLabel}>Takılı Eşleşme</Text>
        </View>
      </View>
      
      <TouchableOpacity style={styles.actionButton} onPress={cleanupStuckTags}>
        <Ionicons name="trash" size={20} color="#FFF" />
        <Text style={styles.actionButtonText}>Takılı Eşleşmeleri Temizle</Text>
      </TouchableOpacity>
    </ScrollView>
  );
  
  // ========== USERS ==========
  const renderUsers = () => (
    <View style={styles.content}>
      <TextInput
        style={styles.searchInput}
        placeholder="Kullanıcı ara (isim veya telefon)..."
        placeholderTextColor={COLORS.textSecondary}
        value={userSearch}
        onChangeText={setUserSearch}
      />
      
      <FlatList
        data={users.filter(u => 
          u.name?.toLowerCase().includes(userSearch.toLowerCase()) ||
          u.phone?.includes(userSearch)
        )}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.userCard}>
            <View style={styles.userInfo}>
              <View style={styles.userAvatar}>
                <Text style={styles.userAvatarText}>{item.name?.charAt(0) || '?'}</Text>
              </View>
              <View style={styles.userDetails}>
                <Text style={styles.userName}>{item.name}</Text>
                <Text style={styles.userPhone}>{item.phone}</Text>
                <View style={styles.userMeta}>
                  <Text style={styles.userMetaText}>
                    {item.role === 'driver' ? '🚗 Şoför' : '👤 Yolcu'} • {item.city || 'Şehir yok'}
                  </Text>
                  <Text style={styles.userMetaText}>
                    📱 {item.device_count || 0} cihaz • IP: {item.last_ip || '-'}
                  </Text>
                </View>
              </View>
            </View>
            
            <View style={styles.userActions}>
              <TouchableOpacity
                style={[styles.userActionBtn, item.is_active ? styles.btnDanger : styles.btnSuccess]}
                onPress={() => toggleUserStatus(item.id, item.is_active)}
              >
                <Ionicons name={item.is_active ? "ban" : "checkmark"} size={16} color="#FFF" />
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.userActionBtn, styles.btnDanger]}
                onPress={() => deleteUser(item.id)}
              >
                <Ionicons name="trash" size={16} color="#FFF" />
              </TouchableOpacity>
            </View>
          </View>
        )}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
  
  // ========== TRIPS (Metadata) ==========
  const renderTrips = () => (
    <FlatList
      style={styles.content}
      data={trips}
      keyExtractor={(item, index) => item.id || index.toString()}
      renderItem={({ item }) => (
        <View style={styles.logCard}>
          <View style={styles.logHeader}>
            <Ionicons name="navigate" size={20} color={COLORS.primary} />
            <Text style={styles.logTitle}>Yolculuk #{item.id?.slice(-6)}</Text>
            <Text style={styles.logTime}>{formatDate(item.created_at)}</Text>
          </View>
          <View style={styles.logBody}>
            <Text style={styles.logText}>👤 Yolcu: {item.passenger_name} ({item.passenger_phone})</Text>
            <Text style={styles.logText}>🚗 Şoför: {item.driver_name} ({item.driver_phone})</Text>
            <Text style={styles.logText}>📍 Başlangıç: {item.pickup_address || '-'}</Text>
            <Text style={styles.logText}>🎯 Hedef: {item.dropoff_address || '-'}</Text>
            <Text style={styles.logText}>📏 Mesafe: {item.distance_km || 0} km • Süre: {item.duration_min || 0} dk</Text>
            <Text style={styles.logText}>💰 Fiyat: ₺{item.price || 0}</Text>
            <Text style={styles.logText}>📊 Durum: {item.status}</Text>
          </View>
        </View>
      )}
      showsVerticalScrollIndicator={false}
      ListEmptyComponent={<Text style={styles.emptyText}>Henüz yolculuk kaydı yok</Text>}
    />
  );
  
  // ========== CALLS (Metadata) ==========
  const renderCalls = () => (
    <FlatList
      style={styles.content}
      data={calls}
      keyExtractor={(item, index) => item.id || index.toString()}
      renderItem={({ item }) => (
        <View style={styles.logCard}>
          <View style={styles.logHeader}>
            <Ionicons name={item.call_type === 'video' ? 'videocam' : 'call'} size={20} color={COLORS.success} />
            <Text style={styles.logTitle}>{item.call_type === 'video' ? 'Görüntülü' : 'Sesli'} Arama</Text>
            <Text style={styles.logTime}>{formatDate(item.start_time)}</Text>
          </View>
          <View style={styles.logBody}>
            <Text style={styles.logText}>📞 Arayan: {item.caller_name} ({item.caller_phone})</Text>
            <Text style={styles.logText}>📱 Aranan: {item.receiver_name} ({item.receiver_phone})</Text>
            <Text style={styles.logText}>⏱️ Süre: {item.duration_seconds || 0} saniye</Text>
            <Text style={styles.logText}>📊 Durum: {item.status}</Text>
            <Text style={styles.logText}>🌐 Arayan IP: {item.caller_ip || '-'}</Text>
            <Text style={styles.logText}>🌐 Aranan IP: {item.receiver_ip || '-'}</Text>
          </View>
        </View>
      )}
      showsVerticalScrollIndicator={false}
      ListEmptyComponent={<Text style={styles.emptyText}>Henüz arama kaydı yok</Text>}
    />
  );
  
  // ========== AUTH LOGS (Metadata) ==========
  const renderAuthLogs = () => (
    <FlatList
      style={styles.content}
      data={authLogs}
      keyExtractor={(item, index) => item.id || index.toString()}
      renderItem={({ item }) => (
        <View style={styles.logCard}>
          <View style={styles.logHeader}>
            <Ionicons 
              name={item.action === 'login' ? 'log-in' : item.action === 'logout' ? 'log-out' : 'key'} 
              size={20} 
              color={item.success ? COLORS.success : COLORS.danger} 
            />
            <Text style={styles.logTitle}>{item.action?.toUpperCase()}</Text>
            <Text style={styles.logTime}>{formatDate(item.timestamp)}</Text>
          </View>
          <View style={styles.logBody}>
            <Text style={styles.logText}>👤 Kullanıcı: {item.user_name} ({item.phone})</Text>
            <Text style={styles.logText}>📱 Cihaz ID: {item.device_id?.slice(0, 20)}...</Text>
            <Text style={styles.logText}>🌐 IP Adresi: {item.ip_address || '-'}</Text>
            <Text style={styles.logText}>📊 Sonuç: {item.success ? '✅ Başarılı' : '❌ Başarısız'}</Text>
            {item.failure_reason && <Text style={styles.logText}>⚠️ Sebep: {item.failure_reason}</Text>}
          </View>
        </View>
      )}
      showsVerticalScrollIndicator={false}
      ListEmptyComponent={<Text style={styles.emptyText}>Henüz auth kaydı yok</Text>}
    />
  );
  
  // ========== NOTIFICATIONS ==========
  const renderNotifications = () => (
    <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
      <Text style={styles.sectionTitle}>Bildirim Gönder</Text>
      
      <Text style={styles.inputLabel}>Hedef Kitle</Text>
      <View style={styles.targetButtons}>
        {[
          { key: 'all', label: 'Herkese', icon: 'people' },
          { key: 'drivers', label: 'Şoförlere', icon: 'car' },
          { key: 'passengers', label: 'Yolculara', icon: 'person' },
          { key: 'user', label: 'Kişiye Özel', icon: 'person-circle' },
        ].map((t) => (
          <TouchableOpacity
            key={t.key}
            style={[styles.targetBtn, notifTarget === t.key && styles.targetBtnActive]}
            onPress={() => setNotifTarget(t.key as any)}
          >
            <Ionicons name={t.icon as any} size={18} color={notifTarget === t.key ? '#FFF' : COLORS.textSecondary} />
            <Text style={[styles.targetBtnText, notifTarget === t.key && styles.targetBtnTextActive]}>
              {t.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      
      {notifTarget === 'user' && (
        <TextInput
          style={styles.input}
          placeholder="Kullanıcı ID veya Telefon"
          placeholderTextColor={COLORS.textSecondary}
          value={notifUserId}
          onChangeText={setNotifUserId}
        />
      )}
      
      <Text style={styles.inputLabel}>Başlık</Text>
      <TextInput
        style={styles.input}
        placeholder="Bildirim başlığı"
        placeholderTextColor={COLORS.textSecondary}
        value={notifTitle}
        onChangeText={setNotifTitle}
      />
      
      <Text style={styles.inputLabel}>Mesaj</Text>
      <TextInput
        style={[styles.input, styles.inputMultiline]}
        placeholder="Bildirim mesajı"
        placeholderTextColor={COLORS.textSecondary}
        value={notifMessage}
        onChangeText={setNotifMessage}
        multiline
        numberOfLines={4}
      />
      
      <TouchableOpacity style={styles.sendButton} onPress={sendNotification}>
        <Ionicons name="send" size={20} color="#FFF" />
        <Text style={styles.sendButtonText}>Bildirim Gönder</Text>
      </TouchableOpacity>
    </ScrollView>
  );
  
  // ========== SETTINGS ==========
  const renderSettings = () => (
    <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
      <Text style={styles.sectionTitle}>Uygulama Ayarları</Text>
      
      <View style={styles.settingCard}>
        <View style={styles.settingHeader}>
          <Ionicons name="locate" size={24} color={COLORS.primary} />
          <Text style={styles.settingTitle}>Şoför Görme Mesafesi</Text>
        </View>
        <Text style={styles.settingDesc}>Şoförlerin kaç km uzaklıktaki yolcuları görebileceği</Text>
        <View style={styles.settingInput}>
          <TextInput
            style={styles.settingTextInput}
            value={driverRadius}
            onChangeText={setDriverRadius}
            keyboardType="numeric"
          />
          <Text style={styles.settingUnit}>km</Text>
        </View>
      </View>
      
      <View style={styles.settingCard}>
        <View style={styles.settingHeader}>
          <Ionicons name="call" size={24} color={COLORS.success} />
          <Text style={styles.settingTitle}>Maksimum Arama Süresi</Text>
        </View>
        <Text style={styles.settingDesc}>Bir aramanın maksimum süresi</Text>
        <View style={styles.settingInput}>
          <TextInput
            style={styles.settingTextInput}
            value={maxCallDuration}
            onChangeText={setMaxCallDuration}
            keyboardType="numeric"
          />
          <Text style={styles.settingUnit}>dakika</Text>
        </View>
      </View>
      
      <TouchableOpacity style={styles.saveButton} onPress={saveSettings}>
        <Ionicons name="save" size={20} color="#FFF" />
        <Text style={styles.saveButtonText}>Ayarları Kaydet</Text>
      </TouchableOpacity>
    </ScrollView>
  );
  
  return (
    <View style={styles.container}>
      {/* Header */}
      <LinearGradient colors={[COLORS.primaryDark, COLORS.background]} style={styles.header}>
        <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
          <Ionicons name="close" size={28} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Admin Panel</Text>
        <View style={{ width: 40 }} />
      </LinearGradient>
      
      {/* Tabs */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabBar}>
        {renderTab('dashboard', 'grid', 'Panel')}
        {renderTab('users', 'people', 'Kullanıcılar')}
        {renderTab('trips', 'navigate', 'Yolculuklar')}
        {renderTab('calls', 'call', 'Aramalar')}
        {renderTab('auth', 'key', 'Girişler')}
        {renderTab('notifications', 'notifications', 'Bildirim')}
        {renderTab('kyc', 'car-sport', 'KYC')}
        {renderTab('settings', 'settings', 'Ayarlar')}
      </ScrollView>
      
      {/* Content */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : (
        <>
          {activeTab === 'dashboard' && renderDashboard()}
          {activeTab === 'users' && renderUsers()}
          {activeTab === 'trips' && renderTrips()}
          {activeTab === 'calls' && renderCalls()}
          {activeTab === 'auth' && renderAuthLogs()}
          {activeTab === 'notifications' && renderNotifications()}
          {activeTab === 'kyc' && renderKYCTab()}
          {activeTab === 'settings' && renderSettings()}
        </>
      )}
    </View>
  );

  // KYC Tab Render
  function renderKYCTab() {
    const getCurrentList = () => {
      switch (kycFilter) {
        case 'pending': return pendingKYCs;
        case 'approved': return approvedKYCs;
        case 'rejected': return rejectedKYCs;
        default: return pendingKYCs;
      }
    };
    
    const currentList = getCurrentList();
    
    return (
      <ScrollView style={styles.tabContent}>
        <Text style={styles.sectionTitle}>🚗 Sürücü Başvuruları</Text>
        
        {/* Filter Buttons */}
        <View style={styles.kycFilterContainer}>
          <TouchableOpacity 
            style={[styles.kycFilterBtn, kycFilter === 'pending' && styles.kycFilterBtnActive]}
            onPress={() => setKycFilter('pending')}
          >
            <Text style={[styles.kycFilterText, kycFilter === 'pending' && styles.kycFilterTextActive]}>
              Bekleyen ({pendingKYCs.length})
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.kycFilterBtn, kycFilter === 'approved' && styles.kycFilterBtnActiveGreen]}
            onPress={() => setKycFilter('approved')}
          >
            <Text style={[styles.kycFilterText, kycFilter === 'approved' && styles.kycFilterTextActive]}>
              Onaylı ({approvedKYCs.length})
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.kycFilterBtn, kycFilter === 'rejected' && styles.kycFilterBtnActiveRed]}
            onPress={() => setKycFilter('rejected')}
          >
            <Text style={[styles.kycFilterText, kycFilter === 'rejected' && styles.kycFilterTextActive]}>
              Reddedilen ({rejectedKYCs.length})
            </Text>
          </TouchableOpacity>
        </View>
        
        {currentList.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons 
              name={kycFilter === 'pending' ? 'checkmark-circle' : kycFilter === 'approved' ? 'people' : 'close-circle'} 
              size={48} 
              color={kycFilter === 'pending' ? COLORS.success : kycFilter === 'approved' ? COLORS.primary : COLORS.error} 
            />
            <Text style={styles.emptyText}>
              {kycFilter === 'pending' ? 'Bekleyen başvuru yok' : 
               kycFilter === 'approved' ? 'Henüz onaylı sürücü yok' : 
               'Reddedilen başvuru yok'}
            </Text>
          </View>
        ) : (
          currentList.map((kyc, index) => (
            <View key={kyc.user_id || index} style={styles.kycCard}>
              <View style={styles.kycHeader}>
                <View>
                  <Text style={styles.kycName}>{kyc.name}</Text>
                  <Text style={styles.kycPhone}>{kyc.phone}</Text>
                  <Text style={styles.kycPlate}>Plaka: {kyc.plate_number}</Text>
                  {(kyc.vehicle_brand || kyc.vehicle_model) && (
                    <Text style={styles.kycVehicle}>
                      🚗 {kyc.vehicle_brand || ''} {kyc.vehicle_model || ''}
                      {kyc.vehicle_year ? ` (${kyc.vehicle_year})` : ''}
                    </Text>
                  )}
                  {kyc.vehicle_color && (
                    <Text style={styles.kycColor}>🎨 Renk: {kyc.vehicle_color}</Text>
                  )}
                  {kyc.rejection_reason && (
                    <Text style={styles.kycRejectionReason}>❌ Red sebebi: {kyc.rejection_reason}</Text>
                  )}
                </View>
                <View style={[
                  styles.kycBadge, 
                  kycFilter === 'approved' && styles.kycBadgeGreen,
                  kycFilter === 'rejected' && styles.kycBadgeRed
                ]}>
                  <Text style={styles.kycBadgeText}>
                    {kycFilter === 'pending' ? 'Bekliyor' : 
                     kycFilter === 'approved' ? 'Onaylı' : 'Reddedildi'}
                  </Text>
                </View>
              </View>
              
              <View style={styles.kycPhotos}>
                <TouchableOpacity 
                  style={styles.kycPhotoBox}
                  onPress={() => kyc.vehicle_photo_url && setKycImageModal(kyc.vehicle_photo_url)}
                >
                  <Text style={styles.kycPhotoLabel}>Araç Fotoğrafı</Text>
                  <Ionicons name="car" size={24} color={COLORS.primary} />
                  <Text style={styles.kycPhotoAction}>Görüntüle</Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={styles.kycPhotoBox}
                  onPress={() => kyc.license_photo_url && setKycImageModal(kyc.license_photo_url)}
                >
                  <Text style={styles.kycPhotoLabel}>Ehliyet</Text>
                  <Ionicons name="card" size={24} color={COLORS.primary} />
                  <Text style={styles.kycPhotoAction}>Görüntüle</Text>
                </TouchableOpacity>
              </View>
              
              {kycFilter === 'pending' && (
                <View style={styles.kycActions}>
                  <TouchableOpacity 
                    style={[styles.kycButton, styles.kycApprove]}
                    onPress={() => {
                      console.log('ONAYLA BUTONUNA BASILDI - userId:', kyc.user_id);
                      const userId = kyc.user_id;
                      if (Platform.OS === 'web') {
                        if (window.confirm('Bu sürücü başvurusunu onaylıyor musunuz?')) {
                          setLoading(true);
                          fetch(`${API_URL}/admin/kyc/approve?admin_phone=${adminPhone}&user_id=${userId}`, {
                            method: 'POST'
                          })
                          .then(res => res.json())
                          .then(data => {
                            console.log('Approve response:', data);
                            if (data.success) {
                              window.alert('✅ Sürücü kaydı onaylandı');
                              loadAllKYCs();
                            } else {
                              window.alert('Hata: ' + (data.message || 'İşlem başarısız'));
                            }
                          })
                          .catch(err => {
                            console.error('Approve error:', err);
                            window.alert('Hata: ' + err.message);
                          })
                          .finally(() => setLoading(false));
                        }
                      } else {
                        Alert.alert('Onayla', 'Bu sürücü başvurusunu onaylıyor musunuz?', [
                          { text: 'İptal', style: 'cancel' },
                          { text: 'Onayla', onPress: () => approveKYC(userId) }
                        ]);
                      }
                    }}
                  >
                    <Ionicons name="checkmark" size={18} color="#FFF" />
                    <Text style={styles.kycButtonText}>Onayla</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity 
                    style={[styles.kycButton, styles.kycReject]}
                    onPress={() => {
                      console.log('REDDET BUTONUNA BASILDI - userId:', kyc.user_id);
                      const userId = kyc.user_id;
                      if (Platform.OS === 'web') {
                        if (window.confirm('Bu sürücü başvurusunu reddediyor musunuz?')) {
                          setLoading(true);
                          fetch(`${API_URL}/admin/kyc/reject?admin_phone=${adminPhone}&user_id=${userId}&reason=Belgeler uygun değil`, {
                            method: 'POST'
                          })
                          .then(res => res.json())
                          .then(data => {
                            console.log('Reject response:', data);
                            if (data.success) {
                              window.alert('❌ Sürücü kaydı reddedildi');
                              loadAllKYCs();
                            } else {
                              window.alert('Hata: ' + (data.message || 'İşlem başarısız'));
                            }
                          })
                          .catch(err => {
                            console.error('Reject error:', err);
                            window.alert('Hata: ' + err.message);
                          })
                          .finally(() => setLoading(false));
                        }
                      } else {
                        Alert.alert('Reddet', 'Bu sürücü başvurusunu reddediyor musunuz?', [
                          { text: 'İptal', style: 'cancel' },
                          { text: 'Reddet', style: 'destructive', onPress: () => rejectKYC(userId) }
                        ]);
                      }
                    }}
                  >
                    <Ionicons name="close" size={18} color="#FFF" />
                    <Text style={styles.kycButtonText}>Reddet</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          ))
        )}
        
        {/* Image Modal */}
        <Modal visible={!!kycImageModal} transparent animationType="fade">
          <TouchableOpacity 
            style={styles.imageModalOverlay}
            activeOpacity={1}
            onPress={() => setKycImageModal(null)}
          >
            <View style={styles.imageModalContent}>
              {kycImageModal && (
                <Image 
                  source={{ uri: kycImageModal }} 
                  style={styles.imageModalImage}
                  resizeMode="contain"
                />
              )}
              <TouchableOpacity 
                style={styles.imageModalClose}
                onPress={() => setKycImageModal(null)}
              >
                <Ionicons name="close" size={24} color="#FFF" />
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </Modal>
      </ScrollView>
    );
  }
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
    paddingTop: Platform.OS === 'ios' ? 50 : 40,
    paddingBottom: 15,
    paddingHorizontal: 15,
  },
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFF',
  },
  tabBar: {
    backgroundColor: COLORS.card,
    paddingVertical: 10,
    paddingHorizontal: 5,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginHorizontal: 4,
    borderRadius: 20,
    backgroundColor: 'transparent',
  },
  tabActive: {
    backgroundColor: 'rgba(63,169,245,0.2)',
  },
  tabText: {
    color: COLORS.textSecondary,
    fontSize: 13,
    marginLeft: 6,
  },
  tabTextActive: {
    color: COLORS.primary,
    fontWeight: '600',
  },
  content: {
    flex: 1,
    padding: 15,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFF',
    marginBottom: 15,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  statCard: {
    width: '48%',
    padding: 15,
    borderRadius: 12,
    marginBottom: 12,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FFF',
    marginTop: 8,
  },
  statLabel: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 4,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.danger,
    padding: 15,
    borderRadius: 12,
    marginTop: 10,
  },
  actionButtonText: {
    color: '#FFF',
    fontWeight: '600',
    marginLeft: 8,
  },
  searchInput: {
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: 12,
    color: '#FFF',
    marginBottom: 15,
  },
  userCard: {
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  userAvatar: {
    width: 45,
    height: 45,
    borderRadius: 23,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  userAvatarText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFF',
  },
  userDetails: {
    marginLeft: 12,
    flex: 1,
  },
  userName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFF',
  },
  userPhone: {
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  userMeta: {
    marginTop: 4,
  },
  userMetaText: {
    fontSize: 11,
    color: COLORS.textSecondary,
  },
  userActions: {
    flexDirection: 'row',
  },
  userActionBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  btnSuccess: {
    backgroundColor: COLORS.success,
  },
  btnDanger: {
    backgroundColor: COLORS.danger,
  },
  logCard: {
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
  },
  logHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.cardLight,
    paddingBottom: 8,
  },
  logTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFF',
    marginLeft: 8,
    flex: 1,
  },
  logTime: {
    fontSize: 11,
    color: COLORS.textSecondary,
  },
  logBody: {
  },
  logText: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginBottom: 4,
  },
  emptyText: {
    textAlign: 'center',
    color: COLORS.textSecondary,
    marginTop: 50,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFF',
    marginBottom: 8,
    marginTop: 15,
  },
  input: {
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: 12,
    color: '#FFF',
  },
  inputMultiline: {
    height: 100,
    textAlignVertical: 'top',
  },
  targetButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  targetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: COLORS.card,
    marginRight: 8,
    marginBottom: 8,
  },
  targetBtnActive: {
    backgroundColor: COLORS.primary,
  },
  targetBtnText: {
    color: COLORS.textSecondary,
    marginLeft: 6,
    fontSize: 13,
  },
  targetBtnTextActive: {
    color: '#FFF',
  },
  sendButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
    padding: 15,
    borderRadius: 12,
    marginTop: 20,
  },
  sendButtonText: {
    color: '#FFF',
    fontWeight: '600',
    marginLeft: 8,
  },
  settingCard: {
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: 15,
    marginBottom: 15,
  },
  settingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFF',
    marginLeft: 10,
  },
  settingDesc: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginBottom: 12,
  },
  settingInput: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  settingTextInput: {
    backgroundColor: COLORS.cardLight,
    borderRadius: 8,
    padding: 10,
    color: '#FFF',
    width: 80,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '600',
  },
  settingUnit: {
    color: COLORS.textSecondary,
    marginLeft: 10,
    fontSize: 14,
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.success,
    padding: 15,
    borderRadius: 12,
    marginTop: 10,
  },
  saveButtonText: {
    color: '#FFF',
    fontWeight: '600',
    marginLeft: 8,
  },
  // KYC Styles
  kycCard: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(63, 169, 245, 0.3)',
  },
  kycHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  kycName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFF',
    marginBottom: 4,
  },
  kycPhone: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginBottom: 4,
  },
  kycPlate: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.primary,
  },
  kycVehicle: {
    fontSize: 14,
    color: '#FFF',
    marginTop: 4,
    fontWeight: '500',
  },
  kycColor: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  kycBadge: {
    backgroundColor: 'rgba(251, 191, 36, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  kycBadgeText: {
    color: '#FBbf24',
    fontSize: 12,
    fontWeight: '600',
  },
  kycPhotos: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  kycPhotoBox: {
    flex: 1,
    backgroundColor: 'rgba(63, 169, 245, 0.1)',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(63, 169, 245, 0.3)',
  },
  kycPhotoLabel: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginBottom: 8,
  },
  kycPhotoAction: {
    fontSize: 12,
    color: COLORS.primary,
    marginTop: 8,
    fontWeight: '600',
  },
  kycActions: {
    flexDirection: 'row',
    gap: 12,
  },
  kycButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  kycApprove: {
    backgroundColor: COLORS.success,
  },
  kycReject: {
    backgroundColor: COLORS.danger,
  },
  kycButtonText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
  },
  imageModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageModalContent: {
    width: '90%',
    height: '70%',
  },
  imageModalImage: {
    width: '100%',
    height: '100%',
  },
  imageModalClose: {
    position: 'absolute',
    top: -40,
    right: 0,
    padding: 10,
  },
  emptyState: {
    alignItems: 'center',
    padding: 40,
  },
  emptyText: {
    color: COLORS.textSecondary,
    fontSize: 16,
    marginTop: 12,
  },
  // KYC Filter Styles
  kycFilterContainer: {
    flexDirection: 'row',
    marginBottom: 16,
    gap: 8,
  },
  kycFilterBtn: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: COLORS.card,
    alignItems: 'center',
  },
  kycFilterBtnActive: {
    backgroundColor: COLORS.primary,
  },
  kycFilterBtnActiveGreen: {
    backgroundColor: COLORS.success,
  },
  kycFilterBtnActiveRed: {
    backgroundColor: COLORS.danger,
  },
  kycFilterText: {
    fontSize: 12,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
  kycFilterTextActive: {
    color: '#FFF',
  },
  kycBadgeGreen: {
    backgroundColor: COLORS.success,
  },
  kycBadgeRed: {
    backgroundColor: COLORS.danger,
  },
  kycRejectionReason: {
    fontSize: 12,
    color: COLORS.danger,
    marginTop: 4,
  },
});
