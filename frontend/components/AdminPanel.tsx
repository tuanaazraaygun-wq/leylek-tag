/**
 * AdminPanel Component - Leylek TAG
 * v10 - Bildirim Özelliği Eklendi
 * Tüm Android cihazlarla uyumlu
 */

import React, { useState, useEffect, useMemo, useCallback, Component } from 'react';
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
  Image,
  Modal,
  Dimensions,
} from 'react-native';

import { Ionicons } from '@expo/vector-icons';
import { ADMIN_API_BASE, normalizeTrPhone10 } from '../lib/adminApi';
import { API_BASE_URL } from '../lib/backendConfig';
import { getPersistedAccessToken } from '../lib/sessionToken';
import {
  type PendingKycRequest,
  isSafeKycImageUrl,
  kycVehicleKindLabel,
} from '../types/adminKyc';
import { callAlertPrompt } from '../lib/alertPrompt';

type KycAiTier = 'green' | 'yellow' | 'red' | 'unknown';

function kycAiWarningsList(kyc: PendingKycRequest): string[] {
  const raw = kyc.ai_warnings;
  if (Array.isArray(raw)) return raw.filter((x): x is string => typeof x === 'string' && x.trim().length > 0);
  if (typeof raw === 'string') {
    try {
      const p = JSON.parse(raw);
      return Array.isArray(p) ? p.filter((x: unknown): x is string => typeof x === 'string' && x.trim().length > 0) : [];
    } catch {
      return [];
    }
  }
  return [];
}

function kycAiTierFromRequest(kyc: PendingKycRequest): KycAiTier {
  const s = String(kyc.ai_status || '').toLowerCase().trim();
  if (s === 'green') return 'green';
  if (s === 'yellow') return 'yellow';
  if (s === 'red') return 'red';
  if (kycAiWarningsList(kyc).length > 0) return 'yellow';
  return 'unknown';
}

function kycQuickDecisionBanner(tier: KycAiTier): {
  label: string;
  sub: string;
  icon: keyof typeof Ionicons.glyphMap;
  bg: string;
  border: string;
  accent: string;
  subColor: string;
} {
  switch (tier) {
    case 'green':
      return {
        label: 'Onay önerilir',
        sub: 'AI ön kontrolü olumlu',
        icon: 'checkmark-circle',
        bg: '#052E16',
        border: '#22C55E',
        accent: '#4ADE80',
        subColor: '#86EFAC',
      };
    case 'yellow':
      return {
        label: 'Dikkatli incele',
        sub: 'AI uyarı veya belirsizlik',
        icon: 'alert-circle',
        bg: '#422006',
        border: '#FBBF24',
        accent: '#FDE047',
        subColor: '#FDE68A',
      };
    case 'red':
      return {
        label: 'Reddet önerilir',
        sub: 'AI ciddi sorun işaretledi',
        icon: 'close-circle',
        bg: '#450A0A',
        border: '#F87171',
        accent: '#FCA5A5',
        subColor: '#FECACA',
      };
    default:
      return {
        label: 'AI özeti yok',
        sub: 'Manuel inceleme',
        icon: 'analytics-outline',
        bg: '#1E293B',
        border: '#64748B',
        accent: '#E2E8F0',
        subColor: '#94A3B8',
      };
  }
}

function kycApproveHintLine(tier: KycAiTier): string {
  switch (tier) {
    case 'green':
      return 'AI sonucu iyi, hızlı onaylayabilirsiniz';
    case 'yellow':
      return 'AI uyarı verdi; belgeleri dikkatlice doğrulayın';
    case 'red':
      return 'AI sorun işaretledi; red veya ek inceleme önerilir';
    default:
      return 'Ön kontrol özeti yok; standart inceleme yapın';
  }
}

const KYC_REJECT_PRESET_REASONS = [
  'Belge kalitesi yetersiz',
  'Bilgi tutarsızlığı',
  'Ehliyet tipi uygun değil',
  'Selfie / kimlik doğrulanamadı',
  'Plaka veya araç uyumsuzluğu',
] as const;

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

function kycDisplayField(v: unknown): string {
  if (v == null || v === '') return '—';
  const s = String(v).trim();
  return s.length ? s : '—';
}

function formatKycSubmittedAt(iso: string | null | undefined): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('tr-TR');
  } catch {
    return '—';
  }
}

type KbChatLine = {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  kind?: string;
  itemIds?: string[];
};

const _KB_UUID_FULL = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function extractKbItemUuids(items: unknown[]): string[] {
  const out: string[] = [];
  for (const it of items) {
    if (!it || typeof it !== 'object') continue;
    const id = String((it as Record<string, unknown>).id ?? '').trim();
    if (_KB_UUID_FULL.test(id)) {
      out.push(id);
    }
  }
  return out;
}

function kbKindLabel(kind: string | undefined): string {
  if (!kind) return '';
  if (kind === 'error') return 'hata';
  if (kind === 'list_result') return 'liste';
  if (kind === 'search_result') return 'arama';
  if (kind === 'executed') return 'uygulandı';
  if (kind === 'clarify') return 'netlik';
  return kind;
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
  const [pendingKYC, setPendingKYC] = useState<PendingKycRequest[]>([]);
  const [approvingKYC, setApprovingKYC] = useState<string | null>(null);
  const [kycRejectModalUserId, setKycRejectModalUserId] = useState<string | null>(null);
  const [communityCityRequests, setCommunityCityRequests] = useState<any[]>([]);
  const [pendingMuhabbetGroups, setPendingMuhabbetGroups] = useState<any[]>([]);
  const [muhabbetGroupActionId, setMuhabbetGroupActionId] = useState<string | null>(null);

  const [kbChatLines, setKbChatLines] = useState<KbChatLine[]>([]);
  const [kbChatInput, setKbChatInput] = useState('');
  const [kbChatLoading, setKbChatLoading] = useState(false);
  const [kbChatErr, setKbChatErr] = useState('');

  type KycDocPreviewItem = { label: string; url: string };
  const [kycDocPreview, setKycDocPreview] = useState<{
    items: KycDocPreviewItem[];
    index: number;
    subtitle: string;
  } | null>(null);

  const closeKycDocPreview = () => setKycDocPreview(null);

  const shiftKycDocPreview = (delta: number) => {
    setKycDocPreview((prev) => {
      if (!prev || prev.items.length === 0) return prev;
      const n = (prev.index + delta + prev.items.length) % prev.items.length;
      return { ...prev, index: n };
    });
  };

  useEffect(() => {
    loadAll();
  }, [adminPhoneNorm]);
  
  const loadKYC = async () => {
    try {
      const res = await fetch(`${ADMIN_API_BASE}/admin/kyc/pending?admin_phone=${encodeURIComponent(adminPhoneNorm)}`);
      const data = await res.json();
      if (data.success) {
        const raw = Array.isArray(data.requests) ? data.requests : [];
        setPendingKYC(raw as PendingKycRequest[]);
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
  
  const rejectKYC = async (userId: string, reason: string): Promise<boolean> => {
    try {
      const res = await fetch(`${ADMIN_API_BASE}/admin/kyc/reject?admin_phone=${encodeURIComponent(adminPhoneNorm)}&user_id=${encodeURIComponent(userId)}&reason=${encodeURIComponent(reason)}`, {
        method: 'POST'
      });
      const data = await res.json();
      if (data.success) {
        Alert.alert('Başarılı', 'Başvuru reddedildi');
        loadKYC();
        return true;
      }
      Alert.alert('Hata', data.detail || 'Red başarısız');
      return false;
    } catch (e: any) {
      Alert.alert('Hata', e.message || 'Red başarısız');
      return false;
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

      try {
        const pgRes = await fetch(
          `${ADMIN_API_BASE}/admin/muhabbet/groups/pending?admin_phone=${encodeURIComponent(adminPhoneNorm)}&limit=100`
        );
        const pgData = await pgRes.json().catch(() => ({}));
        if (pgRes.ok && pgData.success) {
          setPendingMuhabbetGroups(pgData.groups || []);
        } else {
          setPendingMuhabbetGroups([]);
        }
      } catch {
        setPendingMuhabbetGroups([]);
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

  const approveMuhabbetGroup = async (gid: string) => {
    setMuhabbetGroupActionId(gid);
    try {
      const res = await fetch(
        `${ADMIN_API_BASE}/admin/muhabbet/groups/${encodeURIComponent(gid)}/approve?admin_phone=${encodeURIComponent(adminPhoneNorm)}`,
        { method: 'POST' }
      );
      const data = await res.json().catch(() => ({}));
      if (data.success) {
        Alert.alert('Tamam', typeof data.message === 'string' ? data.message : 'Grup onaylandı.');
        setPendingMuhabbetGroups((prev) => prev.filter((g) => String(g.id) !== gid));
      } else {
        Alert.alert('Hata', data.detail || 'Onaylanamadı');
      }
    } catch (e: any) {
      Alert.alert('Hata', e?.message || 'Onaylanamadı');
    }
    setMuhabbetGroupActionId(null);
  };

  const rejectMuhabbetGroup = async (gid: string) => {
    setMuhabbetGroupActionId(gid);
    try {
      const res = await fetch(
        `${ADMIN_API_BASE}/admin/muhabbet/groups/${encodeURIComponent(gid)}/reject?admin_phone=${encodeURIComponent(adminPhoneNorm)}`,
        { method: 'POST' }
      );
      const data = await res.json().catch(() => ({}));
      if (data.success) {
        Alert.alert('Tamam', typeof data.message === 'string' ? data.message : 'Grup reddedildi.');
        setPendingMuhabbetGroups((prev) => prev.filter((g) => String(g.id) !== gid));
      } else {
        Alert.alert('Hata', data.detail || 'Reddedilemedi');
      }
    } catch (e: any) {
      Alert.alert('Hata', e?.message || 'Reddedilemedi');
    }
    setMuhabbetGroupActionId(null);
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

  const sendKbNlTurn = useCallback(async () => {
    const msg = kbChatInput.trim();
    if (!msg || kbChatLoading) return;
    setKbChatLoading(true);
    setKbChatErr('');
    const uid = `m-${Date.now()}`;
    setKbChatLines((prev) => [...prev, { id: uid, role: 'user', text: msg }]);
    setKbChatInput('');
    const token = await getPersistedAccessToken();
    if (!token) {
      setKbChatErr('Oturum anahtarı yok; yeniden giriş yapın.');
      setKbChatLines((prev) => [
        ...prev,
        {
          id: `a-${Date.now()}`,
          role: 'assistant',
          text: 'Oturum anahtarı yok; yeniden giriş yapın.',
          kind: 'error',
        },
      ]);
      setKbChatLoading(false);
      return;
    }
    try {
      const res = await fetch(`${API_BASE_URL}/admin/leylek-zeka-kb/nl-turn`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ message: msg }),
      });
      const raw = await res.text();
      let data: Record<string, unknown> | null = null;
      try {
        data = raw ? (JSON.parse(raw) as Record<string, unknown>) : null;
      } catch {
        data = null;
      }
      if (!res.ok) {
        const detail = data && typeof data.detail === 'string' ? data.detail : null;
        const line = detail || `İstek başarısız (${res.status})`;
        setKbChatErr(line);
        setKbChatLines((prev) => [
          ...prev,
          { id: `a-${Date.now()}`, role: 'assistant', text: line, kind: 'error' },
        ]);
        return;
      }
      const kind =
        data && typeof data.kind === 'string' && data.kind.trim() ? String(data.kind).trim() : '';
      const assistantText =
        typeof data?.assistant_text === 'string' && data.assistant_text.trim()
          ? data.assistant_text.trim()
          : typeof data?.ok === 'boolean' && data.ok
            ? '(Yanıt metni yok)'
            : raw.slice(0, 400) || 'Beklenmeyen yanıt';
      let extra = '';
      const items = data?.items;
      if (Array.isArray(items) && items.length > 0) {
        const lines = items.slice(0, 6).map((it: unknown, i: number) => {
          const row = it && typeof it === 'object' ? (it as Record<string, unknown>) : {};
          const idShort = String(row.id ?? '').slice(0, 10);
          const body = String(row.body ?? '')
            .replace(/\s+/g, ' ')
            .slice(0, 72);
          return `${i + 1}) ${idShort} — ${body}`;
        });
        extra = `\n\n${lines.join('\n')}`;
        if (items.length > 6) {
          extra += `\n… +${items.length - 6} kayıt`;
        }
      }
      const crud = data?.crud;
      let crudHint = '';
      if (crud && typeof crud === 'object' && typeof (crud as { op?: unknown }).op === 'string') {
        crudHint = `\n[${String((crud as { op: string }).op)}]`;
      }
      const itemUuids =
        Array.isArray(items) && items.length > 0 ? extractKbItemUuids(items as unknown[]) : [];
      const prepIds =
        (kind === 'list_result' || kind === 'search_result') && itemUuids.length > 0
          ? itemUuids
          : undefined;
      setKbChatLines((prev) => [
        ...prev,
        {
          id: `a-${Date.now()}`,
          role: 'assistant',
          text: `${assistantText}${extra}${crudHint}`,
          kind: kind || undefined,
          itemIds: prepIds,
        },
      ]);
    } catch (e) {
      const line = `Bağlantı hatası: ${String((e as Error)?.message || e)}`;
      setKbChatErr(line);
      setKbChatLines((prev) => [
        ...prev,
        { id: `a-${Date.now()}`, role: 'assistant', text: line, kind: 'error' },
      ]);
    } finally {
      setKbChatLoading(false);
    }
  }, [kbChatInput, kbChatLoading]);

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

      {/* Tabs — yatay kaydırma */}
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
        <TouchableOpacity
          style={[styles.tabBtn, tab === 'kb' && styles.tabActive]}
          onPress={() => setTab('kb')}
        >
          <Text style={[styles.tabText, tab === 'kb' && styles.tabTextActive]}>Leylek KB</Text>
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
              pendingKYC.map((kyc, i) => {
                const kind = (kyc.vehicle_kind || 'car').toLowerCase();
                const isMotor = kind === 'motorcycle' || kind === 'motor';
                const carUrl = kyc.vehicle_photo_url;
                const motorUrl = kyc.motorcycle_photo_url;
                const hasCarPhoto = isSafeKycImageUrl(carUrl);
                const hasMotorPhoto = isSafeKycImageUrl(motorUrl);
                const hasPrimaryVehicle = isMotor ? hasMotorPhoto : hasCarPhoto;
                const hasLicense = isSafeKycImageUrl(kyc.license_photo_url);
                const hasSelfie = isSafeKycImageUrl(kyc.selfie_url);
                const line1 = `${kycDisplayField(kyc.vehicle_brand)} ${kycDisplayField(kyc.vehicle_model)} (${kycDisplayField(kyc.vehicle_year)})`;
                const line2 = `${kycDisplayField(kyc.vehicle_color)} · ${kycDisplayField(kyc.plate_number)}`;
                const thumbSlots: { label: string; url: string | null | undefined }[] = [
                  { label: 'Otomobil', url: carUrl },
                  { label: 'Motosiklet', url: motorUrl },
                  { label: 'Ehliyet', url: kyc.license_photo_url },
                  { label: 'Selfie', url: kyc.selfie_url },
                ];
                const kycPreviewItems: KycDocPreviewItem[] = thumbSlots
                  .filter((s) => isSafeKycImageUrl(s.url))
                  .map((s) => ({ label: s.label, url: String(s.url).trim() }));
                const kycPreviewSubtitle = [kyc.name, kyc.phone].filter(Boolean).join(' · ') || 'Başvuru';
                const aiTier = kycAiTierFromRequest(kyc);
                const quickBanner = kycQuickDecisionBanner(aiTier);
                const approveHint = kycApproveHintLine(aiTier);
                return (
                <View key={kyc.user_id || i} style={styles.kycCard}>
                  <View
                    style={[
                      styles.kycQuickBanner,
                      { backgroundColor: quickBanner.bg, borderColor: quickBanner.border },
                    ]}
                  >
                    <Ionicons name={quickBanner.icon} size={28} color={quickBanner.accent} />
                    <View style={styles.kycQuickBannerTextCol}>
                      <Text style={[styles.kycQuickBannerTitle, { color: quickBanner.accent }]}>
                        {quickBanner.label}
                      </Text>
                      <Text style={[styles.kycQuickBannerSub, { color: quickBanner.subColor }]}>{quickBanner.sub}</Text>
                    </View>
                  </View>

                  <Text style={styles.kycName}>{kyc.name || 'İsimsiz'}</Text>
                  <Text style={styles.kycPhone}>{kyc.phone || '—'}</Text>
                  <Text style={styles.kycSubmitted}>
                    Başvuru: {formatKycSubmittedAt(kyc.submitted_at ?? undefined)}
                  </Text>
                  <Text style={styles.kycKindLine}>
                    Kayıt tipi: {kycVehicleKindLabel(kyc.vehicle_kind)}
                  </Text>

                  <View style={styles.kycVehicle}>
                    <Text style={styles.kycVehicleText}>{line1}</Text>
                    <Text style={styles.kycVehicleText}>{line2}</Text>
                  </View>

                  <Text style={styles.kycImageSectionTitle}>Belgeler (önizleme)</Text>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    style={styles.kycThumbScroll}
                    contentContainerStyle={styles.kycThumbScrollContent}
                  >
                    {thumbSlots.map((slot) => {
                      const ok = isSafeKycImageUrl(slot.url);
                      const openPreview = () => {
                        if (kycPreviewItems.length === 0) return;
                        const idx = Math.max(0, kycPreviewItems.findIndex((p) => p.label === slot.label));
                        setKycDocPreview({
                          items: kycPreviewItems,
                          index: idx >= 0 ? idx : 0,
                          subtitle: kycPreviewSubtitle,
                        });
                      };
                      return (
                        <View key={slot.label} style={styles.kycThumbCell}>
                          <Text style={styles.kycThumbLabel}>{slot.label}</Text>
                          {ok ? (
                            <TouchableOpacity
                              activeOpacity={0.88}
                              onPress={openPreview}
                              accessibilityRole="button"
                              accessibilityLabel={`${slot.label} belgesini büyüt`}
                            >
                              <Image
                                source={{ uri: slot.url!.trim() }}
                                style={styles.kycThumbImage}
                                resizeMode="cover"
                              />
                              <Text style={styles.kycThumbTapHint}>Dokun → büyüt</Text>
                            </TouchableOpacity>
                          ) : (
                            <View style={styles.kycThumbPlaceholder}>
                              <Text style={styles.kycThumbPlaceholderText}>—</Text>
                            </View>
                          )}
                        </View>
                      );
                    })}
                  </ScrollView>

                  {(kyc.ai_status || (Array.isArray(kyc.ai_warnings) && kyc.ai_warnings.length > 0)) ? (
                    <View style={styles.kycAiBlock}>
                      <Text style={styles.kycAiBlockTitle}>AI Ön Değerlendirme</Text>
                      <Text style={styles.kycAiStatusLine}>
                        Durum:{' '}
                        <Text style={styles.kycAiStatusValue}>
                          {(() => {
                            const s = String(kyc.ai_status || '—').toLowerCase();
                            if (s === 'green') return 'YEŞİL (iyi)';
                            if (s === 'yellow') return 'SARI (dikkat)';
                            if (s === 'red') return 'KIRMIZI (sorunlu)';
                            return String(kyc.ai_status || '—').toUpperCase();
                          })()}
                        </Text>
                      </Text>
                      {(() => {
                        const raw = kyc.ai_warnings;
                        const list = Array.isArray(raw)
                          ? raw
                          : typeof raw === 'string'
                            ? (() => {
                                try {
                                  const p = JSON.parse(raw);
                                  return Array.isArray(p) ? p : [];
                                } catch {
                                  return [];
                                }
                              })()
                            : [];
                        return list.length > 0 ? (
                          <View style={styles.kycAiWarnings}>
                            {list.map((w: string, wi: number) => (
                              <Text key={wi} style={styles.kycAiWarningLine}>
                                • {w}
                              </Text>
                            ))}
                          </View>
                        ) : (
                          <Text style={styles.kycAiNoWarnings}>Uyarı listesi yok</Text>
                        );
                      })()}
                    </View>
                  ) : null}

                  <View style={styles.kycDocs}>
                    <Text style={styles.kycDocLabel}>
                      {isMotor ? 'Motosiklet fotoğrafı' : 'Otomobil fotoğrafı'}: {hasPrimaryVehicle ? '✅' : '❌'}
                    </Text>
                    {!isMotor && hasMotorPhoto ? (
                      <Text style={styles.kycDocLabel}>Motosiklet fotoğrafı: ✅</Text>
                    ) : null}
                    {isMotor && hasCarPhoto ? (
                      <Text style={styles.kycDocLabel}>Otomobil fotoğrafı: ✅</Text>
                    ) : null}
                    <Text style={styles.kycDocLabel}>Ehliyet: {hasLicense ? '✅' : '❌'}</Text>
                    <Text style={styles.kycDocLabel}>Selfie: {hasSelfie ? '✅' : '❌'}</Text>
                  </View>

                  {/* Butonlar — AI hızlı karar */}
                  <View style={styles.kycBtnRow}>
                    <View style={styles.kycApproveCol}>
                      <TouchableOpacity
                        style={[styles.kycBtn, styles.kycApproveBtn, styles.kycBtnStretch]}
                        onPress={() => approveKYC(kyc.user_id)}
                        disabled={approvingKYC === kyc.user_id}
                      >
                        {approvingKYC === kyc.user_id ? (
                          <ActivityIndicator color="#FFF" size="small" />
                        ) : (
                          <Text style={styles.kycBtnText}>✓ Onayla</Text>
                        )}
                      </TouchableOpacity>
                      <Text style={styles.kycApproveHint}>{approveHint}</Text>
                    </View>
                    <TouchableOpacity
                      style={[styles.kycBtn, styles.kycRejectBtn, styles.kycRejectBtnNarrow]}
                      onPress={() => setKycRejectModalUserId(kyc.user_id)}
                    >
                      <Text style={styles.kycBtnText}>✗ Reddet</Text>
                    </TouchableOpacity>
                  </View>
                </View>
                );
              })
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

            <Text style={[styles.sectionTitle, { marginTop: 24 }]}>Bekleyen grup önerileri</Text>
            <Text style={styles.subtleHelp}>
              Kullanıcıların gönderdiği yeni gruplar. Onaylanınca keşif listesinde yayınlanır.
            </Text>
            {pendingMuhabbetGroups.length === 0 ? (
              <Text style={styles.emptyListText}>Bekleyen grup yok.</Text>
            ) : (
              pendingMuhabbetGroups.map((g) => (
                <View key={String(g.id)} style={styles.muhabbetCard}>
                  <Text style={styles.muhabbetMeta}>
                    {g.created_at ? String(g.created_at).slice(0, 19).replace('T', ' ') : '—'} ·{' '}
                    {g.city || ''} · {g.neighborhood_name || 'Mahalle'}
                  </Text>
                  <Text style={styles.muhabbetTitle}>{g.name || '—'}</Text>
                  <Text style={styles.muhabbetDetails}>{g.description || '—'}</Text>
                  <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
                    <TouchableOpacity
                      style={[styles.kycBtn, styles.kycApproveBtn, { flex: 1 }]}
                      onPress={() => void approveMuhabbetGroup(String(g.id))}
                      disabled={muhabbetGroupActionId === String(g.id)}
                    >
                      {muhabbetGroupActionId === String(g.id) ? (
                        <ActivityIndicator color="#FFF" size="small" />
                      ) : (
                        <Text style={styles.kycBtnText}>Onayla</Text>
                      )}
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.kycBtn, styles.kycRejectBtn, { flex: 1 }]}
                      onPress={() => void rejectMuhabbetGroup(String(g.id))}
                      disabled={muhabbetGroupActionId === String(g.id)}
                    >
                      <Text style={styles.kycBtnText}>Reddet</Text>
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

        {tab === 'kb' && (
          <View style={styles.section}>
            <Text style={styles.kbHintTitle}>Yönetici sohbeti (Leylek KB)</Text>
            <Text style={styles.kbHint}>
              listele{'\n'}
              ara: kelime{'\n'}
              öğren: tetik1, tetik2 {'>>>'} cevap metni{'\n'}
              unut: {'<uuid>'} veya unut: kelime (tek aktif eşleşme){'\n'}
            </Text>
            {kbChatErr ? <Text style={styles.kbErrBanner}>{kbChatErr}</Text> : null}
            <ScrollView
              style={styles.kbLog}
              keyboardShouldPersistTaps="handled"
              nestedScrollEnabled
            >
              {kbChatLines.map((line) => (
                <View
                  key={line.id}
                  style={[
                    styles.kbBubble,
                    line.role === 'user' ? styles.kbBubbleUser : styles.kbBubbleAssistant,
                  ]}
                >
                  {line.kind ? (
                    <Text style={styles.kbKind}>{kbKindLabel(line.kind)}</Text>
                  ) : null}
                  <Text style={styles.kbBubbleText}>{line.text}</Text>
                  {line.role === 'assistant' &&
                  line.itemIds &&
                  line.itemIds.length > 0 &&
                  (line.kind === 'list_result' || line.kind === 'search_result') ? (
                    <View style={styles.kbPrepBlock}>
                      {line.itemIds.slice(0, 12).map((iid) => (
                        <View key={iid} style={styles.kbPrepRow}>
                          <Text style={styles.kbPrepId} numberOfLines={1} ellipsizeMode="middle">
                            {iid}
                          </Text>
                          <TouchableOpacity
                            style={styles.kbPrepBtn}
                            onPress={() => setKbChatInput(`unut: ${iid}`)}
                            activeOpacity={0.75}
                          >
                            <Text style={styles.kbPrepBtnText}>Unut hazırla</Text>
                          </TouchableOpacity>
                        </View>
                      ))}
                    </View>
                  ) : null}
                </View>
              ))}
            </ScrollView>
            <View style={styles.kbInputRow}>
              <TextInput
                style={styles.kbInput}
                placeholder="Komut yazın…"
                placeholderTextColor="#64748B"
                value={kbChatInput}
                onChangeText={setKbChatInput}
                editable={!kbChatLoading}
                multiline
              />
              <TouchableOpacity
                style={[styles.kbSendBtn, kbChatLoading && styles.kbSendBtnDisabled]}
                onPress={() => void sendKbNlTurn()}
                disabled={kbChatLoading}
              >
                {kbChatLoading ? (
                  <ActivityIndicator color="#FFF" size="small" />
                ) : (
                  <Text style={styles.kbSendBtnText}>Gönder</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        )}

        <View style={styles.bottomPadding} />
      </ScrollView>

      <Modal
        visible={kycDocPreview !== null}
        transparent
        animationType="fade"
        onRequestClose={closeKycDocPreview}
      >
        <View style={styles.kycPreviewOverlay}>
          <View style={styles.kycPreviewTopBar}>
            <View style={styles.kycPreviewTitleCol}>
              <Text style={styles.kycPreviewDocTitle}>
                {kycDocPreview?.items[kycDocPreview.index]?.label ?? ''}
              </Text>
              <Text style={styles.kycPreviewSubtitle} numberOfLines={1}>
                {kycDocPreview?.subtitle ?? ''}
              </Text>
            </View>
            <TouchableOpacity
              onPress={closeKycDocPreview}
              style={styles.kycPreviewCloseBtn}
              accessibilityRole="button"
              accessibilityLabel="Kapat"
            >
              <Text style={styles.kycPreviewCloseText}>✕</Text>
            </TouchableOpacity>
          </View>

          {kycDocPreview && kycDocPreview.items.length > 0 ? (
            <View style={styles.kycPreviewImageWrap}>
              <Image
                source={{ uri: kycDocPreview.items[kycDocPreview.index].url }}
                style={styles.kycPreviewImage}
                resizeMode="contain"
              />
            </View>
          ) : null}

          {kycDocPreview && kycDocPreview.items.length > 1 ? (
            <View style={styles.kycPreviewNavRow}>
              <TouchableOpacity
                onPress={() => shiftKycDocPreview(-1)}
                style={styles.kycPreviewNavBtn}
                accessibilityRole="button"
                accessibilityLabel="Önceki belge"
              >
                <Text style={styles.kycPreviewNavBtnText}>‹ Önceki</Text>
              </TouchableOpacity>
              <Text style={styles.kycPreviewNavHint}>
                {kycDocPreview.index + 1} / {kycDocPreview.items.length}
              </Text>
              <TouchableOpacity
                onPress={() => shiftKycDocPreview(1)}
                style={styles.kycPreviewNavBtn}
                accessibilityRole="button"
                accessibilityLabel="Sonraki belge"
              >
                <Text style={styles.kycPreviewNavBtnText}>Sonraki ›</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.kycPreviewNavSpacer} />
          )}
        </View>
      </Modal>

      <Modal
        visible={kycRejectModalUserId !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setKycRejectModalUserId(null)}
      >
        <View style={styles.kycRejectModalOverlay}>
          <View style={styles.kycRejectModalCard}>
            <Text style={styles.kycRejectModalTitle}>Red sebebi</Text>
            <Text style={styles.kycRejectModalHelp}>
              Hazır seçeneklerden birini kullanın veya özel metin yazın. İsterseniz sebep eklemeden de reddedebilirsiniz.
            </Text>
            <ScrollView style={styles.kycRejectModalScroll} keyboardShouldPersistTaps="handled">
              {KYC_REJECT_PRESET_REASONS.map((reason) => (
                <TouchableOpacity
                  key={reason}
                  style={styles.kycRejectPresetRow}
                  onPress={async () => {
                    if (!kycRejectModalUserId) return;
                    const ok = await rejectKYC(kycRejectModalUserId, reason);
                    if (ok) setKycRejectModalUserId(null);
                  }}
                >
                  <Ionicons name="chevron-forward-outline" size={20} color="#F87171" />
                  <Text style={styles.kycRejectPresetText}>{reason}</Text>
                </TouchableOpacity>
              ))}
              <TouchableOpacity
                style={styles.kycRejectPresetRow}
                onPress={async () => {
                  if (!kycRejectModalUserId) return;
                  const ok = await rejectKYC(kycRejectModalUserId, 'Belirtilmedi');
                  if (ok) setKycRejectModalUserId(null);
                }}
              >
                <Ionicons name="remove-circle-outline" size={18} color="#94A3B8" />
                <Text style={[styles.kycRejectPresetText, styles.kycRejectPresetMuted]}>
                  Sebep eklemeden reddet
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.kycRejectPresetRow, styles.kycRejectCustomRow]}
                onPress={() => {
                  const uid = kycRejectModalUserId;
                  if (!uid) return;
                  setKycRejectModalUserId(null);
                  const ok = callAlertPrompt(
                    'Özel red sebebi',
                    'Başvurunun reddedilme sebebini yazın:',
                    [
                      { text: 'İptal', style: 'cancel' },
                      { text: 'Reddet', onPress: (reason) => void rejectKYC(uid, reason || 'Belirtilmedi') },
                    ],
                    'plain-text',
                  );
                  if (!ok) {
                    Alert.alert(
                      'Red sebebi',
                      'Metin girişi bu cihazda kullanılamıyor. Hazır sebeplerden birini seçmek için Reddet’e tekrar dokunun.',
                      [{ text: 'Tamam' }],
                    );
                  }
                }}
              >
                <Ionicons name="create-outline" size={18} color="#38BDF8" />
                <Text style={[styles.kycRejectPresetText, styles.kycRejectCustomText]}>Özel sebep yaz…</Text>
              </TouchableOpacity>
            </ScrollView>
            <TouchableOpacity style={styles.kycRejectModalClose} onPress={() => setKycRejectModalUserId(null)}>
              <Text style={styles.kycRejectModalCloseText}>Vazgeç</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
  kycQuickBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 2,
    marginBottom: 14,
    gap: 12,
  },
  kycQuickBannerTextCol: {
    flex: 1,
    minWidth: 0,
  },
  kycQuickBannerTitle: {
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  kycQuickBannerSub: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
    lineHeight: 17,
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
  kycSubmitted: {
    color: '#64748B',
    fontSize: 12,
    marginBottom: 6,
  },
  kycKindLine: {
    color: '#94A3B8',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 10,
  },
  kycImageSectionTitle: {
    color: '#CBD5E1',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 8,
  },
  kycThumbScroll: {
    marginBottom: 12,
    maxHeight: 120,
  },
  kycThumbScrollContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingRight: 8,
  },
  kycThumbCell: {
    width: 104,
  },
  kycThumbLabel: {
    color: '#94A3B8',
    fontSize: 11,
    marginBottom: 4,
    fontWeight: '600',
  },
  kycThumbImage: {
    width: 104,
    height: 88,
    borderRadius: 8,
    backgroundColor: '#334155',
  },
  kycThumbPlaceholder: {
    width: 104,
    height: 88,
    borderRadius: 8,
    backgroundColor: '#334155',
    alignItems: 'center',
    justifyContent: 'center',
  },
  kycThumbPlaceholderText: {
    color: '#64748B',
    fontSize: 20,
  },
  kycThumbTapHint: {
    marginTop: 4,
    fontSize: 10,
    color: '#64748B',
    textAlign: 'center',
  },
  kycPreviewOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.94)',
    paddingTop: Platform.OS === 'ios' ? 52 : 28,
    paddingBottom: 20,
    paddingHorizontal: 12,
  },
  kycPreviewTopBar: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  kycPreviewTitleCol: {
    flex: 1,
    paddingRight: 8,
  },
  kycPreviewDocTitle: {
    color: '#F8FAFC',
    fontSize: 20,
    fontWeight: '800',
  },
  kycPreviewSubtitle: {
    color: '#94A3B8',
    fontSize: 13,
    marginTop: 4,
  },
  kycPreviewCloseBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  kycPreviewCloseText: {
    color: '#FFF',
    fontSize: 22,
    fontWeight: '600',
  },
  kycPreviewImageWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 200,
  },
  kycPreviewImage: {
    width: '100%',
    height: Math.min(Dimensions.get('window').height * 0.62, Dimensions.get('window').width * 1.35),
    maxHeight: Dimensions.get('window').height * 0.68,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 12,
  },
  kycPreviewNavRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 14,
    paddingHorizontal: 4,
  },
  kycPreviewNavSpacer: {
    height: 20,
  },
  kycPreviewNavBtn: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  kycPreviewNavBtnText: {
    color: '#E2E8F0',
    fontSize: 15,
    fontWeight: '700',
  },
  kycPreviewNavHint: {
    color: '#94A3B8',
    fontSize: 14,
    fontWeight: '600',
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
  kycAiBlock: {
    backgroundColor: '#0F172A',
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#334155',
  },
  kycAiBlockTitle: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 8,
    letterSpacing: 0.3,
  },
  kycAiStatusLine: {
    color: '#CBD5E1',
    fontSize: 13,
    marginBottom: 6,
  },
  kycAiStatusValue: {
    fontWeight: '800',
    color: '#F8FAFC',
  },
  kycAiWarnings: {
    marginTop: 4,
  },
  kycAiWarningLine: {
    color: '#E2E8F0',
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 4,
  },
  kycAiNoWarnings: {
    color: '#64748B',
    fontSize: 12,
    fontStyle: 'italic',
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
    alignItems: 'flex-start',
  },
  kycApproveCol: {
    flex: 1,
    minWidth: 0,
  },
  kycBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  kycBtnStretch: {
    flex: 0,
    alignSelf: 'stretch',
    width: '100%',
  },
  kycApproveBtn: {
    backgroundColor: '#10B981',
  },
  kycRejectBtn: {
    backgroundColor: '#EF4444',
  },
  kycRejectBtnNarrow: {
    flex: 0,
    minWidth: 108,
    paddingHorizontal: 10,
  },
  kycApproveHint: {
    marginTop: 8,
    fontSize: 11,
    color: '#94A3B8',
    lineHeight: 16,
    fontWeight: '600',
  },
  kycBtnText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '700',
  },
  kycRejectModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.88)',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  kycRejectModalCard: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: '#334155',
    maxHeight: Math.min(Dimensions.get('window').height * 0.88, 560),
  },
  kycRejectModalTitle: {
    color: '#F8FAFC',
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 8,
  },
  kycRejectModalHelp: {
    color: '#94A3B8',
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 12,
  },
  kycRejectModalScroll: {
    maxHeight: 320,
  },
  kycRejectPresetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: '#334155',
    marginBottom: 8,
  },
  kycRejectCustomRow: {
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: '#0EA5E9',
  },
  kycRejectPresetText: {
    flex: 1,
    color: '#F1F5F9',
    fontSize: 14,
    fontWeight: '600',
  },
  kycRejectPresetMuted: {
    color: '#CBD5E1',
  },
  kycRejectCustomText: {
    color: '#7DD3FC',
  },
  kycRejectModalClose: {
    marginTop: 12,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 10,
    backgroundColor: '#334155',
  },
  kycRejectModalCloseText: {
    color: '#E2E8F0',
    fontSize: 15,
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
  kbHintTitle: {
    color: '#E2E8F0',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 8,
  },
  kbHint: {
    color: '#94A3B8',
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 12,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  kbErrBanner: {
    color: '#FCA5A5',
    fontSize: 13,
    marginBottom: 8,
  },
  kbLog: {
    maxHeight: 280,
    marginBottom: 12,
  },
  kbBubble: {
    padding: 10,
    borderRadius: 10,
    marginBottom: 8,
    maxWidth: '100%',
  },
  kbBubbleUser: {
    alignSelf: 'flex-end',
    backgroundColor: '#1D4ED8',
  },
  kbBubbleAssistant: {
    alignSelf: 'flex-start',
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#334155',
  },
  kbKind: {
    color: '#64748B',
    fontSize: 11,
    marginBottom: 4,
    fontWeight: '600',
  },
  kbBubbleText: {
    color: '#F1F5F9',
    fontSize: 14,
    lineHeight: 20,
  },
  kbInputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  kbInput: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    backgroundColor: '#1E293B',
    color: '#F8FAFC',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#334155',
    fontSize: 15,
  },
  kbSendBtn: {
    backgroundColor: '#2563EB',
    marginLeft: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 10,
    minWidth: 88,
    alignItems: 'center',
    justifyContent: 'center',
  },
  kbSendBtnDisabled: {
    opacity: 0.65,
  },
  kbSendBtnText: {
    color: '#FFF',
    fontWeight: '700',
    fontSize: 15,
  },
  kbPrepBlock: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(51, 65, 85, 0.9)',
  },
  kbPrepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  kbPrepId: {
    flex: 1,
    color: '#94A3B8',
    fontSize: 11,
    marginRight: 8,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  kbPrepBtn: {
    backgroundColor: '#334155',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  kbPrepBtnText: {
    color: '#E2E8F0',
    fontSize: 12,
    fontWeight: '600',
  },
});
