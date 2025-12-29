/**
 * useSocket - Socket.IO Hook for Real-time Call Signaling
 * 
 * Arama sinyalleri için Socket.IO yönetimi:
 * - Bağlantı yönetimi
 * - Kullanıcı kaydı
 * - Arama olayları (call_user, incoming_call, accept, reject, end)
 */

import { useEffect, useRef, useCallback, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { AppState, AppStateStatus } from 'react-native';
import Constants from 'expo-constants';

// Socket.IO Sunucusu - Kullanıcının VPS'i (socket.leylektag.com)
// FastAPI + Python Socket.IO + Uvicorn + Nginx + Let's Encrypt SSL
const SOCKET_URL = 'https://socket.leylektag.com';
const SOCKET_PATH = '/socket.io';

console.log('🔌 Socket URL:', SOCKET_URL, 'Path:', SOCKET_PATH);

interface CallData {
  call_id: string;
  caller_id: string;
  caller_name: string;
  receiver_id: string;
  channel_name: string;
  agora_token: string;
  call_type: 'audio' | 'video';
}

interface UseSocketProps {
  userId: string | null;
  onIncomingCall?: (data: CallData) => void;
  onCallAccepted?: (data: { call_id: string; accepted_by: string }) => void;
  onCallRejected?: (data: { call_id: string; rejected_by: string }) => void;
  onCallEnded?: (data: { call_id: string; ended_by: string }) => void;
  onCallRinging?: (data: { success: boolean; receiver_online: boolean; reason?: string }) => void;
}

export default function useSocket({
  userId,
  onIncomingCall,
  onCallAccepted,
  onCallRejected,
  onCallEnded,
  onCallRinging,
}: UseSocketProps) {
  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isRegistered, setIsRegistered] = useState(false);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 5;

  // Socket bağlantısını kur
  const connect = useCallback(() => {
    if (socketRef.current?.connected) {
      console.log('🔌 Socket zaten bağlı');
      return;
    }

    console.log('🔌 Socket.IO bağlanıyor:', SOCKET_URL, 'Path:', SOCKET_PATH);

    const socket = io(SOCKET_URL, {
      path: SOCKET_PATH,
      transports: ['websocket', 'polling'],
      forceNew: true,
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      timeout: 20000,
    });

    socket.on('connect', () => {
      console.log('✅ Socket.IO bağlandı:', socket.id);
      setIsConnected(true);
      reconnectAttempts.current = 0;

      // Kullanıcıyı HEMEN kaydet
      if (userId) {
        console.log('📱 Register gönderiliyor:', userId);
        socket.emit('register', { user_id: userId });
      }
    });

    socket.on('disconnect', (reason) => {
      console.log('❌ Socket.IO bağlantı kesildi:', reason);
      setIsConnected(false);
      setIsRegistered(false);
    });

    socket.on('connect_error', (error) => {
      console.error('❌ Socket.IO bağlantı hatası:', error.message);
      reconnectAttempts.current++;
    });

    socket.on('registered', (data) => {
      console.log('📱 Socket.IO kullanıcı kayıtlı:', data);
      setIsRegistered(true);
    });

    // Gelen arama
    socket.on('incoming_call', (data: CallData) => {
      console.log('📞 GELEN ARAMA:', data);
      if (onIncomingCall) {
        onIncomingCall(data);
      }
    });

    // Arama kabul edildi
    socket.on('call_accepted', (data) => {
      console.log('✅ ARAMA KABUL EDİLDİ:', data);
      if (onCallAccepted) {
        onCallAccepted(data);
      }
    });

    // Arama reddedildi
    socket.on('call_rejected', (data) => {
      console.log('❌ ARAMA REDDEDİLDİ:', data);
      if (onCallRejected) {
        onCallRejected(data);
      }
    });

    // Arama sonlandırıldı
    socket.on('call_ended', (data) => {
      console.log('📴 ARAMA SONLANDIRILDI:', data);
      if (onCallEnded) {
        onCallEnded(data);
      }
    });

    // Arama çalıyor (arayan için)
    socket.on('call_ringing', (data) => {
      console.log('🔔 ARAMA ÇALIYOR:', data);
      if (onCallRinging) {
        onCallRinging(data);
      }
    });

    socketRef.current = socket;
  }, [userId, onIncomingCall, onCallAccepted, onCallRejected, onCallEnded, onCallRinging]);

  // Bağlantıyı kes
  const disconnect = useCallback(() => {
    if (socketRef.current) {
      console.log('🔌 Socket.IO bağlantısı kesiliyor...');
      socketRef.current.disconnect();
      socketRef.current = null;
      setIsConnected(false);
      setIsRegistered(false);
    }
  }, []);

  // Kullanıcıyı kaydet
  const registerUser = useCallback((uid: string) => {
    if (socketRef.current?.connected) {
      console.log('📱 Kullanıcı kaydediliyor:', uid);
      socketRef.current.emit('register', { user_id: uid });
    }
  }, []);

  // Arama başlat
  const startCall = useCallback((data: {
    caller_id: string;
    caller_name: string;
    receiver_id: string;
    call_id: string;
    channel_name: string;
    agora_token: string;
    call_type: 'audio' | 'video';
  }) => {
    if (socketRef.current?.connected) {
      console.log('📞 Arama başlatılıyor:', data);
      socketRef.current.emit('call_user', data);
    } else {
      console.error('❌ Socket bağlı değil, arama başlatılamadı');
    }
  }, []);

  // Aramayı kabul et
  const acceptCall = useCallback((data: {
    call_id: string;
    caller_id: string;
    receiver_id: string;
  }) => {
    if (socketRef.current?.connected) {
      console.log('✅ Arama kabul ediliyor:', data);
      socketRef.current.emit('accept_call', data);
    }
  }, []);

  // Aramayı reddet
  const rejectCall = useCallback((data: {
    call_id: string;
    caller_id: string;
    receiver_id: string;
  }) => {
    if (socketRef.current?.connected) {
      console.log('❌ Arama reddediliyor:', data);
      socketRef.current.emit('reject_call', data);
    }
  }, []);

  // Aramayı sonlandır
  const endCall = useCallback((data: {
    call_id: string;
    caller_id: string;
    receiver_id: string;
    ended_by: string;
  }) => {
    if (socketRef.current?.connected) {
      console.log('📴 Arama sonlandırılıyor:', data);
      socketRef.current.emit('end_call', data);
    }
  }, []);

  // App state değişikliklerini dinle
  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active') {
        // Uygulama ön plana geldi
        if (!socketRef.current?.connected && userId) {
          console.log('📱 Uygulama aktif, Socket.IO yeniden bağlanıyor...');
          connect();
        }
      } else if (nextAppState === 'background') {
        // Uygulama arka plana gitti - bağlantıyı KORU (arama gelebilir)
        console.log('📱 Uygulama arka planda, Socket.IO bağlantısı korunuyor');
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      subscription.remove();
    };
  }, [userId, connect]);

  // Kullanıcı değiştiğinde bağlan/kayıt ol
  useEffect(() => {
    if (userId) {
      connect();
      
      // Eğer zaten bağlıysa, kullanıcıyı kaydet
      if (socketRef.current?.connected) {
        console.log('📱 Zaten bağlı, register gönderiliyor:', userId);
        socketRef.current.emit('register', { user_id: userId });
      }
    } else {
      disconnect();
    }

    return () => {
      // Component unmount olduğunda bağlantıyı kesme (uygulama kapanmadı)
    };
  }, [userId, connect, disconnect]);
  
  // userId değiştiğinde ve socket bağlıysa register gönder
  useEffect(() => {
    if (userId && socketRef.current?.connected) {
      console.log('📱 UserId değişti, register gönderiliyor:', userId);
      socketRef.current.emit('register', { user_id: userId });
    }
  }, [userId]);

  return {
    socket: socketRef.current,
    isConnected,
    isRegistered,
    connect,
    disconnect,
    registerUser,
    startCall,
    acceptCall,
    rejectCall,
    endCall,
  };
}
