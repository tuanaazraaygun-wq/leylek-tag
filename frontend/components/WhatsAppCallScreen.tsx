/**
 * WhatsApp Benzeri Custom Arama Ekranı v2
 * Daily.co SADECE audio/video stream sağlayıcı
 * SIFIR Daily UI - Tamamen Custom Native UI
 * 
 * Özellikler:
 * - Daily default UI %100 gizli (Leave, Guest, Home page YOK)
 * - Daily popup/warning YOK
 * - Self-view (küçük kamera önizlemesi)
 * - Sesli ↔ Görüntülü geçiş
 * - Türkçe arayüz
 * - Store uyumlu (branding yok)
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  Dimensions,
  BackHandler,
  Animated,
  Platform,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { WebView } from 'react-native-webview';
import { LinearGradient } from 'expo-linear-gradient';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface WhatsAppCallScreenProps {
  roomUrl: string;
  roomName: string;
  callType: 'video' | 'audio';
  otherUserName: string;
  onCallEnd: (roomName: string) => void;
  currentUserId?: string;
}

type CallStatus = 'connecting' | 'ringing' | 'connected' | 'reconnecting' | 'ended';

// Daily UI'ı TAMAMEN gizleyen ve sadece video stream gösteren HTML
const createCallHTML = (roomUrl: string, startWithVideo: boolean) => `
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { 
      width: 100%; 
      height: 100%; 
      overflow: hidden; 
      background: #000;
      -webkit-user-select: none;
      user-select: none;
    }
    
    /* Video containers */
    #remote-video {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      object-fit: cover;
      background: #1a1a1a;
    }
    
    #local-video {
      position: fixed;
      top: 100px;
      right: 16px;
      width: 110px;
      height: 160px;
      object-fit: cover;
      border-radius: 12px;
      border: 2px solid rgba(255,255,255,0.3);
      background: #333;
      z-index: 100;
    }
    
    /* Audio-only avatar */
    #audio-avatar {
      display: none;
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 140px;
      height: 140px;
      border-radius: 70px;
      background: linear-gradient(135deg, #3FA9F5, #1E88E5);
      justify-content: center;
      align-items: center;
      box-shadow: 0 0 40px rgba(63, 169, 245, 0.4);
    }
    
    #audio-avatar.show {
      display: flex;
    }
    
    #avatar-letter {
      font-size: 60px;
      font-weight: bold;
      color: white;
      font-family: -apple-system, BlinkMacSystemFont, sans-serif;
    }
    
    /* Hide everything from Daily */
    iframe, .daily-video-modal, [class*="Daily"], [class*="daily"],
    [class*="prejoin"], [class*="leave"], [class*="modal"],
    [class*="popup"], [class*="warning"], [class*="error"],
    [class*="toast"], [class*="notification"], [class*="banner"],
    [class*="toolbar"], [class*="control"], [class*="button"],
    [class*="menu"], [class*="panel"], [class*="overlay"],
    dialog, aside, nav, header, footer {
      display: none !important;
      visibility: hidden !important;
      opacity: 0 !important;
      pointer-events: none !important;
      width: 0 !important;
      height: 0 !important;
    }
  </style>
  <script src="https://unpkg.com/@daily-co/daily-js"></script>
</head>
<body>
  <div id="audio-avatar">
    <span id="avatar-letter">?</span>
  </div>
  <video id="remote-video" autoplay playsinline></video>
  <video id="local-video" autoplay playsinline muted></video>
  
  <script>
    // Global state
    let callObject = null;
    let localVideoTrack = null;
    let remoteVideoTrack = null;
    let isVideoEnabled = ${startWithVideo};
    let isAudioEnabled = true;
    let hasRemoteVideo = false;
    
    const remoteVideo = document.getElementById('remote-video');
    const localVideo = document.getElementById('local-video');
    const audioAvatar = document.getElementById('audio-avatar');
    const avatarLetter = document.getElementById('avatar-letter');
    
    // Send message to React Native
    function sendToRN(type, data = {}) {
      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(JSON.stringify({ type, ...data }));
      }
    }
    
    // Update UI based on video state
    function updateVideoUI() {
      if (hasRemoteVideo) {
        remoteVideo.style.display = 'block';
        audioAvatar.classList.remove('show');
      } else {
        remoteVideo.style.display = 'none';
        audioAvatar.classList.add('show');
      }
      
      localVideo.style.display = isVideoEnabled ? 'block' : 'none';
    }
    
    // Initialize Daily call
    async function initCall() {
      try {
        sendToRN('status', { status: 'connecting' });
        
        // Create call object - NO UI
        callObject = DailyIframe.createCallObject({
          showLeaveButton: false,
          showFullscreenButton: false,
          showLocalVideo: false,
          showParticipantsBar: false,
          iframeStyle: { display: 'none' }
        });
        
        // Event handlers
        callObject.on('joining-meeting', () => {
          sendToRN('status', { status: 'connecting' });
        });
        
        callObject.on('joined-meeting', async (event) => {
          sendToRN('status', { status: 'connected' });
          sendToRN('joined', { participants: Object.keys(event.participants).length });
          
          // Get local tracks
          const localParticipant = callObject.participants().local;
          if (localParticipant.tracks.video.persistentTrack) {
            const stream = new MediaStream([localParticipant.tracks.video.persistentTrack]);
            localVideo.srcObject = stream;
            localVideoTrack = localParticipant.tracks.video.persistentTrack;
          }
          
          updateVideoUI();
        });
        
        callObject.on('participant-joined', (event) => {
          if (!event.participant.local) {
            sendToRN('participant-joined', { id: event.participant.user_id });
            updateRemoteVideo(event.participant);
          }
        });
        
        callObject.on('participant-updated', (event) => {
          if (event.participant.local) {
            // Local participant updated
            if (event.participant.tracks.video.persistentTrack) {
              const stream = new MediaStream([event.participant.tracks.video.persistentTrack]);
              localVideo.srcObject = stream;
            }
            isVideoEnabled = event.participant.video;
            isAudioEnabled = event.participant.audio;
            sendToRN('local-updated', { video: isVideoEnabled, audio: isAudioEnabled });
          } else {
            // Remote participant updated
            updateRemoteVideo(event.participant);
          }
          updateVideoUI();
        });
        
        callObject.on('participant-left', (event) => {
          if (!event.participant.local) {
            sendToRN('participant-left', { id: event.participant.user_id });
            hasRemoteVideo = false;
            remoteVideo.srcObject = null;
            updateVideoUI();
            // Other participant left - notify RN
            sendToRN('call-ended', { reason: 'participant-left' });
          }
        });
        
        callObject.on('error', (event) => {
          console.error('Daily error:', event);
          sendToRN('error', { message: event.errorMsg || 'Bağlantı hatası' });
        });
        
        callObject.on('left-meeting', () => {
          sendToRN('left', {});
        });
        
        // Join the room
        await callObject.join({ 
          url: '${roomUrl}',
          videoSource: ${startWithVideo},
          audioSource: true
        });
        
      } catch (error) {
        console.error('Init error:', error);
        sendToRN('error', { message: error.message || 'Bağlantı kurulamadı' });
      }
    }
    
    // Update remote video
    function updateRemoteVideo(participant) {
      if (participant.tracks.video.persistentTrack && participant.tracks.video.state === 'playable') {
        const stream = new MediaStream([participant.tracks.video.persistentTrack]);
        remoteVideo.srcObject = stream;
        remoteVideoTrack = participant.tracks.video.persistentTrack;
        hasRemoteVideo = true;
      } else {
        hasRemoteVideo = false;
      }
      updateVideoUI();
    }
    
    // Control functions (called from RN)
    window.toggleVideo = async function(enable) {
      if (callObject) {
        await callObject.setLocalVideo(enable);
        isVideoEnabled = enable;
        updateVideoUI();
        sendToRN('video-toggled', { enabled: enable });
      }
    };
    
    window.toggleAudio = async function(enable) {
      if (callObject) {
        await callObject.setLocalAudio(enable);
        isAudioEnabled = enable;
        sendToRN('audio-toggled', { enabled: enable });
      }
    };
    
    window.cycleCamera = async function() {
      if (callObject) {
        await callObject.cycleCamera();
        sendToRN('camera-cycled', {});
      }
    };
    
    window.endCall = async function() {
      if (callObject) {
        try {
          await callObject.leave();
          await callObject.destroy();
          callObject = null;
        } catch (e) {
          console.error('End call error:', e);
        }
        sendToRN('call-ended', { reason: 'user-ended' });
      }
    };
    
    window.setAvatarLetter = function(letter) {
      avatarLetter.textContent = letter || '?';
    };
    
    // Prevent any popup/alert
    window.alert = function() {};
    window.confirm = function() { return false; };
    window.prompt = function() { return null; };
    
    // Block all Daily modals/popups via MutationObserver
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === 1) {
            const className = node.className || '';
            const id = node.id || '';
            if (className.includes('daily') || className.includes('modal') || 
                className.includes('popup') || className.includes('dialog') ||
                className.includes('overlay') || className.includes('toast') ||
                id.includes('daily') || node.tagName === 'DIALOG' ||
                node.tagName === 'ASIDE') {
              node.remove();
            }
          }
        });
      });
    });
    
    observer.observe(document.body, { childList: true, subtree: true });
    
    // Start
    initCall();
  </script>
</body>
</html>
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
  const [hasRemoteParticipant, setHasRemoteParticipant] = useState(false);
  const [isFrontCamera, setIsFrontCamera] = useState(true);
  
  // UI state
  const [showControls, setShowControls] = useState(true);
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  
  // Max call duration (10 minutes)
  const maxDuration = 600;

  // Set avatar letter on mount
  useEffect(() => {
    const letter = otherUserName?.charAt(0)?.toUpperCase() || '?';
    setTimeout(() => {
      webViewRef.current?.injectJavaScript(`window.setAvatarLetter('${letter}'); true;`);
    }, 500);
  }, [otherUserName]);

  // Pulse animation for connecting state
  useEffect(() => {
    if (status === 'connecting') {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.1, duration: 800, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
        ])
      ).start();
    } else {
      pulseAnim.setValue(1);
    }
  }, [status]);

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

  // Auto-hide controls after 5 seconds
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

  // Handle messages from WebView
  const handleWebViewMessage = (event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      console.log('📞 WebView Message:', data.type, data);
      
      switch (data.type) {
        case 'status':
          setStatus(data.status);
          break;
        case 'joined':
          setStatus('connected');
          break;
        case 'participant-joined':
          setHasRemoteParticipant(true);
          break;
        case 'participant-left':
        case 'call-ended':
          handleEndCall(true);
          break;
        case 'local-updated':
          setIsVideoEnabled(data.video);
          setIsAudioEnabled(data.audio);
          break;
        case 'video-toggled':
          setIsVideoEnabled(data.enabled);
          break;
        case 'audio-toggled':
          setIsAudioEnabled(data.enabled);
          break;
        case 'camera-cycled':
          setIsFrontCamera(prev => !prev);
          break;
        case 'error':
          console.error('Call error:', data.message);
          handleEndCall(true);
          break;
      }
    } catch (e) {
      console.error('Parse error:', e);
    }
  };

  const handleEndCall = useCallback((immediate: boolean = false) => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    
    // Call leave() and destroy() in WebView
    webViewRef.current?.injectJavaScript('window.endCall(); true;');
    
    // Immediately close - no delay, no popup
    onCallEnd(roomName);
  }, [roomName, onCallEnd]);

  // Toggle video
  const toggleVideo = () => {
    const newState = !isVideoEnabled;
    webViewRef.current?.injectJavaScript(`window.toggleVideo(${newState}); true;`);
    setIsVideoEnabled(newState);
  };

  // Toggle audio
  const toggleAudio = () => {
    const newState = !isAudioEnabled;
    webViewRef.current?.injectJavaScript(`window.toggleAudio(${newState}); true;`);
    setIsAudioEnabled(newState);
  };

  // Toggle speaker
  const toggleSpeaker = () => {
    setIsSpeakerOn(!isSpeakerOn);
  };

  // Switch camera
  const switchCamera = () => {
    webViewRef.current?.injectJavaScript('window.cycleCamera(); true;');
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
      case 'ringing': return 'Çalıyor...';
      case 'connected': return hasRemoteParticipant ? 'Bağlandı' : 'Bekleniyor...';
      case 'reconnecting': return 'Yeniden bağlanıyor...';
      case 'ended': return 'Arama bitti';
      default: return '';
    }
  };

  // Remaining time warning
  const remainingTime = maxDuration - callDuration;
  const showWarning = remainingTime <= 60 && remainingTime > 0;

  // HTML content
  const htmlContent = createCallHTML(roomUrl, callType === 'video');

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#000" translucent />
      
      {/* WebView - Daily Video Stream (HIDDEN UI) */}
      <TouchableOpacity 
        style={styles.webViewContainer} 
        activeOpacity={1} 
        onPress={handleScreenTap}
      >
        <WebView
          ref={webViewRef}
          source={{ html: htmlContent }}
          style={styles.webView}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          mediaPlaybackRequiresUserAction={false}
          allowsInlineMediaPlayback={true}
          onMessage={handleWebViewMessage}
          allowsProtectedMedia={true}
          mediaCapturePermissionGrantType="grant"
          cacheEnabled={false}
          scrollEnabled={false}
          bounces={false}
          showsHorizontalScrollIndicator={false}
          showsVerticalScrollIndicator={false}
        />
      </TouchableOpacity>

      {/* Gradient Overlays for better visibility */}
      <LinearGradient
        colors={['rgba(0,0,0,0.7)', 'transparent']}
        style={styles.topGradient}
        pointerEvents="none"
      />
      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.8)']}
        style={styles.bottomGradient}
        pointerEvents="none"
      />

      {/* Header */}
      <Animated.View style={[styles.header, { opacity: showControls ? 1 : fadeAnim }]}>
        <View style={styles.headerContent}>
          <Text style={styles.callerName}>{otherUserName}</Text>
          <View style={styles.statusContainer}>
            {status === 'connecting' && (
              <Animated.View style={[styles.statusDot, { transform: [{ scale: pulseAnim }] }]} />
            )}
            {status === 'connected' && <View style={[styles.statusDot, styles.statusDotConnected]} />}
            <Text style={[styles.statusText, status === 'connected' && styles.statusTextConnected]}>
              {getStatusText()}
            </Text>
          </View>
          {status === 'connected' && (
            <View style={styles.durationContainer}>
              <Ionicons name="time-outline" size={16} color="#FFF" style={{ marginRight: 6 }} />
              <Text style={[styles.duration, showWarning && styles.durationWarning]}>
                {formatDuration(callDuration)}
              </Text>
            </View>
          )}
          {showWarning && (
            <View style={styles.warningBadge}>
              <Text style={styles.warningText}>Son 1 dakika!</Text>
            </View>
          )}
        </View>
      </Animated.View>

      {/* Controls */}
      <Animated.View style={[styles.controlsContainer, { opacity: showControls ? 1 : fadeAnim }]}>
        {/* Video upgrade button (only in audio call when connected) */}
        {!isVideoEnabled && status === 'connected' && (
          <TouchableOpacity 
            style={styles.upgradeButton}
            onPress={toggleVideo}
            activeOpacity={0.8}
          >
            <Ionicons name="videocam" size={22} color="#FFF" />
            <Text style={styles.upgradeText}>Görüntülüye Geç</Text>
          </TouchableOpacity>
        )}

        <View style={styles.controlsRow}>
          {/* Camera Toggle */}
          <TouchableOpacity 
            style={[styles.controlButton, !isVideoEnabled && styles.controlButtonOff]}
            onPress={toggleVideo}
            activeOpacity={0.7}
          >
            <View style={styles.controlIconWrapper}>
              <Ionicons 
                name={isVideoEnabled ? 'videocam' : 'videocam-off'} 
                size={26} 
                color="#FFF" 
              />
            </View>
            <Text style={styles.controlLabel}>
              {isVideoEnabled ? 'Kamera' : 'Kapalı'}
            </Text>
          </TouchableOpacity>

          {/* Microphone Toggle */}
          <TouchableOpacity 
            style={[styles.controlButton, !isAudioEnabled && styles.controlButtonOff]}
            onPress={toggleAudio}
            activeOpacity={0.7}
          >
            <View style={styles.controlIconWrapper}>
              <Ionicons 
                name={isAudioEnabled ? 'mic' : 'mic-off'} 
                size={26} 
                color="#FFF" 
              />
            </View>
            <Text style={styles.controlLabel}>
              {isAudioEnabled ? 'Mikrofon' : 'Sessiz'}
            </Text>
          </TouchableOpacity>

          {/* Speaker Toggle */}
          <TouchableOpacity 
            style={[styles.controlButton, !isSpeakerOn && styles.controlButtonOff]}
            onPress={toggleSpeaker}
            activeOpacity={0.7}
          >
            <View style={styles.controlIconWrapper}>
              <Ionicons 
                name={isSpeakerOn ? 'volume-high' : 'ear-outline'} 
                size={26} 
                color="#FFF" 
              />
            </View>
            <Text style={styles.controlLabel}>
              {isSpeakerOn ? 'Hoparlör' : 'Kulaklık'}
            </Text>
          </TouchableOpacity>

          {/* Switch Camera (only when video enabled) */}
          {isVideoEnabled && (
            <TouchableOpacity 
              style={styles.controlButton}
              onPress={switchCamera}
              activeOpacity={0.7}
            >
              <View style={styles.controlIconWrapper}>
                <Ionicons name="camera-reverse-outline" size={26} color="#FFF" />
              </View>
              <Text style={styles.controlLabel}>Çevir</Text>
            </TouchableOpacity>
          )}

          {/* End Call - Always visible, bigger */}
          <TouchableOpacity 
            style={styles.endCallButton}
            onPress={() => handleEndCall(false)}
            activeOpacity={0.8}
          >
            <Ionicons 
              name="call" 
              size={30} 
              color="#FFF" 
              style={{ transform: [{ rotate: '135deg' }] }}
            />
          </TouchableOpacity>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  webViewContainer: {
    ...StyleSheet.absoluteFillObject,
  },
  webView: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  // Gradients
  topGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 180,
  },
  bottomGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 220,
  },
  // Header
  header: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 60 : 40,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  headerContent: {
    alignItems: 'center',
  },
  callerName: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFF',
    letterSpacing: 0.5,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FFA500',
    marginRight: 8,
  },
  statusDotConnected: {
    backgroundColor: '#4CAF50',
  },
  statusText: {
    fontSize: 16,
    color: '#FFA500',
    fontWeight: '500',
  },
  statusTextConnected: {
    color: '#4CAF50',
  },
  durationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
  },
  duration: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFF',
    fontVariant: ['tabular-nums'],
  },
  durationWarning: {
    color: '#FF9500',
  },
  warningBadge: {
    marginTop: 10,
    backgroundColor: 'rgba(255, 149, 0, 0.9)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  warningText: {
    fontSize: 13,
    color: '#FFF',
    fontWeight: '600',
  },
  // Controls
  controlsContainer: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 50 : 30,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  upgradeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(63, 169, 245, 0.95)',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 28,
    marginBottom: 24,
    shadowColor: '#3FA9F5',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  upgradeText: {
    color: '#FFF',
    fontSize: 17,
    fontWeight: '600',
    marginLeft: 10,
  },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(30, 30, 30, 0.85)',
    borderRadius: 36,
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 8,
  },
  controlButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  controlButtonOff: {
    opacity: 0.7,
  },
  controlIconWrapper: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  controlLabel: {
    color: '#FFF',
    fontSize: 11,
    marginTop: 6,
    textAlign: 'center',
    fontWeight: '500',
  },
  endCallButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#FF3B30',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
    shadowColor: '#FF3B30',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
  },
});
