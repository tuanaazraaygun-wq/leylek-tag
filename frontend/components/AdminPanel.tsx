/**
 * AdminPanel Component - Leylek TAG
 * v10 - Bildirim Özelliği Eklendi
 * Tüm Android cihazlarla uyumlu
 */

import React, { useState, useEffect, useMemo, Component } from 'react';
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

import { ADMIN_API_BASE, normalizeTrPhone10 } from '../lib/adminApi';

function tripStatusLabel(status: string | undefined) {
  const s = String(status || '');
  const map: Record<string, string> = {
    completed: 'Tamamlandı',
    cancelled: 'İptal',
    matched: 'Eşleşti',
    in_progress: 'Yolda',
    waiting: 'Bekliyor',
    pending: 'Hazırlanıyor',
    offers_received: 'Teklifler',
  };
  return map[s] || (s ? s : '—');
}

function formatApiDetail(d: unknown): string {
  if (typeof d === 'string') return d;
  if (Array.isArray(d) && d[0] && typeof (d[0] as { msg?: string }).msg === 'string') {
    return (d[0] as { msg: string }).msg;
  }
  return '';
}

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
  const adminPhoneNorm = useMemo(() => normalizeTrPhone10(adminPhone), [adminPhone]);

  const [tab, setTab] = useState('dashboard');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [stats, setStats] = useState<any>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [trips, setTrips] = useState<any[]>([]);
  const [userTotal, setUserTotal] = useState<number | null>(null);
  const [tripTotal, setTripTotal] = useState<number | null>(null);
  const [search, setSearch] = useState('');
  
  // Notification states
  const [notifTitle, setNotifTitle] = useState('');
  const [notifBody, setNotifBody] = useState('');
  const [notifTarget, setNotifTarget] = useState<'all' | 'drivers' | 'passengers'>('all');
  const [sendingNotif, setSendingNotif] = useState(false);
  
  // KYC states
  const [pendingKYC, setPendingKYC] = useState<any[]>([]);
  const [approvingKYC, setApprovingKYC] = useState<string | null>(null);
  const [communityCityRequests, setCommunityCityRequests] = useState<any[]>([]);

  useEffect(() => {
    loadAll();
  }, [adminPhoneNorm]);
  
  const loadKYC = async () => {
    try {
      const res = await fetch(`${ADMIN_API_BASE}/admin/kyc/pending?admin_phone=${encodeURIComponent(adminPhoneNorm)}`);
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
      const res = await fetch(`${ADMIN_API_BASE}/admin/kyc/approve?admin_phone=${encodeURIComponent(adminPhoneNorm)}&user_id=${encodeURIComponent(userId)}`, {
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
      const res = await fetch(`${ADMIN_API_BASE}/admin/kyc/reject?admin_phone=${encodeURIComponent(adminPhoneNorm)}&user_id=${encodeURIComponent(userId)}&reason=${encodeURIComponent(reason)}`, {
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
  
  // 🆕 Kullanıcı Engelle
  const banUser = async (userId: string) => {
    try {
      const res = await fetch(
        `${ADMIN_API_BASE}/admin/user/ban?admin_phone=${encodeURIComponent(adminPhoneNorm)}&user_id=${encodeURIComponent(userId)}&is_banned=true`,
        { method: 'POST' }
      );
      const data = await res.json();
      if (data.success) {
        Alert.alert('Başarılı', 'Kullanıcı engellendi');
        loadAll();
      } else {
        Alert.alert('Hata', data.detail || 'Engelleme başarısız');
      }
    } catch (e: any) {
      Alert.alert('Hata', e.message || 'Engelleme başarısız');
    }
  };
  
  // 🆕 Kullanıcı Sil
  const deleteUser = async (userId: string) => {
    try {
      const res = await fetch(
        `${ADMIN_API_BASE}/admin/delete-user?admin_phone=${encodeURIComponent(adminPhoneNorm)}&user_id=${encodeURIComponent(userId)}`,
        { method: 'DELETE' }
      );
      const data = await res.json();
      if (data.success) {
        Alert.alert('Başarılı', 'Kullanıcı silindi');
        loadAll();
      } else {
        Alert.alert('Hata', data.detail || 'Silme başarısız');
      }
    } catch (e: any) {
      Alert.alert('Hata', e.message || 'Silme başarısız');
    }
  };

  const loadAll = async () => {
    setLoading(true);
    setLoadError('');
    if (!adminPhoneNorm || adminPhoneNorm.length < 10) {
      setLoadError('Geçerli admin telefonu bulunamadı (10 hane).');
      setLoading(false);
      setRefreshing(false);
      return;
    }
    const errs: string[] = [];
    try {
      const [dashRes, usersRes, tripsRes] = await Promise.all([
        fetch(`${ADMIN_API_BASE}/admin/dashboard/full?admin_phone=${encodeURIComponent(adminPhoneNorm)}`),
        fetch(`${ADMIN_API_BASE}/admin/users/full?admin_phone=${encodeURIComponent(adminPhoneNorm)}&page=1&limit=50`),
        fetch(`${ADMIN_API_BASE}/admin/trips?admin_phone=${encodeURIComponent(adminPhoneNorm)}&page=1&limit=50`),
      ]);

      const dashData = await dashRes.json().catch(() => ({}));
      if (!dashRes.ok) errs.push(`Panel HTTP ${dashRes.status}`);
      else if (!dashData.success) {
        errs.push(formatApiDetail(dashData.detail) || 'Panel verisi alınamadı');
      }
      else setStats(dashData.stats);

      const usersData = await usersRes.json().catch(() => ({}));
      if (!usersRes.ok) errs.push(`Kullanıcılar HTTP ${usersRes.status}`);
      else if (!usersData.success) errs.push('Kullanıcı listesi alınamadı');
      else {
        setUsers(usersData.users || []);
        setUserTotal(typeof usersData.total === 'number' ? usersData.total : null);
      }

      const tripsData = await tripsRes.json().catch(() => ({}));
      if (!tripsRes.ok) errs.push(`Yolculuklar HTTP ${tripsRes.status}`);
      else if (!tripsData.success) errs.push('Yolculuk listesi alınamadı');
      else {
        setTrips(tripsData.trips || []);
        setTripTotal(typeof tripsData.total === 'number' ? tripsData.total : null);
      }

      await loadKYC();

      try {
        const ccRes = await fetch(
          `${ADMIN_API_BASE}/admin/community-city-requests?admin_phone=${encodeURIComponent(adminPhoneNorm)}&limit=100`
        );
        const ccData = await ccRes.json().catch(() => ({}));
        if (ccRes.ok && ccData.success) {
          setCommunityCityRequests(ccData.requests || []);
        } else {
          setCommunityCityRequests([]);
        }
      } catch {
        setCommunityCityRequests([]);
      }
    } catch (e: any) {
      errs.push(e?.message || 'Yükleme hatası');
    }
    setLoadError(errs.filter(Boolean).join(' · '));
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
        `${ADMIN_API_BASE}/admin/notifications/send?admin_phone=${encodeURIComponent(adminPhoneNorm)}&title=${encodeURIComponent(notifTitle)}&body=${encodeURIComponent(notifBody)}&target=${encodeURIComponent(notifTarget)}`,
        { method: 'POST' }
      );
      const data = await response.json();
      
      if (data.success) {
        let msg =
          typeof data.message === 'string' && data.message.trim()
            ? data.message.trim()
            : `Bildirim ${data.sent_count ?? 0} kişiye gönderildi.`;
        if (
          typeof data.total_users === 'number' &&
          data.total_users > 0 &&
          typeof data.users_with_token === 'number'
        ) {
          msg += `\n\nHedefte ${data.total_users} kullanıcı; ${data.users_with_token} tanesinde geçerli push token var.`;
          msg +=
            '\nKendi telefonunuza gelmediyse admin hesabınız bu tokenlı kullanıcılar arasında olmayabilir — uygulamada bildirim iznini açıp giriş yapın (token kaydı yenilensin).';
        }
        Alert.alert('Başarılı', msg);
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

      {loadError ? (
        <View style={styles.errorBanner}>
          <Text style={styles.errorBannerText}>{loadError}</Text>
        </View>
      ) : null}

      {/* Tabs — yatay kaydırma (5 sekme) */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.tabScroll}
        contentContainerStyle={styles.tabRowInner}
      >
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
          style={[styles.tabBtn, tab === 'trips' && styles.tabActive]}
          onPress={() => setTab('trips')}
        >
          <Text style={[styles.tabText, tab === 'trips' && styles.tabTextActive]}>Yolculuklar</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabBtn, tab === 'kyc' && styles.tabActive]}
          onPress={() => setTab('kyc')}
        >
          <Text style={[styles.tabText, tab === 'kyc' && styles.tabTextActive]}>Sürücü Onay</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabBtn, tab === 'muhabbet' && styles.tabActive]}
          onPress={() => setTab('muhabbet')}
        >
          <Text style={[styles.tabText, tab === 'muhabbet' && styles.tabTextActive]}>Muhabbet</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabBtn, tab === 'notif' && styles.tabActive]}
          onPress={() => setTab('notif')}
        >
          <Text style={[styles.tabText, tab === 'notif' && styles.tabTextActive]}>Bildirim</Text>
        </TouchableOpacity>
      </ScrollView>

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
                <Text style={styles.statNum}>{stats?.users?.passengers ?? 0}</Text>
                <Text style={styles.statLabel}>Yolcu</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={styles.statNum}>{stats?.trips?.completed_week ?? 0}</Text>
                <Text style={styles.statLabel}>Yolculuk (7 gün)</Text>
              </View>
            </View>
            <View style={styles.statsRow}>
              <View style={styles.statBox}>
                <Text style={styles.statNum}>{stats?.users?.online_drivers || 0}</Text>
                <Text style={styles.statLabel}>Online sürücü</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={styles.statNum}>{stats?.trips?.completed_today || 0}</Text>
                <Text style={styles.statLabel}>Bugün tamamlanan</Text>
              </View>
            </View>
            <View style={styles.statsRow}>
              <View style={styles.statBox}>
                <Text style={styles.statNum}>{stats?.trips?.active ?? 0}</Text>
                <Text style={styles.statLabel}>Aktif yolculuk</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={styles.statNum}>{stats?.users?.new_today ?? 0}</Text>
                <Text style={styles.statLabel}>Yeni kayıt (bugün)</Text>
              </View>
            </View>
            <View style={styles.statsRow}>
              <View style={[styles.statBox, { backgroundColor: '#1E40AF' }]}>
                <Text style={styles.statNum}>{stats?.users?.with_push_token || 0}</Text>
                <Text style={styles.statLabel}>Bildirim İzni</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={styles.statNum}>{stats?.trips?.waiting || 0}</Text>
                <Text style={styles.statLabel}>Bekleyen talep</Text>
              </View>
            </View>
            {typeof stats?.kyc?.pending === 'number' ? (
              <View style={styles.statsRow}>
                <View style={styles.statBox}>
                  <Text style={styles.statNum}>{stats.kyc.pending}</Text>
                  <Text style={styles.statLabel}>KYC bekleyen</Text>
                </View>
                <View style={styles.statBox}>
                  <Text style={styles.statNum}>{stats?.promos?.active ?? 0}</Text>
                  <Text style={styles.statLabel}>Aktif promosyon</Text>
                </View>
              </View>
            ) : null}
            
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
            <Text style={styles.countText}>
              {filteredUsers.length} listeleniyor
              {userTotal != null ? ` · ${userTotal} toplam` : ''}
            </Text>
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
                {/* Sil / Engelle Butonları */}
                <View style={styles.userActionRow}>
                  <TouchableOpacity
                    style={styles.banBtn}
                    onPress={() => {
                      Alert.alert(
                        'Kullanıcıyı Engelle',
                        `${u.name} kullanıcısını engellemek istediğinize emin misiniz?`,
                        [
                          { text: 'İptal', style: 'cancel' },
                          { text: 'Engelle', style: 'destructive', onPress: () => banUser(u.id) }
                        ]
                      );
                    }}
                  >
                    <Text style={styles.banBtnText}>🚫 Engelle</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.deleteBtn}
                    onPress={() => {
                      Alert.alert(
                        'Kullanıcıyı Sil',
                        `${u.name} kullanıcısını silmek istediğinize emin misiniz? Bu işlem geri alınamaz.`,
                        [
                          { text: 'İptal', style: 'cancel' },
                          { text: 'Sil', style: 'destructive', onPress: () => deleteUser(u.id) }
                        ]
                      );
                    }}
                  >
                    <Text style={styles.deleteBtnText}>🗑️ Sil</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Trips */}
        {tab === 'trips' && (
          <View style={styles.section}>
            <Text style={styles.countText}>
              {trips.length} listeleniyor
              {tripTotal != null ? ` · ${tripTotal} toplam` : ''}
            </Text>
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
                      {tripStatusLabel(t.status)}
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

        {/* Leylek Muhabbeti — şehir açma talepleri */}
        {tab === 'muhabbet' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Muhabbet şehir talepleri</Text>
            <Text style={styles.subtleHelp}>
              Kullanıcılar Ankara dışındaki illerde &quot;Leylek Muhabbetine katın&quot; ile gönderdiği istekler.
            </Text>
            {communityCityRequests.length === 0 ? (
              <Text style={styles.emptyListText}>Henüz talep yok.</Text>
            ) : (
              communityCityRequests.map((r) => (
                <View key={String(r.id)} style={styles.muhabbetCard}>
                  <Text style={styles.muhabbetMeta}>
                    {r.created_at ? String(r.created_at).slice(0, 19).replace('T', ' ') : '—'}
                  </Text>
                  <Text style={styles.muhabbetTitle}>{r.reporter_name || 'Kullanıcı'}</Text>
                  <Text style={styles.muhabbetPhone}>{r.reporter_phone || ''}</Text>
                  <Text style={styles.muhabbetDetails}>{r.details || ''}</Text>
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
  tabScroll: {
    maxHeight: 52,
    backgroundColor: '#1E293B',
  },
  tabRowInner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingBottom: 10,
  },
  tabBtn: {
    minWidth: 92,
    backgroundColor: '#334155',
    marginHorizontal: 3,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  errorBanner: {
    backgroundColor: '#450A0A',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#7F1D1D',
  },
  errorBannerText: {
    color: '#FCA5A5',
    fontSize: 13,
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
  subtleHelp: {
    color: '#94A3B8',
    fontSize: 13,
    marginBottom: 12,
    lineHeight: 18,
  },
  emptyListText: {
    color: '#64748B',
    fontSize: 15,
    marginTop: 8,
  },
  muhabbetCard: {
    backgroundColor: '#1E293B',
    borderRadius: 10,
    padding: 14,
    marginBottom: 10,
    borderLeftWidth: 4,
    borderLeftColor: '#F97316',
  },
  muhabbetMeta: {
    color: '#64748B',
    fontSize: 11,
    marginBottom: 6,
  },
  muhabbetTitle: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
  },
  muhabbetPhone: {
    color: '#94A3B8',
    fontSize: 13,
    marginBottom: 8,
  },
  muhabbetDetails: {
    color: '#E2E8F0',
    fontSize: 14,
    lineHeight: 20,
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
  userActionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 10,
  },
  banBtn: {
    backgroundColor: '#B45309',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 8,
  },
  banBtnText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
  },
  deleteBtn: {
    backgroundColor: '#991B1B',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 8,
  },
  deleteBtnText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
  },
  emptyText: {
    color: '#64748B',
    fontSize: 14,
  },
});
