/**
 * Leylek Muhabbeti (Community) Screen
 * v5 - ŞEHİR TEMALI + EMOJİ + MODERN 3D TASARIM
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
  ScrollView,
  Modal,
  ImageBackground,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { io, Socket } from 'socket.io-client';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Şehir temaları - her şehir için özel renk ve simge
const CITY_THEMES: { [key: string]: { gradient: string[], icon: string, landmark: string } } = {
  'Ankara': { gradient: ['#DC2626', '#991B1B'], icon: 'business', landmark: 'Anıtkabir' },
  'İstanbul': { gradient: ['#7C3AED', '#5B21B6'], icon: 'boat', landmark: 'Boğaz Köprüsü' },
  'İzmir': { gradient: ['#0891B2', '#0E7490'], icon: 'sunny', landmark: 'Saat Kulesi' },
  'Antalya': { gradient: ['#F97316', '#EA580C'], icon: 'umbrella', landmark: 'Kaleiçi' },
  'Bursa': { gradient: ['#16A34A', '#15803D'], icon: 'leaf', landmark: 'Uludağ' },
  'Adana': { gradient: ['#EAB308', '#CA8A04'], icon: 'restaurant', landmark: 'Taş Köprü' },
  'Konya': { gradient: ['#06B6D4', '#0891B2'], icon: 'flower', landmark: 'Mevlana' },
  'Gaziantep': { gradient: ['#DC2626', '#B91C1C'], icon: 'cafe', landmark: 'Zeugma' },
  'Trabzon': { gradient: ['#059669', '#047857'], icon: 'rainy', landmark: 'Sümela' },
  'Çanakkale': { gradient: ['#1D4ED8', '#1E40AF'], icon: 'time', landmark: 'Saat Kulesi' },
  'Eskişehir': { gradient: ['#8B5CF6', '#7C3AED'], icon: 'school', landmark: 'Porsuk' },
  'Mersin': { gradient: ['#0EA5E9', '#0284C7'], icon: 'water', landmark: 'Kız Kalesi' },
  'Samsun': { gradient: ['#10B981', '#059669'], icon: 'flag', landmark: 'Bandırma' },
  'Diyarbakır': { gradient: ['#78350F', '#92400E'], icon: 'shield', landmark: 'Surlar' },
  'Kayseri': { gradient: ['#6366F1', '#4F46E5'], icon: 'snow', landmark: 'Erciyes' },
  'default': { gradient: ['#3B82F6', '#2563EB'], icon: 'location', landmark: '' },
};

// Emojiler
const EMOJI_LIST = ['😀', '😂', '🥰', '😎', '🤔', '👍', '👏', '❤️', '🔥', '✨', '🎉', '💪', '🚗', '🏠', '☀️', '🌙'];

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

const SOCKET_URL = 'https://socket.leylektag.com';

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
  user: { id: string; name: string; role: string; city?: string; rating?: number; };
  onBack: () => void;
  apiUrl: string;
}

// Sadece ilk ismi al
const getFirstName = (fullName: string): string => {
  return fullName.trim().split(' ')[0] || 'Kullanıcı';
};

// Rastgele avatar rengi
const getAvatarColor = (name: string): string => {
  const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9'];
  return colors[name.charCodeAt(0) % colors.length];
};

// Şehir teması al
const getCityTheme = (city: string) => {
  return CITY_THEMES[city] || CITY_THEMES['default'];
};

export default function CommunityScreen({ user, onBack, apiUrl }: CommunityScreenProps) {
  const [selectedCity, setSelectedCity] = useState<string>('');
  const [showCityPicker, setShowCityPicker] = useState(true);
  const [citySearch, setCitySearch] = useState('');
  
  const [messages, setMessages] = useState<CommunityMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [onlineCount, setOnlineCount] = useState(0);
  const [likedMessages, setLikedMessages] = useState<Set<string>>(new Set());
  const [lastSentTime, setLastSentTime] = useState(0);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  
  const socketRef = useRef<Socket | null>(null);
  const flatListRef = useRef<FlatList>(null);

  const filteredCities = CITIES.filter(city =>
    city.toLowerCase().includes(citySearch.toLowerCase())
  );

  const cityTheme = getCityTheme(selectedCity);

  // Socket bağlantısı
  useEffect(() => {
    if (!selectedCity) return;
    
    // /community namespace'ine bağlan - ŞEHİR BAZLI FİLTRELEME
    const socket = io(`${SOCKET_URL}/community`, {
      path: '/socket.io',
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    socket.on('connect', () => {
      console.log('[Community] ✅ Socket bağlandı, şehir:', selectedCity);
      socket.emit('community_join', {
        user_id: user.id,
        name: getFirstName(user.name),
        role: user.role,
        city: selectedCity,
      });
    });

    socket.on('connect_error', (error) => {
      console.log('[Community] ❌ Bağlantı hatası:', error.message);
    });

    socket.on('disconnect', (reason) => {
      console.log('[Community] ⚠️ Bağlantı kesildi:', reason);
    });

    socket.on('community_new_message', (data: CommunityMessage) => {
      console.log('[Community] 📩 Yeni mesaj geldi:', data.content?.substring(0, 30));
      // Sunucu zaten şehir bazlı filtreleme yapıyor, ekstra kontrol güvenlik için
      if (data.city && data.city !== selectedCity) return;
      
      setMessages(prev => {
        const exists = prev.some(m => m.id === data.id);
        if (exists) return prev;
        
        const tempIndex = prev.findIndex(m => m._temp && m.user_id === data.user_id && m.content === data.content);
        if (tempIndex !== -1) {
          const newMsgs = [...prev];
          newMsgs[tempIndex] = { ...data, _temp: false };
          return newMsgs;
        }
        
        return [data, ...prev];
      });
    });

    socket.on('community_like_update', (data: { message_id: string; likes_count: number }) => {
      setMessages(prev =>
        prev.map(msg => msg.id === data.message_id ? { ...msg, likes_count: data.likes_count } : msg)
      );
    });

    socket.on('community_user_count', (data: { count: number }) => {
      setOnlineCount(data.count);
    });

    socketRef.current = socket;

    return () => {
      // Şehir bilgisi ile çık
      socket.emit('community_leave', { user_id: user.id, city: selectedCity });
      socket.disconnect();
    };
  }, [user, selectedCity]);

  // Mesajları yükle
  const fetchMessages = useCallback(async () => {
    if (!selectedCity) return;
    
    setLoading(true);
    try {
      const response = await fetch(`${apiUrl}/community/messages?limit=50&offset=0&city=${encodeURIComponent(selectedCity)}`);
      const data = await response.json();
      if (data.success) setMessages(data.messages);
    } catch (error) {
      console.error('Mesaj yükleme hatası:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [apiUrl, selectedCity]);

  useEffect(() => {
    if (selectedCity) fetchMessages();
  }, [selectedCity, fetchMessages]);

  // Şehir seç
  const handleCitySelect = (city: string) => {
    setSelectedCity(city);
    setShowCityPicker(false);
    setCitySearch('');
  };

  // GERİ TUŞU - Şehir seçimine dön
  const handleBack = () => {
    if (selectedCity && !showCityPicker) {
      setShowCityPicker(true);
      setSelectedCity('');
      setMessages([]);
    } else {
      onBack();
    }
  };

  // Emoji ekle
  const addEmoji = (emoji: string) => {
    setNewMessage(prev => prev + emoji);
    setShowEmojiPicker(false);
  };

  // MESAJ GÖNDER - ANINDA
  const handleSendMessage = async () => {
    const content = newMessage.trim();
    if (!content || content.length > 300) return;

    const now = Date.now();
    if (now - lastSentTime < 2000) {
      Alert.alert('Bekleyin', 'Çok hızlı gönderiyorsunuz');
      return;
    }

    const tempId = `temp_${now}`;
    const tempMsg: CommunityMessage = {
      id: tempId,
      user_id: user.id,
      name: getFirstName(user.name),
      role: user.role as 'passenger' | 'driver',
      content,
      likes_count: 0,
      created_at: new Date().toISOString(),
      city: selectedCity,
      _temp: true,
    };

    setMessages(prev => [tempMsg, ...prev]);
    setNewMessage('');
    setLastSentTime(now);

    try {
      const response = await fetch(`${apiUrl}/community/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: user.id,
          name: getFirstName(user.name),
          role: user.role,
          content,
          city: selectedCity,
        }),
      });

      const data = await response.json();
      if (data.success && data.message) {
        // 🔥 Socket'e mesaj gönder - diğer kullanıcılar anında görsün
        console.log('[Community] 📤 Socket ile mesaj yayınlanıyor:', data.message.id);
        socketRef.current?.emit('community_message', {
          ...data.message,
          city: selectedCity,  // Şehir bilgisini ekle
        });
        setMessages(prev => prev.map(msg => msg.id === tempId ? { ...data.message, _temp: false } : msg));
      } else {
        setMessages(prev => prev.filter(msg => msg.id !== tempId));
        Alert.alert('Hata', data.error || 'Gönderilemedi');
      }
    } catch {
      setMessages(prev => prev.filter(msg => msg.id !== tempId));
    }
  };

  // Beğen
  const handleLike = async (messageId: string) => {
    if (likedMessages.has(messageId)) return;

    setLikedMessages(prev => new Set([...prev, messageId]));
    setMessages(prev =>
      prev.map(msg => msg.id === messageId ? { ...msg, likes_count: msg.likes_count + 1 } : msg)
    );

    try {
      const response = await fetch(`${apiUrl}/community/like`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message_id: messageId, user_id: user.id }),
      });
      const data = await response.json();
      if (data.success) {
        // Şehir bilgisi ile socket'e gönder
        socketRef.current?.emit('community_like', { 
          message_id: messageId, 
          likes_count: data.likes_count,
          city: selectedCity 
        });
      }
    } catch {}
  };

  // Zaman formatla
  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
  };

  // Mesaj kartı
  const renderMessage = ({ item }: { item: CommunityMessage }) => {
    const isOwn = item.user_id === user.id;
    const firstName = getFirstName(item.name);
    const avatarColor = getAvatarColor(item.name);
    const isLiked = likedMessages.has(item.id);
    const rating = 4.5; // Örnek puan

    return (
      <View style={[styles.messageCard, isOwn && styles.messageCardOwn, item._temp && styles.messageCardTemp]}>
        {/* Avatar */}
        {!isOwn && (
          <View style={[styles.avatar, { backgroundColor: avatarColor }]}>
            <Text style={styles.avatarText}>{firstName.charAt(0).toUpperCase()}</Text>
          </View>
        )}
        
        <View style={[styles.messageBubble, isOwn ? styles.bubbleOwn : styles.bubbleOther]}>
          {/* İsim ve Puan */}
          {!isOwn && (
            <View style={styles.messageHeader}>
              <Text style={[styles.messageName, { color: avatarColor }]}>{firstName}</Text>
              <View style={styles.ratingBadge}>
                <Ionicons name="star" size={10} color="#FFD700" />
                <Text style={styles.ratingText}>{rating.toFixed(1)}</Text>
              </View>
              <View style={[styles.roleBadge, { backgroundColor: item.role === 'driver' ? '#F59E0B' : '#10B981' }]}>
                <Text style={styles.roleText}>{item.role === 'driver' ? 'S' : 'Y'}</Text>
              </View>
            </View>
          )}
          
          {/* Mesaj */}
          <Text style={styles.messageText}>{item.content}</Text>
          
          {/* Alt bilgi */}
          <View style={styles.messageFooter}>
            <TouchableOpacity style={styles.likeBtn} onPress={() => handleLike(item.id)} disabled={isLiked}>
              <Ionicons name={isLiked ? 'heart' : 'heart-outline'} size={16} color={isLiked ? '#EF4444' : '#9CA3AF'} />
              {item.likes_count > 0 && <Text style={styles.likeCount}>{item.likes_count}</Text>}
            </TouchableOpacity>
            <Text style={styles.timeText}>{formatTime(item.created_at)}</Text>
            {isOwn && <Ionicons name="checkmark-done" size={14} color="#3B82F6" />}
          </View>
        </View>
        
        {isOwn && (
          <View style={[styles.avatar, { backgroundColor: avatarColor }]}>
            <Text style={styles.avatarText}>{firstName.charAt(0).toUpperCase()}</Text>
          </View>
        )}
      </View>
    );
  };

  // ŞEHİR SEÇİM EKRANI
  if (showCityPicker || !selectedCity) {
    return (
      <SafeAreaView style={styles.container}>
        <LinearGradient colors={['#1E3A5F', '#2D5A87']} style={styles.cityPickerGradient}>
          {/* Header */}
          <View style={styles.cityHeader}>
            <TouchableOpacity onPress={onBack} style={styles.backBtn}>
              <Ionicons name="arrow-back" size={24} color="#FFF" />
            </TouchableOpacity>
            <Text style={styles.cityHeaderTitle}>🐦 Leylek Muhabbeti</Text>
            <View style={{ width: 40 }} />
          </View>

          {/* Bilgi */}
          <View style={styles.cityInfo}>
            <View style={styles.cityInfoIcon}>
              <Ionicons name="earth" size={60} color="#FFF" />
            </View>
            <Text style={styles.cityInfoTitle}>Şehir Topluluğunu Seç</Text>
            <Text style={styles.cityInfoText}>Hemşerilerinle sohbet et, paylaşım yap!</Text>
          </View>

          {/* Arama */}
          <View style={styles.searchBox}>
            <Ionicons name="search" size={20} color="#6B7280" />
            <TextInput
              style={styles.searchInput}
              placeholder="Şehir ara..."
              placeholderTextColor="#9CA3AF"
              value={citySearch}
              onChangeText={setCitySearch}
            />
          </View>

          {/* Şehir Listesi */}
          <ScrollView style={styles.cityList} showsVerticalScrollIndicator={false}>
            {filteredCities.map(city => {
              const theme = getCityTheme(city);
              return (
                <TouchableOpacity key={city} style={styles.cityItem} onPress={() => handleCitySelect(city)}>
                  <LinearGradient colors={theme.gradient} style={styles.cityItemIcon}>
                    <Ionicons name={theme.icon as any} size={22} color="#FFF" />
                  </LinearGradient>
                  <View style={styles.cityItemInfo}>
                    <Text style={styles.cityItemName}>{city}</Text>
                    {theme.landmark && <Text style={styles.cityItemLandmark}>{theme.landmark}</Text>}
                  </View>
                  <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </LinearGradient>
      </SafeAreaView>
    );
  }

  // ANA SOHBET EKRANI
  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {/* Header - Şehir temalı */}
        <LinearGradient colors={cityTheme.gradient} style={styles.chatHeader}>
          <TouchableOpacity onPress={handleBack} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color="#FFF" />
          </TouchableOpacity>
          <View style={styles.chatHeaderInfo}>
            <View style={styles.chatHeaderRow}>
              <Ionicons name={cityTheme.icon as any} size={20} color="#FFF" />
              <Text style={styles.chatHeaderTitle}>{selectedCity}</Text>
            </View>
            <View style={styles.onlineBox}>
              <View style={styles.onlineDot} />
              <Text style={styles.onlineText}>{onlineCount} çevrimiçi</Text>
            </View>
          </View>
          <TouchableOpacity onPress={() => setShowCityPicker(true)}>
            <Ionicons name="globe-outline" size={24} color="#FFF" />
          </TouchableOpacity>
        </LinearGradient>

        {/* Mesajlar - Şehir temalı arka plan */}
        <View style={styles.chatBody}>
          {/* Arka plan efekti */}
          <View style={[styles.bgPattern, { opacity: 0.05 }]}>
            <Ionicons name={cityTheme.icon as any} size={200} color={cityTheme.gradient[0]} />
          </View>
          
          {loading ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator size="large" color={cityTheme.gradient[0]} />
              <Text style={styles.loadingText}>{selectedCity} yükleniyor...</Text>
            </View>
          ) : (
            <FlatList
              ref={flatListRef}
              data={messages}
              renderItem={renderMessage}
              keyExtractor={item => item.id}
              contentContainerStyle={styles.messageList}
              showsVerticalScrollIndicator={false}
              refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchMessages(); }} colors={cityTheme.gradient} />
              }
              ListEmptyComponent={
                <View style={styles.emptyBox}>
                  <Ionicons name={cityTheme.icon as any} size={70} color={cityTheme.gradient[0]} />
                  <Text style={styles.emptyTitle}>{selectedCity} Topluluğu</Text>
                  <Text style={styles.emptyText}>Henüz mesaj yok. İlk sen başlat!</Text>
                </View>
              }
            />
          )}
        </View>

        {/* Mesaj girişi - 3D Modern tasarım */}
        <View style={styles.inputArea}>
          <LinearGradient colors={['#F8FAFC', '#FFFFFF']} style={styles.inputGradient}>
            <View style={styles.inputRow}>
              {/* Emoji butonu */}
              <TouchableOpacity style={styles.emojiBtn} onPress={() => setShowEmojiPicker(true)}>
                <Text style={styles.emojiBtnText}>😊</Text>
              </TouchableOpacity>
              
              {/* Input */}
              <View style={styles.inputBox}>
                <TextInput
                  style={styles.input}
                  placeholder={`${selectedCity}'e mesaj yaz...`}
                  placeholderTextColor="#9CA3AF"
                  value={newMessage}
                  onChangeText={setNewMessage}
                  maxLength={300}
                  multiline
                />
              </View>
              
              {/* Gönder butonu */}
              <TouchableOpacity
                style={[styles.sendBtn, !newMessage.trim() && styles.sendBtnDisabled]}
                onPress={handleSendMessage}
                disabled={!newMessage.trim()}
              >
                <LinearGradient colors={newMessage.trim() ? cityTheme.gradient : ['#D1D5DB', '#9CA3AF']} style={styles.sendBtnGradient}>
                  <Ionicons name="send" size={20} color="#FFF" />
                </LinearGradient>
              </TouchableOpacity>
            </View>
            
            {/* Karakter sayısı */}
            <Text style={styles.charCount}>{newMessage.length}/300</Text>
          </LinearGradient>
        </View>

        {/* Emoji Picker Modal */}
        <Modal visible={showEmojiPicker} transparent animationType="slide">
          <TouchableOpacity style={styles.emojiModalBg} onPress={() => setShowEmojiPicker(false)}>
            <View style={styles.emojiPicker}>
              <Text style={styles.emojiPickerTitle}>Emoji Seç</Text>
              <View style={styles.emojiGrid}>
                {EMOJI_LIST.map(emoji => (
                  <TouchableOpacity key={emoji} style={styles.emojiItem} onPress={() => addEmoji(emoji)}>
                    <Text style={styles.emojiItemText}>{emoji}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </TouchableOpacity>
        </Modal>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F3F4F6' },
  
  // City Picker
  cityPickerGradient: { flex: 1 },
  cityHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16 },
  cityHeaderTitle: { fontSize: 20, fontWeight: '800', color: '#FFF' },
  backBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  cityInfo: { alignItems: 'center', paddingVertical: 30 },
  cityInfoIcon: { width: 100, height: 100, borderRadius: 50, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  cityInfoTitle: { fontSize: 24, fontWeight: '800', color: '#FFF' },
  cityInfoText: { fontSize: 14, color: 'rgba(255,255,255,0.8)', marginTop: 8 },
  searchBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', marginHorizontal: 20, borderRadius: 16, paddingHorizontal: 16, paddingVertical: 12, marginBottom: 16 },
  searchInput: { flex: 1, fontSize: 16, marginLeft: 10, color: '#1F2937' },
  cityList: { flex: 1, paddingHorizontal: 20 },
  cityItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', borderRadius: 16, padding: 14, marginBottom: 10 },
  cityItemIcon: { width: 44, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  cityItemInfo: { flex: 1, marginLeft: 14 },
  cityItemName: { fontSize: 17, fontWeight: '700', color: '#1F2937' },
  cityItemLandmark: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  
  // Chat Header
  chatHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 14 },
  chatHeaderInfo: { flex: 1, marginLeft: 8 },
  chatHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  chatHeaderTitle: { fontSize: 20, fontWeight: '800', color: '#FFF' },
  onlineBox: { flexDirection: 'row', alignItems: 'center', marginTop: 4, gap: 6 },
  onlineDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#22C55E' },
  onlineText: { fontSize: 12, color: 'rgba(255,255,255,0.9)' },
  
  // Chat Body
  chatBody: { flex: 1, backgroundColor: '#F3F4F6', position: 'relative' },
  bgPattern: { position: 'absolute', top: '30%', left: '50%', marginLeft: -100 },
  loadingBox: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 12, fontSize: 14, color: '#6B7280' },
  messageList: { padding: 12, paddingBottom: 10 },
  
  // Messages
  messageCard: { flexDirection: 'row', marginBottom: 12, alignItems: 'flex-end' },
  messageCardOwn: { flexDirection: 'row-reverse' },
  messageCardTemp: { opacity: 0.6 },
  avatar: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  avatarText: { fontSize: 15, fontWeight: '700', color: '#FFF' },
  messageBubble: { maxWidth: '70%', padding: 12, borderRadius: 18, marginHorizontal: 8 },
  bubbleOwn: { backgroundColor: '#3B82F6', borderBottomRightRadius: 4 },
  bubbleOther: { backgroundColor: '#FFF', borderBottomLeftRadius: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 3, elevation: 2 },
  messageHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 6, gap: 6 },
  messageName: { fontSize: 13, fontWeight: '700' },
  ratingBadge: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  ratingText: { fontSize: 11, color: '#6B7280', fontWeight: '600' },
  roleBadge: { width: 18, height: 18, borderRadius: 9, justifyContent: 'center', alignItems: 'center' },
  roleText: { fontSize: 10, fontWeight: '700', color: '#FFF' },
  messageText: { fontSize: 15, color: '#1F2937', lineHeight: 21 },
  messageFooter: { flexDirection: 'row', alignItems: 'center', marginTop: 6, gap: 8 },
  likeBtn: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  likeCount: { fontSize: 12, color: '#9CA3AF' },
  timeText: { fontSize: 11, color: '#9CA3AF', marginLeft: 'auto' },
  
  // Empty
  emptyBox: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 100 },
  emptyTitle: { fontSize: 20, fontWeight: '700', color: '#1F2937', marginTop: 16 },
  emptyText: { fontSize: 14, color: '#6B7280', marginTop: 6 },
  
  // Input Area
  inputArea: { borderTopWidth: 1, borderTopColor: '#E5E7EB' },
  inputGradient: { padding: 12 },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 10 },
  emojiBtn: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F3F4F6', borderRadius: 22 },
  emojiBtnText: { fontSize: 24 },
  inputBox: { flex: 1, backgroundColor: '#F3F4F6', borderRadius: 22, paddingHorizontal: 16, paddingVertical: 10, minHeight: 44, maxHeight: 100 },
  input: { fontSize: 15, color: '#1F2937', maxHeight: 70 },
  sendBtn: { width: 44, height: 44, borderRadius: 22, overflow: 'hidden' },
  sendBtnDisabled: { opacity: 0.6 },
  sendBtnGradient: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  charCount: { fontSize: 11, color: '#9CA3AF', textAlign: 'right', marginTop: 6 },
  
  // Emoji Picker
  emojiModalBg: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  emojiPicker: { backgroundColor: '#FFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 40 },
  emojiPickerTitle: { fontSize: 18, fontWeight: '700', color: '#1F2937', textAlign: 'center', marginBottom: 16 },
  emojiGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8 },
  emojiItem: { width: 50, height: 50, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F3F4F6', borderRadius: 12 },
  emojiItemText: { fontSize: 28 },
});
