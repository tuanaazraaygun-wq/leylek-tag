/**
 * AdminPanel Component - Leylek TAG
 * v10 - Bildirim Özelliği Eklendi
 * Tüm Android cihazlarla uyumlu
 */

import React, { useState, useEffect, Component } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  RefreshControl,
  Platform,
  Alert,
  KeyboardAvoidingView,
} from 'react-native';

const API_URL = 'https://api.leylektag.com/api';

// Error Boundary
class ErrorBoundary extends Component<{children: React.ReactNode}, {hasError: boolean, error: string}> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: '' };
  }
  
  static getDerivedStateFromError(error: any) {
    return { hasError: true, error: String(error) };
  }
  
  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.errorBox}>
          <Text style={styles.errorTitle}>Hata Oluştu</Text>
          <Text style={styles.errorMsg}>{this.state.error}</Text>
          <TouchableOpacity 
            style={styles.retryBtn}
            onPress={() => this.setState({ hasError: false, error: '' })}
          >
            <Text style={styles.retryText}>Tekrar Dene</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return this.props.children;
  }
}

interface Props {
  adminPhone: string;
  onClose: () => void;
}

function AdminContent({ adminPhone, onClose }: Props) {
  const [tab, setTab] = useState('dashboard');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState<any>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [trips, setTrips] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  
  // Notification states
  const [notifTitle, setNotifTitle] = useState('');
  const [notifBody, setNotifBody] = useState('');
  const [notifTarget, setNotifTarget] = useState<'all' | 'drivers' | 'passengers'>('all');
  const [sendingNotif, setSendingNotif] = useState(false);
  
  // KYC states
  const [pendingKYC, setPendingKYC] = useState<any[]>([]);
  const [approvingKYC, setApprovingKYC] = useState<string | null>(null);

  useEffect(() => {
    loadAll();
  }, []);
  
  const loadKYC = async () => {
    try {
      const res = await fetch(`${API_URL}/admin/kyc/pending?admin_phone=${adminPhone}`);
      const data = await res.json();
      if (data.success) {
        setPendingKYC(data.requests || []);
      }
    } catch (e) {
      console.log('KYC yüklenemedi:', e);
    }
  };
  
  const approveKYC = async (userId: string) => {
    setApprovingKYC(userId);
    try {
      const res = await fetch(`${API_URL}/admin/kyc/approve?admin_phone=${adminPhone}&user_id=${userId}`, {
        method: 'POST'
      });
      const data = await res.json();
      if (data.success) {
        Alert.alert('Başarılı', 'Sürücü onaylandı!');
        loadKYC();
      } else {
        Alert.alert('Hata', data.detail || 'Onay başarısız');
      }
    } catch (e: any) {
      Alert.alert('Hata', e.message || 'Onay başarısız');
    }
    setApprovingKYC(null);
  };
  
  const rejectKYC = async (userId: string, reason: string) => {
    try {
      const res = await fetch(`${API_URL}/admin/kyc/reject?admin_phone=${adminPhone}&user_id=${userId}&reason=${encodeURIComponent(reason)}`, {
        method: 'POST'
      });
      const data = await res.json();
      if (data.success) {
        Alert.alert('Başarılı', 'Başvuru reddedildi');
        loadKYC();
      } else {
        Alert.alert('Hata', data.detail || 'Red başarısız');
      }
    } catch (e: any) {
      Alert.alert('Hata', e.message || 'Red başarısız');
    }
  };

  const loadAll = async () => {
    setLoading(true);
    try {
      // Dashboard
      const dashRes = await fetch(`${API_URL}/admin/dashboard/full?admin_phone=${adminPhone}`);
      const dashData = await dashRes.json();
      if (dashData.success) setStats(dashData.stats);
      
      // Users
      const usersRes = await fetch(`${API_URL}/admin/users/full?admin_phone=${adminPhone}&page=1&limit=50`);
      const usersData = await usersRes.json();
      if (usersData.success && usersData.users) setUsers(usersData.users);
      
      // Trips
      const tripsRes = await fetch(`${API_URL}/admin/trips?admin_phone=${adminPhone}&page=1&limit=50`);
      const tripsData = await tripsRes.json();
      if (tripsData.success && tripsData.trips) setTrips(tripsData.trips);
      
      // KYC
      await loadKYC();
    } catch (e) {
      console.log('Load error:', e);
    }
    setLoading(false);
    setRefreshing(false);
  };

  const refresh = () => {
    setRefreshing(true);
    loadAll();
  };

  // Send notification function
  const sendNotification = async () => {
    if (!notifTitle.trim() || !notifBody.trim()) {
      Alert.alert('Hata', 'Başlık ve mesaj gerekli');
      return;
    }
    
    setSendingNotif(true);
    try {
      const response = await fetch(
        `${API_URL}/admin/notifications/send?admin_phone=${adminPhone}&title=${encodeURIComponent(notifTitle)}&body=${encodeURIComponent(notifBody)}&target=${notifTarget}`,
        { method: 'POST' }
      );
      const data = await response.json();
      
      if (data.success) {
        Alert.alert('Başarılı', `Bildirim ${data.sent_count || 0} kişiye gönderildi`);
        setNotifTitle('');
        setNotifBody('');
      } else {
        Alert.alert('Hata', data.error || data.detail || 'Bildirim gönderilemedi');
      }
    } catch (e: any) {
      Alert.alert('Hata', e.message || 'Bildirim gönderilemedi');
    }
    setSendingNotif(false);
  };

  const filteredUsers = search
    ? users.filter(u => 
        String(u.name || '').toLowerCase().includes(search.toLowerCase()) ||
        String(u.phone || '').includes(search)
      )
    : users;

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#3B82F6" />
        <Text style={styles.loadingText}>Yükleniyor...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
          <Text style={styles.closeBtnText}>X</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Admin Panel</Text>
        <TouchableOpacity onPress={refresh} style={styles.closeBtn}>
          <Text style={styles.closeBtnText}>R</Text>
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={styles.tabRow}>
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
          style={[styles.tabBtn, tab === 'kyc' && styles.tabActive]}
          onPress={() => setTab('kyc')}
        >
          <Text style={[styles.tabText, tab === 'kyc' && styles.tabTextActive]}>Sürücü Onay</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.tabBtn, tab === 'notif' && styles.tabActive]}
          onPress={() => setTab('notif')}
        >
          <Text style={[styles.tabText, tab === 'notif' && styles.tabTextActive]}>Bildirim</Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      <ScrollView 
        style={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
      >
        {/* Dashboard */}
        {tab === 'dashboard' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Genel Bakış</Text>
            <View style={styles.statsRow}>
              <View style={styles.statBox}>
                <Text style={styles.statNum}>{stats?.users?.total || 0}</Text>
                <Text style={styles.statLabel}>Kullanıcı</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={styles.statNum}>{stats?.users?.drivers || 0}</Text>
                <Text style={styles.statLabel}>Sürücü</Text>
              </View>
            </View>
            <View style={styles.statsRow}>
              <View style={styles.statBox}>
                <Text style={styles.statNum}>{stats?.users?.online_drivers || 0}</Text>
                <Text style={styles.statLabel}>Online</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={styles.statNum}>{stats?.trips?.completed_today || 0}</Text>
                <Text style={styles.statLabel}>Bugün</Text>
              </View>
            </View>
            <View style={styles.statsRow}>
              <View style={[styles.statBox, { backgroundColor: '#1E40AF' }]}>
                <Text style={styles.statNum}>{stats?.users?.with_push_token || 0}</Text>
                <Text style={styles.statLabel}>Bildirim İzni</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={styles.statNum}>{stats?.trips?.waiting || 0}</Text>
                <Text style={styles.statLabel}>Bekleyen</Text>
              </View>
            </View>
            
            <Text style={styles.sectionTitle}>Son Yolculuklar</Text>
            {trips.slice(0, 5).map((t, i) => (
              <View key={t.id || i} style={styles.card}>
                <Text style={styles.cardTitle}>{t.pickup_location || '-'}</Text>
                <Text style={styles.cardSub}>{t.final_price || t.offered_price || 0} TL</Text>
              </View>
            ))}
          </View>
        )}

        {/* Users */}
        {tab === 'users' && (
          <View style={styles.section}>
            <TextInput
              style={styles.searchInput}
              placeholder="Ara..."
              placeholderTextColor="#888"
              value={search}
              onChangeText={setSearch}
            />
            <Text style={styles.countText}>{filteredUsers.length} kullanıcı</Text>
            {filteredUsers.slice(0, 50).map((u, i) => (
              <View key={u.id || i} style={styles.card}>
                <View style={styles.cardRow}>
                  <View style={styles.cardLeft}>
                    <Text style={styles.cardTitle}>{u.name || 'İsimsiz'}</Text>
                    <Text style={styles.cardSub}>{u.phone || ''}</Text>
                    <Text style={styles.cardMeta}>
                      {u.is_driver ? 'Sürücü' : 'Yolcu'} - {u.total_trips || 0} trip
                    </Text>
                  </View>
                  {u.is_online && (
                    <View style={styles.onlineBadge}>
                      <Text style={styles.onlineText}>Online</Text>
                    </View>
                  )}
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Trips */}
        {tab === 'trips' && (
          <View style={styles.section}>
            <Text style={styles.countText}>{trips.length} yolculuk</Text>
            {trips.slice(0, 50).map((t, i) => (
              <View key={t.id || i} style={styles.card}>
                <View style={styles.cardRow}>
                  <View style={styles.cardLeft}>
                    <Text style={styles.cardTitle} numberOfLines={1}>{t.pickup_location || '-'}</Text>
                    <Text style={styles.cardSub} numberOfLines={1}>{t.dropoff_location || '-'}</Text>
                  </View>
                  <View style={styles.cardRight}>
                    <Text style={styles.priceText}>{t.final_price || t.offered_price || 0} TL</Text>
                    <Text style={[
                      styles.statusText,
                      t.status === 'completed' ? styles.statusGreen : 
                      t.status === 'cancelled' ? styles.statusRed : styles.statusOrange
                    ]}>
                      {t.status === 'completed' ? 'Tamamlandı' : 
                       t.status === 'cancelled' ? 'İptal' : 
                       t.status === 'matched' ? 'Eşleşti' : 'Bekliyor'}
                    </Text>
                  </View>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* KYC / Sürücü Onay */}
        {tab === 'kyc' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Bekleyen Sürücü Başvuruları</Text>
            <Text style={styles.countText}>{pendingKYC.length} başvuru bekliyor</Text>
            
            {pendingKYC.length === 0 ? (
              <View style={styles.emptyBox}>
                <Text style={styles.emptyText}>Bekleyen başvuru yok</Text>
              </View>
            ) : (
              pendingKYC.map((kyc, i) => (
                <View key={kyc.user_id || i} style={styles.kycCard}>
                  <Text style={styles.kycName}>{kyc.name || 'İsimsiz'}</Text>
                  <Text style={styles.kycPhone}>{kyc.phone}</Text>
                  <Text style={styles.kycCity}>{kyc.city}</Text>
                  
                  {/* Araç Bilgileri */}
                  {kyc.driver_details && (
                    <View style={styles.kycVehicle}>
                      <Text style={styles.kycVehicleText}>
                        {kyc.driver_details.brand} {kyc.driver_details.model} - {kyc.driver_details.color}
                      </Text>
                      <Text style={styles.kycVehicleText}>
                        Plaka: {kyc.driver_details.plate}
                      </Text>
                    </View>
                  )}
                  
                  {/* Belgeler */}
                  <View style={styles.kycDocs}>
                    <Text style={styles.kycDocLabel}>Selfie: {kyc.driver_details?.selfie_url ? '✅' : '❌'}</Text>
                    <Text style={styles.kycDocLabel}>Araç Fotoğrafı: {kyc.driver_details?.car_photo_url ? '✅' : '❌'}</Text>
                    <Text style={styles.kycDocLabel}>Ehliyet: {kyc.driver_details?.license_url ? '✅' : '❌'}</Text>
                  </View>
                  
                  {/* Butonlar */}
                  <View style={styles.kycBtnRow}>
                    <TouchableOpacity
                      style={[styles.kycBtn, styles.kycApproveBtn]}
                      onPress={() => approveKYC(kyc.user_id)}
                      disabled={approvingKYC === kyc.user_id}
                    >
                      {approvingKYC === kyc.user_id ? (
                        <ActivityIndicator color="#FFF" size="small" />
                      ) : (
                        <Text style={styles.kycBtnText}>✓ Onayla</Text>
                      )}
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.kycBtn, styles.kycRejectBtn]}
                      onPress={() => {
                        Alert.prompt(
                          'Red Sebebi',
                          'Başvurunun reddedilme sebebini yazın:',
                          [
                            { text: 'İptal', style: 'cancel' },
                            { text: 'Reddet', onPress: (reason) => rejectKYC(kyc.user_id, reason || 'Belirtilmedi') }
                          ],
                          'plain-text'
                        );
                      }}
                    >
                      <Text style={styles.kycBtnText}>✗ Reddet</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            )}
          </View>
        )}

        {/* Notifications */}
        {tab === 'notif' && (
          <KeyboardAvoidingView 
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={styles.section}
          >
            <Text style={styles.sectionTitle}>Bildirim Gönder</Text>
            
            {/* Target Selection */}
            <View style={styles.targetRow}>
              <TouchableOpacity
                style={[styles.targetBtn, notifTarget === 'all' && styles.targetActive]}
                onPress={() => setNotifTarget('all')}
              >
                <Text style={[styles.targetText, notifTarget === 'all' && styles.targetTextActive]}>Herkese</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.targetBtn, notifTarget === 'drivers' && styles.targetActive]}
                onPress={() => setNotifTarget('drivers')}
              >
                <Text style={[styles.targetText, notifTarget === 'drivers' && styles.targetTextActive]}>Sürücüler</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.targetBtn, notifTarget === 'passengers' && styles.targetActive]}
                onPress={() => setNotifTarget('passengers')}
              >
                <Text style={[styles.targetText, notifTarget === 'passengers' && styles.targetTextActive]}>Yolcular</Text>
              </TouchableOpacity>
            </View>
            
            {/* Title Input */}
            <TextInput
              style={styles.notifInput}
              placeholder="Bildirim Başlığı"
              placeholderTextColor="#64748B"
              value={notifTitle}
              onChangeText={setNotifTitle}
              maxLength={100}
            />
            
            {/* Body Input */}
            <TextInput
              style={[styles.notifInput, styles.notifBodyInput]}
              placeholder="Bildirim Mesajı"
              placeholderTextColor="#64748B"
              value={notifBody}
              onChangeText={setNotifBody}
              multiline
              numberOfLines={4}
              maxLength={500}
              textAlignVertical="top"
            />
            
            {/* Send Button */}
            <TouchableOpacity
              style={[styles.sendBtn, sendingNotif && styles.sendBtnDisabled]}
              onPress={sendNotification}
              disabled={sendingNotif}
            >
              {sendingNotif ? (
                <ActivityIndicator color="#FFF" size="small" />
              ) : (
                <Text style={styles.sendBtnText}>Bildirimi Gönder</Text>
              )}
            </TouchableOpacity>
            
            {/* Info Box */}
            <View style={styles.infoBox}>
              <Text style={styles.infoTitle}>Bilgi</Text>
              <Text style={styles.infoText}>
                Push bildirimleri yalnızca uygulamayı yüklemiş ve bildirim izni vermiş kullanıcılara gönderilir.
              </Text>
            </View>
          </KeyboardAvoidingView>
        )}

        <View style={styles.bottomPadding} />
      </ScrollView>
    </View>
  );
}

export default function AdminPanel(props: Props) {
  return (
    <ErrorBoundary>
      <AdminContent {...props} />
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  center: {
    flex: 1,
    backgroundColor: '#0F172A',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#FFF',
    marginTop: 15,
    fontSize: 16,
  },
  errorBox: {
    flex: 1,
    backgroundColor: '#0F172A',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorTitle: {
    color: '#EF4444',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  errorMsg: {
    color: '#FFF',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 20,
  },
  retryBtn: {
    backgroundColor: '#3B82F6',
    paddingHorizontal: 30,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1E293B',
    paddingTop: Platform.OS === 'ios' ? 50 : 40,
    paddingBottom: 15,
    paddingHorizontal: 15,
  },
  closeBtn: {
    width: 44,
    height: 44,
    backgroundColor: '#334155',
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeBtnText: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  title: {
    color: '#FFF',
    fontSize: 20,
    fontWeight: '700',
  },
  tabRow: {
    flexDirection: 'row',
    backgroundColor: '#1E293B',
    paddingHorizontal: 10,
    paddingBottom: 10,
  },
  tabBtn: {
    flex: 1,
    backgroundColor: '#334155',
    marginHorizontal: 3,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  tabActive: {
    backgroundColor: '#3B82F6',
  },
  tabText: {
    color: '#94A3B8',
    fontSize: 13,
    fontWeight: '600',
  },
  tabTextActive: {
    color: '#FFF',
  },
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
    marginTop: 5,
  },
  statsRow: {
    flexDirection: 'row',
    marginBottom: 10,
  },
  statBox: {
    flex: 1,
    backgroundColor: '#1E293B',
    marginHorizontal: 5,
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
  },
  statNum: {
    color: '#FFF',
    fontSize: 26,
    fontWeight: '700',
  },
  statLabel: {
    color: '#94A3B8',
    fontSize: 12,
    marginTop: 5,
  },
  searchInput: {
    backgroundColor: '#1E293B',
    color: '#FFF',
    paddingHorizontal: 15,
    paddingVertical: 12,
    borderRadius: 8,
    fontSize: 16,
    marginBottom: 10,
  },
  countText: {
    color: '#94A3B8',
    fontSize: 14,
    marginBottom: 10,
  },
  card: {
    backgroundColor: '#1E293B',
    padding: 15,
    borderRadius: 10,
    marginBottom: 10,
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cardLeft: {
    flex: 1,
  },
  cardRight: {
    alignItems: 'flex-end',
  },
  cardTitle: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  cardSub: {
    color: '#94A3B8',
    fontSize: 14,
    marginTop: 3,
  },
  cardMeta: {
    color: '#64748B',
    fontSize: 12,
    marginTop: 5,
  },
  priceText: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '700',
  },
  statusText: {
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
  bottomPadding: {
    height: 50,
  },
  // Notification styles
  targetRow: {
    flexDirection: 'row',
    marginBottom: 15,
  },
  targetBtn: {
    flex: 1,
    backgroundColor: '#1E293B',
    marginHorizontal: 3,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  targetActive: {
    backgroundColor: '#3B82F6',
    borderColor: '#3B82F6',
  },
  targetText: {
    color: '#94A3B8',
    fontSize: 13,
    fontWeight: '600',
  },
  targetTextActive: {
    color: '#FFF',
  },
  notifInput: {
    backgroundColor: '#1E293B',
    color: '#FFF',
    paddingHorizontal: 15,
    paddingVertical: 14,
    borderRadius: 10,
    fontSize: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#334155',
  },
  notifBodyInput: {
    height: 120,
    paddingTop: 14,
  },
  sendBtn: {
    backgroundColor: '#3B82F6',
    paddingVertical: 16,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 5,
  },
  sendBtnDisabled: {
    backgroundColor: '#64748B',
  },
  sendBtnText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
  },
  infoBox: {
    backgroundColor: '#1E293B',
    padding: 15,
    borderRadius: 10,
    marginTop: 20,
    borderLeftWidth: 4,
    borderLeftColor: '#3B82F6',
  },
  infoTitle: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 5,
  },
  infoText: {
    color: '#94A3B8',
    fontSize: 13,
    lineHeight: 20,
  },
  // KYC Styles
  kycCard: {
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 15,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#F59E0B',
  },
  kycName: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  kycPhone: {
    color: '#94A3B8',
    fontSize: 14,
    marginBottom: 2,
  },
  kycCity: {
    color: '#3B82F6',
    fontSize: 13,
    marginBottom: 10,
  },
  kycVehicle: {
    backgroundColor: '#334155',
    borderRadius: 8,
    padding: 10,
    marginBottom: 10,
  },
  kycVehicleText: {
    color: '#FFF',
    fontSize: 13,
    marginBottom: 2,
  },
  kycDocs: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 12,
  },
  kycDocLabel: {
    color: '#94A3B8',
    fontSize: 12,
    backgroundColor: '#334155',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 4,
  },
  kycBtnRow: {
    flexDirection: 'row',
    gap: 10,
  },
  kycBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  kycApproveBtn: {
    backgroundColor: '#10B981',
  },
  kycRejectBtn: {
    backgroundColor: '#EF4444',
  },
  kycBtnText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '700',
  },
  emptyBox: {
    backgroundColor: '#1E293B',
    padding: 30,
    borderRadius: 12,
    alignItems: 'center',
  },
  emptyText: {
    color: '#64748B',
    fontSize: 14,
  },
});
