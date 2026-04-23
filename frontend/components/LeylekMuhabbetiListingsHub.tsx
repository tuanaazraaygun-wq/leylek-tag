/**
 * Leylek Muhabbeti — İlanlar sekmesi: filtre, feed, eşleşme, ilan oluşturma.
 *
 * GEÇİCİ (test / Faz 1): seats_count, repeat_type, selected_days, time_window
 * bilgileri ayrı API kolonları yokken `note` metnine gömülür — kalıcı çözüm DEĞİLDİR.
 * Sonraki faz: ride_listings + API + migration ile gerçek kolonlara taşınacak.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, type Href } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { GradientButton } from './GradientButton';
import { ScreenHeaderGradient } from './ScreenHeaderGradient';
import { handleUnauthorizedAndMaybeRedirect } from '../lib/muhabbetAuthRedirect';

const PRIMARY_GRAD = ['#3B82F6', '#60A5FA'] as const;
const ACCENT = '#F59E0B';
const TEXT_PRIMARY = '#111111';
const TEXT_SECONDARY = '#6E6E73';
const CARD_BG = '#FFFFFF';
const CARD_SHADOW = Platform.select({
  ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8 },
  android: { elevation: 2 },
  default: {},
});

type RoleFilter = 'all' | 'driver' | 'passenger';

export type FeedListing = {
  id: string;
  from_text?: string | null;
  to_text?: string | null;
  departure_time?: string | null;
  price_amount?: number | null;
  note?: string | null;
  status?: string | null;
  listing_type?: string | null;
  role_type?: string | null;
  creator_name?: string | null;
  created_by_user_id?: string;
  match_request_status?: string;
  conversation_id?: string | null;
  incoming_request_count?: number;
};

type MatchRequestRow = {
  id: string;
  status?: string | null;
  conversation_id?: string | null;
  sender_name?: string | null;
  receiver_name?: string | null;
  listing?: { from_text?: string | null; to_text?: string | null } | null;
};

export type LeylekMuhabbetiListingsHubProps = {
  apiUrl: string;
  accessToken: string;
  selectedCity: string;
  currentUserId: string;
  syncVersion: number;
  openCreateSignal: number;
  requireToken: () => boolean;
};

function authHeader(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}` };
}

function routeLine(from?: string | null, to?: string | null): string {
  return `${(from && String(from).trim()) || '—'} → ${(to && String(to).trim()) || '—'}`;
}

function formatDeparture(iso: string | null | undefined): string {
  if (!iso) return '—';
  try {
    const d = new Date(String(iso));
    if (Number.isNaN(d.getTime())) return String(iso);
    return d.toLocaleString('tr-TR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  } catch {
    return '—';
  }
}

function pushToChat(
  router: { push: (h: Href) => void },
  p: { conversationId: string; otherUserName: string; fromText: string; toText: string }
) {
  const q = new URLSearchParams();
  if (p.otherUserName) q.set('n', p.otherUserName);
  if (p.fromText) q.set('f', p.fromText);
  if (p.toText) q.set('t', p.toText);
  const s = q.toString();
  const path = s
    ? (`/muhabbet-chat/${encodeURIComponent(p.conversationId)}?${s}` as const)
    : (`/muhabbet-chat/${encodeURIComponent(p.conversationId)}` as const);
  router.push(path as Href);
}

function statusLabel(st: string | null | undefined): string {
  const x = (st || '').toLowerCase();
  if (x === 'active') return 'Yayında';
  if (x === 'matched') return 'Eşleşti';
  if (x === 'closed') return 'Kapandı';
  if (x === 'cancelled') return 'İptal';
  return st || '—';
}

function roleBadge(role: string | undefined): { label: string; tone: 'drv' | 'pax' } {
  const r = (role || '').toLowerCase();
  if (r === 'driver' || r === 'private_driver') return { label: 'Sürücü', tone: 'drv' };
  return { label: 'Yolcu', tone: 'pax' };
}

export default function LeylekMuhabbetiListingsHub({
  apiUrl,
  accessToken,
  selectedCity,
  currentUserId,
  syncVersion,
  openCreateSignal,
  requireToken,
}: LeylekMuhabbetiListingsHubProps) {
  const router = useRouter();
  const tok = accessToken.trim();
  const base = apiUrl.replace(/\/$/, '');

  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all');
  const [loadingFeed, setLoadingFeed] = useState(false);
  const [listings, setListings] = useState<FeedListing[]>([]);
  const [loadingIn, setLoadingIn] = useState(false);
  const [incoming, setIncoming] = useState<MatchRequestRow[]>([]);
  const [loadingOut, setLoadingOut] = useState(false);
  const [outgoing, setOutgoing] = useState<MatchRequestRow[]>([]);
  const [acceptingId, setAcceptingId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [matchBusyId, setMatchBusyId] = useState<string | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [createRole, setCreateRole] = useState<'driver' | 'passenger'>('passenger');
  const [fromText, setFromText] = useState('');
  const [toText, setToText] = useState('');
  const [departureIso, setDepartureIso] = useState('');
  const [priceText, setPriceText] = useState('');
  const [seatsText, setSeatsText] = useState('');
  const [repeatType, setRepeatType] = useState<'once' | 'daily' | 'weekly'>('once');
  const [selectedDays, setSelectedDays] = useState('');
  const [timeWindow, setTimeWindow] = useState('');
  const [noteBody, setNoteBody] = useState('');
  const [createBusy, setCreateBusy] = useState(false);

  const prevOpenSig = React.useRef(openCreateSignal);
  useEffect(() => {
    if (openCreateSignal !== prevOpenSig.current && openCreateSignal > 0) {
      setCreateOpen(true);
      prevOpenSig.current = openCreateSignal;
    }
  }, [openCreateSignal]);

  const loadFeed = useCallback(async () => {
    if (!tok) {
      setListings([]);
      return;
    }
    setLoadingFeed(true);
    try {
      const u = new URLSearchParams({ city: selectedCity, limit: '40' });
      if (roleFilter === 'driver') u.set('role_type', 'driver');
      if (roleFilter === 'passenger') u.set('role_type', 'passenger');
      const res = await fetch(`${base}/muhabbet/listings/feed?${u.toString()}`, {
        headers: authHeader(tok),
      });
      const d = (await res.json().catch(() => ({}))) as { success?: boolean; listings?: FeedListing[] };
      if (res.ok && d.success && Array.isArray(d.listings)) setListings(d.listings);
      else setListings([]);
    } catch {
      setListings([]);
    } finally {
      setLoadingFeed(false);
    }
  }, [base, selectedCity, tok, roleFilter]);

  const loadIncoming = useCallback(async () => {
    if (!tok) {
      setIncoming([]);
      return;
    }
    setLoadingIn(true);
    try {
      const u = new URLSearchParams({ status: 'pending', limit: '50' });
      const res = await fetch(`${base}/muhabbet/match-requests/incoming?${u.toString()}`, {
        headers: authHeader(tok),
      });
      const d = (await res.json().catch(() => ({}))) as { success?: boolean; requests?: MatchRequestRow[] };
      if (res.ok && d.success && Array.isArray(d.requests)) setIncoming(d.requests);
      else setIncoming([]);
    } catch {
      setIncoming([]);
    } finally {
      setLoadingIn(false);
    }
  }, [base, tok]);

  const loadOutgoing = useCallback(async () => {
    if (!tok) {
      setOutgoing([]);
      return;
    }
    setLoadingOut(true);
    try {
      const u = new URLSearchParams({ status: 'all', limit: '50' });
      const res = await fetch(`${base}/muhabbet/match-requests/outgoing?${u.toString()}`, {
        headers: authHeader(tok),
      });
      const d = (await res.json().catch(() => ({}))) as { success?: boolean; requests?: MatchRequestRow[] };
      if (res.ok && d.success && Array.isArray(d.requests)) setOutgoing(d.requests);
      else setOutgoing([]);
    } catch {
      setOutgoing([]);
    } finally {
      setLoadingOut(false);
    }
  }, [base, tok]);

  const loadAll = useCallback(async () => {
    await Promise.all([loadFeed(), loadIncoming(), loadOutgoing()]);
  }, [loadFeed, loadIncoming, loadOutgoing]);

  useEffect(() => {
    if (tok) void loadAll();
  }, [tok, loadAll, selectedCity, syncVersion]);

  const onAccept = async (row: MatchRequestRow) => {
    if (!requireToken() || !tok) return;
    setAcceptingId(row.id);
    try {
      const res = await fetch(`${base}/muhabbet/match-requests/${encodeURIComponent(row.id)}/accept`, {
        method: 'POST',
        headers: { ...authHeader(tok), 'Content-Type': 'application/json' },
        body: '{}',
      });
      if (handleUnauthorizedAndMaybeRedirect(res)) return;
      const d = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        conversation_id?: string;
        detail?: string;
      };
      if (!res.ok || !d.success || !d.conversation_id) {
        Alert.alert('İstek', typeof d.detail === 'string' && d.detail ? d.detail : 'Kabul edilemedi.');
        return;
      }
      const fromT = (row.listing?.from_text as string) || '';
      const toT = (row.listing?.to_text as string) || '';
      const other = (row.sender_name as string) || 'Kullanıcı';
      pushToChat(router, {
        conversationId: d.conversation_id,
        otherUserName: other,
        fromText: fromT,
        toText: toT,
      });
      void loadIncoming();
      void loadFeed();
    } catch {
      Alert.alert('İstek', 'Bağlantı hatası.');
    } finally {
      setAcceptingId(null);
    }
  };

  const onReject = async (row: MatchRequestRow) => {
    if (!requireToken() || !tok) return;
    setRejectingId(row.id);
    try {
      const res = await fetch(`${base}/muhabbet/match-requests/${encodeURIComponent(row.id)}/reject`, {
        method: 'POST',
        headers: { ...authHeader(tok), 'Content-Type': 'application/json' },
        body: '{}',
      });
      const d = (await res.json().catch(() => ({}))) as { success?: boolean; detail?: string };
      if (!res.ok || !d.success) {
        Alert.alert('İstek', typeof d.detail === 'string' && d.detail ? d.detail : 'Reddedilemedi.');
        return;
      }
      void loadIncoming();
    } catch {
      Alert.alert('İstek', 'Bağlantı hatası.');
    } finally {
      setRejectingId(null);
    }
  };

  const sendMatchRequest = async (listingId: string) => {
    if (!requireToken() || !tok) return;
    setMatchBusyId(listingId);
    try {
      const res = await fetch(`${base}/muhabbet/listings/${encodeURIComponent(listingId)}/match-request`, {
        method: 'POST',
        headers: { ...authHeader(tok), 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: null }),
      });
      if (handleUnauthorizedAndMaybeRedirect(res)) return;
      const d = (await res.json().catch(() => ({}))) as { success?: boolean; detail?: string };
      if (!res.ok || !d.success) {
        Alert.alert('Eşleşme', typeof d.detail === 'string' && d.detail ? d.detail : 'İstek gönderilemedi.');
        return;
      }
      void loadFeed();
      void loadOutgoing();
    } catch {
      Alert.alert('Eşleşme', 'Bağlantı hatası.');
    } finally {
      setMatchBusyId(null);
    }
  };

  /**
   * TODO(geçici): Aşağıdaki alanlar yalnızca `note` içinde taşınıyor — üretimde kaldırılacak.
   * Taşınacak kolonlar: seats_count, repeat_type, selected_days, time_window (+ gerekirse JSON şema).
   */
  const composedNote = useMemo(() => {
    const meta: string[] = [];
    meta.push(`Tekrar: ${repeatType === 'once' ? 'bir kez' : repeatType === 'daily' ? 'günlük' : 'haftalık'}`);
    const sc = parseInt(seatsText.replace(/\D/g, ''), 10);
    if (!Number.isNaN(sc) && sc > 0) meta.push(`Koltuk: ${sc}`);
    if (selectedDays.trim()) meta.push(`Günler: ${selectedDays.trim()}`);
    if (timeWindow.trim()) meta.push(`Vakit: ${timeWindow.trim()}`);
    const head = meta.join(' · ');
    const tail = noteBody.trim();
    if (head && tail) return `${head}\n${tail}`;
    return head || tail || null;
  }, [noteBody, repeatType, seatsText, selectedDays, timeWindow]);

  const submitCreate = async () => {
    if (!requireToken() || !tok) return;
    const ft = fromText.trim();
    const tt = toText.trim();
    if (!ft || !tt) {
      Alert.alert('İlan', 'Nereden ve nereye alanlarını doldurun.');
      return;
    }
    setCreateBusy(true);
    try {
      const listing_type = createRole === 'driver' ? 'gidiyorum' : 'gidecegim';
      const role_type = createRole === 'driver' ? 'driver' : 'passenger';
      let departure_time: string | undefined;
      if (departureIso.trim()) {
        const d = new Date(departureIso.trim());
        if (!Number.isNaN(d.getTime())) departure_time = d.toISOString();
      }
      const priceVal = parseFloat(priceText.replace(',', '.'));
      const body: Record<string, unknown> = {
        city: selectedCity.trim(),
        from_text: ft,
        to_text: tt,
        listing_type,
        role_type,
        note: composedNote,
      };
      if (departure_time) body.departure_time = departure_time;
      if (!Number.isNaN(priceVal) && priceVal >= 0) body.price_amount = priceVal;

      const res = await fetch(`${base}/muhabbet/listings/create`, {
        method: 'POST',
        headers: { ...authHeader(tok), 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (handleUnauthorizedAndMaybeRedirect(res)) return;
      const d = (await res.json().catch(() => ({}))) as { success?: boolean; detail?: string };
      if (!res.ok || !d.success) {
        Alert.alert('İlan', typeof d.detail === 'string' && d.detail ? d.detail : 'Kaydedilemedi.');
        return;
      }
      Alert.alert('İlan', 'İlanın yayına alındı.');
      setCreateOpen(false);
      setFromText('');
      setToText('');
      setDepartureIso('');
      setPriceText('');
      setSeatsText('');
      setRepeatType('once');
      setSelectedDays('');
      setTimeWindow('');
      setNoteBody('');
      void loadFeed();
    } catch {
      Alert.alert('İlan', 'Bağlantı hatası.');
    } finally {
      setCreateBusy(false);
    }
  };

  const filterChips = (
    <View style={styles.chipRow}>
      {(['all', 'driver', 'passenger'] as const).map((k) => {
        const active = roleFilter === k;
        const label = k === 'all' ? 'Tümü' : k === 'driver' ? 'Sürücü ilanları' : 'Yolcu ilanları';
        return (
          <TouchableOpacity
            key={k}
            onPress={() => setRoleFilter(k)}
            style={[styles.chip, active && styles.chipOn]}
            activeOpacity={0.88}
          >
            <Text style={[styles.chipText, active && styles.chipTextOn]}>{label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );

  return (
    <View style={styles.root}>
      <View style={styles.toolbar}>
        {filterChips}
        <TouchableOpacity onPress={() => setCreateOpen(true)} activeOpacity={0.9} style={styles.newListingBtn}>
          <LinearGradient colors={[...PRIMARY_GRAD]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
          <Ionicons name="add" size={22} color="#fff" style={{ marginRight: 6 }} />
          <Text style={styles.newListingBtnText}>İlan Ver</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.lead}>
          Şehir içi yolcu ve sürücü ilanları — güvenli eşleşme, kabul sonrası sohbet.
        </Text>

        {loadingFeed ? <ActivityIndicator color={PRIMARY_GRAD[0]} style={{ marginVertical: 16 }} /> : null}
        {!loadingFeed && listings.length === 0 ? (
          <Text style={styles.muted}>Bu filtrede ilan yok. İlk ilanı sen verebilirsin.</Text>
        ) : null}

        {listings.map((L) => {
          const own = String(L.created_by_user_id || '').toLowerCase() === String(currentUserId || '').toLowerCase();
          const st = (L.match_request_status || 'none').toLowerCase();
          const rb = roleBadge(L.role_type || undefined);
          const accepted = st === 'accepted' && L.conversation_id;
          const pending = st === 'pending';
          return (
            <View key={L.id} style={styles.card}>
              <View style={styles.cardTop}>
                <View style={[styles.rolePill, rb.tone === 'drv' ? styles.rolePillDrv : styles.rolePillPax]}>
                  <Text style={styles.rolePillText}>{rb.label}</Text>
                </View>
                <Text style={styles.statusPill}>{statusLabel(L.status)}</Text>
              </View>
              <Text style={styles.cardName} numberOfLines={1}>
                {L.creator_name || 'Kullanıcı'}
              </Text>
              <Text style={styles.cardRoute} numberOfLines={2}>
                {routeLine(L.from_text, L.to_text)}
              </Text>
              <Text style={styles.metaLine}>
                🕐 {formatDeparture(L.departure_time)}{'  ·  '}
                👥 {(L as { seats_count?: number }).seats_count != null ? String((L as { seats_count?: number }).seats_count) : '—'}{' '}
                kişi{'  ·  '}
                💰{' '}
                {L.price_amount != null && L.price_amount !== undefined
                  ? `${Number(L.price_amount).toLocaleString('tr-TR')} ₺`
                  : '—'}
              </Text>
              {L.note ? (
                <Text style={styles.note} numberOfLines={3}>
                  {L.note}
                </Text>
              ) : null}
              {typeof L.incoming_request_count === 'number' && L.incoming_request_count > 0 && own ? (
                <Text style={styles.incomingHint}>{L.incoming_request_count} eşleşme isteği</Text>
              ) : null}

              {!own ? (
                accepted && L.conversation_id ? (
                  <GradientButton
                    label="Mesaja Git"
                    variant="secondary"
                    onPress={() =>
                      pushToChat(router, {
                        conversationId: L.conversation_id!,
                        otherUserName: (L.creator_name || 'Kullanıcı').trim(),
                        fromText: String(L.from_text || ''),
                        toText: String(L.to_text || ''),
                      })
                    }
                    style={{ marginTop: 12 }}
                  />
                ) : pending ? (
                  <View style={styles.sentPill}>
                    <Text style={styles.sentPillText}>İstek gönderildi</Text>
                  </View>
                ) : (
                  <GradientButton
                    label="Eşleşmek istiyorum"
                    loading={matchBusyId === L.id}
                    onPress={() => void sendMatchRequest(L.id)}
                    style={{ marginTop: 12 }}
                  />
                )
              ) : null}
            </View>
          );
        })}

        <Text style={styles.sectionTitle}>Gelen eşleşme istekleri</Text>
        {loadingIn ? <ActivityIndicator color={PRIMARY_GRAD[0]} style={{ marginVertical: 8 }} /> : null}
        {!loadingIn && incoming.length === 0 ? <Text style={styles.muted}>Bekleyen istek yok.</Text> : null}
        {incoming.map((r) => (
          <View key={r.id} style={styles.card}>
            <Text style={styles.cardName}>{r.sender_name || 'Kullanıcı'}</Text>
            <Text style={styles.cardRoute}>{routeLine(r.listing?.from_text, r.listing?.to_text)}</Text>
            <View style={styles.rowActions}>
              <Pressable onPress={() => void onReject(r)} disabled={rejectingId === r.id}>
                <Text style={styles.reject}>{rejectingId === r.id ? '…' : 'Reddet'}</Text>
              </Pressable>
              <GradientButton label="Kabul et" loading={acceptingId === r.id} onPress={() => void onAccept(r)} style={{ minWidth: 120 }} />
            </View>
          </View>
        ))}

        <Text style={[styles.sectionTitle, { marginTop: 20 }]}>Giden istekler</Text>
        {loadingOut ? <ActivityIndicator color={PRIMARY_GRAD[0]} style={{ marginVertical: 8 }} /> : null}
        {!loadingOut && outgoing.length === 0 ? <Text style={styles.muted}>Henüz istek yok.</Text> : null}
        {outgoing.map((r) => {
          const st = (r.status || '').toLowerCase();
          const isAcc = st === 'accepted' && r.conversation_id;
          return (
            <View key={r.id} style={styles.card}>
              <Text style={styles.cardName}>{r.receiver_name || 'İlan sahibi'}</Text>
              <Text style={styles.cardRoute}>{routeLine(r.listing?.from_text, r.listing?.to_text)}</Text>
              <Text style={styles.mutedSmall}>{st === 'pending' ? 'Beklemede' : st === 'accepted' ? 'Kabul' : st === 'rejected' ? 'Red' : st}</Text>
              {isAcc ? (
                <GradientButton
                  label="Mesaja Git"
                  variant="secondary"
                  onPress={() => {
                    if (!r.conversation_id) return;
                    pushToChat(router, {
                      conversationId: r.conversation_id,
                      otherUserName: (r.receiver_name || 'Kullanıcı').trim(),
                      fromText: String(r.listing?.from_text || ''),
                      toText: String(r.listing?.to_text || ''),
                    });
                  }}
                  style={{ marginTop: 10 }}
                />
              ) : null}
            </View>
          );
        })}
        <View style={{ height: 24 }} />
      </ScrollView>

      <Modal visible={createOpen} animationType="slide" onRequestClose={() => setCreateOpen(false)}>
        <SafeAreaView style={styles.modalRoot} edges={['left', 'right', 'bottom']}>
          <ScreenHeaderGradient title="Yeni ilan" onBack={() => setCreateOpen(false)} backIcon="close" gradientColors={PRIMARY_GRAD} />
          <ScrollView contentContainerStyle={styles.modalScroll} keyboardShouldPersistTaps="handled">
            <Text style={styles.inputLabel}>Şehir (şimdilik şehir içi)</Text>
            <Text style={styles.cityLock}>{selectedCity}</Text>

            <Text style={styles.inputLabel}>İlan tipi</Text>
            <View style={styles.rolePick}>
              <TouchableOpacity
                style={[styles.roleOpt, createRole === 'passenger' && styles.roleOptOn]}
                onPress={() => setCreateRole('passenger')}
              >
                <Text style={styles.roleOptText}>Yolcu — gitmek istiyorum</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.roleOpt, createRole === 'driver' && styles.roleOptOn]}
                onPress={() => setCreateRole('driver')}
              >
                <Text style={styles.roleOptText}>Sürücü — gidiyorum</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.inputLabel}>Nereden</Text>
            <TextInput style={styles.input} value={fromText} onChangeText={setFromText} placeholder="Örn. Kızılay" />
            <Text style={styles.inputLabel}>Nereye</Text>
            <TextInput style={styles.input} value={toText} onChangeText={setToText} placeholder="Örn. Batıkent" />

            <Text style={styles.inputLabel}>Kalkış (opsiyonel, ISO)</Text>
            <TextInput
              style={styles.input}
              value={departureIso}
              onChangeText={setDepartureIso}
              placeholder="2026-04-25T08:00:00"
              autoCapitalize="none"
            />

            <Text style={styles.inputLabel}>Fiyat (₺, opsiyonel)</Text>
            <TextInput style={styles.input} value={priceText} onChangeText={setPriceText} keyboardType="decimal-pad" placeholder="150" />

            <Text style={styles.inputLabel}>Koltuk / kişi (opsiyonel)</Text>
            <TextInput style={styles.input} value={seatsText} onChangeText={setSeatsText} keyboardType="number-pad" placeholder="3" />

            <Text style={styles.inputLabel}>Tekrar</Text>
            <View style={styles.rolePick}>
              {(['once', 'daily', 'weekly'] as const).map((rt) => (
                <TouchableOpacity key={rt} style={[styles.roleOpt, repeatType === rt && styles.roleOptOn]} onPress={() => setRepeatType(rt)}>
                  <Text style={styles.roleOptText}>{rt === 'once' ? 'Bir kez' : rt === 'daily' ? 'Günlük' : 'Haftalık'}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.inputLabel}>Seçili günler (opsiyonel)</Text>
            <TextInput style={styles.input} value={selectedDays} onChangeText={setSelectedDays} placeholder="örn. 1,3,5 veya Cmt-Paz" />

            <Text style={styles.inputLabel}>Vakit penceresi (opsiyonel)</Text>
            <TextInput style={styles.input} value={timeWindow} onChangeText={setTimeWindow} placeholder="örn. 08:00–09:00" />

            <Text style={styles.inputLabel}>Not</Text>
            <TextInput style={[styles.input, { minHeight: 88 }]} value={noteBody} onChangeText={setNoteBody} multiline placeholder="Ek bilgi" />

            <Text style={styles.hint}>
              Geçici (test): Tekrar, koltuk, günler ve vakit penceresi şimdilik not metninin başına eklenir; kalıcı
              çözüm değildir — sonraki fazda ayrı veritabanı alanlarına taşınacak.
            </Text>

            <GradientButton label="Yayına al" loading={createBusy} onPress={() => void submitCreate()} style={{ marginTop: 16 }} />
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  toolbar: { paddingHorizontal: 16, paddingBottom: 8, gap: 10 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 14,
    backgroundColor: 'rgba(60,60,67,0.08)',
  },
  chipOn: { backgroundColor: 'rgba(59,130,246,0.2)' },
  chipText: { fontSize: 14, fontWeight: '600', color: TEXT_SECONDARY },
  chipTextOn: { color: '#1D4ED8' },
  newListingBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    paddingVertical: 12,
    overflow: 'hidden',
  },
  newListingBtnText: { color: '#fff', fontWeight: '800', fontSize: 16 },
  scroll: { paddingHorizontal: 16, paddingBottom: 24 },
  lead: { color: TEXT_SECONDARY, fontSize: 14, lineHeight: 20, marginBottom: 12 },
  muted: { color: TEXT_SECONDARY, fontSize: 15, marginVertical: 8 },
  mutedSmall: { color: TEXT_SECONDARY, fontSize: 13, marginTop: 4 },
  sectionTitle: { fontSize: 18, fontWeight: '800', color: TEXT_PRIMARY, marginTop: 8, marginBottom: 8 },
  card: { backgroundColor: CARD_BG, borderRadius: 18, padding: 14, marginBottom: 12, ...CARD_SHADOW },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  rolePill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  rolePillDrv: { backgroundColor: 'rgba(245,158,11,0.2)' },
  rolePillPax: { backgroundColor: 'rgba(59,130,246,0.15)' },
  rolePillText: { fontSize: 12, fontWeight: '800', color: TEXT_PRIMARY },
  statusPill: { fontSize: 12, fontWeight: '600', color: TEXT_SECONDARY },
  cardName: { fontSize: 16, fontWeight: '700', color: TEXT_PRIMARY },
  cardRoute: { marginTop: 4, fontSize: 15, color: TEXT_PRIMARY, lineHeight: 22 },
  metaLine: { marginTop: 6, fontSize: 13, color: TEXT_SECONDARY },
  note: { marginTop: 8, fontSize: 14, color: TEXT_PRIMARY, lineHeight: 20 },
  incomingHint: { marginTop: 6, fontSize: 13, color: ACCENT, fontWeight: '600' },
  sentPill: {
    marginTop: 12,
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(60,60,67,0.1)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
  },
  sentPillText: { fontWeight: '600', color: TEXT_SECONDARY },
  rowActions: { marginTop: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  reject: { color: TEXT_SECONDARY, fontWeight: '600', fontSize: 15 },
  modalRoot: { flex: 1, backgroundColor: '#F2F2F7' },
  modalScroll: { padding: 16, paddingBottom: 40 },
  inputLabel: { marginTop: 12, marginBottom: 6, fontSize: 13, fontWeight: '600', color: TEXT_SECONDARY },
  cityLock: { fontSize: 17, fontWeight: '700', color: TEXT_PRIMARY },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(60,60,67,0.2)',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: TEXT_PRIMARY,
    backgroundColor: '#fff',
  },
  rolePick: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  roleOpt: { paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12, backgroundColor: 'rgba(60,60,67,0.08)' },
  roleOptOn: { backgroundColor: 'rgba(59,130,246,0.2)' },
  roleOptText: { fontSize: 14, fontWeight: '600', color: TEXT_PRIMARY },
  hint: { marginTop: 10, fontSize: 12, color: TEXT_SECONDARY, lineHeight: 18 },
});
