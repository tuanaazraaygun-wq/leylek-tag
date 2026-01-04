/**
 * WhatsApp Benzeri Custom Arama Ekranı - WebView Version
 * Daily.co WebView ile ancak UI tamamen özelleştirilmiş
 * 
 * Özellikler:
 * - Daily default UI CSS ile gizleniyor
 * - Özel kontrol butonları
 * - Türkçe arayüz
 * - Sesli ↔ Görüntülü geçiş
 */
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  Dimensions,
  BackHandler,
  Alert,
  Animated,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { WebView } from 'react-native-webview';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface WhatsAppCallScreenProps {
  roomUrl: string;
  roomName: string;
  callType: 'video' | 'audio';
  otherUserName: string;
  onCallEnd: (roomName: string) => void;
  currentUserId?: string;
}

type CallStatus = 'connecting' | 'connected' | 'reconnecting' | 'ended';

// Daily UI'ını gizlemek için CSS
const HIDE_DAILY_UI_CSS = `
  /* Daily.co tüm UI'ını gizle */
  .daily-prejoin, 
  .leave-btn,
  .leave-button,
  .daily-buttons,
  [class*="leave"],
  [class*="prejoin"],
  [class*="toolbar"],
  [class*="header"],
  [class*="footer"],
  button[data-action="leave"],
  .tray,
  .tray-button,
  .cam-btn,
  .mic-btn,
  .chat-btn,
  .screen-share-btn,
  .settings-btn,
  .participants-btn,
  .daily-co-branding,
  .daily-branding,
  div[class*="Tray"],
  div[class*="Control"],
  div[class*="Header"],
  div[class*="Leave"],
  div[class*="Button"],
  nav,
  header,
  footer {
    display: none !important;
    visibility: hidden !important;
    opacity: 0 !important;
    pointer-events: none !important;
  }
  
  /* Video container tam ekran */
  .daily-video-container,
  .call-wrapper,
  #call-wrapper,
  #videos,
  .videos,
  video {
    width: 100vw !important;
    height: 100vh !important;
    max-width: 100vw !important;
    max-height: 100vh !important;
    position: fixed !important;
    top: 0 !important;
    left: 0 !important;
    z-index: 1 !important;
    object-fit: cover !important;
  }
  
  body {
    margin: 0 !important;
    padding: 0 !important;
    overflow: hidden !important;
    background: #000 !important;
  }
`;

// Inject CSS script
const INJECT_CSS_SCRIPT = `
  (function() {
    var style = document.createElement('style');
    style.type = 'text/css';
    style.innerHTML = \`${HIDE_DAILY_UI_CSS}\`;
    document.head.appendChild(style);
    
    // MutationObserver ile sürekli kontrol et
    var observer = new MutationObserver(function(mutations) {
      var buttons = document.querySelectorAll('button, [class*="leave"], [class*="btn"], nav, header, footer');
      buttons.forEach(function(el) {
        if (el.textContent && (
          el.textContent.includes('Leave') || 
          el.textContent.includes('leave') ||
          el.textContent.includes('Home') ||
          el.textContent.includes('Guest')
        )) {
          el.style.display = 'none';
          el.style.visibility = 'hidden';
        }
      });
    });
    
    observer.observe(document.body, { childList: true, subtree: true });
    
    // İlk yüklemede de çalıştır
    setTimeout(function() {
      var buttons = document.querySelectorAll('button, [class*="leave"], [class*="btn"], nav, header, footer');
      buttons.forEach(function(el) {
        el.style.display = 'none';
        el.style.visibility = 'hidden';
      });
    }, 500);
    
    setTimeout(function() {
      var buttons = document.querySelectorAll('button, [class*="leave"], [class*="btn"], nav, header, footer');
      buttons.forEach(function(el) {
        el.style.display = 'none';
        el.style.visibility = 'hidden';
      });
    }, 1500);
  })();
  true;
`;

export default function WhatsAppCallScreen({
  roomUrl,
  roomName,
  callType,
  otherUserName,
  onCallEnd,
  currentUserId,
}: WhatsAppCallScreenProps) {
  const webViewRef = useRef<WebView>(null);
  
  // Call state
  const [status, setStatus] = useState<CallStatus>('connecting');
  const [callDuration, setCallDuration] = useState(0);
  const [isVideoEnabled, setIsVideoEnabled] = useState(callType === 'video');
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isSpeakerOn, setIsSpeakerOn] = useState(true);
  const [loading, setLoading] = useState(true);
  
  // UI state
  const [showControls, setShowControls] = useState(true);
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  
  // Max call duration (10 minutes)
  const maxDuration = 600;

  // Start timer when connected
  useEffect(() => {
    if (status === 'connected') {
      timerRef.current = setInterval(() => {
        setCallDuration(prev => {
          const newDuration = prev + 1;
          if (newDuration >= maxDuration) {
            handleEndCall(true);
          }
          return newDuration;
        });
      }, 1000);
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [status]);

  // Handle back button
  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      handleEndCall(false);
      return true;
    });
    return () => backHandler.remove();
  }, []);

  // Auto-hide controls after 5 seconds (only in video mode)
  useEffect(() => {
    if (isVideoEnabled && status === 'connected' && showControls) {
      const timeout = setTimeout(() => {
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }).start(() => setShowControls(false));
      }, 5000);
      
      return () => clearTimeout(timeout);
    }
  }, [isVideoEnabled, status, showControls]);

  const handleEndCall = (auto: boolean = false) => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    
    if (auto) {
      onCallEnd(roomName);
      return;
    }

    Alert.alert(
      'Aramayı Bitir',
      'Aramayı sonlandırmak istediğinize emin misiniz?',
      [
        { text: 'İptal', style: 'cancel' },
        { 
          text: 'Bitir', 
          style: 'destructive',
          onPress: () => {
            onCallEnd(roomName);
          }
        },
      ]
    );
  };

  // Toggle video via WebView message
  const toggleVideo = () => {
    const newState = !isVideoEnabled;
    setIsVideoEnabled(newState);
    // Daily.co JS API - toggle camera
    webViewRef.current?.injectJavaScript(`
      if (window.call && window.call.setLocalVideo) {
        window.call.setLocalVideo(${newState});
      }
      true;
    `);
  };

  // Toggle audio via WebView message
  const toggleAudio = () => {
    const newState = !isAudioEnabled;
    setIsAudioEnabled(newState);
    // Daily.co JS API - toggle microphone
    webViewRef.current?.injectJavaScript(`
      if (window.call && window.call.setLocalAudio) {
        window.call.setLocalAudio(${newState});
      }
      true;
    `);
  };

  // Toggle speaker
  const toggleSpeaker = () => {
    setIsSpeakerOn(!isSpeakerOn);
  };

  // Switch camera
  const switchCamera = () => {
    webViewRef.current?.injectJavaScript(`
      if (window.call && window.call.cycleCamera) {
        window.call.cycleCamera();
      }
      true;
    `);
  };

  // Request video upgrade (sesli → görüntülü)
  const requestVideoUpgrade = () => {
    Alert.alert(
      'Görüntülü Arama',
      'Görüntülü aramaya geçmek istiyor musunuz?',
      [
        { text: 'İptal', style: 'cancel' },
        { 
          text: 'Evet', 
          onPress: () => toggleVideo()
        },
      ]
    );
  };

  // Format duration as MM:SS
  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Show controls on tap
  const handleScreenTap = () => {
    if (!showControls) {
      setShowControls(true);
      fadeAnim.setValue(1);
    }
  };

  // Status text
  const getStatusText = () => {
    switch (status) {
      case 'connecting': return 'Bağlanıyor...';
      case 'connected': return 'Bağlandı';
      case 'reconnecting': return 'Yeniden bağlanıyor...';
      case 'ended': return 'Arama bitti';
      default: return '';
    }
  };

  // Remaining time warning
  const remainingTime = maxDuration - callDuration;
  const showWarning = remainingTime <= 60 && remainingTime > 0;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#1a1a1a" />
      
      {/* WebView - Daily.co (Hidden UI) */}
      <TouchableOpacity 
        style={styles.webViewContainer} 
        activeOpacity={1} 
        onPress={handleScreenTap}
      >
        <WebView
          ref={webViewRef}
          source={{ uri: roomUrl }}
          style={styles.webView}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          mediaPlaybackRequiresUserAction={false}
          allowsInlineMediaPlayback={true}
          onLoadStart={() => {
            setLoading(true);
            setStatus('connecting');
          }}
          onLoadEnd={() => {
            setLoading(false);
            setStatus('connected');
          }}
          onError={(syntheticEvent) => {
            const { nativeEvent } = syntheticEvent;
            console.error('WebView error:', nativeEvent);
            Alert.alert('Bağlantı Hatası', 'Arama bağlantısı kurulamadı', [
              { text: 'Tamam', onPress: () => onCallEnd(roomName) }
            ]);
          }}
          injectedJavaScript={INJECT_CSS_SCRIPT}
          allowsProtectedMedia={true}
          mediaCapturePermissionGrantType="grant"
          cacheEnabled={false}
          incognito={true}
        />
        
        {/* Loading Overlay */}
        {loading && (
          <View style={styles.loadingOverlay}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {otherUserName?.charAt(0)?.toUpperCase() || '?'}
              </Text>
            </View>
            <Text style={styles.loadingName}>{otherUserName}</Text>
            <ActivityIndicator size="large" color="#3FA9F5" style={{ marginTop: 20 }} />
            <Text style={styles.loadingText}>Bağlanıyor...</Text>
          </View>
        )}
      </TouchableOpacity>

      {/* Header - Always visible */}
      <Animated.View style={[styles.header, { opacity: showControls ? 1 : fadeAnim }]}>
        <View style={styles.headerContent}>
          <Text style={styles.callerName}>{otherUserName}</Text>
          <Text style={styles.statusText}>{getStatusText()}</Text>
          {status === 'connected' && (
            <View style={styles.durationContainer}>
              <Text style={[styles.duration, showWarning && styles.durationWarning]}>
                {formatDuration(callDuration)}
              </Text>
              {showWarning && (
                <Text style={styles.warningText}>Son 1 dakika!</Text>
              )}
            </View>
          )}
        </View>
      </Animated.View>

      {/* Controls - Bottom */}
      <Animated.View style={[styles.controlsContainer, { opacity: showControls ? 1 : fadeAnim }]}>
        {/* Video upgrade button (only in audio call) */}
        {!isVideoEnabled && status === 'connected' && (
          <TouchableOpacity 
            style={styles.upgradeButton}
            onPress={requestVideoUpgrade}
          >
            <Ionicons name="videocam" size={20} color="#FFF" />
            <Text style={styles.upgradeText}>Görüntülüye Geç</Text>
          </TouchableOpacity>
        )}

        <View style={styles.controlsRow}>
          {/* Camera Toggle */}
          <TouchableOpacity 
            style={[styles.controlButton, !isVideoEnabled && styles.controlButtonOff]}
            onPress={toggleVideo}
          >
            <Ionicons 
              name={isVideoEnabled ? 'videocam' : 'videocam-off'} 
              size={28} 
              color="#FFF" 
            />
            <Text style={styles.controlLabel}>
              {isVideoEnabled ? 'Kamera' : 'Kapalı'}
            </Text>
          </TouchableOpacity>

          {/* Microphone Toggle */}
          <TouchableOpacity 
            style={[styles.controlButton, !isAudioEnabled && styles.controlButtonOff]}
            onPress={toggleAudio}
          >
            <Ionicons 
              name={isAudioEnabled ? 'mic' : 'mic-off'} 
              size={28} 
              color="#FFF" 
            />
            <Text style={styles.controlLabel}>
              {isAudioEnabled ? 'Mikrofon' : 'Sessiz'}
            </Text>
          </TouchableOpacity>

          {/* Speaker Toggle */}
          <TouchableOpacity 
            style={[styles.controlButton, !isSpeakerOn && styles.controlButtonOff]}
            onPress={toggleSpeaker}
          >
            <Ionicons 
              name={isSpeakerOn ? 'volume-high' : 'volume-mute'} 
              size={28} 
              color="#FFF" 
            />
            <Text style={styles.controlLabel}>
              {isSpeakerOn ? 'Hoparlör' : 'Kulaklık'}
            </Text>
          </TouchableOpacity>

          {/* Switch Camera (only when video enabled) */}
          {isVideoEnabled && (
            <TouchableOpacity 
              style={styles.controlButton}
              onPress={switchCamera}
            >
              <Ionicons name="camera-reverse" size={28} color="#FFF" />
              <Text style={styles.controlLabel}>Çevir</Text>
            </TouchableOpacity>
          )}

          {/* End Call */}
          <TouchableOpacity 
            style={styles.endCallButton}
            onPress={() => handleEndCall(false)}
          >
            <Ionicons 
              name="call" 
              size={32} 
              color="#FFF" 
              style={{ transform: [{ rotate: '135deg' }] }}
            />
            <Text style={styles.endCallLabel}>Bitir</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a1a',
  },
  webViewContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  webView: {
    flex: 1,
    backgroundColor: '#000',
  },
  // Loading Overlay
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#1a1a1a',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  avatar: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: '#3FA9F5',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#3FA9F5',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 10,
  },
  avatarText: {
    fontSize: 60,
    fontWeight: 'bold',
    color: '#FFF',
  },
  loadingName: {
    fontSize: 26,
    fontWeight: '700',
    color: '#FFF',
    marginTop: 20,
  },
  loadingText: {
    fontSize: 16,
    color: '#888',
    marginTop: 10,
  },
  // Header
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingTop: Platform.OS === 'ios' ? 50 : 30,
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  headerContent: {
    alignItems: 'center',
  },
  callerName: {
    fontSize: 26,
    fontWeight: '700',
    color: '#FFF',
    textShadowColor: 'rgba(0,0,0,0.7)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  statusText: {
    fontSize: 16,
    color: '#4CAF50',
    marginTop: 6,
    textShadowColor: 'rgba(0,0,0,0.7)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  durationContainer: {
    alignItems: 'center',
    marginTop: 8,
  },
  duration: {
    fontSize: 20,
    fontWeight: '600',
    color: '#FFF',
    fontVariant: ['tabular-nums'],
    textShadowColor: 'rgba(0,0,0,0.7)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  durationWarning: {
    color: '#FF9500',
  },
  warningText: {
    fontSize: 12,
    color: '#FF9500',
    marginTop: 4,
  },
  // Controls
  controlsContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingBottom: Platform.OS === 'ios' ? 40 : 30,
    paddingHorizontal: 16,
  },
  upgradeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(63, 169, 245, 0.9)',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 25,
    marginBottom: 20,
    alignSelf: 'center',
  },
  upgradeText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  controlsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderRadius: 30,
    paddingVertical: 16,
    paddingHorizontal: 8,
  },
  controlButton: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  controlButtonOff: {
    backgroundColor: 'rgba(255,59,48,0.4)',
  },
  controlLabel: {
    color: '#FFF',
    fontSize: 10,
    marginTop: 4,
    textAlign: 'center',
  },
  endCallButton: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#FF3B30',
    shadowColor: '#FF3B30',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
  },
  endCallLabel: {
    color: '#FFF',
    fontSize: 11,
    marginTop: 4,
    fontWeight: '600',
  },
});
