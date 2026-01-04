/**
 * Daily.co Call Screen - Direct URL Mode
 * Opens Daily.co room URL directly in WebView (no iframe)
 * This bypasses Android WebView iframe permission issues
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
} from 'react-native';
import { WebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';

interface DailyCallScreenProps {
  roomUrl: string;
  roomName: string;
  callType: 'video' | 'audio';
  otherUserName: string;
  callerId: string;
  receiverId: string;
  currentUserId: string;
  onCallEnd: (roomName: string) => void;
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
}: DailyCallScreenProps) {
  const [status, setStatus] = useState<'loading' | 'connected' | 'error'>('loading');
  const [callDuration, setCallDuration] = useState(0);
  const [isEnding, setIsEnding] = useState(false);
  
  const webViewRef = useRef<WebView>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const isDestroyedRef = useRef(false);
  
  const maxDuration = 600;
  const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL 
    ? `${process.env.EXPO_PUBLIC_BACKEND_URL}/api`
    : 'https://dailyco-fix.preview.emergentagent.com/api';

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
      if (!isEnding) endCallProperly();
      return true;
    });
    return () => handler.remove();
  }, [isEnding]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const endCallProperly = useCallback(async () => {
    if (isEnding || isDestroyedRef.current) return;
    
    console.log('🔴 [DailyCallScreen] Ending call...');
    setIsEnding(true);
    isDestroyedRef.current = true;
    
    if (timerRef.current) clearInterval(timerRef.current);

    // Notify backend
    try {
      await fetch(`${API_URL}/calls/end`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          room_name: roomName,
          caller_id: callerId,
          receiver_id: receiverId,
          ended_by: currentUserId,
        }),
      });
      console.log('✅ [DailyCallScreen] Backend notified');
    } catch (e) {
      console.log('⚠️ [DailyCallScreen] Backend notify error:', e);
    }
    
    // Close UI
    setTimeout(() => onCallEnd(roomName), 300);
  }, [isEnding, roomName, callerId, receiverId, currentUserId, API_URL, onCallEnd]);

  const formatDuration = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m.toString().padStart(2,'0')}:${sec.toString().padStart(2,'0')}`;
  };

  const showWarning = maxDuration - callDuration <= 60 && callDuration > 0;

  // Build Daily.co prebuilt URL with parameters
  const dailyUrl = `${roomUrl}?prejoinUI=false&startVideo=${callType === 'video'}&startAudio=true`;

  console.log('📞 [DailyCallScreen] Opening Daily URL:', dailyUrl);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#1a1a1a" />
      
      {/* Header */}
      <View style={styles.header}>
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
          onPermissionRequest={(event) => {
            console.log('📞 [DailyCallScreen] Permission request:', event.resources);
            event.grant(event.resources);
          }}
          onLoadStart={() => {
            console.log('📞 [DailyCallScreen] WebView load start');
            setStatus('loading');
          }}
          onLoadEnd={() => {
            console.log('📞 [DailyCallScreen] WebView load end');
            setStatus('connected');
          }}
          onError={(error) => {
            console.error('❌ [DailyCallScreen] WebView error:', error.nativeEvent);
            setStatus('error');
          }}
          onHttpError={(error) => {
            console.error('❌ [DailyCallScreen] HTTP error:', error.nativeEvent);
          }}
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
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1a1a1a' },
  header: { padding: 16, alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#333' },
  name: { fontSize: 20, fontWeight: 'bold', color: '#FFF' },
  type: { fontSize: 14, color: '#888', marginTop: 4 },
  duration: { fontSize: 18, color: '#4CAF50', marginTop: 8, fontWeight: '600' },
  warning: { color: '#FF9500' },
  status: { fontSize: 14, color: '#3FA9F5', marginTop: 8 },
  error: { color: '#FF3B30' },
  webview: { flex: 1, backgroundColor: '#000' },
  overlay: { 
    ...StyleSheet.absoluteFillObject, 
    backgroundColor: '#1a1a1a', 
    justifyContent: 'center', 
    alignItems: 'center' 
  },
  overlayText: { color: '#FFF', marginTop: 16, fontSize: 16 },
  controls: { padding: 20, alignItems: 'center', borderTopWidth: 1, borderTopColor: '#333' },
  endBtn: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: '#FF3B30', 
    paddingVertical: 14, 
    paddingHorizontal: 32, 
    borderRadius: 30 
  },
  disabled: { backgroundColor: '#666' },
  endText: { color: '#FFF', fontSize: 16, fontWeight: '600', marginLeft: 8 },
});
