/**
 * Leylek Muhabbeti (Community) Screen
 * v4 - WhatsApp Grup Tarzı + Emoji Tepki + Sadece İsim
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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { io, Socket } from 'socket.io-client';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Renkler
const COLORS = {
  primary: '#075E54', // WhatsApp yeşil
  secondary: '#128C7E',
  accent: '#25D366',
  background: '#ECE5DD', // WhatsApp chat arka planı
  white: '#FFFFFF',
  text: '#303030',
  textLight: '#667781',
  border: '#D1D7DB',
  messageOwn: '#DCF8C6', // Kendi mesajımız
  messageOther: '#FFFFFF',
  online: '#25D366',
};

// Emoji tepkileri
const REACTIONS = ['❤️', '😂', '😮', '😢', '👍', '🙏'];

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
  user: { id: string; name: string; role: string; city?: string; };
  onBack: () => void;
  apiUrl: string;
}

// Sadece ilk ismi al (soyisim gizle)
const getFirstName = (fullName: string): string => {
  const parts = fullName.trim().split(' ');
  return parts[0] || 'Kullanıcı';
};

// İlk harf
const getInitial = (name: string): string => {
  return name.charAt(0).toUpperCase();
};

// Rastgele pastel renk (her kullanıcı için tutarlı)
const getAvatarColor = (name: string): string => {
  const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9'];
  const index = name.charCodeAt(0) % colors.length;
  return colors[index];
};

export default function CommunityScreen({ user, onBack, apiUrl }: CommunityScreenProps) {
  const [selectedCity, setSelectedCity] = useState<string>(user.city || '');
  const [showCityPicker, setShowCityPicker] = useState(!user.city);
  const [citySearch, setCitySearch] = useState('');
  
  const [messages, setMessages] = useState<CommunityMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [onlineCount, setOnlineCount] = useState(0);
  const [likedMessages, setLikedMessages] = useState<Set<string>>(new Set());
  const [lastSentTime, setLastSentTime] = useState(0);
  const [showReactionPicker, setShowReactionPicker] = useState<string | null>(null);
  
  const socketRef = useRef<Socket | null>(null);
  const flatListRef = useRef<FlatList>(null);

  const filteredCities = CITIES.filter(city =>
    city.toLowerCase().includes(citySearch.toLowerCase())
  );

  // Socket bağlantısı
  useEffect(() => {
    if (!selectedCity) return;
    
    const socket = io(SOCKET_URL, {
      path: '/socket.io',
      transports: ['websocket', 'polling'],
    });

    socket.on('connect', () => {
      socket.emit('community_join', {
        user_id: user.id,
        name: getFirstName(user.name),
        role: user.role,
        city: selectedCity,
      });
    });

    socket.on('community_new_message', (data: CommunityMessage) => {
      if (data.city !== selectedCity) return;
      
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
      socket.emit('community_leave', { user_id: user.id });
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

  const handleCitySelect = (city: string) => {
    setSelectedCity(city);
    setShowCityPicker(false);
    setCitySearch('');
  };

  // Mesaj gönder
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
        socketRef.current?.emit('community_message', data.message);
        setMessages(prev => prev.map(msg => msg.id === tempId ? { ...data.message, _temp: false } : msg));
      } else {
        setMessages(prev => prev.filter(msg => msg.id !== tempId));
        Alert.alert('Hata', data.error || 'Gönderilemedi');
      }
    } catch {
      setMessages(prev => prev.filter(msg => msg.id !== tempId));
    }
  };

  // Tepki ver
  const handleReaction = async (messageId: string, emoji: string) => {
    setShowReactionPicker(null);
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
        socketRef.current?.emit('community_like', { message_id: messageId, likes_count: data.likes_count });
      }
    } catch {}
  };

  // Zaman formatla
  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
  };

  // Mesaj kartı - WhatsApp stili
  const renderMessage = ({ item }: { item: CommunityMessage }) => {
    const isOwn = item.user_id === user.id;
    const firstName = getFirstName(item.name);
    const avatarColor = getAvatarColor(item.name);
    const isLiked = likedMessages.has(item.id);

    return (
      <View style={[styles.messageRow, isOwn && styles.messageRowOwn]}>
        {/* Avatar - sadece başkalarının mesajlarında */}
        {!isOwn && (
          <View style={[styles.avatar, { backgroundColor: avatarColor }]}>
            <Text style={styles.avatarText}>{getInitial(firstName)}</Text>
          </View>
        )}
        
        <View style={[styles.messageBubble, isOwn ? styles.messageBubbleOwn : styles.messageBubbleOther]}>
          {/* İsim - sadece başkalarının mesajlarında */}
          {!isOwn && (
            <View style={styles.messageHeader}>
              <Text style={[styles.messageName, { color: avatarColor }]}>{firstName}</Text>
              <View style={[styles.roleBadge, { backgroundColor: item.role === 'driver' ? '#F59E0B' : '#10B981' }]}>
                <Text style={styles.roleText}>{item.role === 'driver' ? 'S' : 'Y'}</Text>
              </View>
            </View>
          )}
          
          {/* Mesaj içeriği */}
          <Text style={styles.messageText}>{item.content}</Text>
          
          {/* Alt bilgi */}
          <View style={styles.messageFooter}>
            {item.likes_count > 0 && (
              <View style={styles.likeBadge}>
                <Text style={styles.likeEmoji}>❤️</Text>
                <Text style={styles.likeCount}>{item.likes_count}</Text>
              </View>
            )}
            <Text style={styles.messageTime}>{formatTime(item.created_at)}</Text>
            {isOwn && <Ionicons name="checkmark-done" size={16} color="#53BDEB" />}
          </View>
          
          {/* Tepki butonu */}
          {!isOwn && !item._temp && (
            <TouchableOpacity
              style={styles.reactionButton}
              onPress={() => setShowReactionPicker(item.id)}
            >
              <Text style={styles.reactionButtonText}>{isLiked ? '❤️' : '🙂'}</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  // ŞEHİR SEÇİM EKRANI
  if (showCityPicker || !selectedCity) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.cityPickerContainer}>
          <View style={styles.header}>
            <TouchableOpacity onPress={onBack} style={styles.backBtn}>
              <Ionicons name="arrow-back" size={24} color="#FFF" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Leylek Muhabbeti</Text>
            <View style={{ width: 40 }} />
          </View>

          <View style={styles.cityInfo}>
            <Ionicons name="location" size={50} color={COLORS.secondary} />
            <Text style={styles.cityInfoTitle}>Şehir Seçin</Text>
            <Text style={styles.cityInfoText}>Hangi şehrin grubuna katılmak istiyorsunuz?</Text>
          </View>

          <View style={styles.searchBox}>
            <Ionicons name="search" size={20} color={COLORS.textLight} />
            <TextInput
              style={styles.searchInput}
              placeholder="Şehir ara..."
              placeholderTextColor={COLORS.textLight}
              value={citySearch}
              onChangeText={setCitySearch}
            />
          </View>

          <ScrollView style={styles.cityList}>
            {filteredCities.map(city => (
              <TouchableOpacity key={city} style={styles.cityItem} onPress={() => handleCitySelect(city)}>
                <View style={styles.cityIcon}>
                  <Ionicons name="location" size={20} color={COLORS.secondary} />
                </View>
                <Text style={styles.cityName}>{city}</Text>
                <Ionicons name="chevron-forward" size={20} color={COLORS.textLight} />
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </SafeAreaView>
    );
  }

  // ANA SOHBET EKRANI
  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onBack} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color="#FFF" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerInfo} onPress={() => setShowCityPicker(true)}>
            <Text style={styles.headerTitle}>{selectedCity}</Text>
            <Text style={styles.headerSub}>{onlineCount} çevrimiçi</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setShowCityPicker(true)}>
            <Ionicons name="ellipsis-vertical" size={22} color="#FFF" />
          </TouchableOpacity>
        </View>

        {/* Mesajlar */}
        {loading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color={COLORS.secondary} />
          </View>
        ) : (
          <FlatList
            ref={flatListRef}
            data={messages}
            renderItem={renderMessage}
            keyExtractor={item => item.id}
            contentContainerStyle={styles.messageList}
            inverted={false}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchMessages(); }} />
            }
            ListEmptyComponent={
              <View style={styles.emptyBox}>
                <Ionicons name="chatbubbles-outline" size={60} color={COLORS.textLight} />
                <Text style={styles.emptyText}>{selectedCity} grubunda henüz mesaj yok</Text>
                <Text style={styles.emptySubtext}>İlk mesajı sen yaz!</Text>
              </View>
            }
          />
        )}

        {/* Mesaj girişi */}
        <View style={styles.inputBar}>
          <View style={styles.inputBox}>
            <TextInput
              style={styles.input}
              placeholder="Mesaj yaz..."
              placeholderTextColor={COLORS.textLight}
              value={newMessage}
              onChangeText={setNewMessage}
              maxLength={300}
              multiline
            />
          </View>
          <TouchableOpacity
            style={[styles.sendBtn, !newMessage.trim() && styles.sendBtnDisabled]}
            onPress={handleSendMessage}
            disabled={!newMessage.trim()}
          >
            <Ionicons name="send" size={22} color="#FFF" />
          </TouchableOpacity>
        </View>

        {/* Tepki seçici modal */}
        <Modal visible={!!showReactionPicker} transparent animationType="fade">
          <TouchableOpacity style={styles.reactionModal} onPress={() => setShowReactionPicker(null)}>
            <View style={styles.reactionPicker}>
              {REACTIONS.map(emoji => (
                <TouchableOpacity
                  key={emoji}
                  style={styles.reactionEmoji}
                  onPress={() => handleReaction(showReactionPicker!, emoji)}
                >
                  <Text style={styles.reactionEmojiText}>{emoji}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </TouchableOpacity>
        </Modal>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  
  // Header
  header: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.primary,
    paddingVertical: 12, paddingHorizontal: 8,
  },
  backBtn: { padding: 8 },
  headerInfo: { flex: 1, marginLeft: 8 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#FFF' },
  headerSub: { fontSize: 12, color: 'rgba(255,255,255,0.8)' },

  // City Picker
  cityPickerContainer: { flex: 1, backgroundColor: '#FFF' },
  cityInfo: { alignItems: 'center', paddingVertical: 30 },
  cityInfoTitle: { fontSize: 22, fontWeight: '700', color: COLORS.text, marginTop: 12 },
  cityInfoText: { fontSize: 14, color: COLORS.textLight, marginTop: 6 },
  searchBox: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#F5F5F5',
    marginHorizontal: 16, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 10,
  },
  searchInput: { flex: 1, fontSize: 15, marginLeft: 8, color: COLORS.text },
  cityList: { flex: 1, marginTop: 10 },
  cityItem: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 16,
    borderBottomWidth: 1, borderBottomColor: '#F0F0F0',
  },
  cityIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#E8F5E9', justifyContent: 'center', alignItems: 'center' },
  cityName: { flex: 1, fontSize: 16, fontWeight: '500', color: COLORS.text, marginLeft: 12 },

  // Messages
  loadingBox: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  messageList: { padding: 8, paddingBottom: 80 },
  messageRow: { flexDirection: 'row', marginBottom: 8, alignItems: 'flex-end' },
  messageRowOwn: { flexDirection: 'row-reverse' },
  avatar: { width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center', marginRight: 6 },
  avatarText: { color: '#FFF', fontSize: 14, fontWeight: '700' },
  messageBubble: { maxWidth: '75%', padding: 8, borderRadius: 12, position: 'relative' },
  messageBubbleOwn: { backgroundColor: COLORS.messageOwn, borderBottomRightRadius: 4 },
  messageBubbleOther: { backgroundColor: COLORS.messageOther, borderBottomLeftRadius: 4 },
  messageHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  messageName: { fontSize: 13, fontWeight: '700' },
  roleBadge: { width: 16, height: 16, borderRadius: 8, justifyContent: 'center', alignItems: 'center', marginLeft: 6 },
  roleText: { color: '#FFF', fontSize: 9, fontWeight: '700' },
  messageText: { fontSize: 15, color: COLORS.text, lineHeight: 20 },
  messageFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', marginTop: 4, gap: 4 },
  messageTime: { fontSize: 11, color: COLORS.textLight },
  likeBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.05)', borderRadius: 10, paddingHorizontal: 6, paddingVertical: 2, marginRight: 4 },
  likeEmoji: { fontSize: 12 },
  likeCount: { fontSize: 11, color: COLORS.textLight, marginLeft: 2 },
  reactionButton: { position: 'absolute', right: -8, bottom: -8, width: 28, height: 28, borderRadius: 14, backgroundColor: '#FFF', justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.2, shadowRadius: 2, elevation: 3 },
  reactionButtonText: { fontSize: 14 },

  // Empty
  emptyBox: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 100 },
  emptyText: { fontSize: 16, fontWeight: '600', color: COLORS.text, marginTop: 16 },
  emptySubtext: { fontSize: 13, color: COLORS.textLight, marginTop: 4 },

  // Input
  inputBar: { flexDirection: 'row', alignItems: 'flex-end', padding: 8, backgroundColor: '#F0F0F0' },
  inputBox: { flex: 1, backgroundColor: '#FFF', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, minHeight: 44, maxHeight: 100 },
  input: { fontSize: 15, color: COLORS.text, maxHeight: 80 },
  sendBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: COLORS.secondary, justifyContent: 'center', alignItems: 'center', marginLeft: 8 },
  sendBtnDisabled: { backgroundColor: COLORS.border },

  // Reaction Modal
  reactionModal: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.3)' },
  reactionPicker: { flexDirection: 'row', backgroundColor: '#FFF', borderRadius: 30, padding: 8, gap: 4 },
  reactionEmoji: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
  reactionEmojiText: { fontSize: 28 },
});
