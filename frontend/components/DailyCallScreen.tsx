/**
 * Daily.co Call Screen
 * CRITICAL FIX: daily.join() called IMMEDIATELY when WebView loads
 * No React state dependency for join
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
  const maxDuration = 600;

  const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL 
    ? `${process.env.EXPO_PUBLIC_BACKEND_URL}/api`
    : 'https://tagride.preview.emergentagent.com/api';

  // Timer - starts when connected
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

  // Back button
  useEffect(() => {
    const handler = BackHandler.addEventListener('hardwareBackPress', () => {
      if (!isEnding) endCallProperly();
      return true;
    });
    return () => handler.remove();
  }, [isEnding]);

  const endCallProperly = useCallback(async () => {
    if (isEnding) return;
    setIsEnding(true);
    if (timerRef.current) clearInterval(timerRef.current);

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
    } catch (e) {}

    webViewRef.current?.injectJavaScript(`
      if(window.daily){try{window.daily.leave();window.daily.destroy();}catch(e){}}true;
    `);
    
    setTimeout(() => onCallEnd(roomName), 1000);
  }, [isEnding, roomName, callerId, receiverId, currentUserId, API_URL, onCallEnd]);

  const handleMessage = (event: any) => {
    try {
      const msg = JSON.parse(event.nativeEvent.data);
      console.log('📞 Daily:', msg.type, msg.data || '');
      
      switch(msg.type) {
        case 'joining':
          setStatus('joining');
          break;
        case 'joined':
          setStatus('connected');
          break;
        case 'left':
        case 'participant-left':
          // Don't auto-close, wait for backend
          break;
        case 'error':
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

  // CRITICAL: HTML that joins IMMEDIATELY when script loads
  // No waiting for React state, no useEffect dependency
  const html = `<!DOCTYPE html>
<html><head>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1">
<style>
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:100%;height:100%;background:#000;overflow:hidden}
#container{width:100%;height:100%;position:relative}
video{width:100%;height:100%;object-fit:cover}
</style>
</head><body>
<div id="container"></div>
<script>
// STEP 1: Load Daily.js from CDN
var script = document.createElement('script');
script.src = 'https://unpkg.com/@daily-co/daily-js@0.67.0/dist/daily-iframe.min.js';
script.onload = function() {
  // STEP 2: Create call frame IMMEDIATELY after script loads
  try {
    window.daily = DailyIframe.createFrame(document.getElementById('container'), {
      showLeaveButton: false,
      showFullscreenButton: false,
      iframeStyle: {
        width: '100%',
        height: '100%',
        border: 'none'
      }
    });
    
    // STEP 3: Set up event listeners
    window.daily.on('joining-meeting', function() {
      window.ReactNativeWebView.postMessage(JSON.stringify({type:'joining'}));
    });
    
    window.daily.on('joined-meeting', function(e) {
      window.ReactNativeWebView.postMessage(JSON.stringify({type:'joined'}));
      // STEP 4: Enable audio/video after joining
      window.daily.setLocalAudio(true);
      window.daily.setLocalVideo(${callType === 'video'});
    });
    
    window.daily.on('participant-joined', function(e) {
      if(!e.participant.local) {
        window.ReactNativeWebView.postMessage(JSON.stringify({type:'participant-joined'}));
      }
    });
    
    window.daily.on('participant-left', function(e) {
      if(!e.participant.local) {
        window.ReactNativeWebView.postMessage(JSON.stringify({type:'participant-left'}));
      }
    });
    
    window.daily.on('left-meeting', function() {
      window.ReactNativeWebView.postMessage(JSON.stringify({type:'left'}));
    });
    
    window.daily.on('error', function(e) {
      window.ReactNativeWebView.postMessage(JSON.stringify({type:'error',data:e.errorMsg||'error'}));
    });
    
    // STEP 5: JOIN IMMEDIATELY - no waiting
    window.daily.join({
      url: '${roomUrl}',
      startAudioOff: false,
      startVideoOff: ${callType === 'audio'}
    }).catch(function(err) {
      window.ReactNativeWebView.postMessage(JSON.stringify({type:'error',data:err.message||'join failed'}));
    });
    
  } catch(err) {
    window.ReactNativeWebView.postMessage(JSON.stringify({type:'error',data:err.message||'init failed'}));
  }
};
script.onerror = function() {
  window.ReactNativeWebView.postMessage(JSON.stringify({type:'error',data:'script load failed'}));
};
document.head.appendChild(script);
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
          style={{ flex: 1 }}
          javaScriptEnabled
          domStorageEnabled
          mediaPlaybackRequiresUserAction={false}
          allowsInlineMediaPlayback
          onMessage={handleMessage}
          allowsProtectedMedia
          mediaCapturePermissionGrantType="grant"
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
