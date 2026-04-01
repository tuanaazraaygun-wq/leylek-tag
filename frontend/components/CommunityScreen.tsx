/**
 * Leylek Muhabbeti (Community) Screen
 * v7 - MODERN TWITTER + WHATSAPP + DISCORD TASARIMI
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
  Modal,
  Image,
  Animated,
  ImageBackground,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

/** Şu an yalnızca bu şehrin muhabbet kanalı açık; diğer iller talep ile admin paneline düşer. */
const COMMUNITY_LIVE_CITY = 'Ankara';

/** Ankara / doğa — Papazın Bağı çevresi hissi (Unsplash, ücretsiz kullanım) */
const ANKARA_MUHABBET_BG =
  'https://images.unsplash.com/photo-1490750967868-88aa4486c946?auto=format&fit=crop&w=1200&q=75';

const QUICK_SUGGESTION_CHIPS = [
  'Bugün hava yağmurluydu — yollara dikkat ⚠️',
  'Anlık trafik / yol durumu paylaş',
  'Güvenli sürüş, iyi yolculuklar 👋',
];

// Şehir temaları
const CITY_THEMES: { [key: string]: { gradient: string[], icon: string } } = {
  'Ankara': { gradient: ['#1a1a2e', '#16213e'], icon: 'business' },
  'İstanbul': { gradient: ['#0f0c29', '#302b63'], icon: 'boat' },
  'İzmir': { gradient: ['#134e5e', '#71b280'], icon: 'sunny' },
  'Antalya': { gradient: ['#ff6a00', '#ee0979'], icon: 'umbrella' },
  'Bursa': { gradient: ['#11998e', '#38ef7d'], icon: 'leaf' },
  'Eskişehir': { gradient: ['#6a3093', '#a044ff'], icon: 'school' },
  'default': { gradient: ['#0f172a', '#1e293b'], icon: 'location' },
};

// Reaksiyon emojileri
const REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🔥'];
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

const getFirstName = (fullName: string): string => {
  return fullName.trim().split(' ')[0] || 'Kullanıcı';
};

const getAvatarColor = (name: string): string => {
  const colors = ['#F97316', '#EF4444', '#8B5CF6', '#06B6D4', '#10B981', '#F59E0B', '#EC4899', '#6366F1'];
  return colors[name.charCodeAt(0) % colors.length];
};

const getCityTheme = (city: string) => {
  return CITY_THEMES[city] || CITY_THEMES['default'];
};

const formatTime = (dateStr: string): string => {
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  
  if (mins < 1) return 'Şimdi';
  if (mins < 60) return `${mins}d`;
  if (hours < 24) return `${hours}s`;
  return date.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });
};

export default function CommunityScreen({ user, onBack, apiUrl }: CommunityScreenProps) {
  const [selectedCity, setSelectedCity] = useState<string>(COMMUNITY_LIVE_CITY);
  const [showCityPicker, setShowCityPicker] = useState(false);
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
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  
  const flatListRef = useRef<FlatList>(null);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  const filteredCities = CITIES.filter(city =>
    city.toLowerCase().includes(citySearch.toLowerCase())
  );

  // Mesajları yükle
  const loadMessages = useCallback(async () => {
    if (!selectedCity) return;
    
    try {
      const response = await fetch(`${apiUrl}/community/messages?city=${encodeURIComponent(selectedCity)}&limit=50`);
      const data = await response.json();
      
      if (data.success && data.messages) {
        setMessages(data.messages.reverse());
      }
    } catch (error) {
      console.log('Mesaj yükleme hatası:', error);
    }
  }, [selectedCity, apiUrl]);

  // Polling ile mesajları güncelle (Supabase realtime yerine)
  useEffect(() => {
    if (!selectedCity) return;
    
    loadMessages();
    
    // Her 4 saniyede bir güncelle (hızlı his, sunucu yükü dengeli)
    pollingRef.current = setInterval(() => {
      loadMessages();
    }, 4000);
    
    // Online sayısı için ayrı bir API çağrısı
    const loadOnlineCount = async () => {
      try {
        const response = await fetch(`${apiUrl}/community/online-count?city=${encodeURIComponent(selectedCity)}`);
        const data = await response.json();
        if (data.count !== undefined && data.count > 0) {
          setOnlineCount(data.count);
        } else {
          // 🎭 Hayali online sayısı - şehre göre değişken
          const baseCounts: { [key: string]: number } = {
            'İstanbul': 45,
            'Ankara': 32,
            'İzmir': 28,
            'Bursa': 18,
            'Antalya': 22,
          };
          const baseCount = baseCounts[selectedCity] || 15;
          const randomOffset = Math.floor(Math.random() * 12) - 5; // -5 ile +6 arası
          setOnlineCount(Math.max(8, baseCount + randomOffset));
        }
      } catch (e) {
        // Hata durumunda da hayali sayı
        const randomCount = Math.floor(Math.random() * 25) + 12; // 12-37 arası
        setOnlineCount(randomCount);
      }
    };
    loadOnlineCount();
    
    // Her 30 saniyede online sayısını güncelle (değişkenlik için)
    const onlineInterval = setInterval(loadOnlineCount, 30000);
    
    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
      }
      clearInterval(onlineInterval);
    };
  }, [selectedCity, loadMessages, apiUrl]);

  // Mesaj gönder
  const sendMessage = async () => {
    if (!newMessage.trim() && !selectedImage) return;

    const contentSend = newMessage.trim();
    const imageSend = selectedImage;
    
    const now = Date.now();
    if (now - lastSentTime < 2000) {
      Alert.alert('Bekleyin', 'Çok hızlı mesaj gönderiyorsunuz');
      return;
    }
    
    const tempId = `temp_${Date.now()}`;
    const displayName = getFirstName(user.name);
    const tempMessage: CommunityMessage = {
      id: tempId,
      user_id: user.id,
      name: displayName,
      role: user.role as 'passenger' | 'driver',
      content: contentSend,
      image_url: imageSend || undefined,
      likes_count: 0,
      created_at: new Date().toISOString(),
      city: selectedCity,
      rating: user.rating ?? 4,
      _temp: true,
    };
    
    setMessages(prev => [...prev, tempMessage]);
    setNewMessage('');
    setSelectedImage(null);
    setLastSentTime(now);
    setShowEmojiPicker(false);
    
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    
    try {
      const response = await fetch(`${apiUrl}/community/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: user.id,
          name: displayName,
          role: user.role,
          content: contentSend,
          image_url: imageSend,
          city: selectedCity,
          rating: user.rating ?? 4,
        }),
      });
      
      const data = await response.json();
      
      if (data.success && data.message) {
        setMessages(prev => prev.map(m => m.id === tempId ? { ...data.message, _temp: false } : m));
      }
    } catch (error) {
      console.log('Mesaj gönderme hatası:', error);
      setMessages(prev => prev.filter(m => m.id !== tempId));
      Alert.alert('Hata', 'Mesaj gönderilemedi');
    }
  };

  /** Yalnızca anlık kamera — galeri / dosya yok */
  const takePhotoFromCamera = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('İzin', 'Fotoğraf paylaşmak için kamera izni gerekir.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      quality: 0.62,
      base64: true,
    });

    if (!result.canceled && result.assets[0]) {
      setUploadingImage(true);
      try {
        const base64 = result.assets[0].base64;
        if (!base64) {
          Alert.alert('Hata', 'Fotoğraf okunamadı, tekrar deneyin.');
          return;
        }
        const response = await fetch(`${apiUrl}/upload/image`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image: `data:image/jpeg;base64,${base64}` }),
        });
        const data = await response.json();
        if (data.url) {
          setSelectedImage(data.url);
        } else {
          Alert.alert('Hata', (data.detail as string) || 'Yükleme başarısız');
        }
      } catch {
        Alert.alert('Hata', 'Resim yüklenemedi');
      }
      setUploadingImage(false);
    }
  };

  // Beğen
  const likeMessage = async (messageId: string) => {
    if (likedMessages.has(messageId)) return;
    
    setLikedMessages(prev => new Set([...prev, messageId]));
    setMessages(prev =>
      prev.map(msg => msg.id === messageId ? { ...msg, likes_count: msg.likes_count + 1 } : msg)
    );
    
    try {
      await fetch(`${apiUrl}/community/like/${messageId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user.id }),
      });
    } catch (e) {}
  };

  // Reaksiyon ekle
  const addReaction = async (messageId: string, emoji: string) => {
    setShowReactionPicker(null);
    
    setMessages(prev =>
      prev.map(msg => {
        if (msg.id !== messageId) return msg;
        const reactions = msg.reactions || [];
        const existing = reactions.find(r => r.emoji === emoji);
        if (existing) {
          existing.count += 1;
          return { ...msg, reactions: [...reactions] };
        }
        return { ...msg, reactions: [...reactions, { emoji, count: 1, users: [user.id] }] };
      })
    );
    
    try {
      await fetch(`${apiUrl}/community/react/${messageId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user.id, emoji }),
      });
    } catch (e) {}
  };

  // Şehir seçim ekranı
  if (showCityPicker) {
    return (
      <SafeAreaView style={styles.container}>
        <LinearGradient colors={['#0f172a', '#1e293b']} style={styles.cityPickerContainer}>
          {/* Header */}
          <View style={styles.cityPickerHeader}>
            <TouchableOpacity onPress={onBack} style={styles.backButton}>
              <Ionicons name="arrow-back" size={24} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.cityPickerTitle}>Leylek Muhabbeti</Text>
            <View style={{ width: 40 }} />
          </View>
          
          <Text style={styles.cityPickerSubtitle}>
            Şu anda yalnızca {COMMUNITY_LIVE_CITY} topluluğu açıktır. Diğer iller için talep oluşturabilirsiniz.
          </Text>
          
          {/* Arama */}
          <View style={styles.searchContainer}>
            <Ionicons name="search" size={20} color="#64748b" />
            <TextInput
              style={styles.searchInput}
              placeholder="Şehir ara..."
              placeholderTextColor="#64748b"
              value={citySearch}
              onChangeText={setCitySearch}
            />
          </View>
          
          {/* Şehir listesi */}
          <FlatList
            data={filteredCities}
            keyExtractor={(item) => item}
            numColumns={2}
            contentContainerStyle={styles.cityList}
            renderItem={({ item }) => {
              const theme = getCityTheme(item);
              const isLive = item === COMMUNITY_LIVE_CITY;
              return (
                <TouchableOpacity
                  style={[styles.cityCard, !isLive && styles.cityCardDisabled]}
                  activeOpacity={isLive ? 0.88 : 1}
                  onPress={() => {
                    if (isLive) {
                      setSelectedCity(item);
                      setShowCityPicker(false);
                      return;
                    }
                    const cityLabel = item;
                    Alert.alert(
                      'Bilgi',
                      `Şu anda yalnızca ${COMMUNITY_LIVE_CITY} ili kullanıcıları Leylek Muhabbeti'ne katılabilir. Talep oluşturmak için aşağıdaki butona dokunun.`,
                      [
                        { text: 'İptal', style: 'cancel' },
                        {
                          text: `${cityLabel}'yi Leylek Muhabbetine katın`,
                          onPress: async () => {
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
                          },
                        },
                      ]
                    );
                  }}
                >
                  <LinearGradient colors={theme.gradient} style={styles.cityCardGradient}>
                    <Ionicons name={(isLive ? theme.icon : 'lock-closed') as any} size={28} color="#fff" />
                    <Text style={styles.cityCardText}>{item}</Text>
                    {!isLive ? (
                      <Text style={styles.cityCardHint}>Talep ile açılır</Text>
                    ) : null}
                  </LinearGradient>
                </TouchableOpacity>
              );
            }}
          />
        </LinearGradient>
      </SafeAreaView>
    );
  }

  // Mesaj kartı render
  const renderMessage = ({ item }: { item: CommunityMessage }) => {
    const isOwnMessage = item.user_id === user.id;
    const firstName = getFirstName(item.name);
    const avatarColor = getAvatarColor(item.name);
    
    return (
      <View style={[styles.messageContainer, isOwnMessage && styles.ownMessageContainer]}>
        {/* Avatar (sadece başkalarının mesajlarında sol tarafta) */}
        {!isOwnMessage && (
          <View style={[styles.avatar, { backgroundColor: avatarColor }]}>
            <Text style={styles.avatarText}>{firstName.charAt(0).toUpperCase()}</Text>
          </View>
        )}
        
        {/* Mesaj balonu */}
        <View style={[
          styles.messageBubble,
          isOwnMessage ? styles.ownMessageBubble : styles.otherMessageBubble
        ]}>
          {/* Kullanıcı bilgisi */}
          {!isOwnMessage && (
            <View style={styles.messageHeader}>
              <Text style={styles.messageName}>{firstName}</Text>
              {item.rating && item.rating > 0 && (
                <View style={styles.ratingBadge}>
                  <Ionicons name="star" size={10} color="#F59E0B" />
                  <Text style={styles.ratingText}>{item.rating.toFixed(1)}</Text>
                </View>
              )}
              {item.role === 'driver' && (
                <View style={styles.driverBadge}>
                  <Ionicons name="car" size={10} color="#fff" />
                </View>
              )}
            </View>
          )}
          
          {/* Resim varsa */}
          {item.image_url && (
            <Image source={{ uri: item.image_url }} style={styles.messageImage} resizeMode="cover" />
          )}
          
          {/* Mesaj metni */}
          {item.content && (
            <Text style={[styles.messageText, isOwnMessage && styles.ownMessageText]}>
              {item.content}
            </Text>
          )}
          
          {/* Alt bilgi satırı */}
          <View style={styles.messageFooter}>
            <Text style={[styles.messageTime, isOwnMessage && styles.ownMessageTime]}>
              {formatTime(item.created_at)}
            </Text>
            
            {/* Reaksiyonlar */}
            {item.reactions && item.reactions.length > 0 && (
              <View style={styles.reactionsContainer}>
                {item.reactions.slice(0, 3).map((r, i) => (
                  <View key={i} style={styles.reactionBubble}>
                    <Text style={styles.reactionEmoji}>{r.emoji}</Text>
                    <Text style={styles.reactionCount}>{r.count}</Text>
                  </View>
                ))}
              </View>
            )}
            
            {/* Beğeni butonu */}
            <TouchableOpacity 
              onPress={() => likeMessage(item.id)}
              style={styles.likeButton}
            >
              <Ionicons 
                name={likedMessages.has(item.id) ? "heart" : "heart-outline"} 
                size={14} 
                color={likedMessages.has(item.id) ? "#EF4444" : (isOwnMessage ? "#fff8" : "#64748b")} 
              />
              {item.likes_count > 0 && (
                <Text style={[styles.likeCount, isOwnMessage && styles.ownLikeCount]}>
                  {item.likes_count}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
        
        {/* Avatar (kendi mesajlarında sağ tarafta) */}
        {isOwnMessage && (
          <View style={[styles.avatar, { backgroundColor: avatarColor }]}>
            <Text style={styles.avatarText}>{firstName.charAt(0).toUpperCase()}</Text>
          </View>
        )}
        
        {/* Uzun basınca reaksiyon menüsü */}
        {showReactionPicker === item.id && (
          <View style={[styles.reactionPicker, isOwnMessage && styles.reactionPickerRight]}>
            {REACTIONS.map((emoji) => (
              <TouchableOpacity key={emoji} onPress={() => addReaction(item.id, emoji)} style={styles.reactionOption}>
                <Text style={styles.reactionOptionEmoji}>{emoji}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <ImageBackground
        source={{ uri: ANKARA_MUHABBET_BG }}
        style={styles.mainContainer}
        imageStyle={styles.bgImage}
      >
        <LinearGradient
          colors={['rgba(15,23,42,0.72)', 'rgba(15,23,42,0.55)', 'rgba(15,23,42,0.88)']}
          style={StyleSheet.absoluteFillObject}
        />
        <View style={styles.mainForeground}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onBack} style={styles.headerLeft}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>Leylek Muhabbeti</Text>
            <Text style={styles.headerCity}>{selectedCity}</Text>
            <View style={styles.onlineContainer}>
              <View style={styles.onlineDot} />
              <Text style={styles.onlineText}>{onlineCount} çevrimiçi</Text>
            </View>
            <TouchableOpacity onPress={() => setShowCityPicker(true)} hitSlop={{ top: 8, bottom: 8 }}>
              <Text style={styles.headerTalepLink}>Başka il talep et</Text>
            </TouchableOpacity>
          </View>
          
          <TouchableOpacity onPress={() => void loadMessages()} style={styles.headerRight}>
            <Ionicons name="refresh" size={22} color="#fff" />
          </TouchableOpacity>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.chipsScroll}
          contentContainerStyle={styles.chipsScrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {QUICK_SUGGESTION_CHIPS.map((chip) => (
            <TouchableOpacity
              key={chip}
              style={styles.suggestionChip}
              onPress={() => setNewMessage((p) => (p ? `${p} ${chip}` : chip))}
            >
              <Text style={styles.suggestionChipText} numberOfLines={2}>
                {chip}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
        
        {/* Mesajlar */}
        <KeyboardAvoidingView 
          style={styles.chatContainer}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 20}
        >
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#F97316" />
            </View>
          ) : (
            <FlatList
              ref={flatListRef}
              data={messages}
              keyExtractor={(item) => item.id}
              renderItem={renderMessage}
              contentContainerStyle={styles.messageList}
              refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={loadMessages} tintColor="#F97316" />
              }
              onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
              showsVerticalScrollIndicator={false}
            />
          )}
          
          {/* Seçilen resim önizleme */}
          {selectedImage && (
            <View style={styles.imagePreview}>
              <Image source={{ uri: selectedImage }} style={styles.previewImage} />
              <TouchableOpacity onPress={() => setSelectedImage(null)} style={styles.removeImageBtn}>
                <Ionicons name="close-circle" size={24} color="#EF4444" />
              </TouchableOpacity>
            </View>
          )}
          
          {/* Emoji picker */}
          {showEmojiPicker && (
            <View style={styles.emojiPicker}>
              {EMOJI_LIST.map((emoji) => (
                <TouchableOpacity 
                  key={emoji} 
                  onPress={() => setNewMessage(prev => prev + emoji)}
                  style={styles.emojiButton}
                >
                  <Text style={styles.emoji}>{emoji}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
          
          {/* Mesaj giriş alanı */}
          <View style={styles.inputContainer}>
            <TouchableOpacity onPress={() => setShowEmojiPicker(!showEmojiPicker)} style={styles.inputIcon}>
              <Ionicons name="happy-outline" size={24} color="#F97316" />
            </TouchableOpacity>
            
            <TouchableOpacity onPress={() => void takePhotoFromCamera()} style={styles.inputIcon}>
              {uploadingImage ? (
                <ActivityIndicator size="small" color="#F97316" />
              ) : (
                <Ionicons name="camera-outline" size={24} color="#F97316" />
              )}
            </TouchableOpacity>
            
            <TextInput
              style={styles.input}
              placeholder="Kısa not yaz…"
              placeholderTextColor="rgba(148,163,184,0.9)"
              value={newMessage}
              onChangeText={setNewMessage}
              multiline
              maxLength={500}
            />
            
            <TouchableOpacity 
              onPress={sendMessage}
              style={[styles.sendButton, (!newMessage.trim() && !selectedImage) && styles.sendButtonDisabled]}
              disabled={!newMessage.trim() && !selectedImage}
            >
              <Ionicons name="send" size={20} color="#fff" />
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
        </View>
      </ImageBackground>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  mainContainer: {
    flex: 1,
  },
  bgImage: {
    opacity: 0.85,
  },
  mainForeground: {
    flex: 1,
  },
  chipsScroll: {
    maxHeight: 52,
    flexGrow: 0,
  },
  chipsScrollContent: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    gap: 8,
    alignItems: 'center',
  },
  suggestionChip: {
    maxWidth: SCREEN_WIDTH * 0.72,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: 'rgba(30,41,59,0.92)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    marginRight: 8,
  },
  suggestionChipText: {
    color: '#e2e8f0',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '500',
  },
  
  // City Picker
  cityPickerContainer: {
    flex: 1,
    padding: 16,
  },
  cityPickerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#1e293b',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cityPickerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#fff',
  },
  cityPickerSubtitle: {
    fontSize: 14,
    color: '#94a3b8',
    textAlign: 'center',
    marginBottom: 20,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e293b',
    borderRadius: 12,
    paddingHorizontal: 12,
    marginBottom: 16,
  },
  searchInput: {
    flex: 1,
    color: '#fff',
    fontSize: 16,
    paddingVertical: 12,
    marginLeft: 8,
  },
  cityList: {
    paddingBottom: 20,
  },
  cityCard: {
    flex: 1,
    margin: 6,
    borderRadius: 16,
    overflow: 'hidden',
  },
  cityCardGradient: {
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 100,
  },
  cityCardText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
    marginTop: 8,
  },
  cityCardDisabled: {
    opacity: 0.5,
  },
  cityCardHint: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 11,
    marginTop: 6,
    fontWeight: '600',
  },
  
  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#ffffff15',
  },
  headerLeft: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#ffffff15',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: 0.2,
  },
  headerCity: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.88)',
    marginTop: 2,
  },
  headerTalepLink: {
    marginTop: 4,
    fontSize: 11,
    color: '#7dd3fc',
    textDecorationLine: 'underline',
    fontWeight: '600',
  },
  onlineContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  onlineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#22c55e',
    marginRight: 6,
  },
  onlineText: {
    fontSize: 11,
    color: 'rgba(148,163,184,0.95)',
  },
  headerRight: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#ffffff15',
    justifyContent: 'center',
    alignItems: 'center',
  },
  
  // Chat
  chatContainer: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  messageList: {
    padding: 12,
    paddingBottom: 20,
  },
  
  // Message
  messageContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginBottom: 12,
  },
  ownMessageContainer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 8,
  },
  avatarText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  messageBubble: {
    maxWidth: SCREEN_WIDTH * 0.78,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 14,
  },
  ownMessageBubble: {
    backgroundColor: '#F97316', // Turuncu
    borderBottomRightRadius: 4,
  },
  otherMessageBubble: {
    backgroundColor: '#1e3a5f', // Lacivert
    borderBottomLeftRadius: 4,
  },
  messageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  messageName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#F97316',
    marginRight: 6,
  },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff15',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    marginRight: 4,
  },
  ratingText: {
    fontSize: 10,
    color: '#F59E0B',
    marginLeft: 2,
  },
  driverBadge: {
    backgroundColor: '#3B82F6',
    padding: 3,
    borderRadius: 8,
  },
  messageImage: {
    width: '100%',
    height: 160,
    borderRadius: 10,
    marginBottom: 6,
  },
  messageText: {
    fontSize: 13,
    color: '#fff',
    lineHeight: 18,
  },
  ownMessageText: {
    color: '#fff',
  },
  messageFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },
  messageTime: {
    fontSize: 11,
    color: '#94a3b8',
    marginRight: 8,
  },
  ownMessageTime: {
    color: '#ffffff90',
  },
  reactionsContainer: {
    flexDirection: 'row',
    marginRight: 8,
  },
  reactionBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff20',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    marginRight: 4,
  },
  reactionEmoji: {
    fontSize: 12,
  },
  reactionCount: {
    fontSize: 10,
    color: '#fff',
    marginLeft: 2,
  },
  likeButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  likeCount: {
    fontSize: 11,
    color: '#64748b',
    marginLeft: 3,
  },
  ownLikeCount: {
    color: '#ffffff90',
  },
  
  // Reaction Picker
  reactionPicker: {
    position: 'absolute',
    bottom: 50,
    left: 50,
    flexDirection: 'row',
    backgroundColor: '#1e293b',
    borderRadius: 24,
    padding: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  reactionPickerRight: {
    left: undefined,
    right: 50,
  },
  reactionOption: {
    padding: 8,
  },
  reactionOptionEmoji: {
    fontSize: 24,
  },
  
  // Image Preview
  imagePreview: {
    padding: 8,
    backgroundColor: '#1e293b',
  },
  previewImage: {
    width: 100,
    height: 100,
    borderRadius: 12,
  },
  removeImageBtn: {
    position: 'absolute',
    top: 4,
    right: 4,
  },
  
  // Emoji Picker
  emojiPicker: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    backgroundColor: '#1e293b',
    padding: 8,
    borderTopWidth: 1,
    borderTopColor: '#ffffff15',
  },
  emojiButton: {
    padding: 8,
  },
  emoji: {
    fontSize: 24,
  },
  
  // Input
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 12,
    backgroundColor: '#0f172a',
    borderTopWidth: 1,
    borderTopColor: '#ffffff15',
  },
  inputIcon: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  input: {
    flex: 1,
    backgroundColor: 'rgba(30,41,59,0.92)',
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 8,
    color: '#fff',
    fontSize: 14,
    maxHeight: 88,
    marginHorizontal: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F97316',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: '#64748b',
  },
});
