/**
 * ChatBubble.tsx - PURE SOCKET CHAT (ANLIK)
 * 
 * ✅ Sadece Socket - Database YOK
 * ✅ Anlık mesajlaşma (~50ms)
 * ✅ Tag bitince mesajlar silinir
 * ✅ Offline kullanıcıya Push Notification
 */

import React, { useState, useRef, useEffect } from 'react';
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
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface Message {
  id: string;
  text: string;
  sender: 'me' | 'other';
  timestamp: Date;
}

interface ChatBubbleProps {
  visible: boolean;
  onClose: () => void;
  isDriver: boolean;
  otherUserName: string;
  userId: string;
  otherUserId: string;
  tagId: string;
  onSendMessage: (text: string, receiverId: string) => void; // Socket emit
  incomingMessage?: { text: string; senderId: string; timestamp: number } | null; // Socket'ten gelen mesaj
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
  onSendMessage,
  incomingMessage,
}: ChatBubbleProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isMinimized, setIsMinimized] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const flatListRef = useRef<FlatList>(null);
  
  const suggestions = isDriver ? DRIVER_SUGGESTIONS : PASSENGER_SUGGESTIONS;

  // ═══════════════════════════════════════════════════════════════
  // GELEN MESAJI DİNLE (Socket'ten)
  // ═══════════════════════════════════════════════════════════════
  
  useEffect(() => {
    if (incomingMessage && incomingMessage.senderId !== userId) {
      const newMessage: Message = {
        id: `msg-${Date.now()}-${Math.random()}`,
        text: incomingMessage.text,
        sender: 'other',
        timestamp: new Date(incomingMessage.timestamp),
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
    }
  }, [incomingMessage, userId, isMinimized]);

  // ═══════════════════════════════════════════════════════════════
  // MESAJ GÖNDER (Socket ile ANLIK)
  // ═══════════════════════════════════════════════════════════════
  
  const sendMessage = (text: string) => {
    if (!text.trim()) return;
    
    const trimmedText = text.trim();
    
    // DEBUG: otherUserId kontrolü
    console.log('📤 [ChatBubble] sendMessage çağrıldı:', {
      text: trimmedText,
      otherUserId: otherUserId,
      tagId: tagId,
      userId: userId
    });
    
    if (!otherUserId) {
      console.error('❌ [ChatBubble] otherUserId BOŞ! Mesaj gönderilemez.');
      return;
    }
    
    // 1. Lokal olarak ekle (anlık UI güncelleme)
    const newMessage: Message = {
      id: `msg-${Date.now()}-${Math.random()}`,
      text: trimmedText,
      sender: 'me',
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, newMessage]);
    setInputText('');
    
    // 2. Socket ile ANLIK gönder
    console.log('📤 [ChatBubble] onSendMessage ÇAĞRILIYOR:', trimmedText, otherUserId);
    onSendMessage(trimmedText, otherUserId);
    
    // Scroll to bottom
    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 100);
    
    // Keyboard kapat
    Keyboard.dismiss();
  };

  // ═══════════════════════════════════════════════════════════════
  // TAG DEĞİŞTİĞİNDE MESAJLARI TEMİZLE
  // ═══════════════════════════════════════════════════════════════
  
  useEffect(() => {
    // Tag değiştiğinde mesajları sıfırla
    setMessages([]);
    setUnreadCount(0);
  }, [tagId]);

  // ═══════════════════════════════════════════════════════════════
  // ANİMASYONLAR
  // ═══════════════════════════════════════════════════════════════

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: 8,
          tension: 40,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(scaleAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: SCREEN_HEIGHT,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  // ═══════════════════════════════════════════════════════════════
  // UI HELPERS
  // ═══════════════════════════════════════════════════════════════

  const toggleMinimize = () => {
    if (isMinimized) {
      setUnreadCount(0);
    }
    setIsMinimized(!isMinimized);
  };

  const renderMessage = ({ item }: { item: Message }) => (
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
  );

  // ═══════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════

  if (!visible) return null;

  // Minimized view
  if (isMinimized) {
    return (
      <TouchableOpacity 
        style={styles.minimizedBubble}
        onPress={toggleMinimize}
        activeOpacity={0.8}
      >
        <Ionicons name="chatbubble-ellipses" size={28} color="#fff" />
        {unreadCount > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{unreadCount}</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  }

  return (
    <Animated.View 
      style={[
        styles.container,
        {
          transform: [
            { scale: scaleAnim },
            { translateY: slideAnim }
          ],
        }
      ]}
    >
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={toggleMinimize} style={styles.minimizeButton}>
            <Ionicons name="remove" size={28} color="#666" />
          </TouchableOpacity>
          
          <View style={styles.headerCenter}>
            <Ionicons name="person-circle" size={32} color="#007AFF" />
            <Text style={styles.headerTitle}>{otherUserName}</Text>
            <View style={styles.onlineIndicator} />
          </View>
          
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={28} color="#666" />
          </TouchableOpacity>
        </View>

        {/* Messages */}
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={renderMessage}
          style={styles.messageList}
          contentContainerStyle={styles.messageListContent}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={() => {
            flatListRef.current?.scrollToEnd({ animated: false });
          }}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="chatbubbles-outline" size={48} color="#ccc" />
              <Text style={styles.emptyText}>Henüz mesaj yok</Text>
              <Text style={styles.emptySubtext}>Hızlı mesaj gönderin ⚡</Text>
            </View>
          }
        />

        {/* Suggestions */}
        {messages.length === 0 && (
          <View style={styles.suggestionsContainer}>
            {suggestions.map((suggestion, index) => (
              <TouchableOpacity
                key={index}
                style={styles.suggestionButton}
                onPress={() => sendMessage(suggestion)}
              >
                <Text style={styles.suggestionText}>{suggestion}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Input */}
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            value={inputText}
            onChangeText={setInputText}
            placeholder="Mesajınızı yazın..."
            placeholderTextColor="#999"
            multiline
            maxLength={500}
            onSubmitEditing={() => sendMessage(inputText)}
            returnKeyType="send"
          />
          <TouchableOpacity 
            style={[
              styles.sendButton, 
              !inputText.trim() && styles.sendButtonDisabled
            ]}
            onPress={() => sendMessage(inputText)}
            disabled={!inputText.trim()}
          >
            <Ionicons name="send" size={24} color="#fff" />
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
    height: SCREEN_HEIGHT * 0.65,
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 20,
    zIndex: 1000,
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
    borderBottomColor: '#f0f0f0',
  },
  headerCenter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
  },
  onlineIndicator: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#34C759',
  },
  minimizeButton: {
    padding: 4,
  },
  closeButton: {
    padding: 4,
  },
  messageList: {
    flex: 1,
    paddingHorizontal: 16,
  },
  messageListContent: {
    paddingVertical: 16,
  },
  messageBubble: {
    maxWidth: '80%',
    padding: 12,
    borderRadius: 16,
    marginVertical: 4,
  },
  myMessage: {
    alignSelf: 'flex-end',
    backgroundColor: '#007AFF',
    borderBottomRightRadius: 4,
  },
  otherMessage: {
    alignSelf: 'flex-start',
    backgroundColor: '#f0f0f0',
    borderBottomLeftRadius: 4,
  },
  messageText: {
    fontSize: 16,
    lineHeight: 22,
  },
  myMessageText: {
    color: '#fff',
  },
  otherMessageText: {
    color: '#333',
  },
  messageTime: {
    fontSize: 11,
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
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
    marginTop: 12,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#ccc',
    marginTop: 4,
  },
  suggestionsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 8,
  },
  suggestionButton: {
    backgroundColor: '#f5f5f5',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  suggestionText: {
    fontSize: 14,
    color: '#007AFF',
    fontWeight: '500',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    backgroundColor: '#fff',
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 100,
    backgroundColor: '#f5f5f5',
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 16,
    color: '#333',
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#007AFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  sendButtonDisabled: {
    backgroundColor: '#ccc',
  },
  minimizedBubble: {
    position: 'absolute',
    bottom: 100,
    right: 20,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#007AFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 10,
    zIndex: 1000,
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#FF3B30',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  badgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
});
