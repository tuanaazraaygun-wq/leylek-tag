/**
 * Admin Panel - Leylek TAG
 * Kapsamlı yönetim paneli: Dashboard, Kullanıcılar, Sürücüler, KYC, Promosyonlar, Bildirimler
 */

import React, { useState, useEffect, useCallback } from 'react';
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
import Constants from 'expo-constants';
import { LinearGradient } from 'expo-linear-gradient';

const { width } = Dimensions.get('window');
const BACKEND_URL = Constants.expoConfig?.extra?.EXPO_PUBLIC_BACKEND_URL 
  || process.env.EXPO_PUBLIC_BACKEND_URL 
  || 'https://qr-trip-end.preview.emergentagent.com';
const API_URL = `${BACKEND_URL}/api`;

type TabType = 'dashboard' | 'users' | 'drivers' | 'trips' | 'promos' | 'notifications' | 'settings';

interface DashboardStats {
  users: { total: number; drivers: number; passengers: number; online_drivers: number; new_today: number };
  trips: { completed_today: number; completed_week: number; active: number; waiting: number };
  kyc: { pending: number };
  promos: { active: number };
}

interface User {
  id: string;
  name: string;
  phone: string;
  city?: string;
  rating: number;
  total_trips: number;
  is_active: boolean;
  is_driver: boolean;
  is_online?: boolean;
  driver_active_until?: string;
  created_at: string;
}

interface PromoCode {
  id?: string;
  code: string;
  hours: number;
  max_uses: number;
  used_count: number;
  is_active: boolean;
  description?: string;
  created_at?: string;
}

interface Notification {
  id?: string;
  title: string;
  body: string;
  target: string;
  created_at?: string;
}

export default function AdminScreen() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminPhone, setAdminPhone] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  
  // Tab state
  const [activeTab, setActiveTab] = useState<TabType>('dashboard');
  
  // Data states
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [usersTotal, setUsersTotal] = useState(0);
  const [usersPage, setUsersPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [userFilter, setUserFilter] = useState<'all' | 'drivers' | 'online'>('all');
  
  // Promo states
  const [promos, setPromos] = useState<PromoCode[]>([]);
  const [promoModalVisible, setPromoModalVisible] = useState(false);
  const [newPromo, setNewPromo] = useState({ code: '', hours: 3, max_uses: 1, description: '' });
  
  // Notification states
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [notifModalVisible, setNotifModalVisible] = useState(false);
  const [newNotif, setNewNotif] = useState({ title: '', body: '', target: 'all' });
  
  // Add time modal
  const [addTimeModalVisible, setAddTimeModalVisible] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [addTimeHours, setAddTimeHours] = useState('3');

  useEffect(() => {
    checkAdminStatus();
  }, []);

  const checkAdminStatus = async () => {
    try {
      const userData = await AsyncStorage.getItem('leylek_user');
      if (!userData) {
        Alert.alert('Hata', 'Giriş yapmanız gerekiyor');
        router.replace('/');
        return;
      }
      
      const user = JSON.parse(userData);
      const phone = user.phone?.replace(/\D/g, '');
      
      // Admin kontrolü
      const response = await fetch(`${API_URL}/admin/check?phone=${phone}`);
      const result = await response.json();
      
      if (result.is_admin) {
        setIsAdmin(true);
        setAdminPhone(phone);
        loadDashboard(phone);
      } else {
        Alert.alert('Yetkisiz Erişim', 'Bu sayfaya erişim yetkiniz yok');
        router.replace('/');
      }
    } catch (error) {
      console.error('Admin check error:', error);
      Alert.alert('Hata', 'Admin kontrolü yapılamadı');
      router.replace('/');
    } finally {
      setIsLoading(false);
    }
  };

  const loadDashboard = async (phone: string) => {
    try {
      const response = await fetch(`${API_URL}/admin/dashboard/full?admin_phone=${phone}`);
      const result = await response.json();
      if (result.success) {
        setStats(result.stats);
      }
    } catch (error) {
      console.error('Dashboard load error:', error);
    }
  };

  const loadUsers = async (page: number = 1, search: string = '', filter: string = 'all') => {
    try {
      setRefreshing(true);
      let url = `${API_URL}/admin/users/full?admin_phone=${adminPhone}&page=${page}&limit=20`;
      if (search) url += `&search=${encodeURIComponent(search)}`;
      if (filter !== 'all') url += `&filter_type=${filter}`;
      
      const response = await fetch(url);
      const result = await response.json();
      
      if (result.success) {
        if (page === 1) {
          setUsers(result.users);
        } else {
          setUsers(prev => [...prev, ...result.users]);
        }
        setUsersTotal(result.total);
        setUsersPage(page);
      }
    } catch (error) {
      console.error('Load users error:', error);
    } finally {
      setRefreshing(false);
    }
  };

  const loadPromos = async () => {
    try {
      const response = await fetch(`${API_URL}/admin/promo/list?admin_phone=${adminPhone}`);
      const result = await response.json();
      if (result.success) {
        setPromos(result.promos || []);
      }
    } catch (error) {
      console.error('Load promos error:', error);
    }
  };

  const loadNotifications = async () => {
    try {
      const response = await fetch(`${API_URL}/admin/notifications/history?admin_phone=${adminPhone}`);
      const result = await response.json();
      if (result.success) {
        setNotifications(result.notifications || []);
      }
    } catch (error) {
      console.error('Load notifications error:', error);
    }
  };

  const createPromo = async () => {
    if (!newPromo.hours) {
      Alert.alert('Hata', 'Süre belirtmelisiniz');
      return;
    }
    
    try {
      const response = await fetch(`${API_URL}/admin/promo/create?admin_phone=${adminPhone}&hours=${newPromo.hours}&max_uses=${newPromo.max_uses}&description=${encodeURIComponent(newPromo.description)}${newPromo.code ? `&code=${newPromo.code}` : ''}`, {
        method: 'POST'
      });
      const result = await response.json();
      
      if (result.success) {
        Alert.alert('Başarılı', `Promosyon kodu oluşturuldu: ${result.promo.code}`);
        setPromoModalVisible(false);
        setNewPromo({ code: '', hours: 3, max_uses: 1, description: '' });
        loadPromos();
      } else {
        Alert.alert('Hata', result.detail || 'Promosyon oluşturulamadı');
      }
    } catch (error) {
      Alert.alert('Hata', 'Bağlantı hatası');
    }
  };

  const sendNotification = async () => {
    if (!newNotif.title || !newNotif.body) {
      Alert.alert('Hata', 'Başlık ve mesaj gerekli');
      return;
    }
    
    try {
      const response = await fetch(
        `${API_URL}/admin/notifications/send?admin_phone=${adminPhone}&title=${encodeURIComponent(newNotif.title)}&body=${encodeURIComponent(newNotif.body)}&target=${newNotif.target}`,
        { method: 'POST' }
      );
      const result = await response.json();
      
      if (result.success) {
        Alert.alert('Başarılı', `${result.sent_count} kullanıcıya bildirim gönderildi`);
        setNotifModalVisible(false);
        setNewNotif({ title: '', body: '', target: 'all' });
        loadNotifications();
      } else {
        Alert.alert('Hata', result.detail || 'Bildirim gönderilemedi');
      }
    } catch (error) {
      Alert.alert('Hata', 'Bağlantı hatası');
    }
  };

  const banUser = async (userId: string, isBanned: boolean) => {
    Alert.alert(
      isBanned ? 'Kullanıcıyı Banla' : 'Banı Kaldır',
      isBanned ? 'Bu kullanıcıyı banlamak istediğinize emin misiniz?' : 'Kullanıcının banını kaldırmak istediğinize emin misiniz?',
      [
        { text: 'İptal', style: 'cancel' },
        {
          text: 'Evet',
          style: 'destructive',
          onPress: async () => {
            try {
              const response = await fetch(
                `${API_URL}/admin/user/ban?admin_phone=${adminPhone}&user_id=${userId}&is_banned=${isBanned}`,
                { method: 'POST' }
              );
              const result = await response.json();
              if (result.success) {
                Alert.alert('Başarılı', result.message);
                loadUsers(1, searchQuery, userFilter);
              }
            } catch (error) {
              Alert.alert('Hata', 'İşlem başarısız');
            }
          }
        }
      ]
    );
  };

  const addDriverTime = async () => {
    if (!selectedUser || !addTimeHours) return;
    
    try {
      const response = await fetch(
        `${API_URL}/admin/user/add-time?admin_phone=${adminPhone}&user_id=${selectedUser.id}&hours=${addTimeHours}`,
        { method: 'POST' }
      );
      const result = await response.json();
      
      if (result.success) {
        Alert.alert('Başarılı', `${addTimeHours} saat eklendi`);
        setAddTimeModalVisible(false);
        setSelectedUser(null);
        setAddTimeHours('3');
        loadUsers(1, searchQuery, userFilter);
      } else {
        Alert.alert('Hata', result.error || 'Süre eklenemedi');
      }
    } catch (error) {
      Alert.alert('Hata', 'Bağlantı hatası');
    }
  };

  const onRefresh = useCallback(() => {
    if (activeTab === 'dashboard') loadDashboard(adminPhone);
    else if (activeTab === 'users' || activeTab === 'drivers') loadUsers(1, searchQuery, userFilter);
    else if (activeTab === 'promos') loadPromos();
    else if (activeTab === 'notifications') loadNotifications();
  }, [activeTab, adminPhone, searchQuery, userFilter]);

  useEffect(() => {
    if (isAdmin && adminPhone) {
      if (activeTab === 'users' || activeTab === 'drivers') {
        const filter = activeTab === 'drivers' ? 'drivers' : userFilter;
        loadUsers(1, searchQuery, filter);
      } else if (activeTab === 'promos') {
        loadPromos();
      } else if (activeTab === 'notifications') {
        loadNotifications();
      }
    }
  }, [activeTab, isAdmin, adminPhone]);

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3FA9F5" />
        <Text style={styles.loadingText}>Yükleniyor...</Text>
      </View>
    );
  }

  if (!isAdmin) {
    return null;
  }

  const renderTabs = () => (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabsContainer}>
      {[
        { key: 'dashboard', icon: 'grid-outline', label: 'Dashboard' },
        { key: 'users', icon: 'people-outline', label: 'Kullanıcılar' },
        { key: 'drivers', icon: 'car-outline', label: 'Sürücüler' },
        { key: 'promos', icon: 'gift-outline', label: 'Promosyonlar' },
        { key: 'notifications', icon: 'notifications-outline', label: 'Bildirimler' },
        { key: 'settings', icon: 'settings-outline', label: 'Ayarlar' },
      ].map((tab) => (
        <TouchableOpacity
          key={tab.key}
          style={[styles.tab, activeTab === tab.key && styles.activeTab]}
          onPress={() => setActiveTab(tab.key as TabType)}
        >
          <Ionicons name={tab.icon as any} size={20} color={activeTab === tab.key ? '#3FA9F5' : '#9CA3AF'} />
          <Text style={[styles.tabText, activeTab === tab.key && styles.activeTabText]}>{tab.label}</Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );

  const renderDashboard = () => (
    <ScrollView style={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
      <Text style={styles.sectionTitle}>Genel Bakış</Text>
      
      <View style={styles.statsGrid}>
        <View style={[styles.statCard, { backgroundColor: '#1E3A5F' }]}>
          <Ionicons name="people" size={28} color="#3FA9F5" />
          <Text style={styles.statNumber}>{stats?.users?.total || 0}</Text>
          <Text style={styles.statLabel}>Toplam Kullanıcı</Text>
        </View>
        
        <View style={[styles.statCard, { backgroundColor: '#1E3A5F' }]}>
          <Ionicons name="car" size={28} color="#10B981" />
          <Text style={styles.statNumber}>{stats?.users?.drivers || 0}</Text>
          <Text style={styles.statLabel}>Sürücü</Text>
        </View>
        
        <View style={[styles.statCard, { backgroundColor: '#1E3A5F' }]}>
          <Ionicons name="radio-button-on" size={28} color="#F59E0B" />
          <Text style={styles.statNumber}>{stats?.users?.online_drivers || 0}</Text>
          <Text style={styles.statLabel}>Online Sürücü</Text>
        </View>
        
        <View style={[styles.statCard, { backgroundColor: '#1E3A5F' }]}>
          <Ionicons name="checkmark-circle" size={28} color="#10B981" />
          <Text style={styles.statNumber}>{stats?.trips?.completed_today || 0}</Text>
          <Text style={styles.statLabel}>Bugün Tamamlanan</Text>
        </View>
        
        <View style={[styles.statCard, { backgroundColor: '#1E3A5F' }]}>
          <Ionicons name="time" size={28} color="#F59E0B" />
          <Text style={styles.statNumber}>{stats?.trips?.active || 0}</Text>
          <Text style={styles.statLabel}>Aktif Yolculuk</Text>
        </View>
        
        <View style={[styles.statCard, { backgroundColor: '#1E3A5F' }]}>
          <Ionicons name="hourglass" size={28} color="#EF4444" />
          <Text style={styles.statNumber}>{stats?.trips?.waiting || 0}</Text>
          <Text style={styles.statLabel}>Bekleyen</Text>
        </View>
      </View>
      
      <Text style={styles.sectionTitle}>Bu Hafta</Text>
      <View style={styles.weekStats}>
        <View style={styles.weekStatItem}>
          <Text style={styles.weekStatNumber}>{stats?.trips?.completed_week || 0}</Text>
          <Text style={styles.weekStatLabel}>Tamamlanan Trip</Text>
        </View>
        <View style={styles.weekStatItem}>
          <Text style={styles.weekStatNumber}>{stats?.users?.new_today || 0}</Text>
          <Text style={styles.weekStatLabel}>Bugün Yeni Kayıt</Text>
        </View>
        <View style={styles.weekStatItem}>
          <Text style={styles.weekStatNumber}>{stats?.promos?.active || 0}</Text>
          <Text style={styles.weekStatLabel}>Aktif Promosyon</Text>
        </View>
      </View>
    </ScrollView>
  );

  const renderUsers = () => (
    <View style={styles.content}>
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color="#9CA3AF" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="İsim veya telefon ara..."
          placeholderTextColor="#9CA3AF"
          value={searchQuery}
          onChangeText={setSearchQuery}
          onSubmitEditing={() => loadUsers(1, searchQuery, userFilter)}
        />
      </View>
      
      <View style={styles.filterRow}>
        {['all', 'drivers', 'online'].map((filter) => (
          <TouchableOpacity
            key={filter}
            style={[styles.filterBtn, userFilter === filter && styles.filterBtnActive]}
            onPress={() => {
              setUserFilter(filter as any);
              loadUsers(1, searchQuery, filter);
            }}
          >
            <Text style={[styles.filterBtnText, userFilter === filter && styles.filterBtnTextActive]}>
              {filter === 'all' ? 'Tümü' : filter === 'drivers' ? 'Sürücüler' : 'Online'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      
      <FlatList
        data={users}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        onEndReached={() => {
          if (users.length < usersTotal) {
            loadUsers(usersPage + 1, searchQuery, userFilter);
          }
        }}
        onEndReachedThreshold={0.5}
        renderItem={({ item }) => (
          <View style={styles.userCard}>
            <View style={styles.userInfo}>
              <View style={styles.userHeader}>
                <Text style={styles.userName}>{item.name || 'İsimsiz'}</Text>
                {item.is_driver && (
                  <View style={[styles.badge, item.is_online ? styles.badgeOnline : styles.badgeDriver]}>
                    <Text style={styles.badgeText}>{item.is_online ? 'Online' : 'Sürücü'}</Text>
                  </View>
                )}
              </View>
              <Text style={styles.userPhone}>{item.phone}</Text>
              <Text style={styles.userMeta}>
                ⭐ {item.rating?.toFixed(1) || '5.0'} • {item.total_trips || 0} trip • {item.city || 'Şehir yok'}
              </Text>
              {item.driver_active_until && (
                <Text style={styles.userActiveUntil}>
                  Aktif: {new Date(item.driver_active_until).toLocaleString('tr-TR')}
                </Text>
              )}
            </View>
            
            <View style={styles.userActions}>
              {item.is_driver && (
                <TouchableOpacity
                  style={styles.actionBtn}
                  onPress={() => {
                    setSelectedUser(item);
                    setAddTimeModalVisible(true);
                  }}
                >
                  <Ionicons name="time-outline" size={20} color="#10B981" />
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={styles.actionBtn}
                onPress={() => banUser(item.id, item.is_active)}
              >
                <Ionicons name={item.is_active ? 'ban-outline' : 'checkmark-circle-outline'} size={20} color={item.is_active ? '#EF4444' : '#10B981'} />
              </TouchableOpacity>
            </View>
          </View>
        )}
        ListEmptyComponent={
          <Text style={styles.emptyText}>Kullanıcı bulunamadı</Text>
        }
      />
    </View>
  );

  const renderPromos = () => (
    <View style={styles.content}>
      <TouchableOpacity style={styles.addButton} onPress={() => setPromoModalVisible(true)}>
        <Ionicons name="add" size={24} color="white" />
        <Text style={styles.addButtonText}>Yeni Promosyon Kodu</Text>
      </TouchableOpacity>
      
      <FlatList
        data={promos}
        keyExtractor={(item, index) => item.id || index.toString()}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        renderItem={({ item }) => (
          <View style={styles.promoCard}>
            <View style={styles.promoHeader}>
              <Text style={styles.promoCode}>{item.code}</Text>
              <View style={[styles.badge, item.is_active ? styles.badgeOnline : styles.badgeInactive]}>
                <Text style={styles.badgeText}>{item.is_active ? 'Aktif' : 'Pasif'}</Text>
              </View>
            </View>
            <Text style={styles.promoDetails}>
              {item.hours} Saat • {item.used_count}/{item.max_uses} Kullanım
            </Text>
            {item.description && <Text style={styles.promoDesc}>{item.description}</Text>}
          </View>
        )}
        ListEmptyComponent={
          <Text style={styles.emptyText}>Promosyon kodu bulunamadı</Text>
        }
      />
    </View>
  );

  const renderNotifications = () => (
    <View style={styles.content}>
      <TouchableOpacity style={styles.addButton} onPress={() => setNotifModalVisible(true)}>
        <Ionicons name="send" size={24} color="white" />
        <Text style={styles.addButtonText}>Bildirim Gönder</Text>
      </TouchableOpacity>
      
      <FlatList
        data={notifications}
        keyExtractor={(item, index) => item.id || index.toString()}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        renderItem={({ item }) => (
          <View style={styles.notifCard}>
            <Text style={styles.notifTitle}>{item.title}</Text>
            <Text style={styles.notifBody}>{item.body}</Text>
            <Text style={styles.notifMeta}>
              Hedef: {item.target === 'all' ? 'Herkes' : item.target === 'drivers' ? 'Sürücüler' : item.target} 
              {item.created_at && ` • ${new Date(item.created_at).toLocaleString('tr-TR')}`}
            </Text>
          </View>
        )}
        ListEmptyComponent={
          <Text style={styles.emptyText}>Bildirim geçmişi boş</Text>
        }
      />
    </View>
  );

  const renderSettings = () => (
    <ScrollView style={styles.content}>
      <Text style={styles.sectionTitle}>Dispatch Ayarları</Text>
      <View style={styles.settingItem}>
        <Text style={styles.settingLabel}>Eşleşme Yarıçapı</Text>
        <Text style={styles.settingValue}>15 km</Text>
      </View>
      <View style={styles.settingItem}>
        <Text style={styles.settingLabel}>Max Sürücü Sayısı</Text>
        <Text style={styles.settingValue}>5</Text>
      </View>
      <View style={styles.settingItem}>
        <Text style={styles.settingLabel}>Teklif Timeout</Text>
        <Text style={styles.settingValue}>20 saniye</Text>
      </View>
      
      <Text style={styles.sectionTitle}>Sürücü Kuralları</Text>
      <View style={styles.settingItem}>
        <Text style={styles.settingLabel}>Minimum Aktif Süre</Text>
        <Text style={styles.settingValue}>3 saat</Text>
      </View>
    </ScrollView>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0F172A" />
      
      <LinearGradient colors={['#0F172A', '#1E293B']} style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="white" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Admin Panel</Text>
        <View style={{ width: 40 }} />
      </LinearGradient>
      
      {renderTabs()}
      
      {activeTab === 'dashboard' && renderDashboard()}
      {(activeTab === 'users' || activeTab === 'drivers') && renderUsers()}
      {activeTab === 'promos' && renderPromos()}
      {activeTab === 'notifications' && renderNotifications()}
      {activeTab === 'settings' && renderSettings()}
      
      {/* Promosyon Modal */}
      <Modal visible={promoModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Yeni Promosyon Kodu</Text>
            
            <Text style={styles.inputLabel}>Kod (Boş bırakılırsa otomatik)</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Örn: LEYLEK2024"
              placeholderTextColor="#9CA3AF"
              value={newPromo.code}
              onChangeText={(text) => setNewPromo({ ...newPromo, code: text.toUpperCase() })}
              autoCapitalize="characters"
            />
            
            <Text style={styles.inputLabel}>Süre (Saat)</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="3"
              placeholderTextColor="#9CA3AF"
              keyboardType="numeric"
              value={newPromo.hours.toString()}
              onChangeText={(text) => setNewPromo({ ...newPromo, hours: parseInt(text) || 0 })}
            />
            
            <Text style={styles.inputLabel}>Maksimum Kullanım</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="1"
              placeholderTextColor="#9CA3AF"
              keyboardType="numeric"
              value={newPromo.max_uses.toString()}
              onChangeText={(text) => setNewPromo({ ...newPromo, max_uses: parseInt(text) || 1 })}
            />
            
            <Text style={styles.inputLabel}>Açıklama</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Promosyon açıklaması..."
              placeholderTextColor="#9CA3AF"
              value={newPromo.description}
              onChangeText={(text) => setNewPromo({ ...newPromo, description: text })}
            />
            
            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setPromoModalVisible(false)}>
                <Text style={styles.cancelBtnText}>İptal</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.submitBtn} onPress={createPromo}>
                <Text style={styles.submitBtnText}>Oluştur</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      
      {/* Bildirim Modal */}
      <Modal visible={notifModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Bildirim Gönder</Text>
            
            <Text style={styles.inputLabel}>Başlık</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Bildirim başlığı"
              placeholderTextColor="#9CA3AF"
              value={newNotif.title}
              onChangeText={(text) => setNewNotif({ ...newNotif, title: text })}
            />
            
            <Text style={styles.inputLabel}>Mesaj</Text>
            <TextInput
              style={[styles.modalInput, { height: 80 }]}
              placeholder="Bildirim mesajı..."
              placeholderTextColor="#9CA3AF"
              multiline
              value={newNotif.body}
              onChangeText={(text) => setNewNotif({ ...newNotif, body: text })}
            />
            
            <Text style={styles.inputLabel}>Hedef</Text>
            <View style={styles.targetRow}>
              {['all', 'drivers', 'online_drivers'].map((target) => (
                <TouchableOpacity
                  key={target}
                  style={[styles.targetBtn, newNotif.target === target && styles.targetBtnActive]}
                  onPress={() => setNewNotif({ ...newNotif, target })}
                >
                  <Text style={[styles.targetBtnText, newNotif.target === target && styles.targetBtnTextActive]}>
                    {target === 'all' ? 'Herkes' : target === 'drivers' ? 'Sürücüler' : 'Online'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            
            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setNotifModalVisible(false)}>
                <Text style={styles.cancelBtnText}>İptal</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.submitBtn} onPress={sendNotification}>
                <Text style={styles.submitBtnText}>Gönder</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      
      {/* Süre Ekle Modal */}
      <Modal visible={addTimeModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Sürücüye Süre Ekle</Text>
            <Text style={styles.modalSubtitle}>{selectedUser?.name || 'Sürücü'}</Text>
            
            <Text style={styles.inputLabel}>Eklenecek Süre (Saat)</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="3"
              placeholderTextColor="#9CA3AF"
              keyboardType="numeric"
              value={addTimeHours}
              onChangeText={setAddTimeHours}
            />
            
            <View style={styles.quickHours}>
              {[3, 6, 12, 24].map((h) => (
                <TouchableOpacity
                  key={h}
                  style={[styles.quickHourBtn, addTimeHours === h.toString() && styles.quickHourBtnActive]}
                  onPress={() => setAddTimeHours(h.toString())}
                >
                  <Text style={styles.quickHourText}>{h} Saat</Text>
                </TouchableOpacity>
              ))}
            </View>
            
            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setAddTimeModalVisible(false)}>
                <Text style={styles.cancelBtnText}>İptal</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.submitBtn} onPress={addDriverTime}>
                <Text style={styles.submitBtnText}>Ekle</Text>
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
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0F172A' },
  loadingText: { color: '#9CA3AF', marginTop: 12, fontSize: 16 },
  
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 },
  backBtn: { padding: 8 },
  headerTitle: { fontSize: 20, fontWeight: '700', color: 'white' },
  
  tabsContainer: { backgroundColor: '#1E293B', paddingVertical: 8 },
  tab: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, marginHorizontal: 4, borderRadius: 8 },
  activeTab: { backgroundColor: 'rgba(63, 169, 245, 0.15)' },
  tabText: { color: '#9CA3AF', marginLeft: 6, fontSize: 14 },
  activeTabText: { color: '#3FA9F5', fontWeight: '600' },
  
  content: { flex: 1, padding: 16 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: 'white', marginBottom: 16, marginTop: 8 },
  
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  statCard: { width: '48%', padding: 16, borderRadius: 12, marginBottom: 12, alignItems: 'center' },
  statNumber: { fontSize: 28, fontWeight: '700', color: 'white', marginTop: 8 },
  statLabel: { fontSize: 12, color: '#9CA3AF', marginTop: 4 },
  
  weekStats: { flexDirection: 'row', justifyContent: 'space-around', backgroundColor: '#1E293B', borderRadius: 12, padding: 16 },
  weekStatItem: { alignItems: 'center' },
  weekStatNumber: { fontSize: 24, fontWeight: '700', color: '#3FA9F5' },
  weekStatLabel: { fontSize: 12, color: '#9CA3AF', marginTop: 4 },
  
  searchContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1E293B', borderRadius: 12, paddingHorizontal: 12, marginBottom: 12 },
  searchIcon: { marginRight: 8 },
  searchInput: { flex: 1, color: 'white', fontSize: 16, paddingVertical: 12 },
  
  filterRow: { flexDirection: 'row', marginBottom: 12 },
  filterBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: '#1E293B', marginRight: 8 },
  filterBtnActive: { backgroundColor: '#3FA9F5' },
  filterBtnText: { color: '#9CA3AF', fontSize: 14 },
  filterBtnTextActive: { color: 'white', fontWeight: '600' },
  
  userCard: { flexDirection: 'row', backgroundColor: '#1E293B', borderRadius: 12, padding: 16, marginBottom: 12 },
  userInfo: { flex: 1 },
  userHeader: { flexDirection: 'row', alignItems: 'center' },
  userName: { fontSize: 16, fontWeight: '600', color: 'white', marginRight: 8 },
  userPhone: { fontSize: 14, color: '#9CA3AF', marginTop: 4 },
  userMeta: { fontSize: 12, color: '#6B7280', marginTop: 4 },
  userActiveUntil: { fontSize: 12, color: '#10B981', marginTop: 4 },
  userActions: { flexDirection: 'row', alignItems: 'center' },
  actionBtn: { padding: 8, marginLeft: 8 },
  
  badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 12 },
  badgeDriver: { backgroundColor: 'rgba(63, 169, 245, 0.2)' },
  badgeOnline: { backgroundColor: 'rgba(16, 185, 129, 0.2)' },
  badgeInactive: { backgroundColor: 'rgba(239, 68, 68, 0.2)' },
  badgeText: { fontSize: 10, fontWeight: '600', color: 'white' },
  
  addButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#3FA9F5', borderRadius: 12, padding: 14, marginBottom: 16 },
  addButtonText: { color: 'white', fontSize: 16, fontWeight: '600', marginLeft: 8 },
  
  promoCard: { backgroundColor: '#1E293B', borderRadius: 12, padding: 16, marginBottom: 12 },
  promoHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  promoCode: { fontSize: 18, fontWeight: '700', color: '#3FA9F5' },
  promoDetails: { fontSize: 14, color: '#9CA3AF', marginTop: 8 },
  promoDesc: { fontSize: 12, color: '#6B7280', marginTop: 4 },
  
  notifCard: { backgroundColor: '#1E293B', borderRadius: 12, padding: 16, marginBottom: 12 },
  notifTitle: { fontSize: 16, fontWeight: '600', color: 'white' },
  notifBody: { fontSize: 14, color: '#9CA3AF', marginTop: 4 },
  notifMeta: { fontSize: 12, color: '#6B7280', marginTop: 8 },
  
  settingItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#1E293B', borderRadius: 12, padding: 16, marginBottom: 8 },
  settingLabel: { fontSize: 14, color: '#9CA3AF' },
  settingValue: { fontSize: 16, fontWeight: '600', color: 'white' },
  
  emptyText: { textAlign: 'center', color: '#6B7280', marginTop: 40, fontSize: 16 },
  
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', padding: 20 },
  modalContent: { backgroundColor: '#1E293B', borderRadius: 16, padding: 20 },
  modalTitle: { fontSize: 20, fontWeight: '700', color: 'white', marginBottom: 4, textAlign: 'center' },
  modalSubtitle: { fontSize: 14, color: '#9CA3AF', marginBottom: 20, textAlign: 'center' },
  inputLabel: { fontSize: 14, color: '#9CA3AF', marginBottom: 8, marginTop: 12 },
  modalInput: { backgroundColor: '#0F172A', borderRadius: 12, padding: 14, color: 'white', fontSize: 16 },
  modalButtons: { flexDirection: 'row', marginTop: 20 },
  cancelBtn: { flex: 1, padding: 14, borderRadius: 12, backgroundColor: '#374151', marginRight: 8, alignItems: 'center' },
  cancelBtnText: { color: 'white', fontSize: 16, fontWeight: '600' },
  submitBtn: { flex: 1, padding: 14, borderRadius: 12, backgroundColor: '#3FA9F5', marginLeft: 8, alignItems: 'center' },
  submitBtnText: { color: 'white', fontSize: 16, fontWeight: '600' },
  
  targetRow: { flexDirection: 'row', marginTop: 8 },
  targetBtn: { flex: 1, padding: 10, borderRadius: 8, backgroundColor: '#0F172A', marginRight: 8, alignItems: 'center' },
  targetBtnActive: { backgroundColor: '#3FA9F5' },
  targetBtnText: { color: '#9CA3AF', fontSize: 14 },
  targetBtnTextActive: { color: 'white', fontWeight: '600' },
  
  quickHours: { flexDirection: 'row', marginTop: 12 },
  quickHourBtn: { flex: 1, padding: 10, borderRadius: 8, backgroundColor: '#0F172A', marginRight: 8, alignItems: 'center' },
  quickHourBtnActive: { backgroundColor: '#3FA9F5' },
  quickHourText: { color: 'white', fontSize: 14 },
});
