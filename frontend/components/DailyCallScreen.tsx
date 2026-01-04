/**
 * Daily.co Call Screen
 * CRITICAL FIX: Single iframe creation, single join call
 * 
 * Rules (MANDATORY):
 * 1. Daily iframe created ONCE (empty useEffect [])
 * 2. daily.join() called EXACTLY ONCE (hasJoinedRef)
 * 3. No destroy until callEnded event
 * 4. Media starts after joined-meeting
 * 5. HTML is STATIC - no React state interpolation
 */
import React, { useState, useEffect, useRef, useMemo } from 'react';
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

// CRITICAL: Static HTML - defined OUTSIDE component to prevent recreation
const DAILY_HTML = `<!DOCTYPE html>
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
  
  // Create Daily iframe ONCE on page load
  // CRITICAL: Allow camera, microphone, autoplay for Android WebView
  try {
    log('Creating iframe ONCE with permissions...');
    daily = DailyIframe.createFrame(document.getElementById('container'), {
      showLeaveButton: false,
      showFullscreenButton: false,
      iframeStyle: {
        width: '100%',
        height: '100%',
        border: 'none',
        allow: 'camera; microphone; autoplay; display-capture'
      }
    });
    
    window.daily = daily;
    window.isDestroyed = false;
    
    // Event listeners
    daily.on('joining-meeting', function() {
      log('joining-meeting event');
      send('joining');
    });
    
    daily.on('joined-meeting', function() {
      log('joined-meeting event - CONNECTED!');
      send('joined');
    });
    
    daily.on('participant-joined', function(e) {
      if (e && e.participant && !e.participant.local) {
        log('remote participant joined');
        send('participant-joined');
      }
    });
    
    daily.on('participant-left', function(e) {
      if (e && e.participant && !e.participant.local) {
        log('remote participant left');
        send('participant-left');
      }
    });
    
    daily.on('left-meeting', function() {
      log('left-meeting event');
      send('left');
    });
    
    daily.on('error', function(e) {
      log('error: ' + (e.errorMsg || JSON.stringify(e)));
      send('error', e.errorMsg || 'unknown');
    });
    
    daily.on('camera-error', function(e) {
      log('camera-error: ' + JSON.stringify(e));
    });
    
    // Join function - called ONCE from React Native via postMessage
    // CRITICAL: startAudioOff and startVideoOff MUST be false for Android WebView
    window.joinRoom = function(roomUrl, isVideoCall, userName) {
      if (hasJoined) {
        log('SKIP: Already joined');
        return;
      }
      if (isDestroyed) {
        log('SKIP: Already destroyed');
        return;
      }
      if (!roomUrl) {
        log('ERROR: No room URL');
        send('error', 'No room URL');
        return;
      }
      
      hasJoined = true;
      log('JOINING: ' + roomUrl + ' (video: ' + isVideoCall + ', user: ' + userName + ')');
      
      // CRITICAL: For Android WebView, audio/video MUST start ON
      daily.join({
        url: roomUrl,
        startAudioOff: false,
        startVideoOff: false,
        userName: userName || 'Kullanıcı'
      }).then(function() {
        log('Join SUCCESS - connected to room');
        send('joined');
      }).catch(function(err) {
        log('Join error: ' + (err.message || err));
        send('error', err.message || 'Join failed');
        hasJoined = false;
      });
    };
    
    // Destroy function - called ONLY on callEnded
    window.destroyDaily = function() {
      if (isDestroyed) {
        log('SKIP: Already destroyed');
        return;
      }
      isDestroyed = true;
      window.isDestroyed = true;
      log('DESTROYING Daily...');
      
      try {
        daily.leave().then(function() {
          log('Left meeting');
          try { daily.destroy(); log('Destroyed'); } catch(e) {}
        }).catch(function() {
          try { daily.destroy(); log('Destroyed after leave error'); } catch(e) {}
        });
      } catch(e) {
        log('Destroy error: ' + e);
      }
    };
    
    // Message handler from React Native
    window.addEventListener('message', function(e) {
      try {
        var msg = JSON.parse(e.data);
        log('RN message: ' + msg.type);
        
        if (msg.type === 'join' && msg.roomUrl) {
          window.joinRoom(msg.roomUrl, msg.isVideo);
        } else if (msg.type === 'destroy') {
          window.destroyDaily();
        } else if (msg.type === 'toggleAudio') {
          daily.setLocalAudio(msg.enabled);
        } else if (msg.type === 'toggleVideo') {
          daily.setLocalVideo(msg.enabled);
        }
      } catch(e) {
        log('Message parse error: ' + e);
      }
    });
    
    // Also listen to document message (for Android)
    document.addEventListener('message', function(e) {
      try {
        var msg = JSON.parse(e.data);
        log('RN doc message: ' + msg.type);
        
        if (msg.type === 'join' && msg.roomUrl) {
          window.joinRoom(msg.roomUrl, msg.isVideo, msg.userName);
        } else if (msg.type === 'destroy') {
          window.destroyDaily();
        }
      } catch(e) {}
    });
    
    // Notify React Native that page is ready
    log('Page ready, waiting for join command...');
    send('ready');
    
  } catch(err) {
    log('INIT ERROR: ' + (err.message || err));
    send('error', err.message || 'Init failed');
  }
})();
</script>
</body></html>`;

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
  const isReadyRef = useRef(false);     // Track if WebView is ready
  
  const maxDuration = 600;
  const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL 
    ? `${process.env.EXPO_PUBLIC_BACKEND_URL}/api`
    : 'https://dailyco-fix.preview.emergentagent.com/api';

  // CRITICAL: Store initial values in refs to prevent closure issues
  const roomUrlRef = useRef(roomUrl);
  const callTypeRef = useRef(callType);
  
  // CRITICAL: Use useMemo for HTML source to prevent WebView recreation
  const htmlSource = useMemo(() => ({ html: DAILY_HTML }), []);

  // CRITICAL: Send join command EXACTLY ONCE when ready
  const sendJoinCommand = () => {
    if (hasJoinedRef.current) {
      console.log('⚠️ [DailyCallScreen] Already sent join, skipping');
      return;
    }
    if (!isReadyRef.current) {
      console.log('⚠️ [DailyCallScreen] WebView not ready yet');
      return;
    }
    
    hasJoinedRef.current = true;
    const isVideo = callTypeRef.current === 'video';
    
    console.log(`📞 [DailyCallScreen] Sending JOIN command: ${roomUrlRef.current}, video: ${isVideo}`);
    
    const message = JSON.stringify({
      type: 'join',
      roomUrl: roomUrlRef.current,
      isVideo: isVideo,
      userName: otherUserName || 'Kullanıcı'
    });
    
    webViewRef.current?.postMessage(message);
  };

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

  // Cleanup on unmount - BUT only if not already destroyed
  useEffect(() => {
    return () => {
      console.log('🧹 [DailyCallScreen] Unmounting...');
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const endCallProperly = async () => {
    if (isEnding || isDestroyedRef.current) {
      console.log('⚠️ [DailyCallScreen] Already ending/destroyed, skipping');
      return;
    }
    
    console.log('🔴 [DailyCallScreen] Ending call properly...');
    setIsEnding(true);
    isDestroyedRef.current = true;
    
    if (timerRef.current) clearInterval(timerRef.current);

    // 1. Destroy Daily FIRST
    console.log('📤 [DailyCallScreen] Sending destroy command to WebView');
    webViewRef.current?.postMessage(JSON.stringify({ type: 'destroy' }));

    // 2. Notify backend
    try {
      console.log('📤 [DailyCallScreen] Notifying backend...');
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
      console.log('❌ [DailyCallScreen] Backend notify error:', e);
    }
    
    // 3. Close UI after short delay
    setTimeout(() => {
      console.log('👋 [DailyCallScreen] Calling onCallEnd');
      onCallEnd(roomName);
    }, 300);
  };

  const handleMessage = (event: any) => {
    try {
      const msg = JSON.parse(event.nativeEvent.data);
      console.log('📨 [DailyCallScreen] Message from WebView:', msg.type, msg.data || '');
      
      switch(msg.type) {
        case 'ready':
          // WebView is ready - send join command ONCE
          console.log('✅ [DailyCallScreen] WebView ready');
          isReadyRef.current = true;
          sendJoinCommand();
          break;
          
        case 'joining':
          console.log('🔄 [DailyCallScreen] Status: joining');
          setStatus('joining');
          break;
          
        case 'joined':
          console.log('✅ [DailyCallScreen] Status: connected');
          setStatus('connected');
          break;
          
        case 'participant-joined':
          console.log('👤 [DailyCallScreen] Remote participant joined');
          break;
          
        case 'participant-left':
          // Other participant left - end call
          console.log('👤 [DailyCallScreen] Remote participant left, ending call');
          if (!isDestroyedRef.current) {
            endCallProperly();
          }
          break;
          
        case 'left':
          console.log('📞 [DailyCallScreen] Left meeting');
          break;
          
        case 'error':
          console.error('❌ [DailyCallScreen] Daily error:', msg.data);
          setStatus('error');
          break;
      }
    } catch(e) {
      console.log('❌ [DailyCallScreen] Message parse error:', e);
    }
  };

  const formatDuration = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m.toString().padStart(2,'0')}:${sec.toString().padStart(2,'0')}`;
  };

  const showWarning = maxDuration - callDuration <= 60 && callDuration > 0;

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
        {status === 'loading' && <Text style={styles.status}>Yükleniyor...</Text>}
        {status === 'joining' && <Text style={styles.status}>Bağlanıyor...</Text>}
        {status === 'error' && <Text style={[styles.status, styles.error]}>Bağlantı Hatası</Text>}
      </View>

      {/* WebView - CRITICAL: source is memoized, never changes */}
      <View style={styles.webview}>
        <WebView
          ref={webViewRef}
          source={htmlSource}
          style={styles.webviewInner}
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
          incognito={true}
          onPermissionRequest={(event) => event.grant(event.resources)}
        />
        
        {/* Loading overlay */}
        {(status === 'loading' || status === 'joining') && (
          <View style={styles.overlay}>
            <ActivityIndicator size="large" color="#3FA9F5" />
            <Text style={styles.overlayText}>
              {status === 'loading' ? 'Yükleniyor...' : 'Bağlanıyor...'}
            </Text>
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
  webviewInner: { flex: 1, backgroundColor: '#000' },
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
