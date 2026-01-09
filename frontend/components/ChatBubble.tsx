/**
 * ChatBubble.tsx - SUPABASE CHAT
 * 
 * ✅ HTTP API ile mesaj gönder
 * ✅ Supabase Realtime ile anlık mesaj al
 * ✅ Tag bitince mesajlar silinir
 * ✅ Güvenilir ve kararlı
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  FlatList,
  Animated,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { createClient } from '@supabase/supabase-js';
import Constants from 'expo-constants';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Supabase client
const supabaseUrl = Constants.expoConfig?.extra?.EXPO_PUBLIC_SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = Constants.expoConfig?.extra?.EXPO_PUBLIC_SUPABASE_ANON_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// API URL
const API_URL = Constants.expoConfig?.extra?.EXPO_PUBLIC_BACKEND_URL || process.env.EXPO_PUBLIC_BACKEND_URL || '';

interface Message {
  id: string;
  text: string;
  sender: 'me' | 'other';
  timestamp: Date;
  senderName?: string;
}

interface ChatBubbleProps {
  visible: boolean;
  onClose: () => void;
  isDriver: boolean;
  otherUserName: string;
  userId: string;
  otherUserId: string;
  tagId: string;
  onSendMessage?: (text: string, receiverId: string) => void; // Artık kullanılmıyor ama uyumluluk için
  incomingMessage?: { text: string; senderId: string; timestamp: number } | null; // Artık kullanılmıyor
}

// Öneri mesajları
const PASSENGER_SUGGESTIONS = [
  "Ne zamana gelirsiniz?",
  "Bekliyorum",
  "Neredesiniz?",
  "Geldiniz mi?",
];

const DRIVER_SUGGESTIONS = [
  "2 dk geliyorum",
  "Yoldayım",
  "Birazdan oradayım",
  "Trafikte kaldım",
  "Geldim, bekliyorum",
];

export default function ChatBubble({
  visible,
  onClose,
  isDriver,
  otherUserName,
  userId,
  otherUserId,
  tagId,
}: ChatBubbleProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isMinimized, setIsMinimized] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const flatListRef = useRef<FlatList>(null);
  
  const suggestions = isDriver ? DRIVER_SUGGESTIONS : PASSENGER_SUGGESTIONS;

  // ═══════════════════════════════════════════════════════════════
  // MESAJLARI YÜKLE (İlk açılışta)
  // ═══════════════════════════════════════════════════════════════
  
  const loadMessages = useCallback(async () => {
    if (!tagId || !visible) return;
    
    setIsLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/chat/messages?tag_id=${tagId}&limit=50`);
      const data = await response.json();
      
      if (data.success && data.messages) {
        const loadedMessages: Message[] = data.messages.map((msg: any) => ({
          id: msg.id,
          text: msg.message,
          sender: msg.sender_id === userId ? 'me' : 'other',
          timestamp: new Date(msg.created_at),
          senderName: msg.sender_name,
        }));
        setMessages(loadedMessages);
        
        // Scroll to bottom
        setTimeout(() => {
          flatListRef.current?.scrollToEnd({ animated: false });
        }, 100);
      }
    } catch (error) {
      console.error('❌ Mesajlar yüklenemedi:', error);
    } finally {
      setIsLoading(false);
    }
  }, [tagId, userId, visible]);

  // ═══════════════════════════════════════════════════════════════
  // SUPABASE REALTIME - YENİ MESAJLARI DİNLE
  // ═══════════════════════════════════════════════════════════════
  
  useEffect(() => {
    if (!tagId || !visible) return;
    
    console.log('🔔 [ChatBubble] Supabase Realtime başlatılıyor, tagId:', tagId);
    
    // Realtime subscription
    const channel = supabase
      .channel(`chat_${tagId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
          filter: `tag_id=eq.${tagId}`,
        },
        (payload) => {
          console.log('📩 [ChatBubble] Yeni mesaj geldi:', payload);
          const newMsg = payload.new as any;
          
          // Kendi gönderdiğim mesajı tekrar ekleme
          if (newMsg.sender_id === userId) {
            console.log('📩 [ChatBubble] Kendi mesajım, atlanıyor');
            return;
          }
          
          const message: Message = {
            id: newMsg.id,
            text: newMsg.message,
            sender: 'other',
            timestamp: new Date(newMsg.created_at),
            senderName: newMsg.sender_name,
          };
          
          setMessages(prev => {
            // Duplicate kontrolü
            if (prev.some(m => m.id === message.id)) {
              return prev;
            }
            return [...prev, message];
          });
          
          // Minimized ise unread count artır
          if (isMinimized) {
            setUnreadCount(prev => prev + 1);
          }
          
          // Scroll to bottom
          setTimeout(() => {
            flatListRef.current?.scrollToEnd({ animated: true });
          }, 100);
        }
      )
      .subscribe((status) => {
        console.log('🔔 [ChatBubble] Realtime subscription status:', status);
      });
    
    return () => {
      console.log('🔔 [ChatBubble] Realtime subscription kapatılıyor');
      supabase.removeChannel(channel);
    };
  }, [tagId, userId, visible, isMinimized]);

  // İlk açılışta mesajları yükle
  useEffect(() => {
    if (visible && tagId) {
      loadMessages();
    }
  }, [visible, tagId, loadMessages]);

  // ═══════════════════════════════════════════════════════════════
  // MESAJ GÖNDER (HTTP API ile)
  // ═══════════════════════════════════════════════════════════════
  
  const sendMessage = async (text: string) => {
    if (!text.trim() || isSending) return;
    
    const trimmedText = text.trim();
    setIsSending(true);
    
    console.log('📤 [ChatBubble] Mesaj gönderiliyor:', {
      text: trimmedText,
      tagId,
      userId,
      otherUserId,
    });
    
    // Optimistic UI - hemen ekranda göster
    const tempId = `temp-${Date.now()}-${Math.random()}`;
    const tempMessage: Message = {
      id: tempId,
      text: trimmedText,
      sender: 'me',
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, tempMessage]);
    setInputText('');
    
    // Scroll to bottom
    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 100);
    
    try {
      const response = await fetch(`${API_URL}/api/chat/send-message`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tag_id: tagId,
          sender_id: userId,
          sender_name: isDriver ? 'Sürücü' : 'Yolcu',
          receiver_id: otherUserId,
          message: trimmedText,
        }),
      });
      
      const data = await response.json();
      
      if (data.success) {
        console.log('✅ [ChatBubble] Mesaj gönderildi:', data);
        
        // Temp mesajı gerçek ID ile güncelle
        setMessages(prev => prev.map(m => 
          m.id === tempId ? { ...m, id: data.message?.id || tempId } : m
        ));
      } else {
        console.error('❌ [ChatBubble] Mesaj gönderilemedi:', data);
        // Hata durumunda temp mesajı kaldır
        setMessages(prev => prev.filter(m => m.id !== tempId));
      }
    } catch (error) {
      console.error('❌ [ChatBubble] Mesaj gönderme hatası:', error);
      // Hata durumunda temp mesajı kaldır
      setMessages(prev => prev.filter(m => m.id !== tempId));
    } finally {
      setIsSending(false);
      Keyboard.dismiss();
    }
  };

  // ═══════════════════════════════════════════════════════════════
  // ANİMASYONLAR
  // ═══════════════════════════════════════════════════════════════
  
  useEffect(() => {
    if (visible) {
      if (isMinimized) {
        Animated.spring(scaleAnim, {
          toValue: 1,
          useNativeDriver: true,
          tension: 100,
          friction: 8,
        }).start();
      } else {
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }).start();
      }
    } else {
      Animated.timing(slideAnim, {
        toValue: SCREEN_HEIGHT,
        duration: 200,
        useNativeDriver: true,
      }).start();
      scaleAnim.setValue(0);
    }
  }, [visible, isMinimized]);

  // Minimize/Maximize toggle
  const toggleMinimize = () => {
    if (isMinimized) {
      setIsMinimized(false);
      setUnreadCount(0);
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start();
    } else {
      setIsMinimized(true);
      Animated.timing(slideAnim, {
        toValue: SCREEN_HEIGHT,
        duration: 200,
        useNativeDriver: true,
      }).start(() => {
        Animated.spring(scaleAnim, {
          toValue: 1,
          useNativeDriver: true,
          tension: 100,
          friction: 8,
        }).start();
      });
    }
  };

  // ═══════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════
  
  if (!visible) return null;

  // Minimized bubble
  if (isMinimized) {
    return (
      <Animated.View 
        style={[
          styles.minimizedBubble,
          { transform: [{ scale: scaleAnim }] }
        ]}
      >
        <TouchableOpacity 
          style={styles.minimizedContent}
          onPress={toggleMinimize}
          activeOpacity={0.8}
        >
          <Ionicons name="chatbubble-ellipses" size={24} color="#fff" />
          {unreadCount > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{unreadCount}</Text>
            </View>
          )}
        </TouchableOpacity>
      </Animated.View>
    );
  }

  // Full chat panel
  return (
    <Animated.View 
      style={[
        styles.container,
        { transform: [{ translateY: slideAnim }] }
      ]}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Ionicons name="person-circle" size={32} color="#4CAF50" />
            <View style={styles.headerInfo}>
              <Text style={styles.headerName}>{otherUserName}</Text>
              <View style={styles.onlineStatus}>
                <View style={styles.onlineDot} />
                <Text style={styles.onlineText}>Çevrimiçi</Text>
              </View>
            </View>
          </View>
          <View style={styles.headerButtons}>
            <TouchableOpacity onPress={toggleMinimize} style={styles.headerBtn}>
              <Ionicons name="remove" size={24} color="#666" />
            </TouchableOpacity>
            <TouchableOpacity onPress={onClose} style={styles.headerBtn}>
              <Ionicons name="close" size={24} color="#666" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Messages */}
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#4CAF50" />
            <Text style={styles.loadingText}>Mesajlar yükleniyor...</Text>
          </View>
        ) : (
          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={(item) => item.id}
            style={styles.messageList}
            contentContainerStyle={styles.messageListContent}
            renderItem={({ item }) => (
              <View style={[
                styles.messageBubble,
                item.sender === 'me' ? styles.myMessage : styles.otherMessage
              ]}>
                <Text style={[
                  styles.messageText,
                  item.sender === 'me' ? styles.myMessageText : styles.otherMessageText
                ]}>
                  {item.text}
                </Text>
                <Text style={[
                  styles.messageTime,
                  item.sender === 'me' ? styles.myMessageTime : styles.otherMessageTime
                ]}>
                  {item.timestamp.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
                </Text>
              </View>
            )}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Ionicons name="chatbubbles-outline" size={48} color="#ccc" />
                <Text style={styles.emptyText}>Henüz mesaj yok</Text>
                <Text style={styles.emptySubtext}>Bir mesaj göndererek sohbeti başlatın</Text>
              </View>
            }
          />
        )}

        {/* Quick suggestions */}
        <View style={styles.suggestionsContainer}>
          <FlatList
            horizontal
            data={suggestions}
            keyExtractor={(item) => item}
            showsHorizontalScrollIndicator={false}
            renderItem={({ item }) => (
              <TouchableOpacity 
                style={styles.suggestionChip}
                onPress={() => sendMessage(item)}
                disabled={isSending}
              >
                <Text style={styles.suggestionText}>{item}</Text>
              </TouchableOpacity>
            )}
          />
        </View>

        {/* Input */}
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            placeholder="Mesajınızı yazın..."
            placeholderTextColor="#999"
            value={inputText}
            onChangeText={setInputText}
            multiline
            maxLength={500}
            editable={!isSending}
          />
          <TouchableOpacity 
            style={[
              styles.sendButton,
              (!inputText.trim() || isSending) && styles.sendButtonDisabled
            ]}
            onPress={() => sendMessage(inputText)}
            disabled={!inputText.trim() || isSending}
          >
            {isSending ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Ionicons name="send" size={20} color="#fff" />
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: SCREEN_HEIGHT * 0.6,
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 10,
  },
  keyboardView: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerInfo: {
    marginLeft: 10,
  },
  headerName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  onlineStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  onlineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#4CAF50',
    marginRight: 4,
  },
  onlineText: {
    fontSize: 12,
    color: '#4CAF50',
  },
  headerButtons: {
    flexDirection: 'row',
  },
  headerBtn: {
    padding: 8,
    marginLeft: 8,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#666',
  },
  messageList: {
    flex: 1,
  },
  messageListContent: {
    padding: 16,
    paddingBottom: 8,
  },
  messageBubble: {
    maxWidth: '80%',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 18,
    marginBottom: 8,
  },
  myMessage: {
    alignSelf: 'flex-end',
    backgroundColor: '#007AFF',
    borderBottomRightRadius: 4,
  },
  otherMessage: {
    alignSelf: 'flex-start',
    backgroundColor: '#E9E9EB',
    borderBottomLeftRadius: 4,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 20,
  },
  myMessageText: {
    color: '#fff',
  },
  otherMessageText: {
    color: '#333',
  },
  messageTime: {
    fontSize: 10,
    marginTop: 4,
  },
  myMessageTime: {
    color: 'rgba(255,255,255,0.7)',
    textAlign: 'right',
  },
  otherMessageTime: {
    color: '#999',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#999',
    marginTop: 12,
  },
  emptySubtext: {
    fontSize: 13,
    color: '#ccc',
    marginTop: 4,
  },
  suggestionsContainer: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  suggestionChip: {
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
    marginRight: 8,
  },
  suggestionText: {
    fontSize: 13,
    color: '#333',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 12,
    paddingVertical: 8,
    paddingBottom: Platform.OS === 'ios' ? 24 : 12,
    borderTopWidth: 1,
    borderTopColor: '#eee',
    backgroundColor: '#fff',
  },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 100,
    backgroundColor: '#f5f5f5',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
    color: '#333',
    marginRight: 8,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: '#ccc',
  },
  minimizedBubble: {
    position: 'absolute',
    bottom: 100,
    right: 16,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 8,
  },
  minimizedContent: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#FF3B30',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#fff',
  },
});
