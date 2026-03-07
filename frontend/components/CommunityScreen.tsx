/**
 * Leylek Muhabbeti (Community) Screen
 * v6 - MODERN TWITTER + WHATSAPP + DISCORD TASARIMI
 * Supabase Realtime ile anlık mesajlaşma
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
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { io, Socket } from 'socket.io-client';
import * as ImagePicker from 'expo-image-picker';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Şehir temaları - her şehir için özel renk ve simge
const CITY_THEMES: { [key: string]: { gradient: string[], icon: string, landmark: string, bgImage: string } } = {
  'Ankara': { gradient: ['#DC2626', '#991B1B'], icon: 'business', landmark: 'Anıtkabir', bgImage: '' },
  'İstanbul': { gradient: ['#7C3AED', '#5B21B6'], icon: 'boat', landmark: 'Boğaz Köprüsü', bgImage: '' },
  'İzmir': { gradient: ['#0891B2', '#0E7490'], icon: 'sunny', landmark: 'Saat Kulesi', bgImage: '' },
  'Antalya': { gradient: ['#F97316', '#EA580C'], icon: 'umbrella', landmark: 'Kaleiçi', bgImage: '' },
  'Bursa': { gradient: ['#16A34A', '#15803D'], icon: 'leaf', landmark: 'Uludağ', bgImage: '' },
  'Adana': { gradient: ['#EAB308', '#CA8A04'], icon: 'restaurant', landmark: 'Taş Köprü', bgImage: '' },
  'Konya': { gradient: ['#06B6D4', '#0891B2'], icon: 'flower', landmark: 'Mevlana', bgImage: '' },
  'Gaziantep': { gradient: ['#DC2626', '#B91C1C'], icon: 'cafe', landmark: 'Zeugma', bgImage: '' },
  'Trabzon': { gradient: ['#059669', '#047857'], icon: 'rainy', landmark: 'Sümela', bgImage: '' },
  'Çanakkale': { gradient: ['#1D4ED8', '#1E40AF'], icon: 'time', landmark: 'Saat Kulesi', bgImage: '' },
  'Eskişehir': { gradient: ['#8B5CF6', '#7C3AED'], icon: 'school', landmark: 'Porsuk', bgImage: '' },
  'Mersin': { gradient: ['#0EA5E9', '#0284C7'], icon: 'water', landmark: 'Kız Kalesi', bgImage: '' },
  'Samsun': { gradient: ['#10B981', '#059669'], icon: 'flag', landmark: 'Bandırma', bgImage: '' },
  'Diyarbakır': { gradient: ['#78350F', '#92400E'], icon: 'shield', landmark: 'Surlar', bgImage: '' },
  'Kayseri': { gradient: ['#6366F1', '#4F46E5'], icon: 'snow', landmark: 'Erciyes', bgImage: '' },
  'default': { gradient: ['#3B82F6', '#2563EB'], icon: 'location', landmark: '', bgImage: '' },
};

// Reaksiyon emojileri
const REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🔥'];

// Mesaj emojileri
const EMOJI_LIST = ['😀', '😂', '🥰', '😎', '🤔', '👍', '👏', '❤️', '🔥', '✨', '🎉', '💪', '🚗', '🏠', '☀️', '🌙', '👋', '🙏', '💯', '🎯'];

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

interface MessageReaction {
  emoji: string;
  count: number;
  users: string[];
}

interface CommunityMessage {
  id: string;
  user_id: string;
  name: string;
  role: 'passenger' | 'driver';
  content: string;
  image_url?: string;
  likes_count: number;
  reactions?: MessageReaction[];
  created_at: string;
  city?: string;
  rating?: number;
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
  const [showReactionPicker, setShowReactionPicker] = useState<string | null>(null);
  
  const socketRef = useRef<Socket | null>(null);
  const flatListRef = useRef<FlatList>(null);

  const filteredCities = CITIES.filter(city =>
    city.toLowerCase().includes(citySearch.toLowerCase())
  );

  const cityTheme = getCityTheme(selectedCity);

  // Socket bağlantısı
  useEffect(() => {
    if (!selectedCity) return;
    
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
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
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

  // GERİ TUŞU
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

  // Fotoğraf seç
  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.7,
    });
    
    if (!result.canceled && result.assets[0]) {
      // TODO: Fotoğraf yükleme backend entegrasyonu
      Alert.alert('Yakında', 'Fotoğraf paylaşımı yakında aktif olacak!');
    }
  };

  // MESAJ GÖNDER
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
      rating: user.rating || 4.5,
      _temp: true,
    };

    setMessages(prev => [tempMsg, ...prev]);
    setNewMessage('');
    setLastSentTime(now);
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);

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
        console.log('[Community] 📤 Socket ile mesaj yayınlanıyor:', data.message.id);
        socketRef.current?.emit('community_message', {
          ...data.message,
          city: selectedCity,
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

  // Beğen / Reaksiyon
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
        socketRef.current?.emit('community_like', { 
          message_id: messageId, 
          likes_count: data.likes_count,
          city: selectedCity 
        });
      }
    } catch {}
    
    setShowReactionPicker(null);
  };

  // Zaman formatla
  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'şimdi';
    if (diffMins < 60) return `${diffMins}dk`;
    if (diffMins < 1440) return date.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
    return date.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });
  };

  // Mesaj kartı - MODERN TASARIM
  const renderMessage = ({ item }: { item: CommunityMessage }) => {
    const isOwn = item.user_id === user.id;
    const firstName = getFirstName(item.name);
    const avatarColor = getAvatarColor(item.name);
    const isLiked = likedMessages.has(item.id);
    const rating = item.rating || 4.5;

    return (
      <View style={[
        styles.messageContainer,
        isOwn ? styles.messageContainerOwn : styles.messageContainerOther,
        item._temp && styles.messageTemp
      ]}>
        {/* Avatar - Sol taraf (Başkalarının mesajı) */}
        {!isOwn && (
          <View style={[styles.avatarContainer, { backgroundColor: avatarColor }]}>
            <Text style={styles.avatarText}>{firstName.charAt(0).toUpperCase()}</Text>
          </View>
        )}
        
        {/* Mesaj Balonu */}
        <View style={[
          styles.messageBubble,
          isOwn ? styles.bubbleOwn : styles.bubbleOther
        ]}>
          {/* Header - İsim, Puan, Rol */}
          {!isOwn && (
            <View style={styles.messageHeader}>
              <Text style={styles.userName}>{firstName}</Text>
              <View style={styles.userBadges}>
                <View style={styles.ratingBadge}>
                  <Ionicons name="star" size={10} color="#FFD700" />
                  <Text style={styles.ratingText}>{rating.toFixed(1)}</Text>
                </View>
                <View style={[styles.roleBadge, item.role === 'driver' ? styles.driverBadge : styles.passengerBadge]}>
                  <Text style={styles.roleText}>{item.role === 'driver' ? 'Sürücü' : 'Yolcu'}</Text>
                </View>
              </View>
            </View>
          )}
          
          {/* Mesaj İçeriği */}
          <Text style={[styles.messageText, isOwn && styles.messageTextOwn]}>{item.content}</Text>
          
          {/* Fotoğraf varsa */}
          {item.image_url && (
            <Image source={{ uri: item.image_url }} style={styles.messageImage} resizeMode="cover" />
          )}
          
          {/* Alt Bilgi - Saat ve Reaksiyonlar */}
          <View style={styles.messageFooter}>
            <Text style={[styles.timeText, isOwn && styles.timeTextOwn]}>{formatTime(item.created_at)}</Text>
            
            <View style={styles.reactionArea}>
              {/* Beğeni butonu */}
              <TouchableOpacity 
                style={styles.reactionBtn} 
                onPress={() => handleLike(item.id)}
                onLongPress={() => setShowReactionPicker(item.id)}
              >
                <Ionicons 
                  name={isLiked ? 'heart' : 'heart-outline'} 
                  size={16} 
                  color={isLiked ? '#EF4444' : (isOwn ? 'rgba(255,255,255,0.7)' : '#9CA3AF')} 
                />
                {item.likes_count > 0 && (
                  <Text style={[styles.reactionCount, isOwn && styles.reactionCountOwn]}>
                    {item.likes_count}
                  </Text>
                )}
              </TouchableOpacity>
              
              {/* Gönderildi işareti */}
              {isOwn && (
                <Ionicons 
                  name={item._temp ? 'time-outline' : 'checkmark-done'} 
                  size={14} 
                  color="rgba(255,255,255,0.7)" 
                  style={{ marginLeft: 8 }}
                />
              )}
            </View>
          </View>
        </View>
        
        {/* Avatar - Sağ taraf (Kendi mesajım) */}
        {isOwn && (
          <View style={[styles.avatarContainer, { backgroundColor: avatarColor }]}>
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
        <LinearGradient colors={['#0F172A', '#1E293B']} style={styles.cityPickerContainer}>
          {/* Header */}
          <View style={styles.cityHeader}>
            <TouchableOpacity onPress={onBack} style={styles.backButton}>
              <Ionicons name="arrow-back" size={24} color="#FFF" />
            </TouchableOpacity>
            <View style={styles.headerTitleContainer}>
              <Text style={styles.headerTitle}>Leylek Muhabbeti</Text>
              <Text style={styles.headerSubtitle}>Şehir topluluğuna katıl</Text>
            </View>
            <View style={{ width: 40 }} />
          </View>
          
          {/* Arama */}
          <View style={styles.searchContainer}>
            <Ionicons name="search" size={20} color="#9CA3AF" />
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
                <TouchableOpacity 
                  key={city} 
                  style={styles.cityCard}
                  onPress={() => handleCitySelect(city)}
                  activeOpacity={0.7}
                >
                  <LinearGradient 
                    colors={theme.gradient} 
                    style={styles.cityCardGradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                  >
                    <View style={styles.cityIconBox}>
                      <Ionicons name={theme.icon as any} size={24} color="#FFF" />
                    </View>
                    <View style={styles.cityInfo}>
                      <Text style={styles.cityName}>{city}</Text>
                      {theme.landmark && (
                        <Text style={styles.cityLandmark}>{theme.landmark}</Text>
                      )}
                    </View>
                    <Ionicons name="chevron-forward" size={20} color="rgba(255,255,255,0.7)" />
                  </LinearGradient>
                </TouchableOpacity>
              );
            })}
            <View style={{ height: 30 }} />
          </ScrollView>
        </LinearGradient>
      </SafeAreaView>
    );
  }

  // SOHBET EKRANI
  return (
    <SafeAreaView style={styles.container}>
      {/* Arka Plan Gradient */}
      <LinearGradient 
        colors={['#0F172A', '#1E293B', '#0F172A']} 
        style={styles.chatContainer}
      >
        {/* Header */}
        <View style={styles.chatHeader}>
          <LinearGradient 
            colors={cityTheme.gradient} 
            style={styles.chatHeaderGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
          >
            <TouchableOpacity onPress={handleBack} style={styles.backButton}>
              <Ionicons name="arrow-back" size={24} color="#FFF" />
            </TouchableOpacity>
            
            <View style={styles.chatHeaderInfo}>
              <View style={styles.cityIconCircle}>
                <Ionicons name={cityTheme.icon as any} size={20} color="#FFF" />
              </View>
              <View style={styles.chatHeaderText}>
                <Text style={styles.chatHeaderTitle}>{selectedCity}</Text>
                <View style={styles.onlineIndicator}>
                  <View style={styles.onlineDot} />
                  <Text style={styles.onlineText}>{onlineCount} kişi çevrimiçi</Text>
                </View>
              </View>
            </View>
            
            <TouchableOpacity style={styles.refreshButton} onPress={fetchMessages}>
              <Ionicons name="refresh" size={22} color="#FFF" />
            </TouchableOpacity>
          </LinearGradient>
        </View>
        
        {/* Mesaj Listesi */}
        <KeyboardAvoidingView 
          style={styles.chatContent}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
        >
          <View style={{ flex: 1 }}>
          {loading && messages.length === 0 ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={cityTheme.gradient[0]} />
              <Text style={styles.loadingText}>Mesajlar yükleniyor...</Text>
            </View>
          ) : (
            <FlatList
              ref={flatListRef}
              data={[...messages].reverse()}
              renderItem={renderMessage}
              keyExtractor={item => item.id}
              contentContainerStyle={styles.messageList}
              showsVerticalScrollIndicator={false}
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={() => { setRefreshing(true); fetchMessages(); }}
                  colors={cityTheme.gradient}
                  tintColor={cityTheme.gradient[0]}
                />
              }
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <Ionicons name="chatbubbles-outline" size={60} color="#4B5563" />
                  <Text style={styles.emptyText}>Henüz mesaj yok</Text>
                  <Text style={styles.emptySubtext}>İlk mesajı sen gönder!</Text>
                </View>
              }
            />
          )}
          
          {/* Emoji Picker Modal */}
          <Modal visible={showEmojiPicker} transparent animationType="slide">
            <TouchableOpacity 
              style={styles.emojiModalOverlay} 
              activeOpacity={1} 
              onPress={() => setShowEmojiPicker(false)}
            >
              <View style={styles.emojiPickerContainer}>
                <View style={styles.emojiPickerHeader}>
                  <Text style={styles.emojiPickerTitle}>Emoji Seç</Text>
                  <TouchableOpacity onPress={() => setShowEmojiPicker(false)}>
                    <Ionicons name="close" size={24} color="#FFF" />
                  </TouchableOpacity>
                </View>
                <View style={styles.emojiGrid}>
                  {EMOJI_LIST.map((emoji, index) => (
                    <TouchableOpacity 
                      key={index} 
                      style={styles.emojiButton}
                      onPress={() => addEmoji(emoji)}
                    >
                      <Text style={styles.emojiText}>{emoji}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </TouchableOpacity>
          </Modal>
          
          {/* Mesaj Yazma Alanı */}
          <View style={styles.inputContainer}>
            <View style={styles.inputWrapper}>
              {/* Emoji Butonu */}
              <TouchableOpacity 
                style={styles.inputIconButton}
                onPress={() => setShowEmojiPicker(true)}
              >
                <Ionicons name="happy-outline" size={24} color="#9CA3AF" />
              </TouchableOpacity>
              
              {/* Fotoğraf Butonu */}
              <TouchableOpacity 
                style={styles.inputIconButton}
                onPress={pickImage}
              >
                <Ionicons name="image-outline" size={24} color="#9CA3AF" />
              </TouchableOpacity>
              
              {/* Metin Girişi */}
              <TextInput
                style={styles.textInput}
                placeholder={`${selectedCity} topluluğuna mesaj yaz...`}
                placeholderTextColor="#6B7280"
                value={newMessage}
                onChangeText={setNewMessage}
                multiline
                maxLength={300}
              />
              
              {/* Gönder Butonu */}
              <TouchableOpacity 
                style={[
                  styles.sendButton,
                  { backgroundColor: newMessage.trim() ? cityTheme.gradient[0] : '#374151' }
                ]}
                onPress={handleSendMessage}
                disabled={!newMessage.trim()}
              >
                <Ionicons name="send" size={20} color="#FFF" />
              </TouchableOpacity>
            </View>
          </View>
          </View>
        </KeyboardAvoidingView>
      </LinearGradient>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  
  // ŞEHİR SEÇİM
  cityPickerContainer: {
    flex: 1,
  },
  cityHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 10 : 20,
    paddingBottom: 16,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitleContainer: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFF',
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#9CA3AF',
    marginTop: 2,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    marginHorizontal: 16,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 14,
    marginLeft: 10,
    fontSize: 16,
    color: '#FFF',
  },
  cityList: {
    flex: 1,
    paddingHorizontal: 16,
  },
  cityCard: {
    marginBottom: 10,
    borderRadius: 16,
    overflow: 'hidden',
  },
  cityCardGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  cityIconBox: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cityInfo: {
    flex: 1,
    marginLeft: 14,
  },
  cityName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFF',
  },
  cityLandmark: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 2,
  },
  
  // SOHBET EKRANI
  chatContainer: {
    flex: 1,
  },
  chatHeader: {
    overflow: 'hidden',
  },
  chatHeaderGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 10 : 20,
    paddingBottom: 16,
  },
  chatHeaderInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 12,
  },
  cityIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  chatHeaderText: {
    marginLeft: 12,
  },
  chatHeaderTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFF',
  },
  onlineIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  onlineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10B981',
    marginRight: 6,
  },
  onlineText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
  },
  refreshButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  
  // Mesaj Listesi
  chatContent: {
    flex: 1,
  },
  messageList: {
    paddingHorizontal: 12,
    paddingVertical: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#9CA3AF',
    marginTop: 12,
    fontSize: 14,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 100,
  },
  emptyText: {
    color: '#9CA3AF',
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
  },
  emptySubtext: {
    color: '#6B7280',
    fontSize: 14,
    marginTop: 4,
  },
  
  // Mesaj Kartı
  messageContainer: {
    flexDirection: 'row',
    marginBottom: 16,
    alignItems: 'flex-end',
  },
  messageContainerOwn: {
    justifyContent: 'flex-end',
  },
  messageContainerOther: {
    justifyContent: 'flex-start',
  },
  messageTemp: {
    opacity: 0.7,
  },
  avatarContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFF',
  },
  messageBubble: {
    maxWidth: SCREEN_WIDTH * 0.72,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    marginHorizontal: 8,
  },
  bubbleOwn: {
    backgroundColor: '#F97316', // Turuncu
    borderBottomRightRadius: 6,
  },
  bubbleOther: {
    backgroundColor: '#1E3A5F', // Lacivert
    borderBottomLeftRadius: 6,
  },
  messageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
    flexWrap: 'wrap',
  },
  userName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFF',
    marginRight: 8,
  },
  userBadges: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,215,0,0.2)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    marginRight: 6,
  },
  ratingText: {
    fontSize: 10,
    color: '#FFD700',
    fontWeight: '600',
    marginLeft: 2,
  },
  roleBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  driverBadge: {
    backgroundColor: 'rgba(249,115,22,0.3)',
  },
  passengerBadge: {
    backgroundColor: 'rgba(16,185,129,0.3)',
  },
  roleText: {
    fontSize: 10,
    color: '#FFF',
    fontWeight: '600',
  },
  messageText: {
    fontSize: 15,
    color: '#FFF',
    lineHeight: 22,
  },
  messageTextOwn: {
    color: '#FFF',
  },
  messageImage: {
    width: '100%',
    height: 180,
    borderRadius: 12,
    marginTop: 8,
  },
  messageFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 6,
  },
  timeText: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.6)',
  },
  timeTextOwn: {
    color: 'rgba(255,255,255,0.7)',
  },
  reactionArea: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  reactionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  reactionCount: {
    fontSize: 12,
    color: '#9CA3AF',
    marginLeft: 4,
  },
  reactionCountOwn: {
    color: 'rgba(255,255,255,0.7)',
  },
  
  // Emoji Picker
  emojiModalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  emojiPickerContainer: {
    backgroundColor: '#1E293B',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: 30,
  },
  emojiPickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  emojiPickerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFF',
  },
  emojiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 12,
    justifyContent: 'center',
  },
  emojiButton: {
    width: 50,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
    margin: 4,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12,
  },
  emojiText: {
    fontSize: 28,
  },
  
  // Mesaj Yazma
  inputContainer: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#1E293B',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: '#0F172A',
    borderRadius: 24,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  inputIconButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  textInput: {
    flex: 1,
    maxHeight: 100,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: '#FFF',
  },
  sendButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 4,
  },
});
