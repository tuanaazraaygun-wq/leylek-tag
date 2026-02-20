/**
 * Leylek Muhabbeti (Community) Screen
 * v3 - ŞEHİR BAZLI TOPLULUK + ANINDA MESAJ
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  Dimensions,
  RefreshControl,
  Modal,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { io, Socket } from 'socket.io-client';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Renkler
const COLORS = {
  primary: '#3FA9F5',
  secondary: '#1E5F8A',
  background: '#FFFFFF',
  cardBg: '#F8FAFC',
  text: '#1F2937',
  textLight: '#6B7280',
  border: '#E5E7EB',
  passengerBadge: '#10B981',
  driverBadge: '#F59E0B',
  like: '#EF4444',
  likeActive: '#DC2626',
};

// Türkiye şehirleri
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
  'Tekirdağ', 'Tokat', 'Trabzon', 'Tunceli', 'Uşak', 'Van', 'Yalova', 'Yozgat', 'Zonguldak'
];

// Socket URL
const SOCKET_URL = 'https://socket.leylektag.com';

// Mesaj tipi
interface CommunityMessage {
  id: string;
  user_id: string;
  name: string;
  role: 'passenger' | 'driver';
  content: string;
  likes_count: number;
  created_at: string;
  city?: string;
  _temp?: boolean;
}

interface CommunityScreenProps {
  user: {
    id: string;
    name: string;
    role: string;
    city?: string;
  };
  onBack: () => void;
  apiUrl: string;
}

export default function CommunityScreen({ user, onBack, apiUrl }: CommunityScreenProps) {
  const [selectedCity, setSelectedCity] = useState<string>(user.city || '');
  const [showCityPicker, setShowCityPicker] = useState(!user.city);
  const [citySearch, setCitySearch] = useState('');
  
  const [messages, setMessages] = useState<CommunityMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [onlineCount, setOnlineCount] = useState(0);
  const [likedMessages, setLikedMessages] = useState<Set<string>>(new Set());
  const [lastSentTime, setLastSentTime] = useState(0);
  
  const socketRef = useRef<Socket | null>(null);
  const flatListRef = useRef<FlatList>(null);

  // Filtrelenmiş şehirler
  const filteredCities = CITIES.filter(city =>
    city.toLowerCase().includes(citySearch.toLowerCase())
  );

  // Socket bağlantısı
  useEffect(() => {
    if (!selectedCity) return;
    
    console.log('🐦 [Community] Socket bağlanıyor... Şehir:', selectedCity);
    
    const socket = io(SOCKET_URL, {
      path: '/socket.io',
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    });

    socket.on('connect', () => {
      console.log('🐦 [Community] Socket bağlandı:', socket.id);
      socket.emit('community_join', {
        user_id: user.id,
        name: user.name,
        role: user.role,
        city: selectedCity,
      });
    });

    // YENİ MESAJ - sadece aynı şehirden olanları göster
    socket.on('community_new_message', (data: CommunityMessage) => {
      if (data.city !== selectedCity) return; // Farklı şehirse ignore
      
      console.log('🐦 [Community] Yeni mesaj:', data.name);
      
      setMessages(prev => {
        const exists = prev.some(m => m.id === data.id);
        if (exists) return prev;
        
        const tempIndex = prev.findIndex(m => m._temp && m.user_id === data.user_id && m.content === data.content);
        if (tempIndex !== -1) {
          const newMessages = [...prev];
          newMessages[tempIndex] = { ...data, _temp: false };
          return newMessages;
        }
        
        return [data, ...prev];
      });
    });

    socket.on('community_like_update', (data: { message_id: string; likes_count: number }) => {
      setMessages(prev =>
        prev.map(msg =>
          msg.id === data.message_id ? { ...msg, likes_count: data.likes_count } : msg
        )
      );
    });

    socket.on('community_user_count', (data: { count: number }) => {
      setOnlineCount(data.count);
    });

    socket.on('disconnect', () => {
      console.log('🐦 [Community] Socket bağlantısı kesildi');
    });

    socketRef.current = socket;

    return () => {
      socket.emit('community_leave', { user_id: user.id });
      socket.disconnect();
    };
  }, [user, selectedCity]);

  // Mesajları yükle - şehre göre
  const fetchMessages = useCallback(async () => {
    if (!selectedCity) return;
    
    setLoading(true);
    try {
      const response = await fetch(`${apiUrl}/community/messages?limit=50&offset=0&city=${encodeURIComponent(selectedCity)}`);
      const data = await response.json();
      
      if (data.success) {
        setMessages(data.messages);
      }
    } catch (error) {
      console.error('❌ [Community] Mesaj yükleme hatası:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [apiUrl, selectedCity]);

  useEffect(() => {
    if (selectedCity) {
      fetchMessages();
    }
  }, [selectedCity, fetchMessages]);

  // Şehir seç
  const handleCitySelect = (city: string) => {
    setSelectedCity(city);
    setShowCityPicker(false);
    setCitySearch('');
  };

  // MESAJ GÖNDER - ANINDA
  const handleSendMessage = async () => {
    const messageContent = newMessage.trim();
    if (!messageContent) return;
    
    if (messageContent.length > 300) {
      Alert.alert('Uyarı', 'Mesaj 300 karakterden uzun olamaz');
      return;
    }

    const now = Date.now();
    if (now - lastSentTime < 2000) {
      Alert.alert('Bekleyin', 'Çok hızlı gönderiyorsunuz');
      return;
    }

    // ANINDA GÖSTER
    const tempId = `temp_${Date.now()}`;
    const tempMessage: CommunityMessage = {
      id: tempId,
      user_id: user.id,
      name: user.name,
      role: user.role as 'passenger' | 'driver',
      content: messageContent,
      likes_count: 0,
      created_at: new Date().toISOString(),
      city: selectedCity,
      _temp: true,
    };

    setMessages(prev => [tempMessage, ...prev]);
    setNewMessage('');
    setLastSentTime(now);

    // Arka planda kaydet
    try {
      const response = await fetch(`${apiUrl}/community/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: user.id,
          name: user.name,
          role: user.role,
          content: messageContent,
          city: selectedCity,
        }),
      });

      const data = await response.json();

      if (data.success && data.message) {
        socketRef.current?.emit('community_message', data.message);
        setMessages(prev =>
          prev.map(msg =>
            msg.id === tempId ? { ...data.message, _temp: false } : msg
          )
        );
      } else {
        setMessages(prev => prev.filter(msg => msg.id !== tempId));
        Alert.alert('Hata', data.error || 'Mesaj gönderilemedi');
      }
    } catch (error) {
      setMessages(prev => prev.filter(msg => msg.id !== tempId));
      Alert.alert('Hata', 'Bağlantı hatası');
    }
  };

  // Beğen
  const handleLike = async (messageId: string) => {
    if (likedMessages.has(messageId)) return;

    setLikedMessages(prev => new Set([...prev, messageId]));
    setMessages(prev =>
      prev.map(msg =>
        msg.id === messageId ? { ...msg, likes_count: msg.likes_count + 1 } : msg
      )
    );

    try {
      const response = await fetch(`${apiUrl}/community/like`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message_id: messageId, user_id: user.id }),
      });
      const data = await response.json();
      if (data.success) {
        socketRef.current?.emit('community_like', { message_id: messageId, likes_count: data.likes_count });
      }
    } catch (error) {
      console.error('❌ Beğeni hatası:', error);
    }
  };

  // Şikayet
  const handleReport = (messageId: string) => {
    Alert.alert('Şikayet Et', 'Bu mesajı şikayet etmek istiyor musunuz?', [
      { text: 'İptal', style: 'cancel' },
      {
        text: 'Şikayet Et',
        style: 'destructive',
        onPress: async () => {
          await fetch(`${apiUrl}/community/report`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message_id: messageId, reporter_id: user.id }),
          });
          Alert.alert('Teşekkürler', 'Şikayetiniz alındı');
        },
      },
    ]);
  };

  // Zaman formatla
  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'Az önce';
    if (diffMins < 60) return `${diffMins} dk`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours} saat`;
    return date.toLocaleDateString('tr-TR');
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  // Mesaj kartı
  const renderMessage = ({ item }: { item: CommunityMessage }) => {
    const isLiked = likedMessages.has(item.id);
    const isOwn = item.user_id === user.id;
    const isTemp = item._temp;

    return (
      <View style={[styles.messageCard, isTemp && styles.messageCardTemp]}>
        <View style={styles.messageHeader}>
          <View style={[styles.avatar, { backgroundColor: item.role === 'driver' ? COLORS.driverBadge : COLORS.passengerBadge }]}>
            <Text style={styles.avatarText}>{getInitials(item.name)}</Text>
          </View>
          <View style={styles.headerInfo}>
            <View style={styles.nameRow}>
              <Text style={styles.userName}>{item.name}</Text>
              <View style={[styles.roleBadge, { backgroundColor: item.role === 'driver' ? COLORS.driverBadge : COLORS.passengerBadge }]}>
                <Text style={styles.roleText}>{item.role === 'driver' ? 'Sürücü' : 'Yolcu'}</Text>
              </View>
              {isTemp && <ActivityIndicator size="small" color={COLORS.primary} style={{ marginLeft: 8 }} />}
            </View>
            <Text style={styles.timeText}>{formatTime(item.created_at)}</Text>
          </View>
        </View>

        <Text style={styles.messageContent}>{item.content}</Text>

        <View style={styles.messageActions}>
          <TouchableOpacity style={styles.actionButton} onPress={() => handleLike(item.id)} disabled={isLiked || isTemp}>
            <Ionicons name={isLiked ? 'heart' : 'heart-outline'} size={20} color={isLiked ? COLORS.likeActive : COLORS.textLight} />
            <Text style={[styles.actionText, isLiked && { color: COLORS.likeActive }]}>{item.likes_count}</Text>
          </TouchableOpacity>
          {!isOwn && !isTemp && (
            <TouchableOpacity style={styles.actionButton} onPress={() => handleReport(item.id)}>
              <Ionicons name="flag-outline" size={18} color={COLORS.textLight} />
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  // ŞEHİR SEÇİM MODAL
  if (showCityPicker || !selectedCity) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.cityPickerContainer}>
          {/* Header */}
          <View style={styles.cityPickerHeader}>
            <TouchableOpacity onPress={onBack} style={styles.backButton}>
              <Ionicons name="arrow-back" size={24} color={COLORS.secondary} />
            </TouchableOpacity>
            <Text style={styles.cityPickerTitle}>🐦 Leylek Muhabbeti</Text>
            <View style={{ width: 40 }} />
          </View>

          {/* Açıklama */}
          <View style={styles.cityPickerInfo}>
            <Ionicons name="location" size={40} color={COLORS.primary} />
            <Text style={styles.cityPickerInfoTitle}>Şehir Seçin</Text>
            <Text style={styles.cityPickerInfoText}>Hangi şehrin topluluğuna katılmak istiyorsunuz?</Text>
          </View>

          {/* Arama */}
          <View style={styles.searchContainer}>
            <Ionicons name="search" size={20} color={COLORS.textLight} />
            <TextInput
              style={styles.searchInput}
              placeholder="Şehir ara..."
              placeholderTextColor={COLORS.textLight}
              value={citySearch}
              onChangeText={setCitySearch}
            />
          </View>

          {/* Şehir listesi */}
          <ScrollView style={styles.cityList} showsVerticalScrollIndicator={false}>
            {filteredCities.map(city => (
              <TouchableOpacity
                key={city}
                style={styles.cityItem}
                onPress={() => handleCitySelect(city)}
              >
                <Ionicons name="location-outline" size={20} color={COLORS.primary} />
                <Text style={styles.cityItemText}>{city}</Text>
                <Ionicons name="chevron-forward" size={20} color={COLORS.textLight} />
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </SafeAreaView>
    );
  }

  // ANA TOPLULUK SAYFASI
  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={onBack}>
            <Ionicons name="arrow-back" size={24} color={COLORS.secondary} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerCenter} onPress={() => setShowCityPicker(true)}>
            <Text style={styles.headerTitle}>🐦 {selectedCity}</Text>
            <View style={styles.headerSubRow}>
              <Text style={styles.headerSubtitle}>Topluluk</Text>
              <Ionicons name="chevron-down" size={14} color={COLORS.primary} />
            </View>
          </TouchableOpacity>
          <View style={styles.onlineContainer}>
            <View style={styles.onlineDot} />
            <Text style={styles.onlineText}>{onlineCount}</Text>
          </View>
        </View>

        {/* Mesajlar */}
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={COLORS.primary} />
            <Text style={styles.loadingText}>Yükleniyor...</Text>
          </View>
        ) : (
          <FlatList
            ref={flatListRef}
            data={messages}
            renderItem={renderMessage}
            keyExtractor={item => item.id}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchMessages(); }} colors={[COLORS.primary]} />
            }
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Ionicons name="chatbubbles-outline" size={60} color={COLORS.textLight} />
                <Text style={styles.emptyText}>{selectedCity} topluluğunda</Text>
                <Text style={styles.emptySubtext}>henüz mesaj yok. İlk mesajı sen yaz!</Text>
              </View>
            }
          />
        )}

        {/* Mesaj Giriş */}
        <View style={styles.inputContainer}>
          <View style={styles.inputWrapper}>
            <TextInput
              style={styles.input}
              placeholder={`${selectedCity} topluluğuna yaz...`}
              placeholderTextColor={COLORS.textLight}
              value={newMessage}
              onChangeText={setNewMessage}
              maxLength={300}
              multiline
            />
            <Text style={styles.charCount}>{newMessage.length}/300</Text>
          </View>
          <TouchableOpacity
            style={[styles.sendButton, !newMessage.trim() && styles.sendButtonDisabled]}
            onPress={handleSendMessage}
            disabled={!newMessage.trim()}
          >
            <Ionicons name="send" size={20} color="#FFF" />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  
  // City Picker
  cityPickerContainer: { flex: 1, backgroundColor: COLORS.background },
  cityPickerHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  cityPickerTitle: { fontSize: 18, fontWeight: '700', color: COLORS.secondary },
  cityPickerInfo: { alignItems: 'center', paddingVertical: 30, paddingHorizontal: 20 },
  cityPickerInfoTitle: { fontSize: 22, fontWeight: '700', color: COLORS.secondary, marginTop: 12 },
  cityPickerInfoText: { fontSize: 14, color: COLORS.textLight, marginTop: 6, textAlign: 'center' },
  searchContainer: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.cardBg,
    marginHorizontal: 16, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, gap: 10,
  },
  searchInput: { flex: 1, fontSize: 15, color: COLORS.text },
  cityList: { flex: 1, paddingHorizontal: 16, marginTop: 10 },
  cityItem: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.cardBg,
    paddingVertical: 14, paddingHorizontal: 16, borderRadius: 12, marginBottom: 8, gap: 12,
  },
  cityItemText: { flex: 1, fontSize: 16, fontWeight: '600', color: COLORS.text },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  backButton: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  headerCenter: { alignItems: 'center', flex: 1 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: COLORS.secondary },
  headerSubRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  headerSubtitle: { fontSize: 12, color: COLORS.primary, fontWeight: '500' },
  onlineContainer: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingRight: 8 },
  onlineDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.passengerBadge },
  onlineText: { fontSize: 12, color: COLORS.passengerBadge, fontWeight: '600' },

  // Loading
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 12, color: COLORS.textLight, fontSize: 14 },

  // Messages
  listContent: { padding: 12, paddingBottom: 90 },
  messageCard: { backgroundColor: COLORS.cardBg, borderRadius: 12, padding: 12, marginBottom: 10 },
  messageCardTemp: { opacity: 0.7, borderWidth: 1, borderColor: COLORS.primary, borderStyle: 'dashed' },
  messageHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  avatar: { width: 38, height: 38, borderRadius: 19, justifyContent: 'center', alignItems: 'center' },
  avatarText: { color: '#FFF', fontSize: 13, fontWeight: '700' },
  headerInfo: { marginLeft: 10, flex: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  userName: { fontSize: 14, fontWeight: '700', color: COLORS.text },
  roleBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8 },
  roleText: { color: '#FFF', fontSize: 9, fontWeight: '600' },
  timeText: { fontSize: 11, color: COLORS.textLight, marginTop: 2 },
  messageContent: { fontSize: 14, color: COLORS.text, lineHeight: 20 },
  messageActions: {
    flexDirection: 'row', alignItems: 'center', marginTop: 10, paddingTop: 8,
    borderTopWidth: 1, borderTopColor: COLORS.border, gap: 16,
  },
  actionButton: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  actionText: { fontSize: 12, color: COLORS.textLight, fontWeight: '500' },

  // Input
  inputContainer: {
    position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row',
    alignItems: 'flex-end', padding: 10, backgroundColor: COLORS.background,
    borderTopWidth: 1, borderTopColor: COLORS.border,
  },
  inputWrapper: {
    flex: 1, backgroundColor: COLORS.cardBg, borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 8, marginRight: 8, minHeight: 42, maxHeight: 90,
  },
  input: { fontSize: 14, color: COLORS.text, maxHeight: 55 },
  charCount: { fontSize: 9, color: COLORS.textLight, textAlign: 'right', marginTop: 2 },
  sendButton: { width: 42, height: 42, borderRadius: 21, backgroundColor: COLORS.primary, justifyContent: 'center', alignItems: 'center' },
  sendButtonDisabled: { backgroundColor: COLORS.border },

  // Empty
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 80 },
  emptyText: { fontSize: 16, fontWeight: '600', color: COLORS.text, marginTop: 16 },
  emptySubtext: { fontSize: 13, color: COLORS.textLight, marginTop: 4 },
});
