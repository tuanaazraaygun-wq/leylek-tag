import React, { useState, useEffect } from 'react';
import { 
  View, Text, StyleSheet, ScrollView, TouchableOpacity, 
  TextInput, Alert, Modal, FlatList, Dimensions, ActivityIndicator,
  RefreshControl
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';

// Mavi tema renkleri
const COLORS = {
  primary: '#3FA9F5',
  primaryDark: '#1E3A5F',
  secondary: '#2563EB',
  background: '#0F172A',
  card: '#1E293B',
  text: '#FFFFFF',
  textSecondary: 'rgba(255,255,255,0.7)',
  success: '#10B981',
  danger: '#EF4444',
  warning: '#F59E0B',
};

interface AdminPanelProps {
  adminPhone: string;
  onClose: () => void;
}

export default function AdminPanel({ adminPhone, onClose }: AdminPanelProps) {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'users' | 'calls' | 'reports' | 'notifications' | 'admins'>('dashboard');
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  
  // Dashboard stats
  const [stats, setStats] = useState<any>(null);
  
  // Users
  const [users, setUsers] = useState<any[]>([]);
  const [userPage, setUserPage] = useState(1);
  const [userTotal, setUserTotal] = useState(0);
  
  // Calls
  const [calls, setCalls] = useState<any[]>([]);
  
  // Reports
  const [reports, setReports] = useState<any[]>([]);
  
  // Notifications
  const [notifTitle, setNotifTitle] = useState('');
  const [notifMessage, setNotifMessage] = useState('');
  
  // Admins
  const [admins, setAdmins] = useState<any[]>([]);
  const [newAdminPhone, setNewAdminPhone] = useState('');
  const [newAdminName, setNewAdminName] = useState('');
  
  useEffect(() => {
    loadData();
  }, [activeTab]);
  
  const loadData = async () => {
    setLoading(true);
    try {
      switch(activeTab) {
        case 'dashboard':
          await loadDashboard();
          break;
        case 'users':
          await loadUsers();
          break;
        case 'calls':
          await loadCalls();
          break;
        case 'reports':
          await loadReports();
          break;
        case 'admins':
          await loadAdmins();
          break;
      }
    } catch (e) {
      console.error('Veri yükleme hatası:', e);
    }
    setLoading(false);
    setRefreshing(false);
  };
  
  const loadDashboard = async () => {
    const res = await fetch(`${API_URL}/admin/dashboard?admin_phone=${adminPhone}`);
    const data = await res.json();
    if (data.success) setStats(data.stats);
  };
  
  const loadUsers = async () => {
    const res = await fetch(`${API_URL}/admin/users?admin_phone=${adminPhone}&page=${userPage}`);
    const data = await res.json();
    if (data.success) {
      setUsers(data.users);
      setUserTotal(data.total);
    }
  };
  
  const loadCalls = async () => {
    const res = await fetch(`${API_URL}/admin/calls?admin_phone=${adminPhone}`);
    const data = await res.json();
    if (data.success) setCalls(data.calls);
  };
  
  const loadReports = async () => {
    const res = await fetch(`${API_URL}/admin/reports?admin_phone=${adminPhone}`);
    const data = await res.json();
    if (data.success) setReports(data.reports);
  };
  
  const loadAdmins = async () => {
    const res = await fetch(`${API_URL}/admin/admins?admin_phone=${adminPhone}`);
    const data = await res.json();
    if (data.success) setAdmins(data.admins);
  };
  
  const toggleUserStatus = async (userId: string) => {
    const res = await fetch(`${API_URL}/admin/user/toggle-status?admin_phone=${adminPhone}&user_id=${userId}`, {
      method: 'POST'
    });
    const data = await res.json();
    if (data.success) {
      Alert.alert('Başarılı', `Kullanıcı ${data.is_active ? 'aktif' : 'pasif'} yapıldı`);
      loadUsers();
    }
  };
  
  const togglePremium = async (userId: string) => {
    const res = await fetch(`${API_URL}/admin/user/toggle-premium?admin_phone=${adminPhone}&user_id=${userId}`, {
      method: 'POST'
    });
    const data = await res.json();
    if (data.success) {
      Alert.alert('Başarılı', `Premium ${data.is_premium ? 'açıldı' : 'kapandı'}`);
      loadUsers();
    }
  };
  
  const updateReportStatus = async (reportId: string, status: string) => {
    const res = await fetch(`${API_URL}/admin/report/update-status?admin_phone=${adminPhone}&report_id=${reportId}&status=${status}`, {
      method: 'POST'
    });
    if ((await res.json()).success) loadReports();
  };
  
  const sendNotification = async () => {
    if (!notifTitle || !notifMessage) {
      Alert.alert('Hata', 'Başlık ve mesaj gerekli');
      return;
    }
    
    const res = await fetch(`${API_URL}/admin/send-notification?admin_phone=${adminPhone}&title=${encodeURIComponent(notifTitle)}&message=${encodeURIComponent(notifMessage)}`, {
      method: 'POST'
    });
    const data = await res.json();
    if (data.success) {
      Alert.alert('Başarılı', 'Bildirim gönderildi');
      setNotifTitle('');
      setNotifMessage('');
    }
  };
  
  const addAdmin = async () => {
    if (!newAdminPhone || !newAdminName) {
      Alert.alert('Hata', 'Telefon ve ad gerekli');
      return;
    }
    
    const res = await fetch(`${API_URL}/admin/add-admin?admin_phone=${adminPhone}&new_admin_phone=${newAdminPhone}&new_admin_name=${encodeURIComponent(newAdminName)}`, {
      method: 'POST'
    });
    const data = await res.json();
    if (data.success) {
      Alert.alert('Başarılı', data.message);
      setNewAdminPhone('');
      setNewAdminName('');
      loadAdmins();
    } else {
      Alert.alert('Hata', data.detail);
    }
  };
  
  const formatDate = (dateStr: string) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleString('tr-TR');
  };
  
  // Dashboard Tab
  const renderDashboard = () => (
    <ScrollView style={styles.tabContent}>
      {stats ? (
        <>
          {/* Özet Kartları */}
          <View style={styles.statsGrid}>
            <View style={styles.statCard}>
              <LinearGradient colors={[COLORS.primary, COLORS.secondary]} style={styles.statGradient}>
                <Ionicons name="people" size={32} color="#FFF" />
                <Text style={styles.statValue}>{stats.total_users}</Text>
                <Text style={styles.statLabel}>Toplam Kullanıcı</Text>
              </LinearGradient>
            </View>
            
            <View style={styles.statCard}>
              <LinearGradient colors={[COLORS.success, '#059669']} style={styles.statGradient}>
                <Ionicons name="car" size={32} color="#FFF" />
                <Text style={styles.statValue}>{stats.active_trips}</Text>
                <Text style={styles.statLabel}>Aktif Yolculuk</Text>
              </LinearGradient>
            </View>
            
            <View style={styles.statCard}>
              <LinearGradient colors={[COLORS.warning, '#D97706']} style={styles.statGradient}>
                <Ionicons name="time" size={32} color="#FFF" />
                <Text style={styles.statValue}>{stats.pending_requests}</Text>
                <Text style={styles.statLabel}>Bekleyen Talep</Text>
              </LinearGradient>
            </View>
            
            <View style={styles.statCard}>
              <LinearGradient colors={['#8B5CF6', '#7C3AED']} style={styles.statGradient}>
                <Ionicons name="call" size={32} color="#FFF" />
                <Text style={styles.statValue}>{stats.total_calls}</Text>
                <Text style={styles.statLabel}>Toplam Arama</Text>
              </LinearGradient>
            </View>
          </View>
          
          {/* Dönemsel İstatistikler */}
          <View style={styles.periodStats}>
            <Text style={styles.sectionTitle}>📊 Dönemsel İstatistikler</Text>
            
            <View style={styles.periodCard}>
              <Text style={styles.periodLabel}>Bugün</Text>
              <View style={styles.periodRow}>
                <Text style={styles.periodValue}>👥 {stats.today.users} Yeni Kullanıcı</Text>
                <Text style={styles.periodValue}>🚗 {stats.today.trips} Yolculuk</Text>
              </View>
            </View>
            
            <View style={styles.periodCard}>
              <Text style={styles.periodLabel}>Bu Hafta</Text>
              <View style={styles.periodRow}>
                <Text style={styles.periodValue}>👥 {stats.this_week.users} Kullanıcı</Text>
                <Text style={styles.periodValue}>🚗 {stats.this_week.trips} Yolculuk</Text>
              </View>
            </View>
            
            <View style={styles.periodCard}>
              <Text style={styles.periodLabel}>Bu Ay</Text>
              <View style={styles.periodRow}>
                <Text style={styles.periodValue}>👥 {stats.this_month.users} Kullanıcı</Text>
                <Text style={styles.periodValue}>🚗 {stats.this_month.trips} Yolculuk</Text>
              </View>
            </View>
          </View>
          
          {/* Şikayetler */}
          {stats.pending_reports > 0 && (
            <TouchableOpacity style={styles.alertCard} onPress={() => setActiveTab('reports')}>
              <Ionicons name="warning" size={24} color={COLORS.danger} />
              <Text style={styles.alertText}>{stats.pending_reports} bekleyen şikayet var!</Text>
              <Ionicons name="chevron-forward" size={24} color={COLORS.textSecondary} />
            </TouchableOpacity>
          )}
        </>
      ) : (
        <ActivityIndicator size="large" color={COLORS.primary} />
      )}
    </ScrollView>
  );
  
  // Users Tab
  const renderUsers = () => (
    <FlatList
      data={users}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => (
        <View style={styles.userCard}>
          <View style={styles.userHeader}>
            <View style={styles.userAvatar}>
              <Text style={styles.userAvatarText}>{item.name?.[0] || '?'}</Text>
            </View>
            <View style={styles.userInfo}>
              <Text style={styles.userName}>{item.name}</Text>
              <Text style={styles.userPhone}>{item.phone}</Text>
              <Text style={styles.userCity}>{item.city || 'Şehir yok'}</Text>
            </View>
            <View style={styles.userBadges}>
              {item.is_premium && (
                <View style={styles.premiumBadge}>
                  <Text style={styles.badgeText}>⭐ VIP</Text>
                </View>
              )}
              {!item.is_active && (
                <View style={styles.inactiveBadge}>
                  <Text style={styles.badgeText}>PASİF</Text>
                </View>
              )}
            </View>
          </View>
          
          <View style={styles.userStats}>
            <Text style={styles.userStatItem}>⭐ {item.rating?.toFixed(1) || '5.0'}</Text>
            <Text style={styles.userStatItem}>🚗 {item.total_trips || 0} yolculuk</Text>
            <Text style={styles.userStatItem}>⚠️ {item.penalty_points || 0} ceza</Text>
          </View>
          
          <View style={styles.userActions}>
            <TouchableOpacity 
              style={[styles.userActionBtn, !item.is_active && styles.userActionBtnActive]}
              onPress={() => toggleUserStatus(item.id)}
            >
              <Ionicons name={item.is_active ? "ban" : "checkmark-circle"} size={18} color="#FFF" />
              <Text style={styles.userActionText}>{item.is_active ? 'Engelle' : 'Aktif Et'}</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.userActionBtn, styles.userActionBtnPremium]}
              onPress={() => togglePremium(item.id)}
            >
              <Ionicons name="star" size={18} color="#FFF" />
              <Text style={styles.userActionText}>{item.is_premium ? 'VIP Kaldır' : 'VIP Yap'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadUsers(); }} />}
      ListEmptyComponent={<Text style={styles.emptyText}>Kullanıcı bulunamadı</Text>}
    />
  );
  
  // Calls Tab
  const renderCalls = () => (
    <FlatList
      data={calls}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => (
        <View style={styles.callCard}>
          <View style={styles.callHeader}>
            <Ionicons name={item.call_type === 'video' ? 'videocam' : 'call'} size={24} color={COLORS.primary} />
            <View style={styles.callInfo}>
              <Text style={styles.callNames}>{item.caller_name} → {item.receiver_name}</Text>
              <Text style={styles.callDate}>{formatDate(item.timestamp)}</Text>
            </View>
            <View style={styles.callDuration}>
              <Text style={styles.callDurationText}>
                {Math.floor(item.duration_seconds / 60)}:{(item.duration_seconds % 60).toString().padStart(2, '0')}
              </Text>
            </View>
          </View>
        </View>
      )}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadCalls(); }} />}
      ListEmptyComponent={<Text style={styles.emptyText}>Arama kaydı yok</Text>}
    />
  );
  
  // Reports Tab
  const renderReports = () => (
    <FlatList
      data={reports}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => (
        <View style={styles.reportCard}>
          <View style={styles.reportHeader}>
            <View style={[styles.reportStatus, { backgroundColor: item.status === 'pending' ? COLORS.warning : COLORS.success }]}>
              <Text style={styles.reportStatusText}>{item.status === 'pending' ? 'Bekliyor' : item.status}</Text>
            </View>
            <Text style={styles.reportDate}>{formatDate(item.created_at)}</Text>
          </View>
          
          <Text style={styles.reportNames}>{item.reporter_name} ➜ {item.reported_name}</Text>
          <Text style={styles.reportReason}>Sebep: {item.reason}</Text>
          {item.description && <Text style={styles.reportDesc}>{item.description}</Text>}
          
          {item.status === 'pending' && (
            <View style={styles.reportActions}>
              <TouchableOpacity style={styles.reportActionBtn} onPress={() => updateReportStatus(item.id, 'reviewed')}>
                <Text style={styles.reportActionText}>İncelendi</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.reportActionBtn, styles.reportActionBtnDanger]} onPress={() => updateReportStatus(item.id, 'dismissed')}>
                <Text style={styles.reportActionText}>Reddet</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadReports(); }} />}
      ListEmptyComponent={<Text style={styles.emptyText}>Şikayet yok</Text>}
    />
  );
  
  // Notifications Tab
  const renderNotifications = () => (
    <ScrollView style={styles.tabContent}>
      <Text style={styles.sectionTitle}>📢 Bildirim Gönder</Text>
      
      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>Başlık</Text>
        <TextInput
          style={styles.input}
          placeholder="Bildirim başlığı"
          placeholderTextColor={COLORS.textSecondary}
          value={notifTitle}
          onChangeText={setNotifTitle}
        />
      </View>
      
      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>Mesaj</Text>
        <TextInput
          style={[styles.input, styles.inputMulti]}
          placeholder="Bildirim mesajı"
          placeholderTextColor={COLORS.textSecondary}
          value={notifMessage}
          onChangeText={setNotifMessage}
          multiline
          numberOfLines={4}
        />
      </View>
      
      <TouchableOpacity style={styles.sendButton} onPress={sendNotification}>
        <LinearGradient colors={[COLORS.primary, COLORS.secondary]} style={styles.sendButtonGradient}>
          <Ionicons name="send" size={20} color="#FFF" />
          <Text style={styles.sendButtonText}>Herkese Gönder</Text>
        </LinearGradient>
      </TouchableOpacity>
    </ScrollView>
  );
  
  // Admins Tab
  const renderAdmins = () => (
    <ScrollView style={styles.tabContent}>
      <Text style={styles.sectionTitle}>👑 Admin Listesi</Text>
      
      {admins.map((admin, index) => (
        <View key={index} style={styles.adminCard}>
          <View style={styles.adminInfo}>
            <Text style={styles.adminName}>{admin.name}</Text>
            <Text style={styles.adminPhone}>{admin.phone}</Text>
          </View>
          {admin.is_main && (
            <View style={styles.mainAdminBadge}>
              <Text style={styles.badgeText}>ANA ADMİN</Text>
            </View>
          )}
        </View>
      ))}
      
      <Text style={[styles.sectionTitle, { marginTop: 30 }]}>➕ Yeni Admin Ekle</Text>
      
      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>Telefon Numarası</Text>
        <TextInput
          style={styles.input}
          placeholder="5xxxxxxxxx"
          placeholderTextColor={COLORS.textSecondary}
          value={newAdminPhone}
          onChangeText={setNewAdminPhone}
          keyboardType="phone-pad"
        />
      </View>
      
      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>Ad Soyad</Text>
        <TextInput
          style={styles.input}
          placeholder="Admin adı"
          placeholderTextColor={COLORS.textSecondary}
          value={newAdminName}
          onChangeText={setNewAdminName}
        />
      </View>
      
      <TouchableOpacity style={styles.sendButton} onPress={addAdmin}>
        <LinearGradient colors={[COLORS.success, '#059669']} style={styles.sendButtonGradient}>
          <Ionicons name="person-add" size={20} color="#FFF" />
          <Text style={styles.sendButtonText}>Admin Ekle</Text>
        </LinearGradient>
      </TouchableOpacity>
    </ScrollView>
  );

  return (
    <Modal visible={true} animationType="slide">
      <View style={styles.container}>
        {/* Header */}
        <LinearGradient colors={[COLORS.primaryDark, COLORS.background]} style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={28} color="#FFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>👑 Admin Paneli</Text>
          <View style={{ width: 28 }} />
        </LinearGradient>
        
        {/* Tabs */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabBar}>
          {[
            { key: 'dashboard', icon: 'stats-chart', label: 'Dashboard' },
            { key: 'users', icon: 'people', label: 'Kullanıcılar' },
            { key: 'calls', icon: 'call', label: 'Aramalar' },
            { key: 'reports', icon: 'warning', label: 'Şikayetler' },
            { key: 'notifications', icon: 'notifications', label: 'Bildirim' },
            { key: 'admins', icon: 'shield', label: 'Adminler' },
          ].map((tab) => (
            <TouchableOpacity
              key={tab.key}
              style={[styles.tab, activeTab === tab.key && styles.tabActive]}
              onPress={() => setActiveTab(tab.key as any)}
            >
              <Ionicons name={tab.icon as any} size={20} color={activeTab === tab.key ? COLORS.primary : COLORS.textSecondary} />
              <Text style={[styles.tabText, activeTab === tab.key && styles.tabTextActive]}>{tab.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
        
        {/* Content */}
        <View style={styles.content}>
          {loading && !refreshing ? (
            <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 50 }} />
          ) : (
            <>
              {activeTab === 'dashboard' && renderDashboard()}
              {activeTab === 'users' && renderUsers()}
              {activeTab === 'calls' && renderCalls()}
              {activeTab === 'reports' && renderReports()}
              {activeTab === 'notifications' && renderNotifications()}
              {activeTab === 'admins' && renderAdmins()}
            </>
          )}
        </View>
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
    paddingTop: 50,
    paddingBottom: 16,
    paddingHorizontal: 16,
  },
  closeButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFF',
  },
  tabBar: {
    maxHeight: 60,
    backgroundColor: COLORS.card,
    paddingHorizontal: 8,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginHorizontal: 4,
    borderRadius: 8,
    gap: 6,
  },
  tabActive: {
    backgroundColor: 'rgba(63, 169, 245, 0.2)',
  },
  tabText: {
    color: COLORS.textSecondary,
    fontSize: 13,
  },
  tabTextActive: {
    color: COLORS.primary,
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
  tabContent: {
    flex: 1,
    padding: 16,
  },
  // Stats
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 20,
  },
  statCard: {
    width: (SCREEN_WIDTH - 44) / 2,
    borderRadius: 16,
    overflow: 'hidden',
  },
  statGradient: {
    padding: 16,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#FFF',
    marginTop: 8,
  },
  statLabel: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 4,
  },
  // Period Stats
  periodStats: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFF',
    marginBottom: 16,
  },
  periodCard: {
    backgroundColor: COLORS.card,
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  periodLabel: {
    color: COLORS.primary,
    fontWeight: '600',
    marginBottom: 8,
  },
  periodRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  periodValue: {
    color: '#FFF',
    fontSize: 14,
  },
  // Alert
  alertCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    padding: 16,
    borderRadius: 12,
    gap: 12,
  },
  alertText: {
    flex: 1,
    color: COLORS.danger,
    fontWeight: '600',
  },
  // Users
  userCard: {
    backgroundColor: COLORS.card,
    margin: 8,
    padding: 16,
    borderRadius: 12,
  },
  userHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  userAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  userAvatarText: {
    color: '#FFF',
    fontSize: 20,
    fontWeight: 'bold',
  },
  userInfo: {
    flex: 1,
    marginLeft: 12,
  },
  userName: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  userPhone: {
    color: COLORS.textSecondary,
    fontSize: 14,
  },
  userCity: {
    color: COLORS.primary,
    fontSize: 12,
  },
  userBadges: {
    gap: 4,
  },
  premiumBadge: {
    backgroundColor: COLORS.warning,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  inactiveBadge: {
    backgroundColor: COLORS.danger,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  badgeText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: 'bold',
  },
  userStats: {
    flexDirection: 'row',
    marginTop: 12,
    gap: 16,
  },
  userStatItem: {
    color: COLORS.textSecondary,
    fontSize: 13,
  },
  userActions: {
    flexDirection: 'row',
    marginTop: 12,
    gap: 8,
  },
  userActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.danger,
    paddingVertical: 10,
    borderRadius: 8,
    gap: 6,
  },
  userActionBtnActive: {
    backgroundColor: COLORS.success,
  },
  userActionBtnPremium: {
    backgroundColor: COLORS.warning,
  },
  userActionText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '600',
  },
  // Calls
  callCard: {
    backgroundColor: COLORS.card,
    margin: 8,
    padding: 16,
    borderRadius: 12,
  },
  callHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  callInfo: {
    flex: 1,
  },
  callNames: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '500',
  },
  callDate: {
    color: COLORS.textSecondary,
    fontSize: 12,
    marginTop: 4,
  },
  callDuration: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  callDurationText: {
    color: '#FFF',
    fontWeight: 'bold',
  },
  // Reports
  reportCard: {
    backgroundColor: COLORS.card,
    margin: 8,
    padding: 16,
    borderRadius: 12,
  },
  reportHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  reportStatus: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  reportStatusText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  reportDate: {
    color: COLORS.textSecondary,
    fontSize: 12,
  },
  reportNames: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  reportReason: {
    color: COLORS.warning,
    fontSize: 13,
  },
  reportDesc: {
    color: COLORS.textSecondary,
    fontSize: 13,
    marginTop: 8,
    fontStyle: 'italic',
  },
  reportActions: {
    flexDirection: 'row',
    marginTop: 12,
    gap: 8,
  },
  reportActionBtn: {
    flex: 1,
    backgroundColor: COLORS.success,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  reportActionBtnDanger: {
    backgroundColor: COLORS.danger,
  },
  reportActionText: {
    color: '#FFF',
    fontWeight: '600',
  },
  // Form
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    color: COLORS.textSecondary,
    marginBottom: 8,
    fontSize: 14,
  },
  input: {
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: 16,
    color: '#FFF',
    fontSize: 16,
    borderWidth: 1,
    borderColor: 'rgba(63, 169, 245, 0.3)',
  },
  inputMulti: {
    height: 100,
    textAlignVertical: 'top',
  },
  sendButton: {
    marginTop: 8,
    borderRadius: 12,
    overflow: 'hidden',
  },
  sendButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 8,
  },
  sendButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  // Admins
  adminCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
  },
  adminInfo: {
    flex: 1,
  },
  adminName: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  adminPhone: {
    color: COLORS.textSecondary,
    fontSize: 14,
  },
  mainAdminBadge: {
    backgroundColor: COLORS.warning,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  emptyText: {
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: 50,
    fontSize: 16,
  },
});
