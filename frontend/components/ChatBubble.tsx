/**
 * ChatBubble.tsx - HYBRID Chat System
 * 
 * RULES:
 * 1. Supabase = Source of Truth
 * 2. Socket = Real-time notification (best-effort)
 * 3. Socket failure NEVER blocks chat
 * 
 * Features:
 * - Sends message via REST API first
 * - Polls Supabase every 3 seconds
 * - Socket new_message triggers refetch (optional optimization)
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
  AppState,
  AppStateStatus,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// API URL
const BACKEND_URL = Constants.expoConfig?.extra?.EXPO_PUBLIC_BACKEND_URL 
  || process.env.EXPO_PUBLIC_BACKEND_URL 
  || 'https://rideconvo.preview.emergentagent.com';
const API_URL = `${BACKEND_URL}/api`;

interface Message {
  id: string;
  text: string;
  sender: 'me' | 'other';
  timestamp: Date;
  sender_id?: string;
}

interface ChatBubbleProps {
  visible: boolean;
  onClose: () => void;
  isDriver: boolean;
  otherUserName: string;
  userId: string;
  otherUserId: string;
  tagId: string; // Required for Supabase queries
  onSendMessage?: (text: string, receiverId: string) => void; // Socket (best-effort)
  onNewMessageReceived?: () => void; // Notification callback
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
  onNewMessageReceived,
}: ChatBubbleProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isMinimized, setIsMinimized] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isSending, setIsSending] = useState(false);
  const [lastFetchTime, setLastFetchTime] = useState<string | null>(null);
  
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const flatListRef = useRef<FlatList>(null);
  const pollingInterval = useRef<NodeJS.Timeout | null>(null);
  const appState = useRef(AppState.currentState);
  
  const suggestions = isDriver ? DRIVER_SUGGESTIONS : PASSENGER_SUGGESTIONS;

  // ═══════════════════════════════════════════════════════════════
  // SUPABASE API FUNCTIONS (SOURCE OF TRUTH)
  // ═══════════════════════════════════════════════════════════════

  // Fetch messages from Supabase
  const fetchMessages = useCallback(async () => {
    if (!tagId) {
      console.log('⚠️ [ChatBubble] tagId yok, fetch atlanıyor');
      return;
    }
    
    try {
      const response = await fetch(`${API_URL}/chat/messages?tag_id=${tagId}&limit=100`);
      const data = await response.json();
      
      if (data.success && data.messages) {
        const formattedMessages: Message[] = data.messages.map((msg: any) => ({
          id: msg.id,
          text: msg.message,
          sender: msg.sender_id === userId ? 'me' : 'other',
          timestamp: new Date(msg.created_at),
          sender_id: msg.sender_id,
        }));
        
        // Check for new messages
        const currentCount = messages.length;
        const newCount = formattedMessages.length;
        
        if (newCount > currentCount && isMinimized) {
          setUnreadCount(prev => prev + (newCount - currentCount));
          onNewMessageReceived?.();
        }
        
        setMessages(formattedMessages);
        setLastFetchTime(new Date().toISOString());
        
        // Scroll to bottom on new messages
        if (newCount > currentCount) {
          setTimeout(() => {
            flatListRef.current?.scrollToEnd({ animated: true });
          }, 100);
        }
      }
    } catch (error) {
      console.error('❌ [ChatBubble] Fetch error:', error);
      // Error durumunda UI kırılmasın
    }
  }, [tagId, userId, messages.length, isMinimized, onNewMessageReceived]);

  // Send message to Supabase (SOURCE OF TRUTH)
  const sendMessageToAPI = async (text: string): Promise<boolean> => {
    try {
      const response = await fetch(`${API_URL}/chat/send-message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tag_id: tagId,
          sender_id: userId,
          receiver_id: otherUserId,
          message: text,
          sender_name: isDriver ? 'Sürücü' : 'Yolcu',
        }),
      });
      
      const data = await response.json();
      
      if (data.success) {
        console.log('✅ [ChatBubble] Mesaj Supabase\'e kaydedildi:', data.message_id);
        return true;
      } else {
        console.error('❌ [ChatBubble] API error:', data);
        return false;
      }
    } catch (error) {
      console.error('❌ [ChatBubble] Send error:', error);
      return false;
    }
  };

  // ═══════════════════════════════════════════════════════════════
  // SEND MESSAGE (HYBRID: API First, Socket Best-Effort)
  // ═══════════════════════════════════════════════════════════════

  const sendMessage = async (text: string) => {
    if (!text.trim() || isSending) return;
    
    const trimmedText = text.trim();
    setIsSending(true);
    setInputText('');
    
    // Optimistic UI update
    const tempMessage: Message = {
      id: `temp-${Date.now()}`,
      text: trimmedText,
      sender: 'me',
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, tempMessage]);
    
    // Scroll to bottom
    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 100);
    
    // 1. FIRST: Save to Supabase (SOURCE OF TRUTH)
    const apiSuccess = await sendMessageToAPI(trimmedText);
    
    if (apiSuccess) {
      // 2. THEN: Socket notification (BEST-EFFORT, non-blocking)
      try {
        if (onSendMessage) {
          onSendMessage(trimmedText, otherUserId);
          console.log('📤 [ChatBubble] Socket notification sent (best-effort)');
        }
      } catch (socketError) {
        console.warn('⚠️ [ChatBubble] Socket failed (non-blocking):', socketError);
        // Socket hatası mesaj kaydını ETKİLEMEZ
      }
      
      // Refetch to sync with server
      await fetchMessages();
    } else {
      // API failed - remove optimistic message
      setMessages(prev => prev.filter(m => m.id !== tempMessage.id));
      // TODO: Show error toast
    }
    
    setIsSending(false);
  };

  // ═══════════════════════════════════════════════════════════════
  // POLLING & LIFECYCLE
  // ═══════════════════════════════════════════════════════════════

  // Start/Stop polling
  useEffect(() => {
    if (visible && !isMinimized && tagId) {
      // Initial fetch
      fetchMessages();
      
      // Poll every 1 second for near real-time
      pollingInterval.current = setInterval(() => {
        fetchMessages();
      }, 1000);
      
      console.log('🔄 [ChatBubble] Polling started (1s)');
    }
    
    return () => {
      if (pollingInterval.current) {
        clearInterval(pollingInterval.current);
        pollingInterval.current = null;
        console.log('⏹️ [ChatBubble] Polling stopped');
      }
    };
  }, [visible, isMinimized, tagId, fetchMessages]);

  // App state changes (foreground/background)
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
        // App came to foreground - refetch
        if (visible && tagId) {
          console.log('📱 [ChatBubble] App foreground - refetching');
          fetchMessages();
        }
      }
      appState.current = nextAppState;
    });

    return () => {
      subscription.remove();
    };
  }, [visible, tagId, fetchMessages]);

  // ═══════════════════════════════════════════════════════════════
  // ANIMATIONS
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
      fetchMessages(); // Refetch on expand
    }
    setIsMinimized(!isMinimized);
  };

  const sendSuggestion = (text: string) => {
    sendMessage(text);
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
              <Text style={styles.emptySubtext}>Aşağıdaki önerilerden birini seçin</Text>
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
                onPress={() => sendSuggestion(suggestion)}
                disabled={isSending}
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
              <Ionicons name="hourglass" size={24} color="#fff" />
            ) : (
              <Ionicons name="send" size={24} color="#fff" />
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
