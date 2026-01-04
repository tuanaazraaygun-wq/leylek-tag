/**
 * WhatsApp Benzeri Custom Arama Ekranı v3
 * CRITICAL: Proper Call Termination
 * 
 * Termination Flow:
 * 1. User presses "Bitir" → Call backend /api/calls/end
 * 2. Backend broadcasts call_ended to BOTH participants
 * 3. After backend confirms → Daily leave() + destroy()
 * 4. After Daily destroyed → Unmount UI
 * 
 * UI lifecycle is controlled by BACKEND, not Daily events
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  Dimensions,
  BackHandler,
  Animated,
  Platform,
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
  callerId: string;
  receiverId: string;
  currentUserId: string;
  onCallEnd: (roomName: string) => void;
}

type CallStatus = 'connecting' | 'connected' | 'ending' | 'ended';

// Daily UI'ı TAMAMEN gizleyen HTML - sadece video stream
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
    #remote-video {
      position: fixed;
      top: 0; left: 0;
      width: 100%; height: 100%;
      object-fit: cover;
      background: #1a1a1a;
    }
    #local-video {
      position: fixed;
      top: 100px; right: 16px;
      width: 110px; height: 160px;
      object-fit: cover;
      border-radius: 12px;
      border: 2px solid rgba(255,255,255,0.3);
      background: #333;
      z-index: 100;
    }
    #audio-avatar {
      display: none;
      position: fixed;
      top: 50%; left: 50%;
      transform: translate(-50%, -50%);
      width: 140px; height: 140px;
      border-radius: 70px;
      background: linear-gradient(135deg, #3FA9F5, #1E88E5);
      justify-content: center;
      align-items: center;
      box-shadow: 0 0 40px rgba(63, 169, 245, 0.4);
    }
    #audio-avatar.show { display: flex; }
    #avatar-letter {
      font-size: 60px;
      font-weight: bold;
      color: white;
      font-family: -apple-system, BlinkMacSystemFont, sans-serif;
    }
  </style>
  <script src="https://unpkg.com/@daily-co/daily-js"></script>
</head>
<body>
  <div id="audio-avatar"><span id="avatar-letter">?</span></div>
  <video id="remote-video" autoplay playsinline></video>
  <video id="local-video" autoplay playsinline muted></video>
  
  <script>
    let callObject = null;
    let isVideoEnabled = ${startWithVideo};
    let hasRemoteVideo = false;
    let isDestroyed = false;
    
    const remoteVideo = document.getElementById('remote-video');
    const localVideo = document.getElementById('local-video');
    const audioAvatar = document.getElementById('audio-avatar');
    const avatarLetter = document.getElementById('avatar-letter');
    
    function sendToRN(type, data = {}) {
      if (window.ReactNativeWebView && !isDestroyed) {
        window.ReactNativeWebView.postMessage(JSON.stringify({ type, ...data }));
      }
    }
    
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
    
    async function initCall() {
      if (isDestroyed) return;
      try {
        sendToRN('status', { status: 'connecting' });
        
        callObject = DailyIframe.createCallObject({
          showLeaveButton: false,
          showFullscreenButton: false,
          showLocalVideo: false,
          showParticipantsBar: false,
          iframeStyle: { display: 'none' }
        });
        
        callObject.on('joined-meeting', async () => {
          if (isDestroyed) return;
          sendToRN('status', { status: 'connected' });
          
          const localParticipant = callObject.participants().local;
          if (localParticipant?.tracks?.video?.persistentTrack) {
            const stream = new MediaStream([localParticipant.tracks.video.persistentTrack]);
            localVideo.srcObject = stream;
          }
          updateVideoUI();
        });
        
        callObject.on('participant-updated', (event) => {
          if (isDestroyed) return;
          if (event.participant.local) {
            if (event.participant.tracks?.video?.persistentTrack) {
              const stream = new MediaStream([event.participant.tracks.video.persistentTrack]);
              localVideo.srcObject = stream;
            }
            isVideoEnabled = event.participant.video;
          } else {
            if (event.participant.tracks?.video?.persistentTrack && 
                event.participant.tracks.video.state === 'playable') {
              const stream = new MediaStream([event.participant.tracks.video.persistentTrack]);
              remoteVideo.srcObject = stream;
              hasRemoteVideo = true;
            } else {
              hasRemoteVideo = false;
            }
          }
          updateVideoUI();
        });
        
        callObject.on('participant-left', () => {
          if (isDestroyed) return;
          hasRemoteVideo = false;
          remoteVideo.srcObject = null;
          updateVideoUI();
          // NOTE: Do NOT end call here - wait for backend signal
          sendToRN('participant-left', {});
        });
        
        callObject.on('error', (event) => {
          if (isDestroyed) return;
          sendToRN('error', { message: event.errorMsg || 'Bağlantı hatası' });
        });
        
        await callObject.join({ 
          url: '${roomUrl}',
          videoSource: ${startWithVideo},
          audioSource: true
        });
        
      } catch (error) {
        if (isDestroyed) return;
        sendToRN('error', { message: error.message || 'Bağlantı kurulamadı' });
      }
    }
    
    // CRITICAL: Properly destroy Daily call
    window.destroyCall = async function() {
      isDestroyed = true;
      if (callObject) {
        try {
          await callObject.leave();
          await callObject.destroy();
          callObject = null;
          sendToRN('destroyed', {});
        } catch (e) {
          sendToRN('destroyed', { error: e.message });
        }
      } else {
        sendToRN('destroyed', {});
      }
    };
    
    window.toggleVideo = async function(enable) {
      if (callObject && !isDestroyed) {
        await callObject.setLocalVideo(enable);
        isVideoEnabled = enable;
        updateVideoUI();
      }
    };
    
    window.toggleAudio = async function(enable) {
      if (callObject && !isDestroyed) {
        await callObject.setLocalAudio(enable);
      }
    };
    
    window.cycleCamera = async function() {
      if (callObject && !isDestroyed) {
        await callObject.cycleCamera();
      }
    };
    
    window.setAvatarLetter = function(letter) {
      avatarLetter.textContent = letter || '?';
    };
    
    // Prevent popups
    window.alert = function() {};
    window.confirm = function() { return false; };
    window.prompt = function() { return null; };
    
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
  callerId,
  receiverId,
  currentUserId,
  onCallEnd,
}: WhatsAppCallScreenProps) {
  const webViewRef = useRef<WebView>(null);
  
  // Call state
  const [status, setStatus] = useState<CallStatus>('connecting');
  const [callDuration, setCallDuration] = useState(0);
  const [isVideoEnabled, setIsVideoEnabled] = useState(callType === 'video');
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isSpeakerOn, setIsSpeakerOn] = useState(true);
  const [isFrontCamera, setIsFrontCamera] = useState(true);
  const [isEnding, setIsEnding] = useState(false);
  
  // UI state
  const [showControls, setShowControls] = useState(true);
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  
  // API URL
  const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL 
    ? `${process.env.EXPO_PUBLIC_BACKEND_URL}/api`
    : 'https://tagride.preview.emergentagent.com/api';
  
  const maxDuration = 600;

  // Set avatar letter
  useEffect(() => {
    const letter = otherUserName?.charAt(0)?.toUpperCase() || '?';
    setTimeout(() => {
      webViewRef.current?.injectJavaScript(`window.setAvatarLetter('${letter}'); true;`);
    }, 500);
  }, [otherUserName]);

  // Timer
  useEffect(() => {
    if (status === 'connected') {
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
  }, [status]);

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

  // Auto-hide controls
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

  // Handle WebView messages
  const handleWebViewMessage = (event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      console.log('📞 WebView:', data.type);
      
      switch (data.type) {
        case 'status':
          setStatus(data.status);
          break;
        case 'destroyed':
          // Daily destroyed - NOW we can unmount
          console.log('✅ Daily destroyed, unmounting UI');
          onCallEnd(roomName);
          break;
        case 'error':
          console.error('Call error:', data.message);
          onCallEnd(roomName);
          break;
        case 'participant-left':
          // Don't auto-end, wait for backend
          console.log('⚠️ Participant left, waiting for backend signal');
          break;
      }
    } catch (e) {
      console.error('Parse error:', e);
    }
  };

  /**
   * CRITICAL: Proper call termination flow
   * 1. Call backend API
   * 2. Backend broadcasts to other participant
   * 3. Destroy Daily
   * 4. Unmount UI
   */
  const endCallProperly = useCallback(async () => {
    if (isEnding) return;
    setIsEnding(true);
    setStatus('ending');
    
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    
    console.log('📴 Ending call properly...');
    
    try {
      // Step 1: Call backend to notify other participant
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
      console.log('✅ Backend notified:', result);
      
    } catch (error) {
      console.error('Backend call error:', error);
    }
    
    // Step 2: Destroy Daily call
    console.log('🔄 Destroying Daily...');
    webViewRef.current?.injectJavaScript('window.destroyCall(); true;');
    
    // Step 3: Fallback - if destroy doesn't respond in 2s, force unmount
    setTimeout(() => {
      console.log('⏰ Fallback unmount');
      onCallEnd(roomName);
    }, 2000);
    
  }, [isEnding, roomName, callerId, receiverId, currentUserId, API_URL, onCallEnd]);

  // Toggle functions
  const toggleVideo = () => {
    const newState = !isVideoEnabled;
    webViewRef.current?.injectJavaScript(`window.toggleVideo(${newState}); true;`);
    setIsVideoEnabled(newState);
  };

  const toggleAudio = () => {
    const newState = !isAudioEnabled;
    webViewRef.current?.injectJavaScript(`window.toggleAudio(${newState}); true;`);
    setIsAudioEnabled(newState);
  };

  const toggleSpeaker = () => {
    setIsSpeakerOn(!isSpeakerOn);
  };

  const switchCamera = () => {
    webViewRef.current?.injectJavaScript('window.cycleCamera(); true;');
    setIsFrontCamera(!isFrontCamera);
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleScreenTap = () => {
    if (!showControls) {
      setShowControls(true);
      fadeAnim.setValue(1);
    }
  };

  const getStatusText = () => {
    switch (status) {
      case 'connecting': return 'Bağlanıyor...';
      case 'connected': return 'Bağlandı';
      case 'ending': return 'Sonlandırılıyor...';
      case 'ended': return 'Arama bitti';
      default: return '';
    }
  };

  const remainingTime = maxDuration - callDuration;
  const showWarning = remainingTime <= 60 && remainingTime > 0;
  const htmlContent = createCallHTML(roomUrl, callType === 'video');

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#000" translucent />
      
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
        />
      </TouchableOpacity>

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
            <View style={[styles.statusDot, status === 'connected' && styles.statusDotConnected]} />
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
          <TouchableOpacity 
            style={[styles.controlButton, !isVideoEnabled && styles.controlButtonOff]}
            onPress={toggleVideo}
            activeOpacity={0.7}
            disabled={isEnding}
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

          <TouchableOpacity 
            style={[styles.controlButton, !isAudioEnabled && styles.controlButtonOff]}
            onPress={toggleAudio}
            activeOpacity={0.7}
            disabled={isEnding}
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

          <TouchableOpacity 
            style={[styles.controlButton, !isSpeakerOn && styles.controlButtonOff]}
            onPress={toggleSpeaker}
            activeOpacity={0.7}
            disabled={isEnding}
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

          {isVideoEnabled && (
            <TouchableOpacity 
              style={styles.controlButton}
              onPress={switchCamera}
              activeOpacity={0.7}
              disabled={isEnding}
            >
              <View style={styles.controlIconWrapper}>
                <Ionicons name="camera-reverse-outline" size={26} color="#FFF" />
              </View>
              <Text style={styles.controlLabel}>Çevir</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity 
            style={[styles.endCallButton, isEnding && styles.endCallButtonDisabled]}
            onPress={endCallProperly}
            activeOpacity={0.8}
            disabled={isEnding}
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
  topGradient: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    height: 180,
  },
  bottomGradient: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    height: 220,
  },
  header: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 60 : 40,
    left: 0, right: 0,
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
    width: 8, height: 8,
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
  controlsContainer: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 50 : 30,
    left: 0, right: 0,
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
    width: 52, height: 52,
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
    width: 64, height: 64,
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
  endCallButtonDisabled: {
    backgroundColor: '#888',
    shadowOpacity: 0,
  },
});
