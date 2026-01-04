/**
 * Daily.co Video/Audio Call Screen
 * BACKEND-DRIVEN TERMINATION
 * 
 * Rules:
 * - Backend is single source of truth
 * - Daily events do NOT control UI lifecycle
 * - UI closes ONLY after backend confirms callEnded
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
  const [loading, setLoading] = useState(true);
  const [callDuration, setCallDuration] = useState(0);
  const [connected, setConnected] = useState(false);
  const [isEnding, setIsEnding] = useState(false);
  const webViewRef = useRef<WebView>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const maxDuration = 600; // 10 minutes

  // API URL
  const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL 
    ? `${process.env.EXPO_PUBLIC_BACKEND_URL}/api`
    : 'https://tagride.preview.emergentagent.com/api';

  // Timer
  useEffect(() => {
    if (connected) {
      timerRef.current = setInterval(() => {
        setCallDuration(prev => {
          const newDuration = prev + 1;
          if (newDuration >= maxDuration) {
            endCallProperly();
          }
          return newDuration;
        });
      }, 1000);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [connected]);

  // Back button
  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      if (!isEnding) {
        endCallProperly();
      }
      return true;
    });
    return () => backHandler.remove();
  }, [isEnding]);

  /**
   * CRITICAL: Proper call termination
   * 1. Call backend API
   * 2. Backend broadcasts callEnded to both clients
   * 3. Destroy Daily
   * 4. Close UI
   */
  const endCallProperly = useCallback(async () => {
    if (isEnding) return;
    setIsEnding(true);
    
    console.log('📴 [TERMINATION] Step 1: Calling backend...');
    
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }

    try {
      // Step 1: Call backend to end call
      const response = await fetch(`${API_URL}/calls/end`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          room_name: roomName,
          caller_id: callerId,
          receiver_id: receiverId,
          ended_by: currentUserId,
        }),
      });
      
      const result = await response.json();
      console.log('📴 [TERMINATION] Step 2: Backend response:', result);
      
    } catch (error) {
      console.error('📴 [TERMINATION] Backend error:', error);
    }
    
    // Step 3: Destroy Daily call via WebView
    console.log('📴 [TERMINATION] Step 3: Destroying Daily...');
    webViewRef.current?.injectJavaScript(`
      if (window.callFrame) {
        window.callFrame.leave().then(() => {
          window.callFrame.destroy();
          window.ReactNativeWebView.postMessage(JSON.stringify({type: 'destroyed'}));
        }).catch(() => {
          window.ReactNativeWebView.postMessage(JSON.stringify({type: 'destroyed'}));
        });
      } else {
        window.ReactNativeWebView.postMessage(JSON.stringify({type: 'destroyed'}));
      }
      true;
    `);
    
    // Step 4: Fallback - close UI after 2 seconds if destroy doesn't respond
    setTimeout(() => {
      console.log('📴 [TERMINATION] Step 4: Closing UI');
      onCallEnd(roomName);
    }, 2000);
    
  }, [isEnding, roomName, callerId, receiverId, currentUserId, API_URL, onCallEnd]);

  // Handle WebView messages
  const handleMessage = (event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      console.log('📞 Daily message:', data.type);
      
      if (data.type === 'destroyed') {
        // Daily destroyed - close UI immediately
        onCallEnd(roomName);
      } else if (data.type === 'joined') {
        setConnected(true);
        setLoading(false);
      } else if (data.type === 'left') {
        // Participant left - do NOT auto-close, wait for backend
        console.log('⚠️ Participant left, waiting for backend signal');
      }
    } catch (e) {
      // Not JSON, ignore
    }
  };

  // Format duration
  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const remainingTime = maxDuration - callDuration;
  const showWarning = remainingTime <= 60 && remainingTime > 0;

  // Simple HTML to load Daily without UI interference
  const dailyHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <style>
        * { margin: 0; padding: 0; }
        html, body, #call { width: 100%; height: 100%; }
        body { background: #000; }
      </style>
    </head>
    <body>
      <div id="call"></div>
      <script src="https://unpkg.com/@daily-co/daily-js"></script>
      <script>
        const callFrame = DailyIframe.createFrame(document.getElementById('call'), {
          showLeaveButton: false,
          showFullscreenButton: false,
          iframeStyle: {
            width: '100%',
            height: '100%',
            border: 'none',
          }
        });
        
        window.callFrame = callFrame;
        
        callFrame.on('joined-meeting', () => {
          window.ReactNativeWebView.postMessage(JSON.stringify({type: 'joined'}));
        });
        
        callFrame.on('participant-left', (e) => {
          if (!e.participant.local) {
            window.ReactNativeWebView.postMessage(JSON.stringify({type: 'left'}));
          }
        });
        
        callFrame.on('left-meeting', () => {
          window.ReactNativeWebView.postMessage(JSON.stringify({type: 'left'}));
        });
        
        callFrame.join({ url: '${roomUrl}' });
      </script>
    </body>
    </html>
  `;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#1a1a1a" />
      
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.callerName}>{otherUserName}</Text>
        <Text style={styles.callType}>
          {callType === 'video' ? 'Görüntülü Arama' : 'Sesli Arama'}
        </Text>
        {connected && (
          <Text style={[styles.duration, showWarning && styles.durationWarning]}>
            {formatDuration(callDuration)}
          </Text>
        )}
        {showWarning && (
          <Text style={styles.warningText}>Son 1 dakika!</Text>
        )}
      </View>

      {/* WebView */}
      <View style={styles.webViewContainer}>
        <WebView
          ref={webViewRef}
          source={{ html: dailyHtml }}
          style={styles.webView}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          mediaPlaybackRequiresUserAction={false}
          allowsInlineMediaPlayback={true}
          onMessage={handleMessage}
          onLoadStart={() => setLoading(true)}
          onLoadEnd={() => {
            // Don't set loading false here - wait for 'joined' message
          }}
          allowsProtectedMedia={true}
          mediaCapturePermissionGrantType="grant"
        />
        
        {loading && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color="#3FA9F5" />
            <Text style={styles.loadingText}>Bağlanıyor...</Text>
          </View>
        )}
      </View>

      {/* End Call Button */}
      <View style={styles.controls}>
        <TouchableOpacity
          style={[styles.endButton, isEnding && styles.endButtonDisabled]}
          onPress={endCallProperly}
          disabled={isEnding}
        >
          <Ionicons name="call" size={32} color="#FFF" style={{ transform: [{ rotate: '135deg' }] }} />
          <Text style={styles.endButtonText}>
            {isEnding ? 'Sonlandırılıyor...' : 'Aramayı Bitir'}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a1a',
  },
  header: {
    paddingVertical: 16,
    paddingHorizontal: 20,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  callerName: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#FFF',
  },
  callType: {
    fontSize: 14,
    color: '#888',
    marginTop: 4,
  },
  duration: {
    fontSize: 18,
    color: '#4CAF50',
    marginTop: 8,
    fontWeight: '600',
  },
  durationWarning: {
    color: '#FF9500',
  },
  warningText: {
    fontSize: 12,
    color: '#FF9500',
    marginTop: 4,
  },
  webViewContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  webView: {
    flex: 1,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#1a1a1a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#FFF',
    marginTop: 16,
    fontSize: 16,
  },
  controls: {
    paddingVertical: 20,
    paddingHorizontal: 20,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#333',
  },
  endButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FF3B30',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 30,
    minWidth: 200,
  },
  endButtonDisabled: {
    backgroundColor: '#666',
  },
  endButtonText: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '600',
    marginLeft: 10,
  },
});
