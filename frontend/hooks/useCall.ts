/**
 * useCall Hook - Agora Arama Yönetimi
 * Supabase Realtime ile senkronize, backend merkezli lifecycle
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { Alert, Platform } from 'react-native';
import { createClient, RealtimeChannel } from '@supabase/supabase-js';
import Constants from 'expo-constants';

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
  started_at?: string;
  answered_at?: string;
  ended_at?: string;
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

export interface UseCallReturn {
  activeCall: Call | null;
  incomingCall: Call | null;
  isInCall: boolean;
  isRinging: boolean;
  isCalling: boolean;
  startCall: (calleeId: string, callType: 'voice' | 'video', tagId?: string) => Promise<boolean>;
  answerCall: (callId: string) => Promise<boolean>;
  endCall: (reason?: string) => Promise<boolean>;
  rejectCall: () => Promise<boolean>;
}

// ==================== CONFIG ====================

const BACKEND_URL = Constants.expoConfig?.extra?.backendUrl || 
                    process.env.EXPO_PUBLIC_BACKEND_URL || 
                    'https://cabapp-bugfix.preview.emergentagent.com';
const API_URL = `${BACKEND_URL}/api`;

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://ujvploftywsxprlzejgc.supabase.co';
const SUPABASE_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVqdnBsb2Z0eXdzeHBybHplamdjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzQ1NzExMTQsImV4cCI6MjA1MDE0NzExNH0.MM0zFnocqN4mpuqWVqxfLZJqDDC-2uaHa7TXCodDrCY';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ==================== AGORA ENGINE (lazy load) ====================

let agoraEngine: any = null;
let agoraInitialized = false;

const initAgora = async (appId: string) => {
  if (agoraInitialized) return agoraEngine;
  
  try {
    const { createAgoraRtcEngine } = await import('react-native-agora');
    agoraEngine = createAgoraRtcEngine();
    agoraEngine.initialize({ appId });
    agoraInitialized = true;
    console.log('✅ Agora initialized');
    return agoraEngine;
  } catch (error) {
    console.error('❌ Agora init error:', error);
    return null;
  }
};

const cleanupAgora = async () => {
  if (!agoraEngine) return;
  
  try {
    await agoraEngine.leaveChannel();
    console.log('✅ Agora leaveChannel');
  } catch (e) {
    console.log('⚠️ Agora leaveChannel error:', e);
  }
  
  // Engine'i destroy etme - tekrar kullanılacak
  // agoraEngine.release();
  // agoraInitialized = false;
};

// ==================== HOOK ====================

export function useCall(options: UseCallOptions): UseCallReturn {
  const { userId, enabled = true, onIncomingCall, onCallEnded, onCallConnected } = options;
  
  const [activeCall, setActiveCall] = useState<Call | null>(null);
  const [incomingCall, setIncomingCall] = useState<Call | null>(null);
  const [isCalling, setIsCalling] = useState(false);
  
  // Refs for cleanup
  const channelRef = useRef<RealtimeChannel | null>(null);
  const isMountedRef = useRef(true);
  const currentCallIdRef = useRef<string | null>(null);
  
  // ==================== SUPABASE REALTIME ====================
  
  useEffect(() => {
    if (!enabled || !userId) return;
    
    isMountedRef.current = true;
    
    // Calls tablosunu realtime subscribe et
    const channel = supabase
      .channel(`calls:${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'calls',
          filter: `caller_id=eq.${userId}`
        },
        (payload) => handleCallChange(payload)
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'calls',
          filter: `callee_id=eq.${userId}`
        },
        (payload) => handleCallChange(payload)
      )
      .subscribe();
    
    channelRef.current = channel;
    
    // CLEANUP
    return () => {
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
  
  const handleCallChange = useCallback((payload: any) => {
    if (!isMountedRef.current) return;
    
    const call = payload.new as Call;
    const eventType = payload.eventType;
    
    console.log(`📞 Call event: ${eventType}`, call?.status, call?.id?.slice(0, 8));
    
    if (!call) return;
    
    // INSERT - Yeni arama
    if (eventType === 'INSERT') {
      if (call.callee_id === userId && call.status === 'ringing') {
        // Bana gelen arama
        setIncomingCall(call);
        onIncomingCall?.(call);
      } else if (call.caller_id === userId) {
        // Benim başlattığım arama
        setActiveCall(call);
        currentCallIdRef.current = call.id;
      }
    }
    
    // UPDATE - Arama durumu değişti
    if (eventType === 'UPDATE') {
      // Connected oldu
      if (call.status === 'connected') {
        setActiveCall(call);
        setIncomingCall(null);
        currentCallIdRef.current = call.id;
        onCallConnected?.(call);
      }
      
      // ENDED - Arama bitti
      if (call.status === 'ended') {
        console.log('📞 Call ended, cleaning up...');
        
        // Agora cleanup
        cleanupAgora();
        
        // State reset
        setActiveCall(null);
        setIncomingCall(null);
        setIsCalling(false);
        currentCallIdRef.current = null;
        
        onCallEnded?.(call);
      }
    }
  }, [userId, onIncomingCall, onCallEnded, onCallConnected]);
  
  // ==================== START CALL ====================
  
  const startCall = useCallback(async (
    calleeId: string,
    callType: 'voice' | 'video',
    tagId?: string
  ): Promise<boolean> => {
    if (!userId || isCalling || activeCall) return false;
    
    setIsCalling(true);
    
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
      
      if (data.success) {
        // Agora'ya bağlan
        const engine = await initAgora(data.app_id);
        if (engine) {
          await engine.joinChannel(data.token, data.channel_name, data.uid, {
            clientRoleType: 1 // Broadcaster
          });
          console.log('✅ Agora joined channel');
        }
        
        return true;
      } else {
        if (data.busy) {
          Alert.alert('Meşgul', 'Kullanıcı başka bir aramada');
        } else {
          Alert.alert('Hata', data.error || 'Arama başlatılamadı');
        }
        setIsCalling(false);
        return false;
      }
    } catch (error) {
      console.error('Start call error:', error);
      setIsCalling(false);
      Alert.alert('Hata', 'Bağlantı hatası');
      return false;
    }
  }, [userId, isCalling, activeCall]);
  
  // ==================== ANSWER CALL ====================
  
  const answerCall = useCallback(async (callId: string): Promise<boolean> => {
    if (!userId) return false;
    
    try {
      const response = await fetch(`${API_URL}/voice/answer-call`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          call_id: callId,
          callee_id: userId
        })
      });
      
      const data = await response.json();
      
      if (data.success) {
        // Agora'ya bağlan
        const engine = await initAgora(data.app_id);
        if (engine) {
          await engine.joinChannel(data.token, data.channel_name, data.uid, {
            clientRoleType: 1
          });
          console.log('✅ Agora joined (callee)');
        }
        
        setIncomingCall(null);
        return true;
      } else {
        Alert.alert('Hata', data.error || 'Arama cevaplanamadı');
        return false;
      }
    } catch (error) {
      console.error('Answer call error:', error);
      Alert.alert('Hata', 'Bağlantı hatası');
      return false;
    }
  }, [userId]);
  
  // ==================== END CALL ====================
  
  const endCall = useCallback(async (reason: string = 'user_ended'): Promise<boolean> => {
    const callId = currentCallIdRef.current || activeCall?.id || incomingCall?.id;
    
    if (!callId || !userId) {
      // Call ID yok ama local cleanup yap
      cleanupAgora();
      setActiveCall(null);
      setIncomingCall(null);
      setIsCalling(false);
      return true;
    }
    
    try {
      // SADECE backend'e status=ended yaz
      // Agora cleanup realtime event'te yapılacak
      const response = await fetch(`${API_URL}/voice/end-call`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          call_id: callId,
          user_id: userId,
          reason
        })
      });
      
      const data = await response.json();
      return data.success;
    } catch (error) {
      console.error('End call error:', error);
      // Hata olsa bile local cleanup yap
      cleanupAgora();
      setActiveCall(null);
      setIncomingCall(null);
      setIsCalling(false);
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
      
      setIncomingCall(null);
      return true;
    } catch (error) {
      console.error('Reject call error:', error);
      setIncomingCall(null);
      return false;
    }
  }, [userId, incomingCall]);
  
  // ==================== RETURN ====================
  
  return {
    activeCall,
    incomingCall,
    isInCall: !!activeCall && activeCall.status === 'connected',
    isRinging: !!incomingCall || (!!activeCall && activeCall.status === 'ringing'),
    isCalling,
    startCall,
    answerCall,
    endCall,
    rejectCall
  };
}

export default useCall;
