/**
 * Leylek Muhabbeti v1 — Faz 1–2: şehir / mahalle / grup / katılım + grup akışı, gönderi, yorum, şikayet.
 * Faz 2: Bearer access_token zorunlu (presign, gönderi, feed, yorum, şikayet).
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'expo-router';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Pressable,
  FlatList,
  TextInput,
  Modal,
  ActivityIndicator,
  RefreshControl,
  Alert,
  ScrollView,
  Image,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import RouteSummaryCard, { type RouteSummaryPayload } from './RouteSummaryCard';
import { ScreenHeaderGradient } from './ScreenHeaderGradient';
import { GradientButton } from './GradientButton';
import LeylekMuhabbetiListingInboxBlock from './LeylekMuhabbetiListingInboxBlock';

const CITY_THEMES: Record<string, { gradient: [string, string]; icon: keyof typeof Ionicons.glyphMap }> = {
  Ankara: { gradient: ['#1a1a2e', '#16213e'], icon: 'business' },
  İstanbul: { gradient: ['#0f0c29', '#302b63'], icon: 'boat' },
  İzmir: { gradient: ['#134e5e', '#71b280'], icon: 'sunny' },
  Antalya: { gradient: ['#ff6a00', '#ee0979'], icon: 'umbrella' },
  Bursa: { gradient: ['#11998e', '#38ef7d'], icon: 'leaf' },
  Eskişehir: { gradient: ['#6a3093', '#a044ff'], icon: 'school' },
  default: { gradient: ['#0f172a', '#1e293b'], icon: 'location' },
};

const CITIES = [
  'Adana', 'Adıyaman', 'Afyonkarahisar', 'Ağrı', 'Aksaray', 'Amasya', 'Ankara', 'Antalya',
  'Ardahan', 'Artvin', 'Aydın', 'Balıkesir', 'Bartın', 'Batman', 'Bayburt', 'Bilecik',
  'Bingöl', 'Bitlis', 'Bolu', 'Burdur', 'Bursa', 'Çanakkale', 'Çankırı', 'Çorum',
  'Denizli', 'Diyarbakır', 'Düzce', 'Edirne', 'Elazığ', 'Erzincan', 'Erzurum', 'Eskişehir',
  'Gaziantep', 'Giresun', 'Gümüşhane', 'Hakkari', 'Hatay', 'Iğdır', 'Isparta', 'İstanbul',
  'İzmir', 'Kahramanmaraş', 'Karabük', 'Karaman', 'Kars', 'Kastamonu', 'Kayseri', 'Kırıkkale',
  'Kırklareli', 'Kırşehir', 'Kilis', 'Kocaeli', 'Konya', 'Kütahya', 'Malatya', 'Manisa',
  'Mardin', 'Mersin', 'Muğla', 'Muş', 'Nevşehir', 'Niğde', 'Ordu', 'Osmaniye',
  'Rize', 'Sakarya', 'Samsun', 'Siirt', 'Sinop', 'Sivas', 'Şanlıurfa', 'Şırnak',
  'Tekirdağ', 'Tokat', 'Trabzon', 'Tunceli', 'Uşak', 'Van', 'Yalova', 'Yozgat', 'Zonguldak',
];

const REPORT_PRESETS = ['Spam', 'Hakaret / nefret', 'Yasadışı içerik', 'Kişisel veri', 'Diğer'];

const MUHABBET_POST_BODY_MAX = 500;

/** /routes/summary `route` metnini from / to olarak ayır (ör. `A → B`) */
function parseRouteEndpoints(route: string): { from: string; to: string } {
  const t = route
    .trim()
    .replace(/\s*->\s*/gi, '→')
    .replace(/\s*—\s*/g, '→');
  if (t.includes('→')) {
    const parts = t.split('→');
    return { from: (parts[0] || '').trim(), to: parts.slice(1).join('→').trim() || '—' };
  }
  return { from: t || '—', to: '—' };
}

const MUHABBET_SESSION_TITLE = 'Oturum gerekli';
const MUHABBET_SESSION_MESSAGE =
  'Leylek Muhabbeti akışı, paylaşım ve şikayet için güvenli oturum jetonu (access token) gerekir. Lütfen çıkış yapıp tekrar giriş yapın.';

/** RouteSummaryCard ve keşif yüzeyi ile hizalı tasarım tokenları */
const MUHAB_SURFACE = '#F2F2F7';
const TEXT_PRIMARY = '#111111';
const TEXT_SECONDARY = '#6E6E73';
const ACCENT = '#007AFF';
const CARD_BG = '#FFFFFF';
const CARD_RADIUS = 20;
const CARD_SHADOW = Platform.select({
  ios: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 24,
  },
  android: { elevation: 3 },
  default: {},
});

const BORDER_HAIRLINE = '#E5E5EA';
const FIELD_BG = '#EFEFF4';
const BTN_RADIUS = 14;

export interface LeylekMuhabbetiFaz1ScreenProps {
  user: { id: string; name: string; role: string; city?: string; rating?: number };
  onBack: () => void;
  apiUrl: string;
  accessToken?: string | null;
  /** Kart / derin bağlantı: açılışta bu gruba gidilir (feed). */
  initialGroupId?: string | null;
  onInitialGroupConsumed?: () => void;
  /** RouteSummaryCard CTA: rota kurulumu (ör. Expo Router). */
  onNavigateToRouteSetup?: () => void;
  /** RouteSummaryCard CTA: gruba git (parent deeplink / state). */
  onNavigateToGroup?: (groupId: string) => void;
}

type Neighborhood = {
  id: string;
  city: string;
  name: string;
  sort_order: number;
};

type GroupRow = {
  id: string;
  neighborhood_id: string;
  city: string;
  name: string;
  description?: string | null;
  member_count: number;
  neighborhood_name?: string;
  is_member?: boolean;
  /** pending | approved | rejected — keşif listesinde yalnızca approved */
  status?: string | null;
};

type PostRow = {
  id: string;
  group_id: string;
  author_user_id: string;
  body_text: string;
  image_storage_path?: string;
  image_url?: string;
  created_at: string;
  author_name?: string;
};

type CommentRow = {
  id: string;
  post_id: string;
  author_user_id: string;
  body: string;
  /** Bazı ortamlarda DB kolonu body_text ile dönebilir — gösterimde ikisi de desteklenir */
  body_text?: string;
  created_at: string;
  author_name?: string;
};

function getCityTheme(city: string) {
  return CITY_THEMES[city] || CITY_THEMES.default;
}

function authHeaders(accessToken: string | null | undefined, json = true): Record<string, string> {
  const h: Record<string, string> = {};
  if (json) h['Content-Type'] = 'application/json';
  const t = (accessToken || '').trim();
  if (t) h.Authorization = `Bearer ${t}`;
  return h;
}

function formatPostTime(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString('tr-TR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

/** ImagePicker: yeni API `assets[0].uri`, eski sürümler bazen kök `uri`. */
function imagePickerResultToLocalUri(result: ImagePicker.ImagePickerResult): string | null {
  if (result.canceled) return null;
  const assets = result.assets;
  if (Array.isArray(assets) && assets.length > 0) {
    const u = assets[0]?.uri;
    if (typeof u === 'string' && u.trim().length > 0) return u.trim();
  }
  const legacy = (result as { uri?: unknown }).uri;
  if (typeof legacy === 'string' && legacy.trim().length > 0) return legacy.trim();
  return null;
}

/** Supabase signed PUT: expo-file-system v19 kök importta uploadAsync/FileSystemUploadType yok — fetch + blob kullan. */
async function putLocalImageToSignedUrl(
  localUri: string,
  signedUrl: string,
  contentType: string,
): Promise<{ ok: boolean; status: number; message?: string }> {
  if (!localUri?.trim() || !signedUrl?.trim()) {
    return { ok: false, status: 0, message: 'Geçersiz adres' };
  }
  try {
    const fileRes = await fetch(localUri);
    if (!fileRes.ok) {
      return { ok: false, status: fileRes.status, message: 'Fotoğraf dosyası okunamadı' };
    }
    const blob = await fileRes.blob();
    const putRes = await fetch(signedUrl, {
      method: 'PUT',
      headers: { 'Content-Type': contentType || 'image/jpeg' },
      body: blob,
    });
    if (!putRes.ok) {
      return { ok: false, status: putRes.status, message: await putRes.text().catch(() => '') };
    }
    return { ok: true, status: putRes.status };
  } catch (e) {
    return {
      ok: false,
      status: 0,
      message: e instanceof Error ? e.message : 'Yükleme hatası',
    };
  }
}

async function parseJsonResponse(res: Response): Promise<{ ok: boolean; status: number; data: unknown }> {
  const text = await res.text();
  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text) as unknown;
    } catch {
      data = { detail: text.length > 220 ? `${text.slice(0, 220)}…` : text };
    }
  }
  return { ok: res.ok, status: res.status, data };
}

function parseApiErrorDetail(data: unknown): string | null {
  if (!data || typeof data !== 'object') return null;
  const d = data as Record<string, unknown>;
  const det = d.detail;
  if (typeof det === 'string' && det.trim()) return det.trim();
  if (Array.isArray(det)) {
    const parts = det
      .map((x) => {
        if (x && typeof x === 'object' && 'msg' in x) {
          return String((x as { msg?: unknown }).msg || '').trim();
        }
        return typeof x === 'string' ? x.trim() : '';
      })
      .filter(Boolean);
    if (parts.length) return parts.join('\n');
  }
  const msg = d.message;
  if (typeof msg === 'string' && msg.trim()) return msg.trim();
  return null;
}

function userFacingApiMessage(status: number, data: unknown, fallback: string): string {
  if (status === 401) {
    return 'Oturumunuz geçersiz veya süresi dolmuş. Lütfen çıkış yapıp tekrar giriş yapın.';
  }
  if (status === 403) {
    return 'Bu işlem için yetkiniz yok. Gruba üye olduğunuzdan ve hesabınızın eşleştiğinden emin olun.';
  }
  if (status >= 500) {
    return parseApiErrorDetail(data) || 'Sunucuya şu an ulaşılamıyor. Lütfen bir süre sonra tekrar deneyin.';
  }
  if (status === 0 || Number.isNaN(status)) {
    return 'Bağlantı kurulamadı. İnternetinizi kontrol edin.';
  }
  return parseApiErrorDetail(data) || fallback;
}

export default function LeylekMuhabbetiFaz1Screen({
  user,
  onBack,
  apiUrl,
  accessToken,
  initialGroupId,
  onInitialGroupConsumed,
  onNavigateToRouteSetup,
  onNavigateToGroup,
}: LeylekMuhabbetiFaz1ScreenProps) {
  const router = useRouter();
  const tok = (accessToken || '').trim();
  const requireMuhabbetToken = (): boolean => {
    if (!tok) {
      Alert.alert(MUHABBET_SESSION_TITLE, MUHABBET_SESSION_MESSAGE);
      return false;
    }
    return true;
  };

  const [selectedCity, setSelectedCity] = useState(() => {
    const c = (user.city || '').trim();
    return c || 'Ankara';
  });
  const [showCityModal, setShowCityModal] = useState(false);
  const [citySearch, setCitySearch] = useState('');

  const [neighborhoods, setNeighborhoods] = useState<Neighborhood[]>([]);
  const [nLoading, setNLoading] = useState(false);
  const [selectedNeighborhoodId, setSelectedNeighborhoodId] = useState<string | null>(null);

  const [groups, setGroups] = useState<GroupRow[]>([]);
  const [gLoading, setGLoading] = useState(false);

  const [myGroupIds, setMyGroupIds] = useState<Set<string>>(new Set());
  const [refreshing, setRefreshing] = useState(false);
  const [inboxSync, setInboxSync] = useState(0);

  const [detailVisible, setDetailVisible] = useState(false);
  const [detailGroup, setDetailGroup] = useState<GroupRow | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [joinBusy, setJoinBusy] = useState(false);

  const [feedGroup, setFeedGroup] = useState<GroupRow | null>(null);
  const [feedPosts, setFeedPosts] = useState<PostRow[]>([]);
  const [feedLoading, setFeedLoading] = useState(false);
  const [composeOpen, setComposeOpen] = useState(false);
  const [composeCaption, setComposeCaption] = useState('');
  const [composeImageUri, setComposeImageUri] = useState<string | null>(null);
  const [composeMime, setComposeMime] = useState('image/jpeg');
  const [composeBusy, setComposeBusy] = useState(false);

  const [postDetailVisible, setPostDetailVisible] = useState(false);
  const [postDetail, setPostDetail] = useState<PostRow | null>(null);
  const [postDetailLoading, setPostDetailLoading] = useState(false);
  const [comments, setComments] = useState<CommentRow[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [commentBusy, setCommentBusy] = useState(false);

  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [reportDetails, setReportDetails] = useState('');
  const [reportBusy, setReportBusy] = useState(false);

  const [createGroupOpen, setCreateGroupOpen] = useState(false);
  const [createGroupName, setCreateGroupName] = useState('');
  const [createGroupDesc, setCreateGroupDesc] = useState('');
  const [createGroupBusy, setCreateGroupBusy] = useState(false);

  const [roadstersSummary, setRoadstersSummary] = useState<RouteSummaryPayload | null>(null);
  const [roadstersMatches, setRoadstersMatches] = useState<
    { match_id?: string; other_user_id: string }[]
  >([]);
  const [roadstersLoading, setRoadstersLoading] = useState(false);

  useEffect(() => {
    const gid = (initialGroupId || '').trim();
    if (!gid || !tok) return;
    let cancelled = false;
    (async () => {
      try {
        const q = new URLSearchParams({ user_id: user.id });
        const res = await fetch(`${apiUrl}/muhabbet/groups/${gid}?${q}`, {
          headers: { Authorization: `Bearer ${tok}` },
        });
        const data = (await res.json()) as { success?: boolean; group?: GroupRow };
        if (cancelled) return;
        if (data.success && data.group) {
          const g = data.group;
          const st = String(g.status || 'approved').toLowerCase();
          if (st !== 'approved') {
            Alert.alert(
              'Grup henüz yayında değil',
              'Bu grup yönetici onayında veya reddedilmiş olabilir. Onaylandıktan sonra akışa erişebilirsiniz.',
            );
            return;
          }
          const c = (g.city || '').trim();
          if (c) setSelectedCity(c);
          if (g.neighborhood_id) setSelectedNeighborhoodId(String(g.neighborhood_id));
          setFeedGroup(g);
        }
      } catch {
        /* noop */
      } finally {
        if (!cancelled) onInitialGroupConsumed?.();
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [initialGroupId, tok, apiUrl, user.id, onInitialGroupConsumed]);

  const loadMyGroups = useCallback(async () => {
    try {
      const q = new URLSearchParams({ user_id: user.id });
      const res = await fetch(`${apiUrl}/muhabbet/me/groups?${q.toString()}`);
      const data = await res.json();
      if (data.success && Array.isArray(data.groups)) {
        setMyGroupIds(new Set(data.groups.map((g: { id: string }) => g.id)));
      }
    } catch {
      /* sessiz */
    }
  }, [apiUrl, user.id]);

  const loadNeighborhoods = useCallback(async () => {
    setNLoading(true);
    try {
      const q = new URLSearchParams({ city: selectedCity });
      const res = await fetch(`${apiUrl}/muhabbet/neighborhoods?${q.toString()}`);
      const data = await res.json();
      if (data.success && Array.isArray(data.neighborhoods)) {
        setNeighborhoods(data.neighborhoods);
      } else {
        setNeighborhoods([]);
      }
    } catch {
      setNeighborhoods([]);
    }
    setNLoading(false);
  }, [apiUrl, selectedCity]);

  const loadGroups = useCallback(async () => {
    if (!selectedNeighborhoodId) {
      setGroups([]);
      return;
    }
    setGLoading(true);
    try {
      const q = new URLSearchParams({
        city: selectedCity,
        neighborhood_id: selectedNeighborhoodId,
      });
      const res = await fetch(`${apiUrl}/muhabbet/groups?${q.toString()}`);
      const data = await res.json();
      if (data.success && Array.isArray(data.groups)) {
        setGroups(data.groups);
      } else {
        setGroups([]);
      }
    } catch {
      setGroups([]);
    }
    setGLoading(false);
  }, [apiUrl, selectedCity, selectedNeighborhoodId]);

  const loadFeed = useCallback(async () => {
    if (!feedGroup) return;
    if (!tok) {
      setFeedPosts([]);
      setFeedLoading(false);
      return;
    }
    setFeedLoading(true);
    try {
      const q = new URLSearchParams({ limit: '30', offset: '0' });
      const res = await fetch(`${apiUrl}/muhabbet/groups/${feedGroup.id}/feed?${q.toString()}`, {
        headers: authHeaders(tok, false),
      });
      const { ok, status, data } = await parseJsonResponse(res);
      const payload = (data || {}) as { success?: boolean; posts?: PostRow[]; detail?: unknown };
      if (ok && payload.success && Array.isArray(payload.posts)) {
        setFeedPosts(payload.posts);
      } else {
        setFeedPosts([]);
        const msg = userFacingApiMessage(status, data, 'Akış yüklenemedi.');
        if (tok) Alert.alert('Akış', msg);
      }
    } catch {
      setFeedPosts([]);
      if (tok) Alert.alert('Akış', 'Akış yüklenirken bir sorun oluştu. Tekrar deneyin.');
    }
    setFeedLoading(false);
  }, [apiUrl, feedGroup, tok]);

  useEffect(() => {
    void loadNeighborhoods();
    void loadMyGroups();
  }, [loadNeighborhoods, loadMyGroups]);

  useEffect(() => {
    if (!neighborhoods.length) {
      setSelectedNeighborhoodId(null);
      return;
    }
    setSelectedNeighborhoodId((prev) => {
      if (prev && neighborhoods.some((n) => n.id === prev)) return prev;
      return neighborhoods[0].id;
    });
  }, [neighborhoods]);

  useEffect(() => {
    void loadGroups();
  }, [loadGroups]);

  useEffect(() => {
    if (feedGroup) void loadFeed();
  }, [feedGroup, loadFeed]);

  const loadRoadsters = useCallback(async () => {
    if (!tok) {
      setRoadstersSummary(null);
      setRoadstersMatches([]);
      return;
    }
    setRoadstersLoading(true);
    try {
      const base = apiUrl.replace(/\/$/, '');
      const h = { Authorization: `Bearer ${tok}` };
      const mq = new URLSearchParams({ limit: '32', city: selectedCity });
      const [rSum, rMat] = await Promise.all([
        fetch(`${base}/routes/summary`, { headers: h }),
        fetch(`${base}/routes/match?${mq.toString()}`, { headers: h }),
      ]);
      if (rSum.ok) {
        const j = (await rSum.json()) as RouteSummaryPayload;
        if (
          typeof j.match_count === 'number' &&
          typeof j.has_group === 'boolean' &&
          'route' in j &&
          'group_id' in j
        ) {
          setRoadstersSummary(j);
        } else {
          setRoadstersSummary(null);
        }
      } else {
        setRoadstersSummary(null);
      }
      if (rMat.ok) {
        const m = (await rMat.json()) as {
          success?: boolean;
          matches?: { match_id?: string; other_user_id: string }[];
        };
        if (m.success && Array.isArray(m.matches)) {
          setRoadstersMatches(m.matches);
        } else {
          setRoadstersMatches([]);
        }
      } else {
        setRoadstersMatches([]);
      }
    } catch {
      setRoadstersSummary(null);
      setRoadstersMatches([]);
    } finally {
      setRoadstersLoading(false);
    }
  }, [apiUrl, tok, selectedCity]);

  useEffect(() => {
    void loadRoadsters();
  }, [loadRoadsters]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    setInboxSync((v) => v + 1);
    await Promise.all([loadNeighborhoods(), loadGroups(), loadMyGroups(), loadRoadsters()]);
    if (feedGroup) await loadFeed();
    setRefreshing(false);
  }, [loadNeighborhoods, loadGroups, loadMyGroups, loadRoadsters, feedGroup, loadFeed]);

  const openGroupDetail = async (g: GroupRow) => {
    setDetailVisible(true);
    setDetailLoading(true);
    setDetailGroup(g);
    try {
      const q = new URLSearchParams({ user_id: user.id });
      const res = await fetch(`${apiUrl}/muhabbet/groups/${g.id}?${q.toString()}`);
      const data = await res.json();
      if (data.success && data.group) {
        setDetailGroup(data.group);
      }
    } catch {
      /* */
    }
    setDetailLoading(false);
  };

  const joinGroup = async () => {
    if (!detailGroup) return;
    setJoinBusy(true);
    try {
      const res = await fetch(`${apiUrl}/muhabbet/groups/${detailGroup.id}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user.id }),
      });
      const data = await res.json();
      if (data.success) {
        if (data.already_member) {
          Alert.alert('Bilgi', 'Zaten bu grubun üyesisiniz.');
        } else {
          Alert.alert('Tamam', 'Gruba katıldınız.');
        }
        await loadMyGroups();
        await loadGroups();
        const q = new URLSearchParams({ user_id: user.id });
        const gr = await fetch(`${apiUrl}/muhabbet/groups/${detailGroup.id}?${q.toString()}`);
        const gj = await gr.json();
        if (gj.success && gj.group) setDetailGroup(gj.group);
      } else {
        Alert.alert('Hata', (data.detail as string) || 'Katılım başarısız');
      }
    } catch {
      Alert.alert('Hata', 'Bağlantı kurulamadı');
    }
    setJoinBusy(false);
  };

  const openFeedFromDetail = () => {
    if (!detailGroup) return;
    if (!requireMuhabbetToken()) return;
    const st = String(detailGroup.status || 'approved').toLowerCase();
    if (st !== 'approved') {
      Alert.alert('Akış', 'Bu grup henüz yönetici onayıyla yayınlanmadı.');
      return;
    }
    const member = detailGroup.is_member || myGroupIds.has(detailGroup.id);
    if (!member) {
      Alert.alert('Üyelik', 'Önce gruba katılmanız gerekir.');
      return;
    }
    setDetailVisible(false);
    setFeedGroup(detailGroup);
  };

  const submitCreateGroup = async () => {
    if (!requireMuhabbetToken()) return;
    const nid = (selectedNeighborhoodId || '').trim();
    if (!nid) {
      Alert.alert('Mahalle', 'Önce bir mahalle seçin.');
      return;
    }
    const nm = createGroupName.trim();
    if (nm.length < 2) {
      Alert.alert('Grup adı', 'En az 2 karakter girin.');
      return;
    }
    setCreateGroupBusy(true);
    try {
      const res = await fetch(`${apiUrl}/muhabbet/groups/create`, {
        method: 'POST',
        headers: { ...authHeaders(tok), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: user.id,
          name: nm,
          description: createGroupDesc.trim() || undefined,
          city: selectedCity.trim(),
          neighborhood_id: nid,
        }),
      });
      const { ok, status, data } = await parseJsonResponse(res);
      const payload = (data || {}) as { success?: boolean; message?: string; detail?: string };
      if (ok && payload.success) {
        const msg =
          typeof payload.message === 'string' && payload.message.trim()
            ? payload.message.trim()
            : 'Önerin alındı. Yönetici onayından sonra keşifte görünecek.';
        Alert.alert('Teşekkürler', msg);
        setCreateGroupOpen(false);
        setCreateGroupName('');
        setCreateGroupDesc('');
        await loadGroups();
      } else {
        Alert.alert('Grup önerisi', userFacingApiMessage(status, data, 'Gönderilemedi.'));
      }
    } catch {
      Alert.alert('Grup önerisi', 'Bağlantı kurulamadı.');
    }
    setCreateGroupBusy(false);
  };

  const openPostDetail = async (p: PostRow) => {
    if (!requireMuhabbetToken()) return;
    setPostDetailVisible(true);
    setPostDetailLoading(true);
    setPostDetail(p);
    setNewComment('');
    setComments([]);
    let skipComments = false;
    try {
      const res = await fetch(`${apiUrl}/muhabbet/posts/${p.id}`, { headers: authHeaders(tok, false) });
      const { ok, status, data } = await parseJsonResponse(res);
      const payload = (data || {}) as { success?: boolean; post?: PostRow };
      if (ok && payload.success && payload.post) setPostDetail(payload.post);
      else if (!ok || !payload.success) {
        Alert.alert('Gönderi', userFacingApiMessage(status, data, 'Gönderi açılamadı.'));
        skipComments = true;
      }
    } catch {
      Alert.alert('Gönderi', 'Gönderi bilgisi alınamadı.');
      skipComments = true;
    }
    setPostDetailLoading(false);
    if (skipComments) {
      setCommentsLoading(false);
      return;
    }
    setCommentsLoading(true);
    try {
      const res = await fetch(`${apiUrl}/muhabbet/posts/${p.id}/comments`, { headers: authHeaders(tok, false) });
      const { ok, status, data } = await parseJsonResponse(res);
      const payload = (data || {}) as { success?: boolean; comments?: CommentRow[] };
      if (ok && payload.success && Array.isArray(payload.comments)) setComments(payload.comments);
      else {
        setComments([]);
        if (!ok || !payload.success) {
          Alert.alert('Yorumlar', userFacingApiMessage(status, data, 'Yorumlar yüklenemedi.'));
        }
      }
    } catch {
      setComments([]);
      Alert.alert('Yorumlar', 'Yorum listesi alınamadı.');
    }
    setCommentsLoading(false);
  };

  const submitComment = async () => {
    if (!postDetail || !requireMuhabbetToken()) return;
    const t = newComment.trim();
    if (!t) return;
    setCommentBusy(true);
    try {
      const res = await fetch(`${apiUrl}/muhabbet/posts/${postDetail.id}/comments`, {
        method: 'POST',
        headers: authHeaders(tok),
        body: JSON.stringify({ user_id: user.id, body: t }),
      });
      const { ok, status, data } = await parseJsonResponse(res);
      const payload = (data || {}) as { success?: boolean; comment?: CommentRow };
      if (ok && payload.success && payload.comment) {
        setComments((prev) => [...prev, payload.comment as CommentRow]);
        setNewComment('');
      } else {
        Alert.alert('Yorum', userFacingApiMessage(status, data, 'Yorum gönderilemedi.'));
      }
    } catch {
      Alert.alert('Yorum', 'Yorum gönderilemedi. Bağlantınızı kontrol edin.');
    }
    setCommentBusy(false);
  };

  const submitReport = async () => {
    if (!postDetail || !requireMuhabbetToken()) return;
    if (!reportReason.trim()) {
      Alert.alert('Şikayet', 'Lütfen bir kategori seçin.');
      return;
    }
    setReportBusy(true);
    try {
      const res = await fetch(`${apiUrl}/muhabbet/reports`, {
        method: 'POST',
        headers: authHeaders(tok),
        body: JSON.stringify({
          user_id: user.id,
          post_id: postDetail.id,
          reason: reportReason.trim() || undefined,
          details: reportDetails.trim() || undefined,
        }),
      });
      const { ok, status, data } = await parseJsonResponse(res);
      const payload = (data || {}) as { success?: boolean; already_reported?: boolean };
      if (ok && payload.success) {
        if (payload.already_reported) {
          Alert.alert('Şikayet', 'Bu gönderiyi zaten şikayet ettiniz.');
        } else {
          Alert.alert('Teşekkürler', 'Şikayetiniz kaydedildi.');
        }
        setReportOpen(false);
        setReportReason('');
        setReportDetails('');
      } else {
        Alert.alert('Şikayet', userFacingApiMessage(status, data, 'Şikayet kaydedilemedi.'));
      }
    } catch {
      Alert.alert('Şikayet', 'Şikayet gönderilemedi. Bağlantınızı kontrol edin.');
    }
    setReportBusy(false);
  };

  const pickImageForCompose = async () => {
    if (!requireMuhabbetToken()) return;
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('İzin', 'Fotoğraf seçmek için galeri izni gerekir.');
      return;
    }
    const r = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.72,
    });
    const uri = imagePickerResultToLocalUri(r);
    if (!uri) {
      Alert.alert('Fotoğraf', 'Seçilen görüntünün adresi alınamadı. Tekrar deneyin.');
      return;
    }
    setComposeImageUri(uri);
    const a = !r.canceled && Array.isArray(r.assets) && r.assets[0] ? r.assets[0] : null;
    const mt = ((a?.mimeType as string | undefined) || '').toLowerCase();
    if (mt === 'image/png') setComposeMime('image/png');
    else if (mt === 'image/webp') setComposeMime('image/webp');
    else setComposeMime('image/jpeg');
  };

  const submitNewPost = async () => {
    if (!feedGroup || !requireMuhabbetToken()) return;
    const cap = composeCaption.trim();
    const fileUri = (composeImageUri || '').trim();
    if (!fileUri) {
      Alert.alert('Gönderi', 'Fotoğraf seçmelisiniz.');
      return;
    }
    if (cap.length < 1) {
      Alert.alert('Gönderi', 'Kısa açıklama zorunludur.');
      return;
    }
    if (cap.length > MUHABBET_POST_BODY_MAX) {
      Alert.alert('Gönderi', `Açıklama en fazla ${MUHABBET_POST_BODY_MAX} karakter olabilir.`);
      return;
    }
    setComposeBusy(true);
    let uploadOk = false;
    try {
      const pres = await fetch(`${apiUrl}/muhabbet/uploads/presign`, {
        method: 'POST',
        headers: authHeaders(tok),
        body: JSON.stringify({
          user_id: user.id,
          group_id: feedGroup.id,
          content_type: composeMime,
        }),
      });
      const presParsed = await parseJsonResponse(pres);
      const pj = (presParsed.data || {}) as {
        success?: boolean;
        signed_url?: string;
        path?: string;
        detail?: unknown;
      };
      if (!presParsed.ok || !pj.success || !pj.signed_url || !pj.path) {
        Alert.alert(
          'Fotoğraf hazırlığı',
          userFacingApiMessage(presParsed.status, presParsed.data, 'Fotoğraf yüklemesi için adres alınamadı.'),
        );
        setComposeBusy(false);
        return;
      }
      const up = await putLocalImageToSignedUrl(fileUri, String(pj.signed_url), composeMime);
      if (!up.ok) {
        Alert.alert(
          'Fotoğraf yükleme',
          up.status
            ? 'Fotoğraf sunucuya yüklenemedi. Bağlantınızı veya dosya boyutunu kontrol edip tekrar deneyin.'
            : up.message || 'Fotoğraf yüklenemedi.',
        );
        setComposeBusy(false);
        return;
      }
      uploadOk = true;
      const cr = await fetch(`${apiUrl}/muhabbet/posts`, {
        method: 'POST',
        headers: authHeaders(tok),
        body: JSON.stringify({
          user_id: user.id,
          group_id: feedGroup.id,
          body_text: cap,
          image_storage_path: pj.path,
        }),
      });
      const crParsed = await parseJsonResponse(cr);
      const cj = (crParsed.data || {}) as { success?: boolean; detail?: unknown };
      if (crParsed.ok && cj.success) {
        setComposeOpen(false);
        setComposeCaption('');
        setComposeImageUri(null);
        await loadFeed();
        Alert.alert('Tamam', 'Gönderiniz yayınlandı.');
      } else {
        Alert.alert(
          'Gönderi kaydı',
          uploadOk
            ? 'Fotoğraf yüklendi ancak gönderi metni kaydedilemedi. Metni kontrol edip tekrar deneyin; aynı fotoğrafı kullanabilirsiniz.'
            : userFacingApiMessage(crParsed.status, crParsed.data, 'Gönderi kaydedilemedi.'),
        );
      }
    } catch (e) {
      Alert.alert(
        'Gönderi',
        uploadOk
          ? 'Fotoğraf yüklendi; gönderi tamamlanırken bağlantı koptu. Lütfen tekrar deneyin.'
          : e instanceof Error
            ? e.message
            : 'İşlem tamamlanamadı.',
      );
    }
    setComposeBusy(false);
  };

  const requestCityForMuhabbet = async (cityLabel: string) => {
    try {
      const q = new URLSearchParams({
        user_id: user.id,
        requested_city: cityLabel,
      });
      const res = await fetch(`${apiUrl}/community/city-join-request?${q.toString()}`, {
        method: 'POST',
      });
      const j = await res.json();
      if (j.success) {
        Alert.alert('Teşekkürler', 'Talebiniz yöneticilere iletildi.');
      } else {
        Alert.alert('Hata', (j.detail as string) || 'Gönderilemedi');
      }
    } catch {
      Alert.alert('Hata', 'Bağlantı kurulamadı');
    }
  };

  const filteredCities = CITIES.filter((city) =>
    city.toLowerCase().includes(citySearch.toLowerCase()),
  );

  const theme = getCityTheme(selectedCity);
  const apiBaseUrl = apiUrl.replace(/\/$/, '');

  const peopleInsights = useMemo(() => {
    const neigh = neighborhoods.find((n) => n.id === selectedNeighborhoodId);
    const neighLabel = neigh?.name?.trim() || 'Mahalle seç';
    const memberSum = groups.reduce((acc, g) => acc + (typeof g.member_count === 'number' ? g.member_count : 0), 0);
    const myCount = myGroupIds.size;
    return [
      {
        key: 'route',
        title: 'Aynı Güzergah',
        line: myCount > 0 ? `${myCount} grupta` : 'Rota ekleyince',
        hint: myCount > 0 ? 'Üye olduğun gruplar' : 'Eşleşmeler burada',
      },
      {
        key: 'hood',
        title: 'Mahallenden',
        line: neighLabel,
        hint: selectedNeighborhoodId ? selectedCity : 'Önce şehir ve mahalle',
      },
      {
        key: 'active',
        title: 'Bugün aktif',
        line: groups.length > 0 ? `${memberSum || 0} üye` : '—',
        hint: groups.length > 0 ? `${groups.length} grup` : 'Grupları keşfet',
      },
    ];
  }, [neighborhoods, selectedNeighborhoodId, selectedCity, groups, myGroupIds]);

  if (feedGroup) {
    return (
      <SafeAreaView style={styles.feedRoot} edges={['left', 'right', 'bottom']}>
        <ScreenHeaderGradient
          title={feedGroup.name}
          subtitle={
            [feedGroup.neighborhood_name, feedGroup.city]
              .filter((x) => (x || '').toString().trim().length > 0)
              .join(' · ') || undefined
          }
          onBack={() => {
            setFeedGroup(null);
            setFeedPosts([]);
          }}
          right={
            <TouchableOpacity
              onPress={() => {
                if (!requireMuhabbetToken()) return;
                setComposeOpen(true);
              }}
              style={styles.headerIcon}
            >
              <Ionicons name="add-circle-outline" size={28} color={tok ? '#FFFFFF' : 'rgba(255,255,255,0.45)'} />
            </TouchableOpacity>
          }
        />

        {!tok ? (
          <View style={styles.sessionBanner}>
            <Ionicons name="key-outline" size={20} color="#FBBF24" />
            <Text style={styles.sessionBannerText}>{MUHABBET_SESSION_MESSAGE}</Text>
          </View>
        ) : null}

        {feedLoading ? (
          <ActivityIndicator color={ACCENT} style={{ marginTop: 24 }} />
        ) : (
          <FlatList
            data={feedPosts}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.feedListContent}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={ACCENT} />}
            ListEmptyComponent={
              <Text style={styles.mutedLight}>
                {tok
                  ? 'Henüz gönderi yok. + ile ilk paylaşımı siz yapın.'
                  : 'Akışı görmek için oturum jetonu gerekir (üstteki uyarı).'}
              </Text>
            }
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.postCardLight}
                onPress={() => void openPostDetail(item)}
                activeOpacity={0.92}
              >
                {item.image_url ? (
                  <Image source={{ uri: item.image_url }} style={styles.postImageLight} resizeMode="cover" />
                ) : null}
                <Text style={styles.postBodyLight} numberOfLines={4}>
                  {item.body_text}
                </Text>
                <View style={styles.postMetaLight}>
                  <Text style={styles.postAuthorLight}>{item.author_name || 'Kullanıcı'}</Text>
                  <Text style={styles.postTimeLight}>{formatPostTime(item.created_at)}</Text>
                </View>
              </TouchableOpacity>
            )}
          />
        )}

        <Modal visible={composeOpen} animationType="slide" onRequestClose={() => setComposeOpen(false)}>
          <SafeAreaView style={styles.modalRootLight} edges={['left', 'right', 'bottom']}>
            <ScreenHeaderGradient
              title="Yeni gönderi"
              onBack={() => setComposeOpen(false)}
              backIcon="close"
            />
            <ScrollView contentContainerStyle={styles.modalScrollPad}>
              <Text style={styles.inputLabel}>Fotoğraf (zorunlu)</Text>
              <TouchableOpacity style={styles.imagePick} onPress={() => void pickImageForCompose()}>
                {composeImageUri ? (
                  <Image source={{ uri: composeImageUri }} style={styles.imagePickImg} resizeMode="cover" />
                ) : (
                  <Text style={styles.composeMuted}>Galeriden seçmek için dokunun</Text>
                )}
              </TouchableOpacity>
              <Text style={[styles.inputLabel, { marginTop: 16 }]}>Kısa açıklama (zorunlu)</Text>
              <TextInput
                style={styles.composeInput}
                placeholder="Ne paylaşıyorsunuz?"
                placeholderTextColor={TEXT_SECONDARY}
                value={composeCaption}
                onChangeText={setComposeCaption}
                multiline
                maxLength={MUHABBET_POST_BODY_MAX}
              />
              <GradientButton
                label="Yayınla"
                loading={composeBusy}
                onPress={() => void submitNewPost()}
                style={{ marginTop: 20 }}
              />
            </ScrollView>
          </SafeAreaView>
        </Modal>

        <Modal visible={postDetailVisible} animationType="slide" onRequestClose={() => setPostDetailVisible(false)}>
          <SafeAreaView style={styles.modalRootLight} edges={['left', 'right', 'bottom']}>
            <ScreenHeaderGradient
              title="Gönderi"
              onBack={() => setPostDetailVisible(false)}
              right={
                <TouchableOpacity
                  onPress={() => {
                    if (!requireMuhabbetToken()) return;
                    setReportOpen(true);
                  }}
                  style={styles.headerIcon}
                >
                  <Ionicons
                    name="flag-outline"
                    size={24}
                    color={tok ? '#FFFFFF' : 'rgba(255,255,255,0.45)'}
                  />
                </TouchableOpacity>
              }
            />
            {postDetailLoading || !postDetail ? (
              <ActivityIndicator color={ACCENT} style={{ marginTop: 24 }} />
            ) : (
              <KeyboardAvoidingView
                style={styles.modalFlexFill}
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                keyboardVerticalOffset={88}
              >
                <FlatList
                  style={styles.postDetailList}
                  data={comments}
                  keyExtractor={(c) => c.id}
                  ListHeaderComponent={
                    <View>
                      {postDetail.image_url ? (
                        <Image source={{ uri: postDetail.image_url }} style={styles.detailHero} resizeMode="cover" />
                      ) : null}
                      <View style={styles.postDetailHeaderPad}>
                        <Text style={styles.detailCaption}>{postDetail.body_text}</Text>
                        <Text style={styles.detailMeta}>
                          {postDetail.author_name || 'Kullanıcı'} · {formatPostTime(postDetail.created_at)}
                        </Text>
                        <Text style={styles.sheetSectionLabel}>Yorumlar</Text>
                      </View>
                    </View>
                  }
                  ListEmptyComponent={
                    commentsLoading ? (
                      <ActivityIndicator color={ACCENT} style={{ marginVertical: 12 }} />
                    ) : (
                      <Text style={[styles.composeMuted, { paddingHorizontal: 16 }]}>İlk yorumu siz yazın.</Text>
                    )
                  }
                  renderItem={({ item }) => (
                    <View style={styles.commentRow}>
                      <Text style={styles.commentAuthor}>{item.author_name || 'Kullanıcı'}</Text>
                      <Text style={styles.commentBody}>{item.body_text ?? item.body}</Text>
                      <Text style={styles.commentTime}>{formatPostTime(item.created_at)}</Text>
                    </View>
                  )}
                  contentContainerStyle={styles.postDetailListContent}
                />
                <View style={styles.commentBar}>
                  <TextInput
                    style={styles.commentInput}
                    placeholder="Yorum yazın..."
                    placeholderTextColor={TEXT_SECONDARY}
                    value={newComment}
                    onChangeText={setNewComment}
                    multiline
                    maxLength={800}
                  />
                  <Pressable
                    onPress={() => void submitComment()}
                    disabled={commentBusy || !newComment.trim()}
                    style={[
                      styles.commentSendShell,
                      (commentBusy || !newComment.trim()) && styles.btnDisabled,
                    ]}
                  >
                    <LinearGradient
                      colors={['#007AFF', '#5AC8FA']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={StyleSheet.absoluteFill}
                    />
                    <View style={styles.commentSendInner}>
                      {commentBusy ? (
                        <ActivityIndicator color="#FFFFFF" />
                      ) : (
                        <Ionicons name="send" size={22} color="#FFFFFF" />
                      )}
                    </View>
                  </Pressable>
                </View>
              </KeyboardAvoidingView>
            )}
          </SafeAreaView>
        </Modal>

        <Modal visible={reportOpen} transparent animationType="fade" onRequestClose={() => setReportOpen(false)}>
          <View style={styles.detailOverlay}>
            <TouchableOpacity style={styles.detailBackdrop} activeOpacity={1} onPress={() => setReportOpen(false)} />
            <View style={styles.detailSheet}>
              <Text style={styles.detailTitle}>Şikayet</Text>
              <Text style={styles.detailNeigh}>Gönderiyi neden bildiriyorsunuz?</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginVertical: 10 }}>
                {REPORT_PRESETS.map((r) => (
                  <TouchableOpacity
                    key={r}
                    onPress={() => setReportReason(r)}
                    style={[styles.presetChip, reportReason === r && styles.presetChipOn]}
                  >
                    <Text style={[styles.presetChipText, reportReason === r && styles.presetChipTextOn]}>{r}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
              <TextInput
                style={styles.composeInput}
                placeholder="Ek açıklama (isteğe bağlı)"
                placeholderTextColor={TEXT_SECONDARY}
                value={reportDetails}
                onChangeText={setReportDetails}
                multiline
                maxLength={2000}
              />
              <GradientButton
                label="Şikayeti gönder"
                loading={reportBusy}
                onPress={() => void submitReport()}
                style={{ marginTop: 16 }}
              />
              <TouchableOpacity style={styles.closeLink} onPress={() => setReportOpen(false)}>
                <Text style={styles.closeLinkText}>Vazgeç</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.discoveryRoot} edges={['left', 'right', 'bottom']}>
      <ScreenHeaderGradient
        title="Leylek Muhabbeti"
        onBack={onBack}
        right={
          <View style={styles.headerRightRow}>
            <TouchableOpacity
              onPress={() => router.push('/muhabbet-conversations')}
              style={styles.headerIcon}
              accessibilityRole="button"
              accessibilityLabel="Sohbetler"
            >
              <Ionicons name="chatbubbles-outline" size={24} color="#FFFFFF" />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setShowCityModal(true)}
              style={styles.headerIcon}
              accessibilityRole="button"
            >
              <Ionicons name="location-outline" size={24} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        }
      />

      <TouchableOpacity
        style={styles.cityChipLight}
        onPress={() => setShowCityModal(true)}
        activeOpacity={0.88}
      >
        <View style={styles.cityChipLightInner}>
          <Ionicons name={theme.icon} size={18} color={ACCENT} />
          <Text style={styles.cityChipLightText}>{selectedCity}</Text>
          <Ionicons name="chevron-down" size={18} color={TEXT_SECONDARY} />
        </View>
      </TouchableOpacity>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={ACCENT} />}
        showsVerticalScrollIndicator={false}
      >
        {tok ? (
          <RouteSummaryCard
            apiBaseUrl={apiBaseUrl}
            accessToken={tok}
            enabled={!!tok}
            onNavigateToGroup={onNavigateToGroup ?? (() => {})}
            onNavigateToRouteSetup={onNavigateToRouteSetup ?? (() => {})}
            horizontalInset={16}
          />
        ) : null}

        {tok ? (
          <View style={styles.sectionBlock}>
            <Text style={styles.sectionTitle}>🔥 Aynı Güzergahı Kullananlar</Text>
            <Text style={styles.sectionSubtitle}>
              {selectedCity} · aynı rota, tek kart
            </Text>
            {roadstersLoading && !roadstersSummary ? (
              <ActivityIndicator color={ACCENT} style={{ marginVertical: 12 }} />
            ) : null}
            {!roadstersSummary?.route?.trim() ? (
              <View style={styles.roadsterCard}>
                <Text style={styles.roadsterEmptyLine}>
                  Güzergah eklediğinde aynı hat üzerindekileri burada görürsün; Muhabbet akışıyla bağlantı kurulur.
                </Text>
                {onNavigateToRouteSetup ? (
                  <GradientButton
                    label="Güzergah ekle"
                    onPress={onNavigateToRouteSetup}
                    style={{ marginTop: 12 }}
                  />
                ) : null}
              </View>
            ) : (
              (() => {
                const r = roadstersSummary!.route!.trim();
                const { from, to } = parseRouteEndpoints(r);
                const n = roadstersMatches.length;
                return (
                  <View>
                    <View style={styles.roadsterCard}>
                      <Text style={styles.roadsterRouteLine} numberOfLines={2}>
                        📍 {from} → {to}
                      </Text>
                      <Text style={styles.roadsterMeta}>
                        {n > 0 ? `🔥 ${n} kişi bu rotada` : 'Henüz kimse yok, ama ilk sen olabilirsin 🚀'}
                      </Text>
                    </View>
                    {roadstersSummary!.has_group && roadstersSummary!.group_id ? (
                      <GradientButton
                        label="Gruba Git"
                        onPress={() => onNavigateToGroup?.(roadstersSummary!.group_id!)}
                        style={styles.roadsterSectionCta}
                      />
                    ) : onNavigateToRouteSetup ? (
                      <GradientButton
                        label="Keşfet"
                        onPress={onNavigateToRouteSetup}
                        style={styles.roadsterSectionCta}
                      />
                    ) : null}
                  </View>
                );
              })()
            )}
          </View>
        ) : null}

        {tok ? (
          <View style={styles.sectionBlock}>
            <LeylekMuhabbetiListingInboxBlock
              apiUrl={apiUrl}
              accessToken={tok}
              selectedCity={selectedCity}
              syncVersion={inboxSync}
              requireToken={requireMuhabbetToken}
            />
          </View>
        ) : null}

        <View style={styles.sectionBlock}>
          <Text style={styles.sectionTitle}>Senin İnsanların</Text>
          <Text style={styles.sectionSubtitle}>Aynı rota, aynı mahalle, aynı şehir</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.insightRow}
          >
            {peopleInsights.map((ins) => (
              <View key={ins.key} style={styles.insightCard}>
                <Text style={styles.insightCardTitle}>{ins.title}</Text>
                <Text style={styles.insightCardLine} numberOfLines={1}>
                  {ins.line}
                </Text>
                <Text style={styles.insightCardHint} numberOfLines={2}>
                  {ins.hint}
                </Text>
              </View>
            ))}
          </ScrollView>
        </View>

        <View style={styles.sectionBlock}>
          <Text style={styles.sectionTitle}>Keşfet</Text>
          <Text style={styles.sectionSubtitle}>Mahallene göre grupları seç, sohbete katıl</Text>
          <Text style={styles.sectionEyebrow}>Mahalle</Text>
          {nLoading ? (
            <ActivityIndicator color={ACCENT} style={{ marginVertical: 16 }} />
          ) : neighborhoods.length === 0 ? (
            <View style={styles.emptyBoxLight}>
              <Ionicons name="map-outline" size={32} color={TEXT_SECONDARY} />
              <Text style={styles.emptyTitleLight}>Bu şehirde henüz mahalle yok</Text>
              <Text style={styles.emptySubLight}>
                Veri eklendiğinde mahalle ve gruplar burada listelenir. Şehir açılış talebi için aşağıdaki düğmeyi
                kullanabilirsiniz.
              </Text>
              <GradientButton
                variant="secondary"
                label="Şehir talebi gönder"
                onPress={() => void requestCityForMuhabbet(selectedCity)}
                style={{ marginTop: 16, alignSelf: 'stretch' }}
              />
            </View>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.nChipRow}>
              {neighborhoods.map((n) => {
                const active = n.id === selectedNeighborhoodId;
                return (
                  <TouchableOpacity
                    key={n.id}
                    onPress={() => setSelectedNeighborhoodId(n.id)}
                    style={[styles.nChipLight, active && styles.nChipLightActive]}
                  >
                    <Text style={[styles.nChipLightText, active && styles.nChipLightTextActive]}>{n.name}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          )}

          <View style={styles.discoveryGroupRow}>
            <Text style={[styles.sectionEyebrow, { marginTop: 20, marginBottom: 0 }]}>Gruplar</Text>
            {tok ? (
              <TouchableOpacity
                onPress={() => {
                  if (!selectedNeighborhoodId) {
                    Alert.alert('Mahalle', 'Önce mahalle seçin.');
                    return;
                  }
                  setCreateGroupOpen(true);
                }}
                activeOpacity={0.88}
                style={styles.suggestGroupBtnShell}
              >
                <LinearGradient
                  colors={['#FF8A00', '#FFB347']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={StyleSheet.absoluteFill}
                />
                <View style={styles.suggestGroupBtnInner}>
                  <Ionicons name="add-circle-outline" size={18} color="#FFFFFF" />
                  <Text style={styles.suggestGroupBtnTextGrad}>Yeni grup öner</Text>
                </View>
              </TouchableOpacity>
            ) : null}
          </View>
          {selectedNeighborhoodId && neighborhoods.length > 0 ? (
            <Text style={styles.groupsScopeHintLight}>
              <Text style={{ fontWeight: '600', color: TEXT_PRIMARY }}>
                {neighborhoods.find((n) => n.id === selectedNeighborhoodId)?.name ?? '—'}
              </Text>{' '}
              mahallesindeki gruplar. Aynı isim farklı mahallelerde ayrı gruptur.
            </Text>
          ) : null}
          {gLoading ? (
            <ActivityIndicator color={ACCENT} style={{ marginVertical: 16 }} />
          ) : groups.length === 0 ? (
            <Text style={styles.mutedLight}>
              {selectedNeighborhoodId ? 'Bu mahallede henüz grup yok.' : 'Önce mahalle seçin.'}
            </Text>
          ) : (
            groups.map((item) => {
              const member = myGroupIds.has(item.id);
              const mahalleLabel =
                (item.neighborhood_name && item.neighborhood_name.trim()) ||
                neighborhoods.find((n) => n.id === item.neighborhood_id)?.name ||
                'Mahalle';
              const activityLine =
                (item.description && item.description.trim()) || 'Mahalle sohbeti ve duyurular';
              return (
                <TouchableOpacity
                  key={item.id}
                  style={styles.groupCardLight}
                  onPress={() => void openGroupDetail(item)}
                  activeOpacity={0.92}
                >
                  <View style={styles.groupCardLightRow}>
                    <View style={styles.groupCardLightMain}>
                      <View style={styles.groupNeighPill}>
                        <Text style={styles.groupNeighPillText}>{mahalleLabel}</Text>
                      </View>
                      <Text style={styles.groupNameLight}>{item.name}</Text>
                      <Text style={styles.groupActivityLight} numberOfLines={2}>
                        {activityLine}
                      </Text>
                      <Text style={styles.groupMetaLightText}>
                        {item.member_count ?? 0} üye
                        {member ? ' · Üyesin' : ''}
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color="#C7C7CC" style={styles.groupChevron} />
                  </View>
                </TouchableOpacity>
              );
            })
          )}
        </View>

        <View style={styles.sectionBlock}>
          <Text style={styles.sectionTitle}>Akış</Text>
          <Text style={styles.sectionSubtitle}>
            Bir gruba üye olup detaydan &quot;Akışa git&quot; dediğinde gönderiler burada açılır; + ile fotoğraflı paylaşım
            ekleyebilirsin.
          </Text>
          <View style={styles.flowHintCard}>
            <Text style={styles.flowHintTitle}>Gönderi akışı</Text>
            <Text style={styles.flowHintBody}>
              Grup kartına dokun, katıl veya akışa geç. Oturumun yoksa üstteki uyarıya dikkat et.
            </Text>
          </View>
        </View>
      </ScrollView>

      <Modal visible={showCityModal} animationType="slide" onRequestClose={() => setShowCityModal(false)}>
        <SafeAreaView style={styles.modalRootLight} edges={['left', 'right', 'bottom']}>
          <ScreenHeaderGradient
            title="Şehir seç"
            onBack={() => setShowCityModal(false)}
            backIcon="close"
          />
          <View style={styles.searchRow}>
            <Ionicons name="search" size={20} color={TEXT_SECONDARY} />
            <TextInput
              style={styles.searchInput}
              placeholder="Şehir ara..."
              placeholderTextColor={TEXT_SECONDARY}
              value={citySearch}
              onChangeText={setCitySearch}
            />
          </View>
          <FlatList
            data={filteredCities}
            keyExtractor={(item) => item}
            numColumns={2}
            contentContainerStyle={styles.cityGrid}
            renderItem={({ item }) => {
              const th = getCityTheme(item);
              return (
                <TouchableOpacity
                  style={styles.cityCardWrap}
                  onPress={() => {
                    setSelectedCity(item);
                    setShowCityModal(false);
                  }}
                  activeOpacity={0.9}
                >
                  <LinearGradient colors={th.gradient} style={styles.cityCard}>
                    <Ionicons name={th.icon} size={26} color="#fff" />
                    <Text style={styles.cityCardText}>{item}</Text>
                  </LinearGradient>
                </TouchableOpacity>
              );
            }}
          />
        </SafeAreaView>
      </Modal>

      <Modal visible={createGroupOpen} animationType="slide" onRequestClose={() => setCreateGroupOpen(false)}>
        <SafeAreaView style={styles.modalRootLight} edges={['left', 'right', 'bottom']}>
          <ScreenHeaderGradient
            title="Yeni grup öner"
            onBack={() => setCreateGroupOpen(false)}
            backIcon="close"
          />
          <ScrollView contentContainerStyle={styles.modalScrollPad} keyboardShouldPersistTaps="handled">
            <Text style={styles.inputLabel}>Grup adı</Text>
            <TextInput
              style={styles.composeInput}
              placeholder="Örn. Sabah servisleri"
              placeholderTextColor={TEXT_SECONDARY}
              value={createGroupName}
              onChangeText={setCreateGroupName}
              maxLength={80}
            />
            <Text style={[styles.inputLabel, { marginTop: 14 }]}>Kısa açıklama (isteğe bağlı)</Text>
            <TextInput
              style={styles.composeInput}
              placeholder="Grubun konusu"
              placeholderTextColor={TEXT_SECONDARY}
              value={createGroupDesc}
              onChangeText={setCreateGroupDesc}
              multiline
              maxLength={500}
            />
            <Text style={styles.composeMuted}>
              Önerin yönetici onayına düşer; onaylanana kadar listede görünmez.
            </Text>
            <GradientButton
              label="Öneriyi gönder"
              loading={createGroupBusy}
              onPress={() => void submitCreateGroup()}
              style={{ marginTop: 20 }}
            />
          </ScrollView>
        </SafeAreaView>
      </Modal>

      <Modal visible={detailVisible} transparent animationType="fade" onRequestClose={() => setDetailVisible(false)}>
        <View style={styles.detailOverlay}>
          <TouchableOpacity style={styles.detailBackdrop} activeOpacity={1} onPress={() => setDetailVisible(false)} />
          <View style={styles.detailSheet}>
            {detailLoading || !detailGroup ? (
              <ActivityIndicator color={ACCENT} style={{ marginVertical: 24 }} />
            ) : (
              <>
                <Text style={styles.detailTitle}>{detailGroup.name}</Text>
                {detailGroup.neighborhood_name ? (
                  <Text style={styles.detailNeigh}>{detailGroup.neighborhood_name} · {detailGroup.city}</Text>
                ) : null}
                {String(detailGroup.status || 'approved').toLowerCase() === 'pending' ? (
                  <Text style={styles.detailPendingNote}>
                    Bu grup yönetici onayında. Onaylanana kadar keşifte görünmez; katılım ve akış kapalıdır.
                  </Text>
                ) : null}
                {String(detailGroup.status || 'approved').toLowerCase() === 'rejected' ? (
                  <Text style={styles.detailPendingNote}>Bu grup önerisi reddedilmiş.</Text>
                ) : null}
                {detailGroup.description ? (
                  <Text style={styles.detailBody}>{detailGroup.description}</Text>
                ) : null}
                <Text style={styles.detailMembers}>
                  {detailGroup.member_count ?? 0} üye
                  {detailGroup.is_member ? ' · Üyesiniz' : ''}
                </Text>
                {String(detailGroup.status || 'approved').toLowerCase() === 'approved' ? (
                  detailGroup.is_member || myGroupIds.has(detailGroup.id) ? (
                    <GradientButton label="Akışa git" onPress={openFeedFromDetail} style={{ marginTop: 16 }} />
                  ) : (
                    <GradientButton
                      label="Gruba katıl"
                      loading={joinBusy}
                      onPress={() => void joinGroup()}
                      style={{ marginTop: 16 }}
                    />
                  )
                ) : null}
                <TouchableOpacity style={styles.closeLink} onPress={() => setDetailVisible(false)}>
                  <Text style={styles.closeLinkText}>Kapat</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  discoveryRoot: { flex: 1, backgroundColor: MUHAB_SURFACE },
  cityChipLight: {
    marginHorizontal: 16,
    marginBottom: 10,
    borderRadius: CARD_RADIUS,
    backgroundColor: CARD_BG,
    overflow: 'hidden',
    ...CARD_SHADOW,
  },
  cityChipLightInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  cityChipLightText: { flex: 1, color: TEXT_PRIMARY, fontSize: 16, fontWeight: '600', letterSpacing: -0.2 },
  feedRoot: { flex: 1, backgroundColor: MUHAB_SURFACE },
  feedListContent: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 100 },
  postCardLight: {
    backgroundColor: CARD_BG,
    borderRadius: CARD_RADIUS,
    marginBottom: 14,
    overflow: 'hidden',
    borderWidth: 0,
    ...CARD_SHADOW,
  },
  postImageLight: { width: '100%', height: 200, backgroundColor: '#EFEFF4' },
  postBodyLight: {
    color: TEXT_PRIMARY,
    fontSize: 16,
    paddingHorizontal: 16,
    paddingTop: 12,
    lineHeight: 24,
    letterSpacing: -0.2,
  },
  postMetaLight: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  postAuthorLight: { color: ACCENT, fontWeight: '600', fontSize: 14 },
  postTimeLight: { color: TEXT_SECONDARY, fontSize: 13 },
  mutedLight: { color: TEXT_SECONDARY, fontSize: 15, marginVertical: 10, lineHeight: 22 },
  root: { flex: 1, backgroundColor: '#0b1220' },
  headerRightRow: { flexDirection: 'row', alignItems: 'center' },
  headerIcon: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 0, paddingBottom: 36 },
  sectionBlock: { paddingHorizontal: 16, marginTop: 8 },
  sectionTitle: {
    color: TEXT_PRIMARY,
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: -0.35,
    marginTop: 4,
  },
  sectionSubtitle: {
    color: TEXT_SECONDARY,
    fontSize: 15,
    lineHeight: 20,
    marginTop: 6,
    marginBottom: 14,
  },
  sectionEyebrow: {
    color: TEXT_SECONDARY,
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.15,
    marginBottom: 10,
  },
  insightRow: { flexDirection: 'row', gap: 10, paddingRight: 16, paddingBottom: 4 },
  insightCard: {
    width: 148,
    minHeight: 112,
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: 18,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(60,60,67,0.08)',
    ...CARD_SHADOW,
  },
  insightCardTitle: {
    color: TEXT_SECONDARY,
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.2,
    marginBottom: 6,
  },
  insightCardLine: { color: TEXT_PRIMARY, fontSize: 16, fontWeight: '700', letterSpacing: -0.25 },
  insightCardHint: { color: TEXT_SECONDARY, fontSize: 12, lineHeight: 16, marginTop: 8 },
  nChipRow: { flexDirection: 'row', gap: 8, paddingVertical: 4 },
  nChipLight: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: CARD_BG,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E5E5EA',
    ...Platform.select({ ios: {}, android: { elevation: 0 }, default: {} }),
  },
  nChipLightActive: { backgroundColor: ACCENT, borderColor: ACCENT },
  nChipLightText: { color: TEXT_PRIMARY, fontWeight: '600', fontSize: 14 },
  nChipLightTextActive: { color: '#FFFFFF' },
  groupsScopeHintLight: {
    color: TEXT_SECONDARY,
    fontSize: 13,
    lineHeight: 20,
    marginBottom: 12,
  },
  discoveryGroupRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
    gap: 8,
  },
  suggestGroupBtnShell: {
    marginTop: 16,
    borderRadius: 14,
    overflow: 'hidden',
    minHeight: 44,
    justifyContent: 'center',
  },
  suggestGroupBtnInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 12,
    paddingHorizontal: 14,
    justifyContent: 'center',
  },
  suggestGroupBtnTextGrad: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  detailPendingNote: {
    color: TEXT_SECONDARY,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 10,
  },
  roadsterCard: {
    backgroundColor: CARD_BG,
    borderRadius: CARD_RADIUS,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 10,
    ...CARD_SHADOW,
  },
  roadsterEmptyLine: {
    color: TEXT_SECONDARY,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  roadsterRouteLine: {
    color: TEXT_PRIMARY,
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.25,
    lineHeight: 22,
  },
  roadsterMeta: {
    color: TEXT_SECONDARY,
    fontSize: 14,
    marginTop: 8,
    fontWeight: '600',
  },
  roadsterSectionCta: { marginTop: 6, marginBottom: 4 },
  groupCardLight: {
    backgroundColor: CARD_BG,
    borderRadius: CARD_RADIUS,
    paddingVertical: 16,
    paddingHorizontal: 16,
    marginBottom: 12,
    borderWidth: 0,
    ...CARD_SHADOW,
  },
  groupCardLightRow: { flexDirection: 'row', alignItems: 'center' },
  groupCardLightMain: { flex: 1, paddingRight: 8 },
  groupNeighPill: {
    alignSelf: 'flex-start',
    backgroundColor: '#EFEFF4',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    marginBottom: 8,
  },
  groupNeighPillText: { color: TEXT_SECONDARY, fontSize: 12, fontWeight: '600' },
  groupNameLight: { color: TEXT_PRIMARY, fontSize: 18, fontWeight: '700', letterSpacing: -0.28 },
  groupActivityLight: { color: TEXT_SECONDARY, fontSize: 14, lineHeight: 20, marginTop: 6 },
  groupMetaLightText: { color: TEXT_SECONDARY, fontSize: 13, marginTop: 10, fontWeight: '500' },
  groupChevron: { marginTop: 4 },
  emptyBoxLight: {
    backgroundColor: CARD_BG,
    borderRadius: CARD_RADIUS,
    padding: 20,
    alignItems: 'center',
    ...CARD_SHADOW,
  },
  emptyTitleLight: { color: TEXT_PRIMARY, fontSize: 17, fontWeight: '700', marginTop: 10, textAlign: 'center' },
  emptySubLight: { color: TEXT_SECONDARY, fontSize: 14, marginTop: 8, textAlign: 'center', lineHeight: 20 },
  flowHintCard: {
    backgroundColor: CARD_BG,
    borderRadius: CARD_RADIUS,
    paddingVertical: 18,
    paddingHorizontal: 18,
    marginBottom: 8,
    ...CARD_SHADOW,
  },
  flowHintTitle: { color: TEXT_PRIMARY, fontSize: 17, fontWeight: '700', letterSpacing: -0.25 },
  flowHintBody: { color: TEXT_SECONDARY, fontSize: 14, lineHeight: 20, marginTop: 8 },
  muted: { color: TEXT_SECONDARY, fontStyle: 'italic', marginVertical: 8 },
  modalRootLight: { flex: 1, backgroundColor: MUHAB_SURFACE },
  modalScrollPad: { padding: 16, paddingBottom: 40 },
  modalFlexFill: { flex: 1 },
  postDetailList: { flex: 1, backgroundColor: MUHAB_SURFACE },
  postDetailListContent: { paddingHorizontal: 16, paddingBottom: 120 },
  postDetailHeaderPad: { padding: 16 },
  sheetSectionLabel: {
    color: TEXT_SECONDARY,
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.15,
    marginTop: 20,
  },
  composeMuted: { color: TEXT_SECONDARY, fontSize: 15, lineHeight: 22, textAlign: 'center' },
  btnDisabled: { opacity: 0.45 },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: 16,
    marginBottom: 10,
    marginTop: 4,
    backgroundColor: CARD_BG,
    borderRadius: BTN_RADIUS,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: BORDER_HAIRLINE,
    ...CARD_SHADOW,
  },
  searchInput: { flex: 1, color: TEXT_PRIMARY, fontSize: 16 },
  cityGrid: { paddingHorizontal: 10, paddingBottom: 24 },
  cityCardWrap: { width: '50%', padding: 6 },
  cityCard: {
    borderRadius: 14,
    paddingVertical: 18,
    paddingHorizontal: 10,
    alignItems: 'center',
    minHeight: 96,
    justifyContent: 'center',
  },
  cityCardText: { color: '#fff', fontWeight: '700', marginTop: 8, textAlign: 'center', fontSize: 13 },
  detailOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
  detailBackdrop: { flex: 1 },
  detailSheet: {
    backgroundColor: CARD_BG,
    borderTopLeftRadius: CARD_RADIUS,
    borderTopRightRadius: CARD_RADIUS,
    padding: 22,
    paddingBottom: 28,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: BORDER_HAIRLINE,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.06,
        shadowRadius: 12,
      },
      android: { elevation: 8 },
      default: {},
    }),
  },
  detailTitle: { color: TEXT_PRIMARY, fontSize: 20, fontWeight: '700', letterSpacing: -0.35 },
  detailNeigh: { color: TEXT_SECONDARY, marginTop: 6, fontSize: 14, lineHeight: 20 },
  detailBody: { color: TEXT_PRIMARY, marginTop: 12, fontSize: 15, lineHeight: 22 },
  detailMembers: { color: TEXT_SECONDARY, marginTop: 14, fontSize: 13 },
  closeLink: { marginTop: 14, alignItems: 'center', paddingVertical: 8 },
  closeLinkText: { color: ACCENT, fontSize: 16, fontWeight: '600' },
  postCard: {
    backgroundColor: CARD_BG,
    borderRadius: CARD_RADIUS,
    marginBottom: 14,
    overflow: 'hidden',
    borderWidth: 0,
    ...CARD_SHADOW,
  },
  postImage: { width: '100%', height: 200, backgroundColor: FIELD_BG },
  postBody: { color: TEXT_PRIMARY, fontSize: 15, paddingHorizontal: 14, paddingTop: 10, lineHeight: 22 },
  postMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  postAuthor: { color: ACCENT, fontWeight: '600', fontSize: 13 },
  postTime: { color: TEXT_SECONDARY, fontSize: 12 },
  composeInput: {
    backgroundColor: FIELD_BG,
    borderRadius: BTN_RADIUS,
    padding: 14,
    color: TEXT_PRIMARY,
    minHeight: 100,
    textAlignVertical: 'top',
    fontSize: 16,
    lineHeight: 22,
  },
  inputLabel: { color: TEXT_SECONDARY, fontSize: 13, fontWeight: '600', marginBottom: 8 },
  imagePick: {
    minHeight: 160,
    borderRadius: BTN_RADIUS,
    backgroundColor: FIELD_BG,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: BORDER_HAIRLINE,
  },
  imagePickImg: { width: '100%', height: 200 },
  detailHero: { width: '100%', height: 240, backgroundColor: FIELD_BG },
  detailCaption: { color: TEXT_PRIMARY, fontSize: 16, lineHeight: 24, letterSpacing: -0.2 },
  detailMeta: { color: TEXT_SECONDARY, marginTop: 10, fontSize: 13 },
  commentRow: {
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: BORDER_HAIRLINE,
  },
  commentAuthor: { color: ACCENT, fontWeight: '600', fontSize: 14 },
  commentBody: { color: TEXT_PRIMARY, marginTop: 4, fontSize: 15, lineHeight: 22 },
  commentTime: { color: TEXT_SECONDARY, fontSize: 12, marginTop: 6 },
  commentBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: BORDER_HAIRLINE,
    backgroundColor: CARD_BG,
    gap: 8,
  },
  commentInput: {
    flex: 1,
    backgroundColor: FIELD_BG,
    borderRadius: BTN_RADIUS,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: TEXT_PRIMARY,
    maxHeight: 120,
    fontSize: 16,
  },
  commentSendShell: {
    width: 48,
    height: 48,
    borderRadius: 14,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  commentSendInner: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  presetChip: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: FIELD_BG,
    marginRight: 8,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  presetChipOn: { borderColor: ACCENT, backgroundColor: 'rgba(0, 122, 255, 0.1)' },
  presetChipText: { color: TEXT_PRIMARY, fontSize: 13, fontWeight: '600' },
  presetChipTextOn: { color: ACCENT },
  sessionBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginHorizontal: 16,
    marginBottom: 10,
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#422006',
    borderWidth: 1,
    borderColor: '#a16207',
  },
  sessionBannerText: { flex: 1, color: '#fef3c7', fontSize: 13, lineHeight: 19 },
});
