/**
 * Leylek Muhabbeti (Community) Screen
 * Tamamen izole - mevcut sistemlere dokunmaz
 * v2 - ANINDA MESAJ (Optimistic UI)
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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { io, Socket } from 'socket.io-client';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

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
  _temp?: boolean; // Geçici mesaj flag'i
}

interface CommunityScreenProps {
  user: {
    id: string;
    name: string;
    role: string;
  };
  onBack: () => void;
  apiUrl: string;
}

export default function CommunityScreen({ user, onBack, apiUrl }: CommunityScreenProps) {
  const [messages, setMessages] = useState<CommunityMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [onlineCount, setOnlineCount] = useState(0);
  const [likedMessages, setLikedMessages] = useState<Set<string>>(new Set());
  const [lastSentTime, setLastSentTime] = useState(0);
  
  const socketRef = useRef<Socket | null>(null);
  const flatListRef = useRef<FlatList>(null);

  // Socket bağlantısı
  useEffect(() => {
    console.log('🐦 [Community] Socket bağlanıyor...');
    
    const socket = io(SOCKET_URL, {
      path: '/socket.io',
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    });

    socket.on('connect', () => {
      console.log('🐦 [Community] Socket bağlandı:', socket.id);
      // Community'ye katıl
      socket.emit('community_join', {
        user_id: user.id,
        name: user.name,
        role: user.role,
      });
    });

    // YENİ MESAJ GELDİĞİNDE - ANINDA GÖSTER
    socket.on('community_new_message', (data: CommunityMessage) => {
      console.log('🐦 [Community] Yeni mesaj alındı:', data.name);
      
      // Kendi mesajımız değilse ekle (kendi mesajımız zaten optimistic olarak eklendi)
      setMessages(prev => {
        // Bu mesaj zaten var mı kontrol et (id veya temp_id ile)
        const exists = prev.some(m => m.id === data.id);
        if (exists) return prev;
        
        // Geçici mesajı gerçek mesajla değiştir
        const tempIndex = prev.findIndex(m => m._temp && m.user_id === data.user_id && m.content === data.content);
        if (tempIndex !== -1) {
          const newMessages = [...prev];
          newMessages[tempIndex] = { ...data, _temp: false };
          return newMessages;
        }
        
        // Yeni mesaj ekle (en üste)
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

    socket.on('connect_error', (error) => {
      console.log('🐦 [Community] Socket bağlantı hatası:', error.message);
    });

    socketRef.current = socket;

    return () => {
      console.log('🐦 [Community] Socket kapatılıyor...');
      socket.emit('community_leave', { user_id: user.id });
      socket.disconnect();
    };
  }, [user]);

  // Mesajları yükle
  const fetchMessages = useCallback(async () => {
    try {
      const response = await fetch(`${apiUrl}/community/messages?limit=50&offset=0`);
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
  }, [apiUrl]);

  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  // MESAJ GÖNDER - ANINDA GÖSTER (Optimistic UI)
  const handleSendMessage = async () => {
    const messageContent = newMessage.trim();
    if (!messageContent) return;
    
    if (messageContent.length > 300) {
      Alert.alert('Uyarı', 'Mesaj 300 karakterden uzun olamaz');
      return;
    }

    // Anti-spam: 2 saniye bekleme (3'ten 2'ye düşürdüm)
    const now = Date.now();
    if (now - lastSentTime < 2000) {
      Alert.alert('Bekleyin', 'Çok hızlı gönderiyorsunuz');
      return;
    }

    // 1. ANINDA EKRANDA GÖSTER (Optimistic)
    const tempId = `temp_${Date.now()}`;
    const tempMessage: CommunityMessage = {
      id: tempId,
      user_id: user.id,
      name: user.name,
      role: user.role as 'passenger' | 'driver',
      content: messageContent,
      likes_count: 0,
      created_at: new Date().toISOString(),
      _temp: true, // Geçici işareti
    };

    // Mesajı HEMEN ekle
    setMessages(prev => [tempMessage, ...prev]);
    setNewMessage(''); // Input'u temizle
    setLastSentTime(now);

    // 2. ARKA PLANDA API'YE KAYDET
    try {
      const response = await fetch(`${apiUrl}/community/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: user.id,
          name: user.name,
          role: user.role,
          content: messageContent,
        }),
      });

      const data = await response.json();

      if (data.success && data.message) {
        // 3. SOCKET İLE BROADCAST ET (diğer kullanıcılar görsün)
        socketRef.current?.emit('community_message', data.message);
        
        // Geçici mesajı gerçek ID ile güncelle
        setMessages(prev =>
          prev.map(msg =>
            msg.id === tempId ? { ...data.message, _temp: false } : msg
          )
        );
      } else {
        // Hata durumunda geçici mesajı kaldır
        setMessages(prev => prev.filter(msg => msg.id !== tempId));
        Alert.alert('Hata', data.error || 'Mesaj gönderilemedi');
      }
    } catch (error) {
      console.error('❌ [Community] Gönderme hatası:', error);
      // Hata durumunda geçici mesajı kaldır
      setMessages(prev => prev.filter(msg => msg.id !== tempId));
      Alert.alert('Hata', 'Bağlantı hatası');
    }
  };

  // Beğen - ANINDA
  const handleLike = async (messageId: string) => {
    if (likedMessages.has(messageId)) return;

    // ANINDA UI güncelle
    setLikedMessages(prev => new Set([...prev, messageId]));
    setMessages(prev =>
      prev.map(msg =>
        msg.id === messageId ? { ...msg, likes_count: msg.likes_count + 1 } : msg
      )
    );

    // Arka planda API'ye kaydet
    try {
      const response = await fetch(`${apiUrl}/community/like`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message_id: messageId,
          user_id: user.id,
        }),
      });

      const data = await response.json();

      if (data.success) {
        // Socket ile broadcast et
        socketRef.current?.emit('community_like', {
          message_id: messageId,
          likes_count: data.likes_count,
        });
      }
    } catch (error) {
      console.error('❌ [Community] Beğeni hatası:', error);
    }
  };

  // Şikayet et
  const handleReport = (messageId: string) => {
    Alert.alert(
      'Şikayet Et',
      'Bu mesajı şikayet etmek istediğinize emin misiniz?',
      [
        { text: 'İptal', style: 'cancel' },
        {
          text: 'Şikayet Et',
          style: 'destructive',
          onPress: async () => {
            try {
              await fetch(`${apiUrl}/community/report`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  message_id: messageId,
                  reporter_id: user.id,
                }),
              });
              Alert.alert('Teşekkürler', 'Şikayetiniz alındı');
            } catch (error) {
              console.error('❌ [Community] Şikayet hatası:', error);
            }
          },
        },
      ]
    );
  };

  // Zaman formatla
  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Az önce';
    if (diffMins < 60) return `${diffMins} dk önce`;
    if (diffHours < 24) return `${diffHours} saat önce`;
    if (diffDays < 7) return `${diffDays} gün önce`;
    return date.toLocaleDateString('tr-TR');
  };

  // Kullanıcı baş harfleri
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  // Mesaj kartı
  const renderMessage = ({ item }: { item: CommunityMessage }) => {
    const isLiked = likedMessages.has(item.id);
    const isOwn = item.user_id === user.id;
    const isTemp = item._temp;

    return (
      <View style={[styles.messageCard, isTemp && styles.messageCardTemp]}>
        {/* Profil ve İsim */}
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
              {isTemp && (
                <ActivityIndicator size="small" color={COLORS.primary} style={{ marginLeft: 8 }} />
              )}
            </View>
            <Text style={styles.timeText}>{formatTime(item.created_at)}</Text>
          </View>
        </View>

        {/* İçerik */}
        <Text style={styles.messageContent}>{item.content}</Text>

        {/* Aksiyonlar */}
        <View style={styles.messageActions}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => handleLike(item.id)}
            disabled={isLiked || isTemp}
          >
            <Ionicons
              name={isLiked ? 'heart' : 'heart-outline'}
              size={20}
              color={isLiked ? COLORS.likeActive : COLORS.textLight}
            />
            <Text style={[styles.actionText, isLiked && { color: COLORS.likeActive }]}>
              {item.likes_count}
            </Text>
          </TouchableOpacity>

          {!isOwn && !isTemp && (
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => handleReport(item.id)}
            >
              <Ionicons name="flag-outline" size={18} color={COLORS.textLight} />
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Yükleniyor...</Text>
        </View>
      </SafeAreaView>
    );
  }

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
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>🐦 Leylek Muhabbeti</Text>
            <Text style={styles.onlineCount}>{onlineCount} çevrimiçi</Text>
          </View>
          <View style={styles.headerRight} />
        </View>

        {/* Mesaj Listesi */}
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                fetchMessages();
              }}
              colors={[COLORS.primary]}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="chatbubbles-outline" size={60} color={COLORS.textLight} />
              <Text style={styles.emptyText}>Henüz mesaj yok</Text>
              <Text style={styles.emptySubtext}>İlk mesajı sen yaz!</Text>
            </View>
          }
        />

        {/* Mesaj Giriş */}
        <View style={styles.inputContainer}>
          <View style={styles.inputWrapper}>
            <TextInput
              style={styles.input}
              placeholder="Bir şeyler yaz..."
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
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    color: COLORS.textLight,
    fontSize: 14,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    backgroundColor: COLORS.background,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerCenter: {
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.secondary,
  },
  onlineCount: {
    fontSize: 12,
    color: COLORS.passengerBadge,
    marginTop: 2,
  },
  headerRight: {
    width: 40,
  },
  listContent: {
    padding: 16,
    paddingBottom: 100,
  },
  messageCard: {
    backgroundColor: COLORS.cardBg,
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
  },
  messageCardTemp: {
    opacity: 0.7,
    borderWidth: 1,
    borderColor: COLORS.primary,
    borderStyle: 'dashed',
  },
  messageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '700',
  },
  headerInfo: {
    marginLeft: 10,
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  userName: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.text,
  },
  roleBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  roleText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: '600',
  },
  timeText: {
    fontSize: 12,
    color: COLORS.textLight,
    marginTop: 2,
  },
  messageContent: {
    fontSize: 15,
    color: COLORS.text,
    lineHeight: 22,
  },
  messageActions: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    gap: 20,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  actionText: {
    fontSize: 13,
    color: COLORS.textLight,
    fontWeight: '500',
  },
  inputContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 12,
    backgroundColor: COLORS.background,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  inputWrapper: {
    flex: 1,
    backgroundColor: COLORS.cardBg,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginRight: 10,
    minHeight: 44,
    maxHeight: 100,
  },
  input: {
    fontSize: 15,
    color: COLORS.text,
    maxHeight: 60,
  },
  charCount: {
    fontSize: 10,
    color: COLORS.textLight,
    textAlign: 'right',
    marginTop: 4,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: COLORS.border,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 100,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text,
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: COLORS.textLight,
    marginTop: 4,
  },
});
