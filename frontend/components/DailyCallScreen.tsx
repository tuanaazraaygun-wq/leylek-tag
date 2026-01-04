/**
 * Daily.co Call Screen
 * CRITICAL: Single iframe creation, single join call
 * 
 * Rules:
 * - Daily iframe created ONCE (empty useEffect [])
 * - daily.join() called EXACTLY ONCE (hasJoinedRef)
 * - No destroy until callEnded event
 * - Media starts after joined-meeting
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
  const [status, setStatus] = useState<'loading' | 'joining' | 'connected' | 'error'>('loading');
  const [callDuration, setCallDuration] = useState(0);
  const [isEnding, setIsEnding] = useState(false);
  
  const webViewRef = useRef<WebView>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const hasJoinedRef = useRef(false);  // CRITICAL: Prevent multiple joins
  const isDestroyedRef = useRef(false); // CRITICAL: Prevent multiple destroys
  
  const maxDuration = 600;
  const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL 
    ? `${process.env.EXPO_PUBLIC_BACKEND_URL}/api`
    : 'https://tagride.preview.emergentagent.com/api';

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

  // CRITICAL: Send join command ONCE after WebView is ready
  const onWebViewLoad = useCallback(() => {
    if (hasJoinedRef.current) {
      console.log('⚠️ Already joined, skipping');
      return;
    }
    
    console.log('📞 Sending join command...');
    hasJoinedRef.current = true;
    
    // Send join command with room URL and call type
    webViewRef.current?.injectJavaScript(`
      window.JOIN_CONFIG = {
        roomUrl: "${roomUrl}",
        startVideoOff: ${callType === 'audio'}
      };
      if (window.startJoin) {
        window.startJoin();
      }
      true;
    `);
  }, [roomUrl, callType]);

  const endCallProperly = useCallback(async () => {
    if (isEnding || isDestroyedRef.current) return;
    setIsEnding(true);
    isDestroyedRef.current = true;
    
    if (timerRef.current) clearInterval(timerRef.current);

    // 1. Notify backend
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
    } catch (e) {
      console.log('Backend notify error:', e);
    }

    // 2. Destroy Daily
    webViewRef.current?.injectJavaScript(`
      if (window.daily && !window.isDestroyed) {
        window.isDestroyed = true;
        window.daily.leave().then(function() {
          window.daily.destroy();
        }).catch(function() {
          try { window.daily.destroy(); } catch(e) {}
        });
      }
      true;
    `);
    
    // 3. Close UI after short delay
    setTimeout(() => onCallEnd(roomName), 500);
  }, [isEnding, roomName, callerId, receiverId, currentUserId, API_URL, onCallEnd]);

  const handleMessage = (event: any) => {
    try {
      const msg = JSON.parse(event.nativeEvent.data);
      console.log('📞 Daily event:', msg.type);
      
      switch(msg.type) {
        case 'ready':
          // WebView is ready, send join command
          onWebViewLoad();
          break;
        case 'joining':
          setStatus('joining');
          break;
        case 'joined':
          setStatus('connected');
          break;
        case 'participant-left':
          // Other participant left - end call
          if (!isDestroyedRef.current) {
            endCallProperly();
          }
          break;
        case 'error':
          console.error('Daily error:', msg.data);
          setStatus('error');
          break;
      }
    } catch(e) {}
  };

  const formatDuration = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m.toString().padStart(2,'0')}:${sec.toString().padStart(2,'0')}`;
  };

  // CRITICAL: Static HTML - no React state interpolation
  // Join command sent via postMessage after load
  const html = `<!DOCTYPE html>
<html><head>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<style>
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:100%;height:100%;background:#000;overflow:hidden}
#container{width:100%;height:100%}
</style>
</head><body>
<div id="container"></div>
<script src="https://unpkg.com/@daily-co/daily-js@0.67.0/dist/daily-iframe.min.js"></script>
<script>
(function() {
  var daily = null;
  var hasJoined = false;
  var isDestroyed = false;
  
  function log(msg) {
    console.log('[Daily] ' + msg);
  }
  
  function send(type, data) {
    try {
      window.ReactNativeWebView.postMessage(JSON.stringify({type: type, data: data || ''}));
    } catch(e) {}
  }
  
  // Create Daily iframe ONCE
  try {
    log('Creating iframe...');
    daily = DailyIframe.createFrame(document.getElementById('container'), {
      showLeaveButton: false,
      showFullscreenButton: false,
      iframeStyle: {
        width: '100%',
        height: '100%',
        border: 'none'
      }
    });
    
    window.daily = daily;
    
    // Event listeners
    daily.on('joining-meeting', function() {
      log('joining-meeting');
      send('joining');
    });
    
    daily.on('joined-meeting', function() {
      log('joined-meeting');
      send('joined');
      // Enable audio/video immediately
      daily.setLocalAudio(true);
      if (window.JOIN_CONFIG && !window.JOIN_CONFIG.startVideoOff) {
        daily.setLocalVideo(true);
      }
    });
    
    daily.on('participant-joined', function(e) {
      if (e && e.participant && !e.participant.local) {
        log('participant-joined: ' + (e.participant.user_id || 'unknown'));
        send('participant-joined');
      }
    });
    
    daily.on('participant-left', function(e) {
      if (e && e.participant && !e.participant.local) {
        log('participant-left');
        send('participant-left');
      }
    });
    
    daily.on('left-meeting', function() {
      log('left-meeting');
    });
    
    daily.on('error', function(e) {
      log('error: ' + (e.errorMsg || 'unknown'));
      send('error', e.errorMsg || 'unknown');
    });
    
    // Join function - called from React Native
    window.startJoin = function() {
      if (hasJoined) {
        log('Already joined, skipping');
        return;
      }
      if (!window.JOIN_CONFIG || !window.JOIN_CONFIG.roomUrl) {
        log('No room URL');
        send('error', 'No room URL');
        return;
      }
      
      hasJoined = true;
      log('Joining: ' + window.JOIN_CONFIG.roomUrl);
      
      daily.join({
        url: window.JOIN_CONFIG.roomUrl,
        startAudioOff: false,
        startVideoOff: window.JOIN_CONFIG.startVideoOff
      }).then(function() {
        log('Join promise resolved');
      }).catch(function(err) {
        log('Join error: ' + (err.message || err));
        send('error', err.message || 'Join failed');
      });
    };
    
    // Notify React Native that we're ready
    log('Ready, waiting for join command...');
    send('ready');
    
  } catch(err) {
    log('Init error: ' + (err.message || err));
    send('error', err.message || 'Init failed');
  }
})();
</script>
</body></html>`;

  const showWarning = maxDuration - callDuration <= 60 && callDuration > 0;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#1a1a1a" />
      
      <View style={styles.header}>
        <Text style={styles.name}>{otherUserName}</Text>
        <Text style={styles.type}>{callType === 'video' ? 'Görüntülü' : 'Sesli'} Arama</Text>
        {status === 'connected' && (
          <Text style={[styles.duration, showWarning && styles.warning]}>
            {formatDuration(callDuration)}
          </Text>
        )}
        {status === 'loading' && <Text style={styles.status}>Yükleniyor...</Text>}
        {status === 'joining' && <Text style={styles.status}>Bağlanıyor...</Text>}
        {status === 'error' && <Text style={[styles.status, styles.error]}>Bağlantı Hatası</Text>}
      </View>

      <View style={styles.webview}>
        <WebView
          ref={webViewRef}
          source={{ html }}
          style={{ flex: 1, backgroundColor: '#000' }}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          mediaPlaybackRequiresUserAction={false}
          allowsInlineMediaPlayback={true}
          onMessage={handleMessage}
          allowsProtectedMedia={true}
          mediaCapturePermissionGrantType="grant"
          originWhitelist={['*']}
          mixedContentMode="always"
          cacheEnabled={false}
        />
        
        {(status === 'loading' || status === 'joining') && (
          <View style={styles.overlay}>
            <ActivityIndicator size="large" color="#3FA9F5" />
            <Text style={styles.overlayText}>
              {status === 'loading' ? 'Yükleniyor...' : 'Bağlanıyor...'}
            </Text>
          </View>
        )}
      </View>

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
