/**
 * Admin Panel - Leylek TAG
 * Sadece 5326497412 numarası erişebilir
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
} from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';

const BACKEND_URL = Constants.expoConfig?.extra?.EXPO_PUBLIC_BACKEND_URL 
  || process.env.EXPO_PUBLIC_BACKEND_URL 
  || 'https://ride-completion.preview.emergentagent.com';
const API_URL = `${BACKEND_URL}/api`;

interface User {
  id: string;
  name: string;
  phone: string;
  role: string;
  rating: number;
  is_verified: boolean;
  is_banned?: boolean;
  created_at: string;
  last_login?: string;
}

interface Tag {
  id: string;
  passenger_id: string;
  driver_id?: string;
  status: string;
  pickup_location: string;
  dropoff_location: string;
  final_price?: number;
  created_at: string;
  users?: { name: string; phone: string };
}

interface PricingSettings {
  min_price_per_km_normal: number;
  max_price_per_km_normal: number;
  min_price_per_km_peak: number;
  max_price_per_km_peak: number;
  minimum_price: number;
  driver_pickup_per_km: number;
}

interface DashboardStats {
  total_users: number;
  active_users_24h: number;
  active_tags: number;
  today_completed: number;
  today_revenue: number;
}

export default function AdminScreen() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminPhone, setAdminPhone] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  
  // Dashboard data
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [activeUsers, setActiveUsers] = useState<User[]>([]);
  const [activeTags, setActiveTags] = useState<Tag[]>([]);
  const [recentMatches, setRecentMatches] = useState<Tag[]>([]);
  const [pricing, setPricing] = useState<PricingSettings | null>(null);
  
  // UI States
  const [activeTab, setActiveTab] = useState<'dashboard' | 'users' | 'tags' | 'pricing'>('dashboard');
  const [pricingModalVisible, setPricingModalVisible] = useState(false);
  const [editPricing, setEditPricing] = useState<PricingSettings | null>(null);

  // Check admin status on mount
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
      const phone = user.phone?.replace('+90', '').replace('+', '').replace(' ', '').trim();
      setAdminPhone(phone);
      
      // Check admin from API
      const response = await fetch(`${API_URL}/admin/check?phone=${phone}`);
      const data = await response.json();
      
      if (data.is_admin) {
        setIsAdmin(true);
        loadDashboard(phone);
      } else {
        Alert.alert('Erişim Engellendi', 'Admin yetkisi gerekli');
        router.replace('/');
      }
    } catch (error) {
      console.error('Admin check error:', error);
      Alert.alert('Hata', 'Yetki kontrolü başarısız');
      router.replace('/');
    }
  };

  const loadDashboard = async (phone: string) => {
    setIsLoading(true);
    try {
      const response = await fetch(`${API_URL}/admin/dashboard?phone=${phone}`);
      const data = await response.json();
      
      if (data.success) {
        setStats(data.stats);
        setActiveUsers(data.active_users || []);
        setActiveTags(data.active_tags || []);
        setRecentMatches(data.recent_matches || []);
        setPricing(data.pricing_settings);
      }
    } catch (error) {
      console.error('Dashboard load error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadDashboard(adminPhone);
    setRefreshing(false);
  }, [adminPhone]);

  const handleUserAction = async (userId: string, action: string, value?: number) => {
    try {
      const response = await fetch(`${API_URL}/admin/user/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: adminPhone, user_id: userId, action, value }),
      });
      const data = await response.json();
      
      if (data.success) {
        Alert.alert('Başarılı', data.message);
        onRefresh();
      } else {
        Alert.alert('Hata', data.error || 'İşlem başarısız');
      }
    } catch (error) {
      Alert.alert('Hata', 'İşlem başarısız');
    }
  };

  const handleTagAction = async (tagId: string, action: string) => {
    try {
      const response = await fetch(`${API_URL}/admin/tag/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: adminPhone, tag_id: tagId, action }),
      });
      const data = await response.json();
      
      if (data.success) {
        Alert.alert('Başarılı', data.message);
        onRefresh();
      } else {
        Alert.alert('Hata', data.error || 'İşlem başarısız');
      }
    } catch (error) {
      Alert.alert('Hata', 'İşlem başarısız');
    }
  };

  const savePricing = async () => {
    if (!editPricing) return;
    
    try {
      const response = await fetch(`${API_URL}/admin/pricing/update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: adminPhone, ...editPricing }),
      });
      const data = await response.json();
      
      if (data.success) {
        setPricing(data.settings);
        setPricingModalVisible(false);
        Alert.alert('Başarılı', 'Fiyatlandırma güncellendi');
      } else {
        Alert.alert('Hata', data.error || 'Güncelleme başarısız');
      }
    } catch (error) {
      Alert.alert('Hata', 'Güncelleme başarısız');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'waiting': return '#FFA500';
      case 'matched': return '#4CAF50';
      case 'in_progress': return '#2196F3';
      case 'completed': return '#8BC34A';
      case 'cancelled': return '#F44336';
      default: return '#999';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'waiting': return 'Bekliyor';
      case 'pending': return 'Beklemede';
      case 'offers_received': return 'Teklif Var';
      case 'matched': return 'Eşleşti';
      case 'in_progress': return 'Devam Ediyor';
      case 'completed': return 'Tamamlandı';
      case 'cancelled': return 'İptal';
      default: return status;
    }
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#E74C3C" />
        <Text style={styles.loadingText}>Admin paneli yükleniyor...</Text>
      </View>
    );
  }

  if (!isAdmin) {
    return null;
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#1a1a2e" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>🛡️ Admin Panel</Text>
        <TouchableOpacity onPress={onRefresh} style={styles.refreshButton}>
          <Ionicons name="refresh" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={styles.tabContainer}>
        {(['dashboard', 'users', 'tags', 'pricing'] as const).map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, activeTab === tab && styles.activeTab]}
            onPress={() => setActiveTab(tab)}
          >
            <Text style={[styles.tabText, activeTab === tab && styles.activeTabText]}>
              {tab === 'dashboard' ? '📊' : tab === 'users' ? '👥' : tab === 'tags' ? '🏷️' : '💰'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#E74C3C" />}
      >
        {/* Dashboard Tab */}
        {activeTab === 'dashboard' && (
          <View>
            {/* Stats Cards */}
            <View style={styles.statsGrid}>
              <View style={[styles.statCard, { backgroundColor: '#3498db' }]}>
                <Text style={styles.statNumber}>{stats?.total_users || 0}</Text>
                <Text style={styles.statLabel}>Toplam Kullanıcı</Text>
              </View>
              <View style={[styles.statCard, { backgroundColor: '#2ecc71' }]}>
                <Text style={styles.statNumber}>{stats?.active_users_24h || 0}</Text>
                <Text style={styles.statLabel}>Aktif (24s)</Text>
              </View>
              <View style={[styles.statCard, { backgroundColor: '#e74c3c' }]}>
                <Text style={styles.statNumber}>{stats?.active_tags || 0}</Text>
                <Text style={styles.statLabel}>Aktif TAG</Text>
              </View>
              <View style={[styles.statCard, { backgroundColor: '#9b59b6' }]}>
                <Text style={styles.statNumber}>{stats?.today_completed || 0}</Text>
                <Text style={styles.statLabel}>Bugün Tamamlanan</Text>
              </View>
            </View>

            {/* Today Revenue */}
            <View style={styles.revenueCard}>
              <Text style={styles.revenueLabel}>💵 Bugünkü Ciro</Text>
              <Text style={styles.revenueAmount}>{stats?.today_revenue || 0} TL</Text>
            </View>

            {/* Active Tags */}
            <Text style={styles.sectionTitle}>🔴 Anlık Aktif TAG'ler</Text>
            {activeTags.length === 0 ? (
              <Text style={styles.emptyText}>Aktif TAG yok</Text>
            ) : (
              activeTags.slice(0, 10).map((tag) => (
                <View key={tag.id} style={styles.tagCard}>
                  <View style={styles.tagHeader}>
                    <View style={[styles.statusBadge, { backgroundColor: getStatusColor(tag.status) }]}>
                      <Text style={styles.statusText}>{getStatusText(tag.status)}</Text>
                    </View>
                    <Text style={styles.tagPrice}>{tag.final_price || '?'} TL</Text>
                  </View>
                  <Text style={styles.tagRoute} numberOfLines={1}>
                    📍 {tag.pickup_location || 'Bilinmiyor'}
                  </Text>
                  <Text style={styles.tagRoute} numberOfLines={1}>
                    🎯 {tag.dropoff_location || 'Bilinmiyor'}
                  </Text>
                  <Text style={styles.tagUser}>
                    👤 {tag.users?.name || 'Bilinmiyor'} - {tag.users?.phone || ''}
                  </Text>
                  <View style={styles.tagActions}>
                    <TouchableOpacity
                      style={[styles.actionButton, { backgroundColor: '#e74c3c' }]}
                      onPress={() => Alert.alert(
                        'İptal Et',
                        'Bu yolculuğu iptal etmek istediğinize emin misiniz?',
                        [
                          { text: 'Vazgeç', style: 'cancel' },
                          { text: 'İptal Et', onPress: () => handleTagAction(tag.id, 'cancel') }
                        ]
                      )}
                    >
                      <Text style={styles.actionButtonText}>İptal Et</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.actionButton, { backgroundColor: '#27ae60' }]}
                      onPress={() => handleTagAction(tag.id, 'complete')}
                    >
                      <Text style={styles.actionButtonText}>Tamamla</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            )}

            {/* Recent Matches */}
            <Text style={styles.sectionTitle}>🤝 Son Eşleşmeler</Text>
            {recentMatches.length === 0 ? (
              <Text style={styles.emptyText}>Eşleşme yok</Text>
            ) : (
              recentMatches.slice(0, 5).map((match) => (
                <View key={match.id} style={styles.matchCard}>
                  <Text style={styles.matchText}>
                    👤 {match.users?.name || 'Yolcu'} ↔️ 🚗 Sürücü
                  </Text>
                  <Text style={styles.matchPrice}>{match.final_price || '?'} TL</Text>
                </View>
              ))
            )}
          </View>
        )}

        {/* Users Tab */}
        {activeTab === 'users' && (
          <View>
            <Text style={styles.sectionTitle}>👥 Aktif Kullanıcılar (24 Saat)</Text>
            {activeUsers.length === 0 ? (
              <Text style={styles.emptyText}>Aktif kullanıcı yok</Text>
            ) : (
              activeUsers.map((user) => (
                <View key={user.id} style={styles.userCard}>
                  <View style={styles.userInfo}>
                    <Text style={styles.userName}>{user.name || 'İsimsiz'}</Text>
                    <Text style={styles.userPhone}>{user.phone}</Text>
                    <View style={styles.userMeta}>
                      <Text style={styles.userRole}>{user.role === 'driver' ? '🚗 Sürücü' : '👤 Yolcu'}</Text>
                      <Text style={styles.userRating}>⭐ {user.rating?.toFixed(1) || '5.0'}</Text>
                      {user.is_verified && <Text style={styles.verified}>✓ Onaylı</Text>}
                      {user.is_banned && <Text style={styles.banned}>🚫 Yasaklı</Text>}
                    </View>
                  </View>
                  <View style={styles.userActions}>
                    <TouchableOpacity
                      style={[styles.smallButton, { backgroundColor: user.is_banned ? '#27ae60' : '#e74c3c' }]}
                      onPress={() => handleUserAction(user.id, user.is_banned ? 'unban' : 'ban')}
                    >
                      <Text style={styles.smallButtonText}>{user.is_banned ? 'Yasağı Kaldır' : 'Yasakla'}</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            )}
          </View>
        )}

        {/* Tags Tab */}
        {activeTab === 'tags' && (
          <View>
            <Text style={styles.sectionTitle}>🏷️ Tüm Aktif TAG'ler</Text>
            {activeTags.map((tag) => (
              <View key={tag.id} style={styles.tagCard}>
                <View style={styles.tagHeader}>
                  <View style={[styles.statusBadge, { backgroundColor: getStatusColor(tag.status) }]}>
                    <Text style={styles.statusText}>{getStatusText(tag.status)}</Text>
                  </View>
                  <Text style={styles.tagId}>#{tag.id.slice(0, 8)}</Text>
                </View>
                <Text style={styles.tagRoute}>📍 {tag.pickup_location}</Text>
                <Text style={styles.tagRoute}>🎯 {tag.dropoff_location}</Text>
                <Text style={styles.tagPrice}>💰 {tag.final_price || '?'} TL</Text>
                <View style={styles.tagActions}>
                  <TouchableOpacity
                    style={[styles.actionButton, { backgroundColor: '#e74c3c' }]}
                    onPress={() => handleTagAction(tag.id, 'cancel')}
                  >
                    <Text style={styles.actionButtonText}>İptal</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.actionButton, { backgroundColor: '#27ae60' }]}
                    onPress={() => handleTagAction(tag.id, 'complete')}
                  >
                    <Text style={styles.actionButtonText}>Tamamla</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.actionButton, { backgroundColor: '#95a5a6' }]}
                    onPress={() => Alert.alert(
                      'Sil',
                      'Bu TAG\'i silmek istediğinize emin misiniz?',
                      [
                        { text: 'Vazgeç', style: 'cancel' },
                        { text: 'Sil', style: 'destructive', onPress: () => handleTagAction(tag.id, 'delete') }
                      ]
                    )}
                  >
                    <Text style={styles.actionButtonText}>Sil</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Pricing Tab */}
        {activeTab === 'pricing' && (
          <View>
            <Text style={styles.sectionTitle}>💰 Fiyatlandırma Ayarları</Text>
            
            {pricing && (
              <View style={styles.pricingCard}>
                <View style={styles.pricingRow}>
                  <Text style={styles.pricingLabel}>Normal Saat (TL/km)</Text>
                  <Text style={styles.pricingValue}>
                    {pricing.min_price_per_km_normal} - {pricing.max_price_per_km_normal} TL
                  </Text>
                </View>
                <View style={styles.pricingRow}>
                  <Text style={styles.pricingLabel}>Yoğun Saat (TL/km)</Text>
                  <Text style={styles.pricingValue}>
                    {pricing.min_price_per_km_peak} - {pricing.max_price_per_km_peak} TL
                  </Text>
                </View>
                <View style={styles.pricingRow}>
                  <Text style={styles.pricingLabel}>Minimum Fiyat</Text>
                  <Text style={styles.pricingValue}>{pricing.minimum_price} TL</Text>
                </View>
                <View style={styles.pricingRow}>
                  <Text style={styles.pricingLabel}>Sürücü Varış (TL/km)</Text>
                  <Text style={styles.pricingValue}>{pricing.driver_pickup_per_km} TL</Text>
                </View>
                
                <TouchableOpacity
                  style={styles.editPricingButton}
                  onPress={() => {
                    setEditPricing({ ...pricing });
                    setPricingModalVisible(true);
                  }}
                >
                  <Ionicons name="create-outline" size={20} color="#fff" />
                  <Text style={styles.editPricingText}>Fiyatları Düzenle</Text>
                </TouchableOpacity>
              </View>
            )}

            <View style={styles.infoCard}>
              <Text style={styles.infoTitle}>ℹ️ Fiyat Hesaplama</Text>
              <Text style={styles.infoText}>
                • Yolculuk ücreti = Mesafe × KM Fiyatı{'\n'}
                • Minimum fiyat altına düşmez{'\n'}
                • Yoğun saatler: 07:00-10:00, 17:00-20:00{'\n'}
                • Sürücü varış ücreti ayrıca eklenir
              </Text>
            </View>
          </View>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Pricing Edit Modal */}
      <Modal
        visible={pricingModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setPricingModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>💰 Fiyatları Düzenle</Text>
            
            {editPricing && (
              <ScrollView style={styles.modalScroll}>
                <Text style={styles.inputLabel}>Normal Saat Min (TL/km)</Text>
                <TextInput
                  style={styles.input}
                  keyboardType="numeric"
                  value={String(editPricing.min_price_per_km_normal)}
                  onChangeText={(v) => setEditPricing({ ...editPricing, min_price_per_km_normal: parseInt(v) || 0 })}
                />
                
                <Text style={styles.inputLabel}>Normal Saat Max (TL/km)</Text>
                <TextInput
                  style={styles.input}
                  keyboardType="numeric"
                  value={String(editPricing.max_price_per_km_normal)}
                  onChangeText={(v) => setEditPricing({ ...editPricing, max_price_per_km_normal: parseInt(v) || 0 })}
                />
                
                <Text style={styles.inputLabel}>Yoğun Saat Min (TL/km)</Text>
                <TextInput
                  style={styles.input}
                  keyboardType="numeric"
                  value={String(editPricing.min_price_per_km_peak)}
                  onChangeText={(v) => setEditPricing({ ...editPricing, min_price_per_km_peak: parseInt(v) || 0 })}
                />
                
                <Text style={styles.inputLabel}>Yoğun Saat Max (TL/km)</Text>
                <TextInput
                  style={styles.input}
                  keyboardType="numeric"
                  value={String(editPricing.max_price_per_km_peak)}
                  onChangeText={(v) => setEditPricing({ ...editPricing, max_price_per_km_peak: parseInt(v) || 0 })}
                />
                
                <Text style={styles.inputLabel}>Minimum Fiyat (TL)</Text>
                <TextInput
                  style={styles.input}
                  keyboardType="numeric"
                  value={String(editPricing.minimum_price)}
                  onChangeText={(v) => setEditPricing({ ...editPricing, minimum_price: parseInt(v) || 0 })}
                />
                
                <Text style={styles.inputLabel}>Sürücü Varış (TL/km)</Text>
                <TextInput
                  style={styles.input}
                  keyboardType="numeric"
                  value={String(editPricing.driver_pickup_per_km)}
                  onChangeText={(v) => setEditPricing({ ...editPricing, driver_pickup_per_km: parseInt(v) || 0 })}
                />
              </ScrollView>
            )}
            
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: '#95a5a6' }]}
                onPress={() => setPricingModalVisible(false)}
              >
                <Text style={styles.modalButtonText}>İptal</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: '#27ae60' }]}
                onPress={savePricing}
              >
                <Text style={styles.modalButtonText}>Kaydet</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a2e',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1a1a2e',
  },
  loadingText: {
    color: '#fff',
    marginTop: 16,
    fontSize: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#16213e',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  refreshButton: {
    padding: 8,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#16213e',
    paddingHorizontal: 8,
    paddingBottom: 8,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 8,
    marginHorizontal: 4,
  },
  activeTab: {
    backgroundColor: '#E74C3C',
  },
  tabText: {
    fontSize: 20,
  },
  activeTabText: {
    fontWeight: 'bold',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 16,
  },
  statCard: {
    width: '48%',
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
    marginRight: '2%',
  },
  statNumber: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
  },
  statLabel: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 4,
  },
  revenueCard: {
    backgroundColor: '#f39c12',
    padding: 20,
    borderRadius: 12,
    marginBottom: 16,
    alignItems: 'center',
  },
  revenueLabel: {
    fontSize: 14,
    color: '#fff',
  },
  revenueAmount: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 16,
    marginBottom: 12,
  },
  emptyText: {
    color: '#999',
    textAlign: 'center',
    padding: 20,
  },
  tagCard: {
    backgroundColor: '#16213e',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  tagHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  tagId: {
    color: '#999',
    fontSize: 12,
  },
  tagPrice: {
    color: '#f39c12',
    fontSize: 16,
    fontWeight: 'bold',
  },
  tagRoute: {
    color: '#ddd',
    fontSize: 14,
    marginBottom: 4,
  },
  tagUser: {
    color: '#999',
    fontSize: 12,
    marginTop: 8,
  },
  tagActions: {
    flexDirection: 'row',
    marginTop: 12,
    gap: 8,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  actionButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 12,
  },
  matchCard: {
    backgroundColor: '#16213e',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  matchText: {
    color: '#fff',
    fontSize: 14,
  },
  matchPrice: {
    color: '#f39c12',
    fontWeight: 'bold',
  },
  userCard: {
    backgroundColor: '#16213e',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  userPhone: {
    color: '#999',
    fontSize: 14,
    marginTop: 2,
  },
  userMeta: {
    flexDirection: 'row',
    marginTop: 8,
    gap: 12,
  },
  userRole: {
    color: '#3498db',
    fontSize: 12,
  },
  userRating: {
    color: '#f39c12',
    fontSize: 12,
  },
  verified: {
    color: '#27ae60',
    fontSize: 12,
  },
  banned: {
    color: '#e74c3c',
    fontSize: 12,
  },
  userActions: {
    marginLeft: 12,
  },
  smallButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
  },
  smallButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  pricingCard: {
    backgroundColor: '#16213e',
    padding: 16,
    borderRadius: 12,
  },
  pricingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a4a',
  },
  pricingLabel: {
    color: '#999',
    fontSize: 14,
  },
  pricingValue: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  editPricingButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E74C3C',
    padding: 14,
    borderRadius: 8,
    marginTop: 16,
    gap: 8,
  },
  editPricingText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  infoCard: {
    backgroundColor: '#16213e',
    padding: 16,
    borderRadius: 12,
    marginTop: 16,
  },
  infoTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  infoText: {
    color: '#999',
    fontSize: 14,
    lineHeight: 22,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#1a1a2e',
    borderRadius: 16,
    padding: 20,
    maxHeight: '80%',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 20,
  },
  modalScroll: {
    maxHeight: 400,
  },
  inputLabel: {
    color: '#999',
    fontSize: 14,
    marginBottom: 4,
    marginTop: 12,
  },
  input: {
    backgroundColor: '#16213e',
    color: '#fff',
    padding: 12,
    borderRadius: 8,
    fontSize: 16,
  },
  modalButtons: {
    flexDirection: 'row',
    marginTop: 20,
    gap: 12,
  },
  modalButton: {
    flex: 1,
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  modalButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
});
