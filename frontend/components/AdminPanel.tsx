import React, { useState, useEffect } from 'react';
import { 
  View, Text, StyleSheet, ScrollView, TouchableOpacity, 
  TextInput, Alert, Modal, FlatList, Dimensions, ActivityIndicator,
  RefreshControl, Platform
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

type TabType = 'dashboard' | 'users' | 'trips' | 'calls' | 'reports' | 'auth' | 'notifications' | 'settings' | 'admins';

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
  
  // Admin Ekleme
  const [admins, setAdmins] = useState<any[]>([]);
  const [newAdminPhone, setNewAdminPhone] = useState('');
  
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
        case 'settings': await loadSettings(); break;
        case 'admins': await loadAdmins(); break;
      }
    } catch (e) {
      console.error('Veri yükleme hatası:', e);
    }
    setLoading(false);
    setRefreshing(false);
  };
  
  const loadDashboard = async () => {
    try {
      const res = await fetch(`${API_URL}/admin/dashboard?admin_phone=${adminPhone}`);
      const data = await res.json();
      if (data.success) setStats(data.stats);
    } catch (e) { console.error(e); }
  };
  
  const loadUsers = async () => {
    try {
      const res = await fetch(`${API_URL}/admin/users?admin_phone=${adminPhone}&limit=100`);
      const data = await res.json();
      if (data.success) setUsers(data.users || []);
    } catch (e) { console.error(e); }
  };
  
  const loadTrips = async () => {
    try {
      const res = await fetch(`${API_URL}/admin/tags?admin_phone=${adminPhone}&limit=50`);
      const data = await res.json();
      if (data.success) setTrips(data.tags || []);
    } catch (e) { console.error(e); }
  };
  
  const loadCalls = async () => {
    try {
      const res = await fetch(`${API_URL}/admin/calls?admin_phone=${adminPhone}&limit=50`);
      const data = await res.json();
      if (data.success) setCalls(data.calls || []);
    } catch (e) { console.error(e); }
  };
  
  const loadAuthLogs = async () => {
    try {
      // Auth logs için reports kullanılabilir
      const res = await fetch(`${API_URL}/admin/reports?admin_phone=${adminPhone}`);
      const data = await res.json();
      if (data.success) setAuthLogs(data.reports || []);
    } catch (e) { console.error(e); }
  };
  
  const loadSettings = async () => {
    try {
      const res = await fetch(`${API_URL}/admin/settings?admin_phone=${adminPhone}`);
      const data = await res.json();
      if (data.success) {
        setSettings(data.settings || {});
        setDriverRadius(String(data.settings?.driver_radius_km || 50));
        setMaxCallDuration(String(data.settings?.max_call_duration_min || 30));
      }
    } catch (e) { console.error(e); }
  };
  
  const loadAdmins = async () => {
    try {
      const res = await fetch(`${API_URL}/admin/list-admins?admin_phone=${adminPhone}`);
      const data = await res.json();
      if (data.success) setAdmins(data.admins || []);
    } catch (e) { console.error(e); }
  };
  
  const addNewAdmin = async () => {
    if (!newAdminPhone || newAdminPhone.length < 10) {
      Alert.alert('Hata', 'Geçerli bir telefon numarası girin');
      return;
    }
    
    try {
      const res = await fetch(`${API_URL}/admin/add-admin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ admin_phone: adminPhone, new_admin_phone: newAdminPhone })
      });
      const data = await res.json();
      if (data.success) {
        Alert.alert('Başarılı', data.message);
        setNewAdminPhone('');
        loadAdmins();
      } else {
        Alert.alert('Hata', data.detail || 'Admin eklenemedi');
      }
    } catch (e) { 
      Alert.alert('Hata', 'Admin eklenemedi');
    }
  };
  
  const toggleUserStatus = async (userId: string, currentStatus: boolean) => {
    try {
      const res = await fetch(`${API_URL}/admin/user/toggle-status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ admin_phone: adminPhone, user_id: userId })
      });
      const data = await res.json();
      if (data.success) {
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
              const res = await fetch(`${API_URL}/admin/user/delete`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ admin_phone: adminPhone, user_id: userId })
              });
              const data = await res.json();
              if (data.success) {
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
      const res = await fetch(`${API_URL}/admin/cleanup-stuck-tags?admin_phone=${adminPhone}`, {
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
      const res = await fetch(`${API_URL}/admin/send-notification`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          admin_phone: adminPhone,
          title: notifTitle,
          message: notifMessage,
          target: notifTarget,
          user_id: notifTarget === 'user' ? notifUserId : null
        })
      });
      const data = await res.json();
      if (data.success) {
        Alert.alert('Gönderildi', `${data.sent_count || 0} kişiye bildirim gönderildi`);
        setNotifTitle('');
        setNotifMessage('');
      }
    } catch (e) { 
      Alert.alert('Hata', 'Bildirim gönderilemedi');
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
  
  // ========== TRIPS (Yolculuklar) ==========
  const renderTrips = () => (
    <FlatList
      style={styles.content}
      data={trips}
      keyExtractor={(item, index) => item.id || index.toString()}
      renderItem={({ item }) => (
        <View style={styles.logCard}>
          <View style={styles.logHeader}>
            <Ionicons name="car" size={20} color={COLORS.primary} />
            <Text style={styles.logTitle}>TAG #{item.id?.slice(0, 8)}</Text>
            <Text style={styles.logTime}>{formatDate(item.created_at)}</Text>
          </View>
          <View style={styles.logBody}>
            <Text style={styles.logText}>👤 Yolcu: {item.passenger_name || 'Bilinmiyor'} ({item.passenger_phone || '-'})</Text>
            <Text style={styles.logText}>🚗 Şoför: {item.driver_name || 'Atanmadı'} ({item.driver_phone || '-'})</Text>
            <Text style={styles.logText}>📍 Başlangıç: {item.pickup_location || '-'}</Text>
            <Text style={styles.logText}>🎯 Hedef: {item.dropoff_location || '-'}</Text>
            <Text style={styles.logText}>🏙️ Şehir: {item.city || '-'}</Text>
            <Text style={styles.logText}>💰 Fiyat: {item.final_price ? `₺${item.final_price}` : 'Belirlenmedi'}</Text>
            <Text style={styles.logText}>📊 Durum: {
              item.status === 'pending' ? '🟡 Bekliyor' :
              item.status === 'matched' ? '🟢 Eşleşti' :
              item.status === 'in_progress' ? '🚗 Devam Ediyor' :
              item.status === 'completed' ? '✅ Tamamlandı' :
              item.status === 'cancelled' ? '❌ İptal' :
              item.status
            }</Text>
            {item.matched_at && <Text style={styles.logText}>🤝 Eşleşme: {formatDate(item.matched_at)}</Text>}
            {item.completed_at && <Text style={styles.logText}>✅ Bitiş: {formatDate(item.completed_at)}</Text>}
            {item.cancelled_at && <Text style={styles.logText}>❌ İptal: {formatDate(item.cancelled_at)}</Text>}
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
            <Text style={styles.logTime}>{formatDate(item.created_at)}</Text>
          </View>
          <View style={styles.logBody}>
            <Text style={styles.logText}>📞 Arayan: {item.caller_name || 'Bilinmiyor'}</Text>
            <Text style={styles.logText}>📱 Aranan: {item.receiver_name || 'Bilinmiyor'}</Text>
            <Text style={styles.logText}>⏱️ Süre: {item.duration_seconds ? `${item.duration_seconds} saniye` : 'Cevaplanmadı'}</Text>
            <Text style={styles.logText}>📊 Durum: {item.status === 'connected' ? '✅ Bağlandı' : item.status === 'rejected' ? '❌ Reddedildi' : item.status === 'cancelled' ? '⚠️ İptal' : item.status === 'missed' ? '📵 Cevapsız' : item.status}</Text>
            {item.ended_at && <Text style={styles.logText}>🕐 Bitiş: {formatDate(item.ended_at)}</Text>}
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
  
  // Admin Yönetimi Tab
  const renderAdmins = () => (
    <ScrollView style={styles.tabContent}>
      {/* Admin Ekle */}
      <View style={styles.statCard}>
        <View style={styles.cardHeader}>
          <Ionicons name="person-add" size={24} color={COLORS.primary} />
          <Text style={styles.cardTitle}>Yeni Admin Ekle</Text>
        </View>
        <Text style={styles.settingDesc}>Kayıtlı bir kullanıcıyı admin yap</Text>
        <View style={[styles.settingInput, { marginTop: 12 }]}>
          <TextInput
            style={[styles.settingTextInput, { flex: 1 }]}
            value={newAdminPhone}
            onChangeText={setNewAdminPhone}
            placeholder="5XX XXX XX XX"
            keyboardType="phone-pad"
            maxLength={10}
          />
          <TouchableOpacity 
            style={[styles.saveButton, { marginLeft: 8, paddingVertical: 10 }]} 
            onPress={addNewAdmin}
          >
            <Ionicons name="add" size={20} color="#FFF" />
            <Text style={styles.saveButtonText}>Ekle</Text>
          </TouchableOpacity>
        </View>
      </View>
      
      {/* Mevcut Adminler */}
      <View style={styles.statCard}>
        <View style={styles.cardHeader}>
          <Ionicons name="shield-checkmark" size={24} color={COLORS.primary} />
          <Text style={styles.cardTitle}>Mevcut Adminler ({admins.length})</Text>
        </View>
        
        {admins.map((admin: any, index: number) => (
          <View key={admin.id || index} style={styles.adminItem}>
            <View style={styles.adminInfo}>
              <Ionicons name="person-circle" size={40} color={COLORS.primary} />
              <View style={{ marginLeft: 12 }}>
                <Text style={styles.adminName}>{admin.name || 'İsimsiz'}</Text>
                <Text style={styles.adminPhone}>{admin.phone}</Text>
                {admin.is_hardcoded && (
                  <Text style={styles.adminBadge}>Sistem Admin</Text>
                )}
              </View>
            </View>
          </View>
        ))}
        
        {admins.length === 0 && (
          <Text style={styles.emptyText}>Henüz admin yok</Text>
        )}
      </View>
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
        {renderTab('admins', 'shield', 'Adminler')}
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
          {activeTab === 'settings' && renderSettings()}
          {activeTab === 'admins' && renderAdmins()}
        </>
      )}
    </View>
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
});
