/**
 * Daily.co Call Screen - Türkçe + Hızlı Kapanma + Küçültülebilir
 * v2.0
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  SafeAreaView,
  StatusBar,
  BackHandler,
  Dimensions,
  Animated,
  PanResponder,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface DailyCallScreenProps {
  roomUrl: string;
  roomName: string;
  callType: 'video' | 'audio';
  otherUserName: string;
  callerId: string;
  receiverId: string;
  currentUserId: string;
  onCallEnd: (roomName: string) => void;
  onMinimize?: () => void;  // Küçültme callback'i
}

export default function DailyCallScreen({
  roomUrl,
  roomName,
  callType,
  otherUserName,
  callerId,
  receiverId,
  currentUserId,
  onCallEnd,
  onMinimize,
}: DailyCallScreenProps) {
  const [status, setStatus] = useState<'loading' | 'connected' | 'error'>('loading');
  const [callDuration, setCallDuration] = useState(0);
  const [isEnding, setIsEnding] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  
  const webViewRef = useRef<WebView>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const isDestroyedRef = useRef(false);
  
  // Animasyon değerleri
  const slideAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;
  
  const maxDuration = 600;
  const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL 
    ? `${process.env.EXPO_PUBLIC_BACKEND_URL}/api`
    : 'https://socket-singleton.preview.emergentagent.com/api';

  // Timer - only when connected
  useEffect(() => {
    if (status === 'connected') {
      timerRef.current = setInterval(() => {
        setCallDuration(prev => {
          if (prev + 1 >= maxDuration) {
            endCallProperly();
          }
          return prev + 1;
        });
      }, 1000);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [status]);

  // Back button handler
  useEffect(() => {
    const handler = BackHandler.addEventListener('hardwareBackPress', () => {
      if (isMinimized) {
        maximizeCall();
        return true;
      }
      if (!isEnding) endCallProperly();
      return true;
    });
    return () => handler.remove();
  }, [isEnding, isMinimized]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const endCallProperly = useCallback(async () => {
    if (isEnding || isDestroyedRef.current) return;
    
    console.log('🔴 [DailyCallScreen] Ending call FAST...');
    setIsEnding(true);
    isDestroyedRef.current = true;
    
    if (timerRef.current) clearInterval(timerRef.current);

    // 🔥 HEMEN kapat - backend'i beklemeden
    onCallEnd(roomName);

    // Backend'e arka planda bildir
    try {
      fetch(`${API_URL}/calls/end`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          room_name: roomName,
          caller_id: callerId,
          receiver_id: receiverId,
          ended_by: currentUserId,
        }),
      }).catch(e => console.log('⚠️ Backend notify error:', e));
    } catch (e) {
      console.log('⚠️ Backend notify error:', e);
    }
  }, [isEnding, roomName, callerId, receiverId, currentUserId, API_URL, onCallEnd]);

  // Küçült
  const minimizeCall = () => {
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: SCREEN_HEIGHT - 150,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 0.3,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setIsMinimized(true);
      if (onMinimize) onMinimize();
    });
  };

  // Büyüt
  const maximizeCall = () => {
    setIsMinimized(false);
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const formatDuration = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m.toString().padStart(2,'0')}:${sec.toString().padStart(2,'0')}`;
  };

  const showWarning = maxDuration - callDuration <= 60 && callDuration > 0;

  // Daily.co URL
  const dailyUrl = `${roomUrl}?prejoinUI=false&startVideo=${callType === 'video'}&startAudio=true&lang=tr`;

  // 🔥 JavaScript ile Daily.co arayüzünü Türkçeleştir
  const turkishTranslationScript = `
    (function() {
      const translations = {
        'Leave': 'Bitir',
        'Turn on': 'Aç',
        'Turn off': 'Kapat',
        'Mute': 'Sessize Al',
        'Unmute': 'Sesi Aç',
        'More': 'Daha Fazla',
        'Guest': '${otherUserName || 'Misafir'}',
        'people in call': 'kişi görüşmede',
        'in call': 'görüşmede',
        'Connecting': 'Bağlanıyor',
        'Connected': 'Bağlandı',
        'Camera': 'Kamera',
        'Microphone': 'Mikrofon',
        'Share screen': 'Ekran Paylaş',
        'Chat': 'Sohbet',
        'Settings': 'Ayarlar',
        'You': 'Sen',
        'Join': 'Katıl',
        'Joining': 'Katılıyor',
        'Loading': 'Yükleniyor',
        'Start video': 'Video Başlat',
        'Stop video': 'Video Durdur',
        'Start audio': 'Ses Başlat',
        'Stop audio': 'Sesi Durdur',
      };
      
      function translatePage() {
        const walker = document.createTreeWalker(
          document.body,
          NodeFilter.SHOW_TEXT,
          null,
          false
        );
        
        let node;
        while (node = walker.nextNode()) {
          for (const [en, tr] of Object.entries(translations)) {
            if (node.nodeValue && node.nodeValue.includes(en)) {
              node.nodeValue = node.nodeValue.replace(new RegExp(en, 'gi'), tr);
            }
          }
        }
        
        // Butonları da kontrol et
        document.querySelectorAll('button, [role="button"], span, div').forEach(el => {
          for (const [en, tr] of Object.entries(translations)) {
            if (el.textContent && el.textContent.trim() === en) {
              el.textContent = tr;
            }
            if (el.getAttribute('aria-label') === en) {
              el.setAttribute('aria-label', tr);
            }
            if (el.getAttribute('title') === en) {
              el.setAttribute('title', tr);
            }
          }
        });
      }
      
      // Sayfa yüklendiğinde ve her 2 saniyede bir çevir
      translatePage();
      setInterval(translatePage, 2000);
    })();
    true;
  `;

  // Küçültülmüş görünüm
  if (isMinimized) {
    return (
      <TouchableOpacity 
        style={styles.minimizedContainer}
        onPress={maximizeCall}
        activeOpacity={0.9}
      >
        <View style={styles.minimizedContent}>
          <View style={styles.minimizedAvatar}>
            <Ionicons name="person" size={24} color="#FFF" />
          </View>
          <View style={styles.minimizedInfo}>
            <Text style={styles.minimizedName} numberOfLines={1}>{otherUserName}</Text>
            <Text style={styles.minimizedDuration}>{formatDuration(callDuration)}</Text>
          </View>
          <TouchableOpacity 
            style={styles.minimizedEndBtn}
            onPress={endCallProperly}
          >
            <Ionicons name="call" size={18} color="#FFF" style={{ transform: [{ rotate: '135deg' }] }} />
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  }

  return (
    <Animated.View 
      style={[
        styles.container,
        {
          transform: [
            { translateY: slideAnim },
            { scale: scaleAnim }
          ]
        }
      ]}
    >
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="light-content" backgroundColor="#1a1a1a" />
        
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <TouchableOpacity onPress={minimizeCall} style={styles.minimizeBtn}>
              <Ionicons name="chevron-down" size={28} color="#FFF" />
            </TouchableOpacity>
          </View>
          <View style={styles.headerCenter}>
            <Text style={styles.name}>{otherUserName}</Text>
            <Text style={styles.type}>{callType === 'video' ? 'Görüntülü' : 'Sesli'} Arama</Text>
            {status === 'connected' && (
              <Text style={[styles.duration, showWarning && styles.warning]}>
                {formatDuration(callDuration)}
              </Text>
            )}
            {status === 'loading' && <Text style={styles.status}>Bağlanıyor...</Text>}
            {status === 'error' && <Text style={[styles.status, styles.error]}>Bağlantı Hatası</Text>}
          </View>
          <View style={styles.headerRight} />
        </View>

        {/* WebView - Direct Daily.co URL */}
        <View style={styles.webview}>
          <WebView
            ref={webViewRef}
            source={{ uri: dailyUrl }}
            style={{ flex: 1, backgroundColor: '#000' }}
            javaScriptEnabled={true}
            domStorageEnabled={true}
            mediaPlaybackRequiresUserAction={false}
            allowsInlineMediaPlayback={true}
            allowsProtectedMedia={true}
            mediaCapturePermissionGrantType="grant"
            originWhitelist={['*']}
            mixedContentMode="always"
            injectedJavaScript={turkishTranslationScript}
            onPermissionRequest={(event) => {
              event.grant(event.resources);
            }}
            onLoadStart={() => setStatus('loading')}
            onLoadEnd={() => {
              setStatus('connected');
              // Sayfa yüklenince tekrar çevir
              webViewRef.current?.injectJavaScript(turkishTranslationScript);
            }}
            onError={() => setStatus('error')}
          />
          
          {/* Loading overlay */}
          {status === 'loading' && (
            <View style={styles.overlay}>
              <ActivityIndicator size="large" color="#3FA9F5" />
              <Text style={styles.overlayText}>Bağlanıyor...</Text>
            </View>
          )}
        </View>

        {/* Controls */}
        <View style={styles.controls}>
          <TouchableOpacity
            style={[styles.endBtn, isEnding && styles.disabled]}
            onPress={endCallProperly}
            disabled={isEnding}
          >
            <Ionicons name="call" size={28} color="#FFF" style={{ transform: [{ rotate: '135deg' }] }} />
            <Text style={styles.endText}>{isEnding ? 'Sonlandırılıyor...' : 'Bitir'}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: { 
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#1a1a1a',
    zIndex: 9999,
  },
  safeArea: { flex: 1 },
  header: { 
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12, 
    borderBottomWidth: 1, 
    borderBottomColor: '#333' 
  },
  headerLeft: { width: 50 },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerRight: { width: 50 },
  minimizeBtn: {
    padding: 8,
  },
  name: { fontSize: 18, fontWeight: 'bold', color: '#FFF' },
  type: { fontSize: 13, color: '#888', marginTop: 2 },
  duration: { fontSize: 16, color: '#4CAF50', marginTop: 4, fontWeight: '600' },
  warning: { color: '#FF9500' },
  status: { fontSize: 13, color: '#3FA9F5', marginTop: 4 },
  error: { color: '#FF3B30' },
  webview: { flex: 1, backgroundColor: '#000' },
  overlay: { 
    ...StyleSheet.absoluteFillObject, 
    backgroundColor: '#1a1a1a', 
    justifyContent: 'center', 
    alignItems: 'center' 
  },
  overlayText: { color: '#FFF', marginTop: 16, fontSize: 16 },
  controls: { 
    padding: 16, 
    alignItems: 'center', 
    borderTopWidth: 1, 
    borderTopColor: '#333',
    backgroundColor: '#1a1a1a',
  },
  endBtn: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: '#FF3B30', 
    paddingVertical: 14, 
    paddingHorizontal: 40, 
    borderRadius: 30,
    elevation: 5,
    shadowColor: '#FF3B30',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
  },
  disabled: { backgroundColor: '#666' },
  endText: { color: '#FFF', fontSize: 17, fontWeight: '700', marginLeft: 10 },
  
  // Küçültülmüş görünüm
  minimizedContainer: {
    position: 'absolute',
    bottom: 100,
    right: 16,
    backgroundColor: '#2a2a2a',
    borderRadius: 16,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    zIndex: 9999,
  },
  minimizedContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  minimizedAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#3FA9F5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  minimizedInfo: {
    marginLeft: 12,
    marginRight: 12,
  },
  minimizedName: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
    maxWidth: 100,
  },
  minimizedDuration: {
    color: '#4CAF50',
    fontSize: 12,
    marginTop: 2,
  },
  minimizedEndBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FF3B30',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
