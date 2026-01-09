/**
 * ChatBubble.tsx - PURE REALTIME CHAT (NO DATABASE)
 * 
 * ✅ Supabase Realtime Broadcast ile anlık mesajlaşma
 * ✅ Database'e HİÇ kaydetmez
 * ✅ Mesajlar sadece bellekte tutulur
 * ✅ Trip bitince otomatik temizlenir
 */

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { createClient } from '@supabase/supabase-js';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Supabase credentials
const SUPABASE_URL = 'https://ujvploftywsxprlzejgc.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVqdnBsb2Z0eXdzeHBybHplamdjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY0MTgwNzYsImV4cCI6MjA4MTk5NDA3Nn0.c3I-1K7Guc5OmOxHdc_mhw-pSEsobVE6DN7m-Z9Re8k';

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
  onSendMessage?: (text: string, receiverId: string) => void;
  incomingMessage?: { text: string; senderId: string; timestamp: number } | null;
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
  const [isConnected, setIsConnected] = useState(false);
  
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const flatListRef = useRef<FlatList>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);
  
  const suggestions = isDriver ? DRIVER_SUGGESTIONS : PASSENGER_SUGGESTIONS;

  // ═══════════════════════════════════════════════════════════════
  // SUPABASE REALTIME BROADCAST - DATABASE'E KAYDETMEZ!
  // ═══════════════════════════════════════════════════════════════
  
  useEffect(() => {
    if (!tagId || !visible || !userId) return;
    
    console.log('🔔 [ChatBubble] Realtime Broadcast başlatılıyor:', { tagId, userId });
    
    // Broadcast channel oluştur - HER İKİ KULLANICI AYNI CHANNEL'A BAĞLANIR
    const channel = supabase.channel(`chat-broadcast-${tagId}`, {
      config: {
        broadcast: {
          self: false, // Kendi mesajlarını alma
        },
      },
    });
    
    // Mesaj dinle
    channel
      .on('broadcast', { event: 'new-message' }, (payload) => {
        console.log('📩 [ChatBubble] Broadcast mesaj geldi:', payload);
        
        const msg = payload.payload;
        
        // Kendi mesajımı tekrar ekleme
        if (msg.senderId === userId) {
          console.log('📩 [ChatBubble] Kendi mesajım, atlanıyor');
          return;
        }
        
        const newMessage: Message = {
          id: `msg-${Date.now()}-${Math.random()}`,
          text: msg.text,
          sender: 'other',
          timestamp: new Date(msg.timestamp),
          senderName: msg.senderName,
        };
        
        setMessages(prev => [...prev, newMessage]);
        
        // Minimized ise unread count artır
        if (isMinimized) {
          setUnreadCount(prev => prev + 1);
        }
        
        // Scroll to bottom
        setTimeout(() => {
          flatListRef.current?.scrollToEnd({ animated: true });
        }, 100);
      })
      .subscribe((status) => {
        console.log('🔔 [ChatBubble] Broadcast subscription status:', status);
        setIsConnected(status === 'SUBSCRIBED');
      });
    
    channelRef.current = channel;
    
    return () => {
      console.log('🔔 [ChatBubble] Broadcast channel kapatılıyor');
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [tagId, userId, visible, isMinimized]);

  // ═══════════════════════════════════════════════════════════════
  // MESAJ GÖNDER - BROADCAST İLE (DATABASE YOK!)
  // ═══════════════════════════════════════════════════════════════
  
  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || !channelRef.current) return;
    
    const trimmedText = text.trim();
    
    console.log('📤 [ChatBubble] Mesaj gönderiliyor (broadcast):', {
      text: trimmedText,
      tagId,
      userId,
      otherUserId,
    });
    
    // 1. Lokal olarak ekle (anlık UI güncelleme)
    const newMessage: Message = {
      id: `msg-${Date.now()}-${Math.random()}`,
      text: trimmedText,
      sender: 'me',
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, newMessage]);
    setInputText('');
    
    // Scroll to bottom
    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 100);
    
    // 2. Broadcast ile gönder - DATABASE'E KAYDETMEZ!
    try {
      await channelRef.current.send({
        type: 'broadcast',
        event: 'new-message',
        payload: {
          text: trimmedText,
          senderId: userId,
          senderName: isDriver ? 'Sürücü' : 'Yolcu',
          receiverId: otherUserId,
          timestamp: new Date().toISOString(),
        },
      });
      console.log('✅ [ChatBubble] Broadcast mesaj gönderildi!');
    } catch (error) {
      console.error('❌ [ChatBubble] Broadcast gönderme hatası:', error);
    }
    
    Keyboard.dismiss();
  }, [tagId, userId, otherUserId, isDriver]);

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
                <View style={[styles.onlineDot, { backgroundColor: isConnected ? '#4CAF50' : '#999' }]} />
                <Text style={[styles.onlineText, { color: isConnected ? '#4CAF50' : '#999' }]}>
                  {isConnected ? 'Bağlı' : 'Bağlanıyor...'}
                </Text>
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
          />
          <TouchableOpacity 
            style={[
              styles.sendButton,
              !inputText.trim() && styles.sendButtonDisabled
            ]}
            onPress={() => sendMessage(inputText)}
            disabled={!inputText.trim()}
          >
            <Ionicons name="send" size={20} color="#fff" />
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
    marginRight: 4,
  },
  onlineText: {
    fontSize: 12,
  },
  headerButtons: {
    flexDirection: 'row',
  },
  headerBtn: {
    padding: 8,
    marginLeft: 8,
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
