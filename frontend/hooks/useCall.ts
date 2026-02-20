/**
 * useCall Hook - Supabase Realtime ile Senkronize Arama Yönetimi
 * WhatsApp/Facebook mantığında, backend merkezli lifecycle
 * 
 * KURALLAR:
 * 1. "Kapat" butonu SADECE backend'e status=ended yazar
 * 2. Agora cleanup SADECE realtime event ile yapılır
 * 3. Kim kapatırsa kapatsın, diğer tarafa anında bildirim gider
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { Alert, Platform, PermissionsAndroid } from 'react-native';
import { createClient, RealtimeChannel } from '@supabase/supabase-js';
import Constants from 'expo-constants';

// ==================== CONFIG ====================

const BACKEND_URL = Constants.expoConfig?.extra?.backendUrl || 
                    'https://trip-sync-fix.preview.emergentagent.com';
const API_URL = `${BACKEND_URL}/api`;

const SUPABASE_URL = 'https://ujvploftywsxprlzejgc.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVqdnBsb2Z0eXdzeHBybHplamdjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY0MTgwNzYsImV4cCI6MjA4MTk5NDA3Nn0.c3I-1K7Guc5OmOxHdc_mhw-pSEsobVE6DN7m-Z9Re8k';
const AGORA_APP_ID = '43c07f0cef814fd4a5ae3283c8bd77de';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ==================== TYPES ====================

export interface Call {
  id: string;
  caller_id: string;
  callee_id: string;
  call_type: 'voice' | 'video';
  channel_name: string;
  status: 'ringing' | 'connected' | 'ended';
  caller_uid?: number;
  callee_uid?: number;
  ended_by?: string;
  end_reason?: string;
}

export interface UseCallOptions {
  userId: string;
  enabled?: boolean;
  onIncomingCall?: (call: Call) => void;
  onCallEnded?: (call: Call) => void;
  onCallConnected?: (call: Call) => void;
}

// ==================== AGORA ENGINE ====================

let agoraEngine: any = null;
let isAgoraJoined = false;
let agoraCleanupInProgress = false;

const initAgora = async (): Promise<any> => {
  if (Platform.OS === 'web') return null;
  
  try {
    const { createAgoraRtcEngine, ChannelProfileType, ClientRoleType } = await import('react-native-agora');
    
    // Eğer cleanup devam ediyorsa bekle
    if (agoraCleanupInProgress) {
      console.log('⏳ Agora cleanup bekleniyor...');
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    if (agoraEngine) {
      return agoraEngine;
    }
    
    agoraEngine = createAgoraRtcEngine();
    agoraEngine.initialize({
      appId: AGORA_APP_ID,
      channelProfile: ChannelProfileType.ChannelProfileCommunication,
    });
    
    // Ses ayarları
    agoraEngine.enableAudio();
    agoraEngine.setEnableSpeakerphone(true);
    agoraEngine.setDefaultAudioRouteToSpeakerphone(true);
    agoraEngine.adjustRecordingSignalVolume(400);
    agoraEngine.adjustPlaybackSignalVolume(400);
    
    console.log('✅ Agora engine initialized');
    return agoraEngine;
  } catch (e) {
    console.error('❌ Agora init error:', e);
    return null;
  }
};

/**
 * Agora Cleanup - SADECE realtime event sonrası çağrılır
 * Buton'dan ASLA doğrudan çağrılmaz!
 * Güvenli cleanup - tüm hataları yakalar
 */
const cleanupAgora = async () => {
  if (agoraCleanupInProgress) {
    console.log('⚠️ Cleanup zaten devam ediyor, skip');
    return;
  }
  
  agoraCleanupInProgress = true;
  console.log('🧹 Agora cleanup başladı...');
  
  if (!agoraEngine) {
    console.log('🧹 Agora engine yok, skip');
    agoraCleanupInProgress = false;
    return;
  }
  
  // 1. Leave channel
  try {
    if (isAgoraJoined) {
      await agoraEngine.leaveChannel();
      console.log('✅ Agora leaveChannel');
      isAgoraJoined = false;
    }
  } catch (e) {
    console.log('⚠️ leaveChannel error (ignored):', e);
    isAgoraJoined = false;
  }
  
  // 2. Remove listeners
  try {
    agoraEngine.removeAllListeners();
    console.log('✅ Agora listeners removed');
  } catch (e) {
    console.log('⚠️ removeAllListeners error (ignored):', e);
  }
  
  // 3. Release engine
  try {
    agoraEngine.release();
    console.log('✅ Agora engine released');
  } catch (e) {
    console.log('⚠️ release error (ignored):', e);
  }
  
  // 4. Reset state
  agoraEngine = null;
  isAgoraJoined = false;
  agoraCleanupInProgress = false;
  
  console.log('🧹 Agora cleanup tamamlandı');
};

const requestPermissions = async (): Promise<boolean> => {
  if (Platform.OS !== 'android') return true;
  
  try {
    const grants = await PermissionsAndroid.requestMultiple([
      PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
      PermissionsAndroid.PERMISSIONS.CAMERA,
    ]);
    return grants[PermissionsAndroid.PERMISSIONS.RECORD_AUDIO] === PermissionsAndroid.RESULTS.GRANTED;
  } catch {
    return false;
  }
};

// ==================== HOOK ====================

export function useCall(options: UseCallOptions) {
  const { userId, enabled = true, onIncomingCall, onCallEnded, onCallConnected } = options;
  
  const [activeCall, setActiveCall] = useState<Call | null>(null);
  const [incomingCall, setIncomingCall] = useState<Call | null>(null);
  const [callState, setCallState] = useState<'idle' | 'calling' | 'ringing' | 'connected'>('idle');
  const [remoteUid, setRemoteUid] = useState<number | null>(null);
  
  // Refs
  const channelRef = useRef<RealtimeChannel | null>(null);
  const isMountedRef = useRef(true);
  const currentCallIdRef = useRef<string | null>(null);

  // ==================== SUPABASE REALTIME SUBSCRIPTION ====================
  
  useEffect(() => {
    if (!enabled || !userId) return;
    
    isMountedRef.current = true;
    console.log('📡 Calls realtime subscription başlatılıyor...');
    
    // calls tablosunu realtime subscribe et
    const channel = supabase
      .channel(`calls_${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'calls',
          filter: `caller_id=eq.${userId}`
        },
        (payload) => handleCallEvent(payload, 'caller')
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'calls',
          filter: `callee_id=eq.${userId}`
        },
        (payload) => handleCallEvent(payload, 'callee')
      )
      .subscribe((status) => {
        console.log('📡 Realtime status:', status);
      });
    
    channelRef.current = channel;
    
    // CLEANUP - Component unmount
    return () => {
      console.log('🧹 useCall cleanup...');
      isMountedRef.current = false;
      
      // Supabase subscription cleanup
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
        console.log('🧹 Supabase channel removed');
      }
      
      // Agora cleanup
      cleanupAgora();
    };
  }, [enabled, userId]);

  // ==================== REALTIME EVENT HANDLER ====================
  
  const handleCallEvent = useCallback((payload: any, role: 'caller' | 'callee') => {
    if (!isMountedRef.current) return;
    
    const call = payload.new as Call;
    const eventType = payload.eventType;
    
    console.log(`📞 Call event [${role}]: ${eventType}`, call?.status);
    
    if (!call) return;
    
    // ========== INSERT - Yeni arama ==========
    if (eventType === 'INSERT') {
      if (role === 'callee' && call.status === 'ringing') {
        // GELEN ARAMA
        console.log('📞 GELEN ARAMA!');
        setIncomingCall(call);
        setCallState('ringing');
        onIncomingCall?.(call);
      } else if (role === 'caller') {
        // Benim başlattığım arama
        setActiveCall(call);
        setCallState('calling');
        currentCallIdRef.current = call.id;
      }
    }
    
    // ========== UPDATE - Durum değişti ==========
    if (eventType === 'UPDATE') {
      
      // CONNECTED - Arama cevaplandı
      if (call.status === 'connected') {
        console.log('📞 ARAMA BAĞLANDI!');
        setActiveCall(call);
        setIncomingCall(null);
        setCallState('connected');
        currentCallIdRef.current = call.id;
        onCallConnected?.(call);
      }
      
      // ========== ENDED - ARAMA BİTTİ ==========
      // Bu event geldiğinde TÜM CLEANUP burada yapılır
      if (call.status === 'ended') {
        console.log('📞 ARAMA SONLANDI - Cleanup başlıyor...');
        console.log('📞 Kapatan:', call.ended_by, 'Sebep:', call.end_reason);
        
        // 1. Agora cleanup
        cleanupAgora();
        
        // 2. State reset
        setActiveCall(null);
        setIncomingCall(null);
        setCallState('idle');
        setRemoteUid(null);
        currentCallIdRef.current = null;
        
        // 3. Callback
        onCallEnded?.(call);
        
        // 4. UI feedback
        if (call.end_reason === 'rejected') {
          Alert.alert('Reddedildi', 'Arama reddedildi');
        } else if (call.end_reason === 'timeout') {
          Alert.alert('Cevap Yok', 'Arama cevaplanmadı');
        }
      }
    }
  }, [userId, onIncomingCall, onCallEnded, onCallConnected]);

  // ==================== START CALL ====================
  
  const startCall = useCallback(async (
    calleeId: string,
    callType: 'voice' | 'video' = 'voice',
    tagId?: string
  ): Promise<boolean> => {
    if (!userId || callState !== 'idle') {
      console.log('⚠️ startCall: userId yok veya zaten aramada');
      return false;
    }
    
    // İzin kontrolü
    const hasPermission = await requestPermissions();
    if (!hasPermission) {
      Alert.alert('İzin Gerekli', 'Mikrofon izni verin');
      return false;
    }
    
    setCallState('calling');
    
    try {
      // Backend'e arama başlat
      const response = await fetch(`${API_URL}/voice/start-call`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          caller_id: userId,
          callee_id: calleeId,
          call_type: callType,
          tag_id: tagId
        })
      });
      
      const data = await response.json();
      
      if (!data.success) {
        setCallState('idle');
        if (data.error === 'busy') {
          Alert.alert('Meşgul', 'Kullanıcı başka aramada');
        } else {
          Alert.alert('Hata', data.message || 'Arama başlatılamadı');
        }
        return false;
      }
      
      // Agora'ya bağlan
      const engine = await initAgora();
      if (engine) {
        // Agora event handlers
        engine.registerEventHandler({
          onUserJoined: (_: any, uid: number) => {
            console.log('👤 Karşı taraf katıldı:', uid);
            setRemoteUid(uid);
          },
          onUserOffline: (_: any, uid: number, reason: number) => {
            console.log('👤 Karşı taraf ayrıldı:', uid, reason);
            setRemoteUid(null);
            // Backend'e yazma - sadece local cleanup
            // Karşı taraf zaten end_call çağırmış olmalı
          },
          onConnectionStateChanged: (_: any, state: number, reason: number) => {
            console.log('🔗 Connection state:', state, reason);
            // DISCONNECTED durumunda backend'e yazma
            // Sadece local state güncelle
            if (state === 5) { // DISCONNECTED
              setRemoteUid(null);
            }
          },
        });
        
        await engine.joinChannel(data.token, data.channel_name, data.uid, {
          clientRoleType: 1
        });
        isAgoraJoined = true;
        console.log('✅ Agora channel joined (caller)');
      }
      
      currentCallIdRef.current = data.call_id;
      return true;
      
    } catch (error) {
      console.error('Start call error:', error);
      setCallState('idle');
      Alert.alert('Hata', 'Bağlantı hatası');
      return false;
    }
  }, [userId, callState]);

  // ==================== ANSWER CALL ====================
  
  const answerCall = useCallback(async (): Promise<boolean> => {
    if (!incomingCall || !userId) return false;
    
    const hasPermission = await requestPermissions();
    if (!hasPermission) {
      Alert.alert('İzin Gerekli', 'Mikrofon izni verin');
      return false;
    }
    
    try {
      const response = await fetch(`${API_URL}/voice/answer-call`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          call_id: incomingCall.id,
          callee_id: userId
        })
      });
      
      const data = await response.json();
      
      if (!data.success) {
        Alert.alert('Hata', data.error || 'Cevaplanamadı');
        return false;
      }
      
      // Agora'ya bağlan
      const engine = await initAgora();
      if (engine) {
        engine.registerEventHandler({
          onUserJoined: (_: any, uid: number) => {
            console.log('👤 Caller katıldı:', uid);
            setRemoteUid(uid);
          },
          onUserOffline: (_: any, uid: number) => {
            console.log('👤 Caller ayrıldı:', uid);
            setRemoteUid(null);
          },
          onConnectionStateChanged: (_: any, state: number) => {
            if (state === 5) setRemoteUid(null);
          },
        });
        
        await engine.joinChannel(data.token, data.channel_name, data.uid, {
          clientRoleType: 1
        });
        isAgoraJoined = true;
        console.log('✅ Agora channel joined (callee)');
      }
      
      currentCallIdRef.current = incomingCall.id;
      setIncomingCall(null);
      return true;
      
    } catch (error) {
      console.error('Answer call error:', error);
      Alert.alert('Hata', 'Bağlantı hatası');
      return false;
    }
  }, [userId, incomingCall]);

  // ==================== END CALL ====================
  /**
   * KAPAT BUTONU BUNU ÇAĞIRIR
   * Sadece backend'e status=ended yazar
   * Agora cleanup YAPILMAZ - realtime event'te yapılır
   */
  const endCall = useCallback(async (reason: string = 'user_ended'): Promise<boolean> => {
    const callId = currentCallIdRef.current || activeCall?.id || incomingCall?.id;
    
    if (!callId) {
      console.log('⚠️ endCall: callId yok');
      // Yine de local cleanup yap
      cleanupAgora();
      setActiveCall(null);
      setIncomingCall(null);
      setCallState('idle');
      return true;
    }
    
    console.log('📞 END CALL çağrıldı - Backend\'e yazılıyor...');
    
    try {
      // SADECE backend'e yaz - Agora cleanup realtime'da yapılacak
      await fetch(`${API_URL}/voice/end-call`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          call_id: callId,
          user_id: userId,
          reason
        })
      });
      
      console.log('✅ Backend\'e end_call yazıldı');
      // Realtime event gelince cleanup yapılacak
      return true;
      
    } catch (error) {
      console.error('End call error:', error);
      // Hata durumunda manual cleanup
      cleanupAgora();
      setActiveCall(null);
      setIncomingCall(null);
      setCallState('idle');
      return false;
    }
  }, [userId, activeCall, incomingCall]);

  // ==================== REJECT CALL ====================
  
  const rejectCall = useCallback(async (): Promise<boolean> => {
    if (!incomingCall) return false;
    
    try {
      await fetch(`${API_URL}/voice/end-call`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          call_id: incomingCall.id,
          user_id: userId,
          reason: 'rejected'
        })
      });
      
      // Realtime event'te cleanup yapılacak
      return true;
    } catch {
      setIncomingCall(null);
      setCallState('idle');
      return false;
    }
  }, [userId, incomingCall]);

  // ==================== RETURN ====================
  
  return {
    // State
    activeCall,
    incomingCall,
    callState,
    remoteUid,
    isInCall: callState === 'connected',
    isRinging: callState === 'ringing' || callState === 'calling',
    
    // Actions
    startCall,
    answerCall,
    endCall,
    rejectCall,
  };
}

export default useCall;
