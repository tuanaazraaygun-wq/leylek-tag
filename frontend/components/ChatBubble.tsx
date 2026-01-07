/**
 * ChatBubble.tsx - Bulutlu Modern Chat Komponenti
 * 
 * Özellikler:
 * - Bulut şeklinde açılan chat penceresi
 * - Küçültülebilir
 * - Öneri mesajları
 * - Büyük ve kalın yazılar
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
  onSendMessage?: (text: string, receiverId: string) => void;
  incomingMessages?: Message[];
}

// Öneri mesajları
const PASSENGER_SUGGESTIONS = [
  "Ne zamana gelirsiniz?",
  "Yol paylaşım ücreti ne kadar?",
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
  onSendMessage,
  incomingMessages = [],
}: ChatBubbleProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isMinimized, setIsMinimized] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const flatListRef = useRef<FlatList>(null);
  
  const suggestions = isDriver ? DRIVER_SUGGESTIONS : PASSENGER_SUGGESTIONS;
  const buttonText = isDriver ? 'Yolcuya Yaz' : 'Sürücüye Yaz';

  // Görünürlük animasyonu
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

  // Gelen mesajları ekle
  useEffect(() => {
    if (incomingMessages.length > 0) {
      setMessages(prev => [...prev, ...incomingMessages]);
      if (isMinimized) {
        setUnreadCount(prev => prev + incomingMessages.length);
      }
    }
  }, [incomingMessages]);

  // Mesaj gönder
  const sendMessage = (text: string) => {
    if (!text.trim()) return;
    
    const newMessage: Message = {
      id: Date.now().toString(),
      text: text.trim(),
      sender: 'me',
      timestamp: new Date(),
    };
    
    setMessages(prev => [...prev, newMessage]);
    setInputText('');
    
    if (onSendMessage) {
      onSendMessage(text.trim(), otherUserId);
    }
    
    // Scroll to bottom
    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 100);
  };

  // Öneri mesajı gönder
  const sendSuggestion = (text: string) => {
    sendMessage(text);
  };

  // Küçült/Büyüt
  const toggleMinimize = () => {
    if (isMinimized) {
      setUnreadCount(0);
    }
    setIsMinimized(!isMinimized);
  };

  // Mesaj render
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

  if (!visible) return null;

  // Küçültülmüş görünüm
  if (isMinimized) {
    return (
      <TouchableOpacity 
        style={styles.minimizedBubble}
        onPress={toggleMinimize}
        activeOpacity={0.9}
      >
        <View style={styles.minimizedContent}>
          <Ionicons name="chatbubble-ellipses" size={24} color="#FFF" />
          {unreadCount > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{unreadCount}</Text>
            </View>
          )}
        </View>
        <Text style={styles.minimizedText}>{otherUserName}</Text>
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
          opacity: scaleAnim,
        }
      ]}
    >
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        {/* Bulut şeklinde başlık */}
        <View style={styles.cloudHeader}>
          <View style={styles.cloudShape}>
            <TouchableOpacity onPress={toggleMinimize} style={styles.minimizeBtn}>
              <Ionicons name="remove" size={24} color="#FFF" />
            </TouchableOpacity>
            <View style={styles.headerInfo}>
              <Ionicons name="chatbubble-ellipses" size={20} color="#FFF" />
              <Text style={styles.headerTitle}>{otherUserName}</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={24} color="#FFF" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Mesajlar */}
        <View style={styles.messagesContainer}>
          {messages.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="chatbubbles-outline" size={48} color="#CCC" />
              <Text style={styles.emptyText}>Henüz mesaj yok</Text>
              <Text style={styles.emptySubtext}>Aşağıdaki önerilerden birini seçebilirsiniz</Text>
            </View>
          ) : (
            <FlatList
              ref={flatListRef}
              data={messages}
              renderItem={renderMessage}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.messagesList}
              showsVerticalScrollIndicator={false}
              onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
            />
          )}
        </View>

        {/* Öneri mesajları */}
        <View style={styles.suggestionsContainer}>
          <FlatList
            data={suggestions}
            horizontal
            showsHorizontalScrollIndicator={false}
            keyExtractor={(item, index) => index.toString()}
            renderItem={({ item }) => (
              <TouchableOpacity 
                style={styles.suggestionBtn}
                onPress={() => sendSuggestion(item)}
              >
                <Text style={styles.suggestionText}>{item}</Text>
              </TouchableOpacity>
            )}
            contentContainerStyle={styles.suggestionsList}
          />
        </View>

        {/* Mesaj girişi */}
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            value={inputText}
            onChangeText={setInputText}
            placeholder="Mesajınızı yazın..."
            placeholderTextColor="#999"
            multiline
            maxLength={500}
          />
          <TouchableOpacity 
            style={[styles.sendBtn, !inputText.trim() && styles.sendBtnDisabled]}
            onPress={() => sendMessage(inputText)}
            disabled={!inputText.trim()}
          >
            <Ionicons name="send" size={22} color="#FFF" />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 20,
    right: 16,
    left: 16,
    maxHeight: SCREEN_HEIGHT * 0.6,
    backgroundColor: '#FFF',
    borderRadius: 24,
    elevation: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    overflow: 'hidden',
    zIndex: 9998,
  },
  keyboardView: {
    flex: 1,
  },
  cloudHeader: {
    backgroundColor: '#3FA9F5',
    paddingTop: 8,
    paddingBottom: 16,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  cloudShape: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  minimizeBtn: {
    padding: 8,
  },
  headerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFF',
    marginLeft: 8,
  },
  closeBtn: {
    padding: 8,
  },
  messagesContainer: {
    flex: 1,
    minHeight: 150,
    maxHeight: 250,
    backgroundColor: '#F5F5F5',
  },
  messagesList: {
    padding: 16,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
    marginTop: 12,
  },
  emptySubtext: {
    fontSize: 13,
    color: '#999',
    marginTop: 4,
    textAlign: 'center',
  },
  messageBubble: {
    maxWidth: '80%',
    padding: 12,
    borderRadius: 18,
    marginBottom: 8,
  },
  myMessage: {
    alignSelf: 'flex-end',
    backgroundColor: '#3FA9F5',
    borderBottomRightRadius: 4,
  },
  otherMessage: {
    alignSelf: 'flex-start',
    backgroundColor: '#E8E8E8',
    borderBottomLeftRadius: 4,
  },
  messageText: {
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 22,
  },
  myMessageText: {
    color: '#FFF',
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
  suggestionsContainer: {
    backgroundColor: '#FFF',
    borderTopWidth: 1,
    borderTopColor: '#EEE',
    paddingVertical: 8,
  },
  suggestionsList: {
    paddingHorizontal: 12,
  },
  suggestionBtn: {
    backgroundColor: '#E3F2FD',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
    marginHorizontal: 4,
    borderWidth: 1,
    borderColor: '#BBDEFB',
  },
  suggestionText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1976D2',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 12,
    backgroundColor: '#FFF',
    borderTopWidth: 1,
    borderTopColor: '#EEE',
  },
  input: {
    flex: 1,
    backgroundColor: '#F5F5F5',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 16,
    fontWeight: '500',
    maxHeight: 100,
    color: '#333',
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#3FA9F5',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  sendBtnDisabled: {
    backgroundColor: '#CCC',
  },
  
  // Küçültülmüş görünüm
  minimizedBubble: {
    position: 'absolute',
    bottom: 100,
    right: 16,
    backgroundColor: '#3FA9F5',
    borderRadius: 28,
    padding: 14,
    alignItems: 'center',
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    zIndex: 9998,
  },
  minimizedContent: {
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: '#FF3B30',
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  badgeText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '700',
  },
  minimizedText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '600',
    marginTop: 4,
  },
});
