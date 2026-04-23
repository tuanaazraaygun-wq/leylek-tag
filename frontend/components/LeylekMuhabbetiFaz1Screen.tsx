/**
 * Leylek Muhabbeti v1 — Faz 1–2: şehir / mahalle / grup / katılım + grup akışı, gönderi, yorum, şikayet.
 * Faz 2: Bearer access_token zorunlu (presign, gönderi, feed, yorum, şikayet).
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
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
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';

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

export interface LeylekMuhabbetiFaz1ScreenProps {
  user: { id: string; name: string; role: string; city?: string; rating?: number };
  onBack: () => void;
  apiUrl: string;
  accessToken?: string | null;
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

export default function LeylekMuhabbetiFaz1Screen({
  user,
  onBack,
  apiUrl,
  accessToken,
}: LeylekMuhabbetiFaz1ScreenProps) {
  const tok = (accessToken || '').trim();

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
    if (!feedGroup || !tok) return;
    setFeedLoading(true);
    try {
      const q = new URLSearchParams({ limit: '30', offset: '0' });
      const res = await fetch(`${apiUrl}/muhabbet/groups/${feedGroup.id}/feed?${q.toString()}`, {
        headers: authHeaders(tok, false),
      });
      const data = await res.json();
      if (data.success && Array.isArray(data.posts)) {
        setFeedPosts(data.posts);
      } else {
        setFeedPosts([]);
        if (data.detail) Alert.alert('Akış', String(data.detail));
      }
    } catch {
      setFeedPosts([]);
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

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([loadNeighborhoods(), loadGroups(), loadMyGroups()]);
    if (feedGroup) await loadFeed();
    setRefreshing(false);
  }, [loadNeighborhoods, loadGroups, loadMyGroups, feedGroup, loadFeed]);

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
    if (!tok) {
      Alert.alert('Oturum', 'Paylaşım için uygulamada oturum jetonu gerekir. Lütfen yeniden giriş yapın.');
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

  const openPostDetail = async (p: PostRow) => {
    if (!tok) return;
    setPostDetailVisible(true);
    setPostDetailLoading(true);
    setPostDetail(p);
    setNewComment('');
    try {
      const res = await fetch(`${apiUrl}/muhabbet/posts/${p.id}`, { headers: authHeaders(tok, false) });
      const data = await res.json();
      if (data.success && data.post) setPostDetail(data.post);
    } catch {
      /* */
    }
    setPostDetailLoading(false);
    setCommentsLoading(true);
    try {
      const res = await fetch(`${apiUrl}/muhabbet/posts/${p.id}/comments`, { headers: authHeaders(tok, false) });
      const data = await res.json();
      if (data.success && Array.isArray(data.comments)) setComments(data.comments);
      else setComments([]);
    } catch {
      setComments([]);
    }
    setCommentsLoading(false);
  };

  const submitComment = async () => {
    if (!postDetail || !tok) return;
    const t = newComment.trim();
    if (!t) return;
    setCommentBusy(true);
    try {
      const res = await fetch(`${apiUrl}/muhabbet/posts/${postDetail.id}/comments`, {
        method: 'POST',
        headers: authHeaders(tok),
        body: JSON.stringify({ user_id: user.id, body: t }),
      });
      const data = await res.json();
      if (data.success && data.comment) {
        setComments((prev) => [...prev, data.comment]);
        setNewComment('');
      } else {
        const msg = (data.detail as string) || JSON.stringify(data);
        Alert.alert('Yorum', msg);
      }
    } catch {
      Alert.alert('Yorum', 'Gönderilemedi');
    }
    setCommentBusy(false);
  };

  const submitReport = async () => {
    if (!postDetail || !tok) return;
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
      const data = await res.json();
      if (data.success) {
        if (data.already_reported) {
          Alert.alert('Şikayet', 'Bu gönderiyi zaten şikayet ettiniz.');
        } else {
          Alert.alert('Teşekkürler', 'Şikayetiniz kaydedildi.');
        }
        setReportOpen(false);
        setReportReason('');
        setReportDetails('');
      } else {
        Alert.alert('Şikayet', (data.detail as string) || 'Kayıt başarısız');
      }
    } catch {
      Alert.alert('Şikayet', 'Bağlantı hatası');
    }
    setReportBusy(false);
  };

  const pickImageForCompose = async () => {
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
    if (!feedGroup || !tok) return;
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
    if (cap.length > 500) {
      Alert.alert('Gönderi', 'Açıklama en fazla 500 karakter olabilir.');
      return;
    }
    setComposeBusy(true);
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
      const pj = await pres.json();
      if (!pj.success || !pj.signed_url || !pj.path) {
        Alert.alert('Yükleme', (pj.detail as string) || 'İmzalı URL alınamadı');
        setComposeBusy(false);
        return;
      }
      const up = await putLocalImageToSignedUrl(fileUri, String(pj.signed_url), composeMime);
      if (!up.ok) {
        Alert.alert(
          'Yükleme',
          up.status ? `Depolama hatası (${up.status})` : up.message || 'Yükleme başarısız',
        );
        setComposeBusy(false);
        return;
      }
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
      const cj = await cr.json();
      if (cj.success) {
        setComposeOpen(false);
        setComposeCaption('');
        setComposeImageUri(null);
        await loadFeed();
        Alert.alert('Tamam', 'Gönderiniz yayınlandı.');
      } else {
        Alert.alert('Gönderi', (cj.detail as string) || 'Kaydedilemedi');
      }
    } catch (e) {
      Alert.alert('Gönderi', e instanceof Error ? e.message : 'Bilinmeyen hata');
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

  if (feedGroup) {
    return (
      <SafeAreaView style={styles.root}>
        <LinearGradient colors={['#0b1220', '#111827']} style={StyleSheet.absoluteFill} />
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => {
              setFeedGroup(null);
              setFeedPosts([]);
            }}
            style={styles.headerIcon}
          >
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <View style={{ flex: 1, marginHorizontal: 8 }}>
            <Text style={styles.headerTitle} numberOfLines={1}>
              {feedGroup.name}
            </Text>
            <Text style={styles.headerSub} numberOfLines={1}>
              {feedGroup.neighborhood_name || ''} · {feedGroup.city}
            </Text>
          </View>
          <TouchableOpacity onPress={() => setComposeOpen(true)} style={styles.headerIcon}>
            <Ionicons name="add-circle-outline" size={28} color="#38BDF8" />
          </TouchableOpacity>
        </View>

        {feedLoading ? (
          <ActivityIndicator color="#38BDF8" style={{ marginTop: 24 }} />
        ) : (
          <FlatList
            data={feedPosts}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#38BDF8" />}
            ListEmptyComponent={
              <Text style={styles.muted}>Henüz gönderi yok. + ile ilk paylaşımı siz yapın.</Text>
            }
            renderItem={({ item }) => (
              <TouchableOpacity style={styles.postCard} onPress={() => void openPostDetail(item)} activeOpacity={0.9}>
                {item.image_url ? (
                  <Image source={{ uri: item.image_url }} style={styles.postImage} resizeMode="cover" />
                ) : null}
                <Text style={styles.postBody} numberOfLines={4}>
                  {item.body_text}
                </Text>
                <View style={styles.postMeta}>
                  <Text style={styles.postAuthor}>{item.author_name || 'Kullanıcı'}</Text>
                  <Text style={styles.postTime}>{formatPostTime(item.created_at)}</Text>
                </View>
              </TouchableOpacity>
            )}
          />
        )}

        <Modal visible={composeOpen} animationType="slide" onRequestClose={() => setComposeOpen(false)}>
          <SafeAreaView style={styles.modalRoot}>
            <LinearGradient colors={['#0f172a', '#1e293b']} style={StyleSheet.absoluteFill} />
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setComposeOpen(false)} style={styles.headerIcon}>
                <Ionicons name="close" size={24} color="#fff" />
              </TouchableOpacity>
              <Text style={styles.modalTitle}>Yeni gönderi</Text>
              <View style={{ width: 40 }} />
            </View>
            <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
              <Text style={styles.inputLabel}>Fotoğraf (zorunlu)</Text>
              <TouchableOpacity style={styles.imagePick} onPress={() => void pickImageForCompose()}>
                {composeImageUri ? (
                  <Image source={{ uri: composeImageUri }} style={styles.imagePickImg} resizeMode="cover" />
                ) : (
                  <Text style={styles.muted}>Galeriden seçmek için dokunun</Text>
                )}
              </TouchableOpacity>
              <Text style={[styles.inputLabel, { marginTop: 16 }]}>Kısa açıklama (zorunlu)</Text>
              <TextInput
                style={styles.composeInput}
                placeholder="Ne paylaşıyorsunuz?"
                placeholderTextColor="#64748b"
                value={composeCaption}
                onChangeText={setComposeCaption}
                multiline
                maxLength={500}
              />
              <TouchableOpacity
                style={[styles.joinBtn, composeBusy && styles.joinBtnDisabled]}
                disabled={composeBusy}
                onPress={() => void submitNewPost()}
              >
                {composeBusy ? (
                  <ActivityIndicator color="#0f172a" />
                ) : (
                  <Text style={styles.joinBtnText}>Yayınla</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </SafeAreaView>
        </Modal>

        <Modal visible={postDetailVisible} animationType="slide" onRequestClose={() => setPostDetailVisible(false)}>
          <SafeAreaView style={styles.modalRoot}>
            <LinearGradient colors={['#0b1220', '#111827']} style={StyleSheet.absoluteFill} />
            <View style={styles.header}>
              <TouchableOpacity onPress={() => setPostDetailVisible(false)} style={styles.headerIcon}>
                <Ionicons name="arrow-back" size={24} color="#fff" />
              </TouchableOpacity>
              <Text style={[styles.headerTitle, { flex: 1, marginHorizontal: 8 }]} numberOfLines={1}>
                Gönderi
              </Text>
              <TouchableOpacity onPress={() => setReportOpen(true)} style={styles.headerIcon}>
                <Ionicons name="flag-outline" size={22} color="#F97316" />
              </TouchableOpacity>
            </View>
            {postDetailLoading || !postDetail ? (
              <ActivityIndicator color="#38BDF8" style={{ marginTop: 24 }} />
            ) : (
              <KeyboardAvoidingView
                style={{ flex: 1 }}
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                keyboardVerticalOffset={88}
              >
                <FlatList
                  data={comments}
                  keyExtractor={(c) => c.id}
                  ListHeaderComponent={
                    <View>
                      {postDetail.image_url ? (
                        <Image source={{ uri: postDetail.image_url }} style={styles.detailHero} resizeMode="cover" />
                      ) : null}
                      <View style={{ padding: 16 }}>
                        <Text style={styles.detailCaption}>{postDetail.body_text}</Text>
                        <Text style={styles.detailMeta}>
                          {postDetail.author_name || 'Kullanıcı'} · {formatPostTime(postDetail.created_at)}
                        </Text>
                        <Text style={styles.sectionLabel}>Yorumlar</Text>
                      </View>
                    </View>
                  }
                  ListEmptyComponent={
                    commentsLoading ? (
                      <ActivityIndicator color="#38BDF8" style={{ marginVertical: 12 }} />
                    ) : (
                      <Text style={[styles.muted, { paddingHorizontal: 16 }]}>İlk yorumu siz yazın.</Text>
                    )
                  }
                  renderItem={({ item }) => (
                    <View style={styles.commentRow}>
                      <Text style={styles.commentAuthor}>{item.author_name || 'Kullanıcı'}</Text>
                      <Text style={styles.commentBody}>{item.body}</Text>
                      <Text style={styles.commentTime}>{formatPostTime(item.created_at)}</Text>
                    </View>
                  )}
                  contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 120 }}
                />
                <View style={styles.commentBar}>
                  <TextInput
                    style={styles.commentInput}
                    placeholder="Yorum yazın..."
                    placeholderTextColor="#64748b"
                    value={newComment}
                    onChangeText={setNewComment}
                    multiline
                    maxLength={800}
                  />
                  <TouchableOpacity
                    style={styles.commentSend}
                    disabled={commentBusy || !newComment.trim()}
                    onPress={() => void submitComment()}
                  >
                    {commentBusy ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <Ionicons name="send" size={22} color="#fff" />
                    )}
                  </TouchableOpacity>
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
                placeholderTextColor="#64748b"
                value={reportDetails}
                onChangeText={setReportDetails}
                multiline
                maxLength={2000}
              />
              <TouchableOpacity
                style={[styles.joinBtn, reportBusy && styles.joinBtnDisabled]}
                disabled={reportBusy}
                onPress={() => void submitReport()}
              >
                {reportBusy ? (
                  <ActivityIndicator color="#0f172a" />
                ) : (
                  <Text style={styles.joinBtnText}>Şikayeti gönder</Text>
                )}
              </TouchableOpacity>
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
    <SafeAreaView style={styles.root}>
      <LinearGradient colors={['#0b1220', '#111827']} style={StyleSheet.absoluteFill} />
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.headerIcon} accessibilityRole="button">
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Leylek Muhabbeti</Text>
        <TouchableOpacity
          onPress={() => setShowCityModal(true)}
          style={styles.headerIcon}
          accessibilityRole="button"
        >
          <Ionicons name="location" size={22} color="#38BDF8" />
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        style={styles.cityChip}
        onPress={() => setShowCityModal(true)}
        activeOpacity={0.85}
      >
        <LinearGradient colors={theme.gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.cityChipInner}>
          <Ionicons name={theme.icon} size={18} color="#fff" />
          <Text style={styles.cityChipText}>{selectedCity}</Text>
          <Ionicons name="chevron-down" size={18} color="#e2e8f0" />
        </LinearGradient>
      </TouchableOpacity>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#38BDF8" />}
      >
        <Text style={styles.sectionLabel}>Mahalle</Text>
        {nLoading ? (
          <ActivityIndicator color="#38BDF8" style={{ marginVertical: 16 }} />
        ) : neighborhoods.length === 0 ? (
          <View style={styles.emptyBox}>
            <Ionicons name="map-outline" size={36} color="#64748b" />
            <Text style={styles.emptyTitle}>Bu şehirde henüz mahalle yok</Text>
            <Text style={styles.emptySub}>
              Veri eklendiğinde mahalle ve gruplar burada listelenir. Şehir açılış talebi için aşağıdaki düğmeyi
              kullanabilirsiniz.
            </Text>
            <TouchableOpacity style={styles.secondaryBtn} onPress={() => void requestCityForMuhabbet(selectedCity)}>
              <Text style={styles.secondaryBtnText}>Şehir talebi gönder</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.nChipRow}>
            {neighborhoods.map((n) => {
              const active = n.id === selectedNeighborhoodId;
              return (
                <TouchableOpacity
                  key={n.id}
                  onPress={() => setSelectedNeighborhoodId(n.id)}
                  style={[styles.nChip, active && styles.nChipActive]}
                >
                  <Text style={[styles.nChipText, active && styles.nChipTextActive]}>{n.name}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        )}

        <Text style={styles.sectionLabel}>Gruplar</Text>
        {gLoading ? (
          <ActivityIndicator color="#38BDF8" style={{ marginVertical: 16 }} />
        ) : groups.length === 0 ? (
          <Text style={styles.muted}>
            {selectedNeighborhoodId ? 'Bu mahallede henüz grup yok.' : 'Önce mahalle seçin.'}
          </Text>
        ) : (
          groups.map((item) => {
            const member = myGroupIds.has(item.id);
            return (
              <TouchableOpacity
                key={item.id}
                style={styles.groupCard}
                onPress={() => void openGroupDetail(item)}
                activeOpacity={0.88}
              >
                <View style={styles.groupCardTop}>
                  <Text style={styles.groupName}>{item.name}</Text>
                  {member ? (
                    <View style={styles.badgeMember}>
                      <Text style={styles.badgeMemberText}>Üyesiniz</Text>
                    </View>
                  ) : null}
                </View>
                {item.description ? (
                  <Text style={styles.groupDesc} numberOfLines={2}>
                    {item.description}
                  </Text>
                ) : null}
                <View style={styles.groupMeta}>
                  <Ionicons name="people-outline" size={16} color="#94a3b8" />
                  <Text style={styles.groupMetaText}>{item.member_count ?? 0} üye</Text>
                </View>
              </TouchableOpacity>
            );
          })
        )}

        <View style={styles.feedHintBox}>
          <Text style={styles.feedTitle}>Gönderi akışı</Text>
          <Text style={styles.feedSub}>
            Üye olduğunuz bir grubu açıp &quot;Akışa git&quot; ile gerçek zamanlı paylaşımları görüntüleyebilir,
            fotoğraflı gönderi oluşturabilirsiniz.
          </Text>
        </View>
      </ScrollView>

      <Modal visible={showCityModal} animationType="slide" onRequestClose={() => setShowCityModal(false)}>
        <SafeAreaView style={styles.modalRoot}>
          <LinearGradient colors={['#0f172a', '#1e293b']} style={StyleSheet.absoluteFill} />
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowCityModal(false)} style={styles.headerIcon}>
              <Ionicons name="close" size={24} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Şehir seç</Text>
            <View style={{ width: 40 }} />
          </View>
          <View style={styles.searchRow}>
            <Ionicons name="search" size={20} color="#64748b" />
            <TextInput
              style={styles.searchInput}
              placeholder="Şehir ara..."
              placeholderTextColor="#64748b"
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

      <Modal visible={detailVisible} transparent animationType="fade" onRequestClose={() => setDetailVisible(false)}>
        <View style={styles.detailOverlay}>
          <TouchableOpacity style={styles.detailBackdrop} activeOpacity={1} onPress={() => setDetailVisible(false)} />
          <View style={styles.detailSheet}>
            {detailLoading || !detailGroup ? (
              <ActivityIndicator color="#38BDF8" style={{ marginVertical: 24 }} />
            ) : (
              <>
                <Text style={styles.detailTitle}>{detailGroup.name}</Text>
                {detailGroup.neighborhood_name ? (
                  <Text style={styles.detailNeigh}>{detailGroup.neighborhood_name} · {detailGroup.city}</Text>
                ) : null}
                {detailGroup.description ? (
                  <Text style={styles.detailBody}>{detailGroup.description}</Text>
                ) : null}
                <Text style={styles.detailMembers}>
                  {detailGroup.member_count ?? 0} üye
                  {detailGroup.is_member ? ' · Üyesiniz' : ''}
                </Text>
                {detailGroup.is_member || myGroupIds.has(detailGroup.id) ? (
                  <TouchableOpacity style={styles.joinBtn} onPress={openFeedFromDetail}>
                    <Text style={styles.joinBtnText}>Akışa git</Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    style={[styles.joinBtn, joinBusy && styles.joinBtnDisabled]}
                    disabled={joinBusy}
                    onPress={() => void joinGroup()}
                  >
                    {joinBusy ? (
                      <ActivityIndicator color="#0f172a" />
                    ) : (
                      <Text style={styles.joinBtnText}>Gruba katıl</Text>
                    )}
                  </TouchableOpacity>
                )}
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
  root: { flex: 1, backgroundColor: '#0b1220' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  headerIcon: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { color: '#fff', fontSize: 17, fontWeight: '700' },
  headerSub: { color: '#94a3b8', fontSize: 12, marginTop: 2 },
  cityChip: { marginHorizontal: 16, marginBottom: 8, borderRadius: 14, overflow: 'hidden' },
  cityChipInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  cityChipText: { flex: 1, color: '#fff', fontSize: 16, fontWeight: '600' },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingBottom: 32 },
  sectionLabel: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginTop: 16,
    marginBottom: 8,
  },
  nChipRow: { flexDirection: 'row', gap: 8, paddingVertical: 4 },
  nChip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#334155',
  },
  nChipActive: { backgroundColor: '#0ea5e9', borderColor: '#38bdf8' },
  nChipText: { color: '#cbd5e1', fontWeight: '600', fontSize: 14 },
  nChipTextActive: { color: '#fff' },
  groupCard: {
    backgroundColor: '#151f32',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#243045',
  },
  groupCardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  groupName: { color: '#fff', fontSize: 16, fontWeight: '700', flex: 1 },
  badgeMember: { backgroundColor: '#14532d', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  badgeMemberText: { color: '#86efac', fontSize: 11, fontWeight: '700' },
  groupDesc: { color: '#94a3b8', fontSize: 13, marginTop: 6 },
  groupMeta: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10 },
  groupMetaText: { color: '#94a3b8', fontSize: 13 },
  muted: { color: '#64748b', fontStyle: 'italic', marginVertical: 8 },
  emptyBox: {
    backgroundColor: '#151f32',
    borderRadius: 14,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#243045',
  },
  emptyTitle: { color: '#e2e8f0', fontSize: 16, fontWeight: '700', marginTop: 10, textAlign: 'center' },
  emptySub: { color: '#94a3b8', fontSize: 13, marginTop: 8, textAlign: 'center', lineHeight: 20 },
  secondaryBtn: {
    marginTop: 14,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#38bdf8',
  },
  secondaryBtnText: { color: '#38bdf8', fontWeight: '700' },
  feedHintBox: {
    marginTop: 24,
    borderRadius: 16,
    padding: 18,
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  feedTitle: { color: '#f8fafc', fontSize: 17, fontWeight: '800' },
  feedSub: { color: '#94a3b8', fontSize: 13, marginTop: 8, lineHeight: 20 },
  modalRoot: { flex: 1, backgroundColor: '#0f172a' },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  modalTitle: { color: '#fff', fontSize: 17, fontWeight: '700' },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: 16,
    marginBottom: 10,
    backgroundColor: '#1e293b',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  searchInput: { flex: 1, color: '#fff', fontSize: 16 },
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
    backgroundColor: '#111827',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 22,
    paddingBottom: 28,
    borderTopWidth: 1,
    borderColor: '#1f2937',
  },
  detailTitle: { color: '#fff', fontSize: 20, fontWeight: '800' },
  detailNeigh: { color: '#94a3b8', marginTop: 6, fontSize: 14 },
  detailBody: { color: '#cbd5e1', marginTop: 12, fontSize: 15, lineHeight: 22 },
  detailMembers: { color: '#64748b', marginTop: 14, fontSize: 13 },
  joinBtn: {
    marginTop: 18,
    backgroundColor: '#38bdf8',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  joinBtnDisabled: { opacity: 0.55 },
  joinBtnText: { color: '#0f172a', fontWeight: '800', fontSize: 16 },
  closeLink: { marginTop: 14, alignItems: 'center', paddingVertical: 8 },
  closeLinkText: { color: '#94a3b8', fontSize: 15 },
  postCard: {
    backgroundColor: '#151f32',
    borderRadius: 14,
    marginBottom: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#243045',
  },
  postImage: { width: '100%', height: 200, backgroundColor: '#1e293b' },
  postBody: { color: '#e2e8f0', fontSize: 15, paddingHorizontal: 14, paddingTop: 10, lineHeight: 22 },
  postMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  postAuthor: { color: '#38bdf8', fontWeight: '600', fontSize: 13 },
  postTime: { color: '#64748b', fontSize: 12 },
  composeInput: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 12,
    color: '#fff',
    minHeight: 100,
    textAlignVertical: 'top',
  },
  inputLabel: { color: '#94a3b8', fontSize: 13, fontWeight: '600', marginBottom: 8 },
  imagePick: {
    minHeight: 160,
    borderRadius: 12,
    backgroundColor: '#1e293b',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  imagePickImg: { width: '100%', height: 200 },
  detailHero: { width: '100%', height: 240, backgroundColor: '#1e293b' },
  detailCaption: { color: '#f1f5f9', fontSize: 16, lineHeight: 24 },
  detailMeta: { color: '#64748b', marginTop: 10, fontSize: 13 },
  commentRow: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1f2937',
  },
  commentAuthor: { color: '#38bdf8', fontWeight: '700', fontSize: 13 },
  commentBody: { color: '#e2e8f0', marginTop: 4, fontSize: 15 },
  commentTime: { color: '#64748b', fontSize: 11, marginTop: 6 },
  commentBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 10,
    borderTopWidth: 1,
    borderTopColor: '#243045',
    backgroundColor: '#0f172a',
    gap: 8,
  },
  commentInput: {
    flex: 1,
    backgroundColor: '#1e293b',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#fff',
    maxHeight: 120,
  },
  commentSend: {
    backgroundColor: '#0ea5e9',
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  presetChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#1e293b',
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  presetChipOn: { borderColor: '#38bdf8', backgroundColor: '#0c4a6e' },
  presetChipText: { color: '#cbd5e1', fontSize: 13, fontWeight: '600' },
  presetChipTextOn: { color: '#fff' },
});
