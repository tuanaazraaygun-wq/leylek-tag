/**
 * Daily.co Call Screen - Native SDK
 * Uses @daily-co/react-native-daily-js for native WebRTC
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
  Platform,
} from 'react-native';
import Daily, {
  DailyCall,
  DailyEvent,
  DailyEventObjectParticipant,
  DailyParticipant,
} from '@daily-co/react-native-daily-js';
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
  const [errorMessage, setErrorMessage] = useState('');
  
  const callObjectRef = useRef<DailyCall | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const hasJoinedRef = useRef(false);
  const isDestroyedRef = useRef(false);
  
  const maxDuration = 600;
  const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL 
    ? `${process.env.EXPO_PUBLIC_BACKEND_URL}/api`
    : 'https://dailyco-fix.preview.emergentagent.com/api';

  // Initialize Daily call object and join
  useEffect(() => {
    if (hasJoinedRef.current) return;
    hasJoinedRef.current = true;
    
    console.log('📞 [DailyNative] Initializing call...', { roomUrl, callType });
    
    const initCall = async () => {
      try {
        // Create call object
        const callObject = Daily.createCallObject({
          videoSource: callType === 'video',
          audioSource: true,
        });
        
        callObjectRef.current = callObject;
        
        // Set up event listeners
        callObject.on('joining-meeting', () => {
          console.log('📞 [DailyNative] joining-meeting');
          setStatus('joining');
        });
        
        callObject.on('joined-meeting', (event) => {
          console.log('✅ [DailyNative] joined-meeting', event);
          setStatus('connected');
        });
        
        callObject.on('participant-joined', (event: DailyEventObjectParticipant | undefined) => {
          if (event?.participant && !event.participant.local) {
            console.log('👤 [DailyNative] Remote participant joined');
          }
        });
        
        callObject.on('participant-left', (event: DailyEventObjectParticipant | undefined) => {
          if (event?.participant && !event.participant.local) {
            console.log('👤 [DailyNative] Remote participant left');
            // End call when other participant leaves
            if (!isDestroyedRef.current) {
              endCallProperly();
            }
          }
        });
        
        callObject.on('error', (event) => {
          console.error('❌ [DailyNative] Error:', event);
          setErrorMessage(event?.errorMsg || 'Bağlantı hatası');
          setStatus('error');
        });
        
        callObject.on('left-meeting', () => {
          console.log('📞 [DailyNative] left-meeting');
        });
        
        // Join the room
        console.log('📞 [DailyNative] Joining room:', roomUrl);
        await callObject.join({
          url: roomUrl,
          userName: otherUserName || 'Kullanıcı',
        });
        
        // Enable audio/video after join
        await callObject.setLocalAudio(true);
        if (callType === 'video') {
          await callObject.setLocalVideo(true);
        }
        
        console.log('✅ [DailyNative] Join successful');
        
      } catch (error: any) {
        console.error('❌ [DailyNative] Init error:', error);
        setErrorMessage(error?.message || 'Bağlantı kurulamadı');
        setStatus('error');
      }
    };
    
    initCall();
    
    // Cleanup on unmount
    return () => {
      console.log('🧹 [DailyNative] Cleanup on unmount');
      if (timerRef.current) clearInterval(timerRef.current);
      if (callObjectRef.current && !isDestroyedRef.current) {
        isDestroyedRef.current = true;
        callObjectRef.current.leave().catch(() => {});
        callObjectRef.current.destroy().catch(() => {});
      }
    };
  }, []);

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

  const endCallProperly = useCallback(async () => {
    if (isEnding || isDestroyedRef.current) return;
    
    console.log('🔴 [DailyNative] Ending call...');
    setIsEnding(true);
    isDestroyedRef.current = true;
    
    if (timerRef.current) clearInterval(timerRef.current);

    // 1. Leave and destroy Daily call
    if (callObjectRef.current) {
      try {
        await callObjectRef.current.leave();
        await callObjectRef.current.destroy();
        console.log('✅ [DailyNative] Call destroyed');
      } catch (e) {
        console.log('⚠️ [DailyNative] Destroy error:', e);
      }
    }

    // 2. Notify backend
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
      console.log('✅ [DailyNative] Backend notified');
    } catch (e) {
      console.log('⚠️ [DailyNative] Backend notify error:', e);
    }
    
    // 3. Close UI
    setTimeout(() => onCallEnd(roomName), 300);
  }, [isEnding, roomName, callerId, receiverId, currentUserId, API_URL, onCallEnd]);

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
        {status === 'error' && (
          <Text style={[styles.status, styles.error]}>
            {errorMessage || 'Bağlantı Hatası'}
          </Text>
        )}
      </View>

      {/* Call View Area */}
      <View style={styles.callArea}>
        {status === 'connected' ? (
          <View style={styles.connectedView}>
            <Ionicons 
              name={callType === 'video' ? 'videocam' : 'call'} 
              size={80} 
              color="#3FA9F5" 
            />
            <Text style={styles.connectedText}>Bağlantı kuruldu</Text>
            <Text style={styles.connectedSubtext}>
              {callType === 'video' ? 'Görüntülü görüşme aktif' : 'Sesli görüşme aktif'}
            </Text>
          </View>
        ) : (
          <View style={styles.loadingView}>
            <ActivityIndicator size="large" color="#3FA9F5" />
            <Text style={styles.loadingText}>
              {status === 'loading' ? 'Yükleniyor...' : 
               status === 'joining' ? 'Bağlanıyor...' : 
               'Bağlantı hatası'}
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
  callArea: { 
    flex: 1, 
    backgroundColor: '#000', 
    justifyContent: 'center', 
    alignItems: 'center' 
  },
  connectedView: {
    alignItems: 'center',
  },
  connectedText: {
    color: '#FFF',
    fontSize: 20,
    fontWeight: '600',
    marginTop: 16,
  },
  connectedSubtext: {
    color: '#888',
    fontSize: 14,
    marginTop: 8,
  },
  loadingView: {
    alignItems: 'center',
  },
  loadingText: {
    color: '#FFF',
    fontSize: 16,
    marginTop: 16,
  },
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
