/**
 * Admin Panel - Leylek TAG
 * v8 - ERROR BOUNDARY İLE SARMALANMIŞ VERSİYON
 */

import React, { useState, useEffect, Component, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  RefreshControl,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ADMIN_API_BASE, normalizeTrPhone10 } from '../lib/adminApi';
import { API_BASE_URL } from '../lib/backendConfig';
import { getPersistedAccessToken } from '../lib/sessionToken';

/** Geçici teşhis: yalnızca EXPO_PUBLIC_ADMIN_DIAG=1 build'lerde admin bandı görünür. */
const SHOW_ADMIN_DIAG = process.env.EXPO_PUBLIC_ADMIN_DIAG === '1';

function summarizeAdminCheckResponse(res: Response, body: unknown): string {
  const st = res.status;
  let isAd = '?';
  let keys = '';
  if (body && typeof body === 'object' && !Array.isArray(body)) {
    const o = body as Record<string, unknown>;
    isAd = Object.prototype.hasOwnProperty.call(o, 'is_admin') ? String(o.is_admin) : '?';
    keys = Object.keys(o).slice(0, 12).join(',');
  } else {
    keys = body === null || body === undefined ? 'empty' : 'non-object';
  }
  const line = `HTTP ${st} is_admin=${isAd} keys=[${keys}]`;
  return line.length > 170 ? `${line.slice(0, 167)}...` : line;
}

type AdminDiagBandProps = {
  loading: boolean;
  error: string;
  isAdmin: boolean;
  tab: string;
  adminCheckSummary: string;
};

function AdminDiagBand({
  loading,
  error,
  isAdmin,
  tab,
  adminCheckSummary,
}: AdminDiagBandProps) {
  if (!SHOW_ADMIN_DIAG) return null;
  const errShort = error ? error.replace(/\s+/g, ' ').trim().slice(0, 96) : '(yok)';
  const checkShort = (adminCheckSummary || '(yok)').replace(/\s+/g, ' ').trim().slice(0, 140);
  return (
    <View style={styles.adminDiagBand} accessibilityLabel="Admin teşhis bandı">
      <Text style={styles.adminDiagText} selectable numberOfLines={5}>
        {`[ADMIN_DIAG] loading=${String(loading)} isAdmin=${String(isAdmin)} tab=${tab}\nerror: ${errShort}\ncheck: ${checkShort}`}
      </Text>
    </View>
  );
}

// Error Boundary Class Component
class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.log('Admin Error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={errorStyles.container}>
          <Text style={errorStyles.title}>Bir hata oluştu</Text>
          <Text style={errorStyles.message}>{String(this.state.error)}</Text>
          <TouchableOpacity 
            style={errorStyles.button} 
            onPress={() => this.setState({ hasError: false, error: null })}
          >
            <Text style={errorStyles.buttonText}>Tekrar Dene</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return this.props.children;
  }
}

const errorStyles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#111', justifyContent: 'center', alignItems: 'center', padding: 20 },
  title: { color: '#F00', fontSize: 20, fontWeight: 'bold', marginBottom: 10 },
  message: { color: '#FFF', fontSize: 14, textAlign: 'center', marginBottom: 20 },
  button: { backgroundColor: '#3B82F6', paddingHorizontal: 30, paddingVertical: 15, borderRadius: 8 },
  buttonText: { color: '#FFF', fontSize: 16, fontWeight: '600' },
});

// Main Admin Component
type KbChatLine = {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  kind?: string;
  /** list_result / search_result: tam UUID — “Unut hazırla” ile input doldurma */
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

function AdminContent() {
  const router = useRouter();
  const [kbChatLines, setKbChatLines] = useState<KbChatLine[]>([]);
  const [kbChatInput, setKbChatInput] = useState('');
  const [kbChatLoading, setKbChatLoading] = useState(false);
  const [kbChatErr, setKbChatErr] = useState('');
  const [state, setState] = useState({
    loading: true,
    error: '',
    isAdmin: false,
    phone: '',
    tab: 'dashboard',
    stats: null,
    users: [],
    trips: [],
    search: '',
    refreshing: false,
    apiWarnings: '',
    /** Geçici teşhis: admin/check özeti (SHOW_ADMIN_DIAG açıkken bandda). */
    adminCheckSummary: '',
  });

  useEffect(() => {
    init();
  }, []);

  const init = async () => {
    try {
      // Uygulama genelinde ana oturum anahtarı `user`; eski kurulumlar için `leylek_user` fallback.
      const userData = (await AsyncStorage.getItem('user')) || (await AsyncStorage.getItem('leylek_user'));
      
      if (!userData) {
        setState(s => ({
          ...s,
          loading: false,
          error: 'Giriş yapmalısınız',
          adminCheckSummary: 'check: atlanmadı (oturum yok)',
        }));
        return;
      }
      
      let user;
      try {
        user = JSON.parse(userData);
      } catch (e) {
        setState(s => ({
          ...s,
          loading: false,
          error: 'Kullanıcı verisi okunamadı',
          adminCheckSummary: 'check: atlanmadı (kullanıcı JSON)',
        }));
        return;
      }
      
      const userPhone = normalizeTrPhone10(String(user.phone || ''));
      
      let checkRes: Response;
      let checkData: unknown;
      try {
        checkRes = await fetch(`${ADMIN_API_BASE}/admin/check?phone=${encodeURIComponent(userPhone)}`);
        checkData = await checkRes.json();
      } catch {
        setState(s => ({
          ...s,
          loading: false,
          error: 'Bağlantı hatası: admin/check',
          adminCheckSummary: 'check: istisna (ağ veya JSON)',
        }));
        return;
      }

      const checkSummary = summarizeAdminCheckResponse(checkRes, checkData);
      const isAdminOk =
        checkData &&
        typeof checkData === 'object' &&
        !Array.isArray(checkData) &&
        (checkData as Record<string, unknown>).is_admin === true;

      if (!isAdminOk) {
        setState(s => ({
          ...s,
          loading: false,
          error: 'Admin yetkisi yok',
          adminCheckSummary: checkSummary,
        }));
        return;
      }
      
      setState(s => ({ ...s, isAdmin: true, phone: userPhone, adminCheckSummary: checkSummary }));
      await loadData(userPhone);
      
    } catch (err) {
      setState(s => ({
        ...s,
        loading: false,
        error: 'Bağlantı hatası: ' + String((err as Error)?.message || err),
        adminCheckSummary: s.adminCheckSummary || 'check: beklenmeyen hata',
      }));
    }
  };

  const loadData = async (adminPhone) => {
    const errs = [];
    try {
      const ap = normalizeTrPhone10(adminPhone);
      if (!ap || ap.length < 10) {
        setState(s => ({
          ...s,
          loading: false,
          refreshing: false,
          error: 'Geçerli telefon bulunamadı',
        }));
        return;
      }

      const [dashRes, usersRes, tripsRes] = await Promise.all([
        fetch(`${ADMIN_API_BASE}/admin/dashboard/full?admin_phone=${encodeURIComponent(ap)}`),
        fetch(`${ADMIN_API_BASE}/admin/users/full?admin_phone=${encodeURIComponent(ap)}&page=1&limit=50`),
        fetch(`${ADMIN_API_BASE}/admin/trips?admin_phone=${encodeURIComponent(ap)}&page=1&limit=50`),
      ]);

      let stats = null;
      const dashData = await dashRes.json().catch(() => ({}));
      if (!dashRes.ok) errs.push(`Panel ${dashRes.status}`);
      else if (!dashData.success) errs.push('Panel verisi alınamadı');
      else stats = dashData.stats;

      let users = [];
      const usersData = await usersRes.json().catch(() => ({}));
      if (!usersRes.ok) errs.push(`Kullanıcılar ${usersRes.status}`);
      else if (!usersData.success) errs.push('Kullanıcı listesi yok');
      else if (Array.isArray(usersData.users)) users = usersData.users;

      let trips = [];
      const tripsData = await tripsRes.json().catch(() => ({}));
      if (!tripsRes.ok) errs.push(`Yolculuklar ${tripsRes.status}`);
      else if (!tripsData.success) errs.push('Yolculuk listesi yok');
      else if (Array.isArray(tripsData.trips)) trips = tripsData.trips;

      setState(s => ({
        ...s,
        loading: false,
        refreshing: false,
        stats,
        users,
        trips,
        apiWarnings: errs.length ? errs.join(' · ') : '',
      }));
    } catch (err) {
      setState(s => ({
        ...s,
        loading: false,
        refreshing: false,
        apiWarnings: String(err?.message || err),
      }));
    }
  };

  const refresh = () => {
    setState(s => ({ ...s, refreshing: true }));
    loadData(state.phone);
  };

  const goBack = () => {
    try { router.back(); } catch (e) { router.replace('/'); }
  };

  const setTab = (tab) => setState(s => ({ ...s, tab }));
  const setSearch = (search) => setState(s => ({ ...s, search }));

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
      const kind = typeof data?.kind === 'string' ? data.kind : '';
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

  // LOADING
  if (state.loading) {
    return (
      <View style={styles.screen}>
        <AdminDiagBand
          loading={state.loading}
          error={state.error}
          isAdmin={state.isAdmin}
          tab={state.tab}
          adminCheckSummary={state.adminCheckSummary}
        />
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#3B82F6" />
          <Text style={styles.loadingText}>Yükleniyor...</Text>
        </View>
      </View>
    );
  }

  // ERROR
  if (state.error) {
    return (
      <View style={styles.screen}>
        <AdminDiagBand
          loading={state.loading}
          error={state.error}
          isAdmin={state.isAdmin}
          tab={state.tab}
          adminCheckSummary={state.adminCheckSummary}
        />
        <View style={styles.centered}>
          <Text style={styles.errorText}>{state.error}</Text>
          <TouchableOpacity style={styles.blueBtn} onPress={goBack}>
            <Text style={styles.blueBtnText}>Geri Dön</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // NOT ADMIN
  if (!state.isAdmin) {
    return (
      <View style={styles.screen}>
        <AdminDiagBand
          loading={state.loading}
          error={state.error}
          isAdmin={state.isAdmin}
          tab={state.tab}
          adminCheckSummary={state.adminCheckSummary}
        />
        <View style={styles.centered}>
          <Text style={styles.errorText}>Yetkisiz</Text>
          <TouchableOpacity style={styles.blueBtn} onPress={goBack}>
            <Text style={styles.blueBtnText}>Geri Dön</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // Filter users
  const filteredUsers = state.search
    ? state.users.filter(u => {
        const n = String(u.name || '').toLowerCase();
        const p = String(u.phone || '');
        return n.includes(state.search.toLowerCase()) || p.includes(state.search);
      })
    : state.users;

  // MAIN PANEL
  return (
    <View style={styles.screen}>
      <AdminDiagBand
        loading={state.loading}
        error={state.error}
        isAdmin={state.isAdmin}
        tab={state.tab}
        adminCheckSummary={state.adminCheckSummary}
      />
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={goBack} style={styles.headerBtn}>
          <Text style={styles.headerBtnText}>{'<'}</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Admin</Text>
        <TouchableOpacity onPress={refresh} style={styles.headerBtn}>
          <Text style={styles.headerBtnText}>R</Text>
        </TouchableOpacity>
      </View>

      {state.apiWarnings ? (
        <View style={styles.warnBanner}>
          <Text style={styles.warnText}>{state.apiWarnings}</Text>
        </View>
      ) : null}

      {/* Tabs */}
      <View style={styles.tabs}>
        {(['dashboard', 'users', 'trips', 'kb'] as const).map((t) => (
          <TouchableOpacity
            key={t}
            style={[styles.tabBtn, state.tab === t && styles.tabActive]}
            onPress={() => setTab(t)}
          >
            <Text style={[styles.tabText, state.tab === t && styles.tabTextActive]}>
              {t === 'dashboard'
                ? 'Panel'
                : t === 'users'
                  ? 'Kullanıcılar'
                  : t === 'trips'
                    ? 'Yolculuklar'
                    : 'Leylek KB'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Content */}
      <ScrollView
        style={styles.content}
        refreshControl={<RefreshControl refreshing={state.refreshing} onRefresh={refresh} />}
      >
        {/* Dashboard */}
        {state.tab === 'dashboard' && (
          <View style={styles.section}>
            <View style={styles.row}>
              <View style={styles.statCard}>
                <Text style={styles.statNum}>{state.stats?.users?.total || 0}</Text>
                <Text style={styles.statLabel}>Kullanıcı</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statNum}>{state.stats?.users?.drivers || 0}</Text>
                <Text style={styles.statLabel}>Sürücü</Text>
              </View>
            </View>
            <View style={styles.row}>
              <View style={styles.statCard}>
                <Text style={styles.statNum}>{state.stats?.users?.passengers ?? 0}</Text>
                <Text style={styles.statLabel}>Yolcu</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statNum}>{state.stats?.trips?.completed_week ?? 0}</Text>
                <Text style={styles.statLabel}>Yolculuk (7 gün)</Text>
              </View>
            </View>
            <View style={styles.row}>
              <View style={styles.statCard}>
                <Text style={styles.statNum}>{state.stats?.users?.online_drivers || 0}</Text>
                <Text style={styles.statLabel}>Online</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statNum}>{state.stats?.trips?.completed_today || 0}</Text>
                <Text style={styles.statLabel}>Bugün tamamlanan</Text>
              </View>
            </View>
            <View style={styles.row}>
              <View style={styles.statCard}>
                <Text style={styles.statNum}>{state.stats?.trips?.active ?? 0}</Text>
                <Text style={styles.statLabel}>Aktif</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statNum}>{state.stats?.trips?.waiting ?? 0}</Text>
                <Text style={styles.statLabel}>Bekleyen</Text>
              </View>
            </View>
          </View>
        )}

        {/* Users */}
        {state.tab === 'users' && (
          <View style={styles.section}>
            <TextInput
              style={styles.input}
              placeholder="Ara..."
              placeholderTextColor="#666"
              value={state.search}
              onChangeText={setSearch}
            />
            <Text style={styles.countText}>{filteredUsers.length} kullanıcı</Text>
            {filteredUsers.slice(0, 30).map((u, i) => (
              <View key={u.id || i} style={styles.card}>
                <Text style={styles.cardTitle}>{u.name || 'İsimsiz'}</Text>
                <Text style={styles.cardSub}>{u.phone || ''}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Trips */}
        {state.tab === 'trips' && (
          <View style={styles.section}>
            {state.trips.slice(0, 30).map((t, i) => (
              <View key={t.id || i} style={styles.card}>
                <Text style={styles.cardTitle}>{t.pickup_location || 'Bilinmiyor'}</Text>
                <Text style={styles.cardSub}>
                  {(t.final_price || t.offered_price || 0) + ' TL · ' + String(t.status || '')}
                </Text>
              </View>
            ))}
          </View>
        )}

        {state.tab === 'kb' && (
          <View style={styles.section}>
            <Text style={styles.kbHintTitle}>Yönetici sohbeti (Leylek KB)</Text>
            <Text style={styles.kbHint}>
              listele{'\n'}
              ara: kelime{'\n'}
              öğren: tetik1, tetik2 {'>>>'} cevap metni{'\n'}
              unut: {'<uuid>'} veya unut: kelime (tek aktif eşleşme){'\n'}
            </Text>
            {kbChatErr ? (
              <Text style={styles.kbErrBanner}>{kbChatErr}</Text>
            ) : null}
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
                    <Text style={styles.kbKind}>
                      {line.kind === 'error' ? 'hata' : line.kind}
                    </Text>
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

        <View style={styles.spacer} />
      </ScrollView>
    </View>
  );
}

// Wrap with Error Boundary
export default function AdminPanel() {
  return (
    <ErrorBoundary>
      <AdminContent />
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  adminDiagBand: {
    backgroundColor: '#422006',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#F59E0B',
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  adminDiagText: {
    color: '#FEF3C7',
    fontSize: 11,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    lineHeight: 15,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    color: '#FFF',
    marginTop: 15,
    fontSize: 16,
  },
  errorText: {
    color: '#EF4444',
    fontSize: 18,
    marginBottom: 20,
    textAlign: 'center',
  },
  blueBtn: {
    backgroundColor: '#3B82F6',
    paddingHorizontal: 30,
    paddingVertical: 12,
    borderRadius: 8,
  },
  blueBtnText: {
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
  headerBtn: {
    width: 44,
    height: 44,
    backgroundColor: '#334155',
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerBtnText: {
    color: '#FFF',
    fontSize: 20,
    fontWeight: 'bold',
  },
  headerTitle: {
    color: '#FFF',
    fontSize: 20,
    fontWeight: '700',
  },
  tabs: {
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
  row: {
    flexDirection: 'row',
    marginBottom: 10,
  },
  statCard: {
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
  input: {
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
  spacer: {
    height: 50,
  },
  warnBanner: {
    backgroundColor: '#450A0A',
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  warnText: {
    color: '#FCA5A5',
    fontSize: 12,
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
    maxHeight: 320,
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
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  kbPrepBtnText: {
    color: '#E2E8F0',
    fontSize: 11,
    fontWeight: '600',
  },
});
