/**
 * SocketContext.tsx - SINGLETON Socket Yönetimi
 * 
 * Bu context, socket bağlantısını uygulama seviyesinde yönetir.
 * Component yaşam döngüsünden TAMAMEN BAĞIMSIZ.
 * 
 * v3.0 - Simplified Architecture
 * - Socket singleton modül seviyesinde tutulur
 * - Context sadece socket instance ve emit fonksiyonları sağlar
 * - Event listener'lar useSocket hook'unda yönetilir
 * 
 * Kullanım:
 * 1. _layout.tsx'de SocketProvider ile sar
 * 2. useSocket() hook ile emit fonksiyonlarına eriş
 */

import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { AppState, AppStateStatus } from 'react-native';

// Socket.IO Sunucusu
const SOCKET_URL = 'https://socket.leylektag.com';

// ═══════════════════════════════════════════════════════════════════
// SINGLETON SOCKET - Modül seviyesinde TEK instance
// ═══════════════════════════════════════════════════════════════════
let singletonSocket: Socket | null = null;

function getOrCreateSocket(): Socket {
  if (!singletonSocket) {
    console.log('🔌 [SocketContext] Singleton socket oluşturuluyor...');
    singletonSocket = io(SOCKET_URL, {
      path: '/socket.io',
      transports: ['websocket', 'polling'],
      forceNew: false,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000,
      autoConnect: false, // Manuel bağlanacağız
    });
    
    // Temel bağlantı logları
    singletonSocket.on('connect', () => {
      console.log('✅ [SocketContext] Socket bağlandı:', singletonSocket?.id);
    });
    
    singletonSocket.on('disconnect', (reason) => {
      console.log('⚠️ [SocketContext] Socket koptu:', reason);
    });
    
    singletonSocket.on('reconnect', (attemptNumber) => {
      console.log('🔄 [SocketContext] Reconnect başarılı, attempt:', attemptNumber);
    });
    
    singletonSocket.on('connect_error', (error) => {
      console.error('❌ [SocketContext] Bağlantı hatası:', error.message);
    });
    
    singletonSocket.on('registered', (data) => {
      console.log('✅ [SocketContext] Kayıt başarılı:', data);
    });
  }
  return singletonSocket;
}

// ═══════════════════════════════════════════════════════════════════
// CONTEXT TYPE
// ═══════════════════════════════════════════════════════════════════

interface SocketContextType {
  socket: Socket | null;
  isConnected: boolean;
  isRegistered: boolean;
  userId: string | null;
  userRole: string | null;
  
  // Bağlantı yönetimi
  connect: (userId: string, userRole: string) => void;
  disconnect: () => void;
  
  // Generic emit
  emit: (event: string, data: any) => void;
  
  // Teklif sistemi
  emitSendOffer: (data: any) => void;
  emitAcceptOffer: (data: any) => void;
  emitRejectOffer: (data: any) => void;
  
  // TAG sistemi
  emitCreateTagRequest: (data: any) => void;
  emitCancelTagRequest: (data: any) => void;
  
  // Konum
  emitDriverLocationUpdate: (data: any) => void;
  emitLocationUpdate: (data: any) => void;
  
  // Yolculuk
  emitTripStarted: (data: any) => void;
  emitTripEnded: (data: any) => void;
  forceEndTrip: (data: any) => void;
  
  // Arama
  emitCallInvite: (data: any) => void;
  emitCallAccept: (data: any) => void;
  emitCallReject: (data: any) => void;
  emitCallCancel: (data: any) => void;
  emitCallEnd: (data: any) => void;
  
  // 🆕 Mesajlaşma
  emitSendMessage: (data: any) => void;
}

const SocketContext = createContext<SocketContextType | null>(null);

// ═══════════════════════════════════════════════════════════════════
// SOCKET PROVIDER
// ═══════════════════════════════════════════════════════════════════

interface SocketProviderProps {
  children: React.ReactNode;
}

export function SocketProvider({ children }: SocketProviderProps) {
  const [isConnected, setIsConnected] = useState(false);
  const [isRegistered, setIsRegistered] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  
  const socketRef = useRef<Socket | null>(null);
  const userIdRef = useRef<string | null>(null);
  const userRoleRef = useRef<string | null>(null);

  // Refs'i güncelle (closure sorununu önlemek için)
  useEffect(() => {
    userIdRef.current = userId;
    userRoleRef.current = userRole;
  }, [userId, userRole]);

  // ══════════════════════════════════════════════════════════════════
  // SOCKET SETUP - Bir kez
  // ══════════════════════════════════════════════════════════════════
  
  useEffect(() => {
    const socket = getOrCreateSocket();
    socketRef.current = socket;

    // Bağlantı durumu listener'ları
    const handleConnect = () => {
      console.log('✅ [SocketProvider] Socket bağlandı:', socket.id);
      setIsConnected(true);
      
      // Otomatik register
      if (userIdRef.current && userRoleRef.current) {
        console.log('📱 [SocketProvider] Auto-register:', userIdRef.current, userRoleRef.current);
        socket.emit('register', { user_id: userIdRef.current, role: userRoleRef.current });
      }
    };

    const handleDisconnect = (reason: string) => {
      console.log('⚠️ [SocketProvider] Socket koptu:', reason);
      setIsConnected(false);
      setIsRegistered(false);
    };

    const handleReconnect = (attemptNumber: number) => {
      console.log('🔄 [SocketProvider] Reconnect başarılı, attempt:', attemptNumber);
      // Reconnect'te de register yap
      if (userIdRef.current && userRoleRef.current) {
        socket.emit('register', { user_id: userIdRef.current, role: userRoleRef.current });
      }
    };

    const handleRegistered = (data: any) => {
      console.log('✅ [SocketProvider] Kayıt başarılı:', data);
      setIsRegistered(true);
    };

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('reconnect', handleReconnect);
    socket.on('registered', handleRegistered);

    // Cleanup - AMA SOCKET'İ KAPATMA!
    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('reconnect', handleReconnect);
      socket.off('registered', handleRegistered);
      // Socket'i KAPATMIYORUZ - singleton kalıcı
    };
  }, []);

  // ══════════════════════════════════════════════════════════════════
  // APP STATE - Arka plan / Ön plan
  // ══════════════════════════════════════════════════════════════════
  
  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active') {
        console.log('📱 [SocketProvider] App aktif');
        const socket = socketRef.current;
        if (socket) {
          if (socket.connected) {
            // Re-register
            if (userIdRef.current && userRoleRef.current) {
              console.log('📱 [SocketProvider] Re-register:', userIdRef.current);
              socket.emit('register', { user_id: userIdRef.current, role: userRoleRef.current });
            }
          } else {
            // Reconnect
            console.log('📱 [SocketProvider] Reconnecting...');
            socket.connect();
          }
        }
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription.remove();
  }, []);

  // ══════════════════════════════════════════════════════════════════
  // CONNECT FONKSİYONU
  // ══════════════════════════════════════════════════════════════════
  
  const connect = useCallback((newUserId: string, newUserRole: string) => {
    console.log('🔌 [SocketProvider] Connect çağrıldı:', newUserId, newUserRole);
    
    setUserId(newUserId);
    setUserRole(newUserRole);
    userIdRef.current = newUserId;
    userRoleRef.current = newUserRole;
    
    const socket = socketRef.current;
    if (!socket) {
      console.error('❌ [SocketProvider] Socket null!');
      return;
    }
    
    if (!socket.connected) {
      console.log('🔌 [SocketProvider] Socket.connect() çağrılıyor...');
      socket.connect();
    } else {
      console.log('🔌 [SocketProvider] Socket zaten bağlı, register yapılıyor...');
      socket.emit('register', { user_id: newUserId, role: newUserRole });
    }
  }, []);

  // ══════════════════════════════════════════════════════════════════
  // DISCONNECT - ASLA ÇAĞIRILMAMALI (sadece logout için)
  // ══════════════════════════════════════════════════════════════════
  
  const disconnect = useCallback(() => {
    console.log('⚠️ [SocketProvider] Disconnect çağrıldı - YAPILMIYOR');
    // Socket'i KAPATMA - sadece user bilgilerini temizle
    setUserId(null);
    setUserRole(null);
    userIdRef.current = null;
    userRoleRef.current = null;
    setIsRegistered(false);
  }, []);

  // ══════════════════════════════════════════════════════════════════
  // EMIT FONKSİYONLARI
  // ══════════════════════════════════════════════════════════════════
  
  const emit = useCallback((event: string, data: any) => {
    // Her zaman singleton socket'i al
    const socket = getOrCreateSocket();
    
    // Socket bağlıysa HEMEN gönder
    if (socket?.connected) {
      console.log(`📤 [SocketProvider] Emit: ${event}`);
      socket.emit(event, data);
      return;
    }
    
    // Socket bağlı değilse, bağlan ve HEMEN gönder
    console.warn(`⚠️ [SocketProvider] Socket bağlı değil, bağlanıp gönderiliyor: ${event}`);
    socket.connect();
    
    // Bağlantı olur olmaz gönder
    socket.once('connect', () => {
      console.log(`📤 [SocketProvider] Emit (after connect): ${event}`);
      socket.emit(event, data);
    });
  }, []);

  const emitSendOffer = useCallback((data: any) => {
    console.log('💰 [SocketProvider] emitSendOffer:', JSON.stringify(data));
    emit('send_offer', data);
  }, [emit]);

  const emitAcceptOffer = useCallback((data: any) => {
    console.log('✅ [SocketProvider] emitAcceptOffer:', data);
    emit('accept_offer', data);
  }, [emit]);

  const emitRejectOffer = useCallback((data: any) => {
    console.log('❌ [SocketProvider] emitRejectOffer:', data);
    emit('reject_offer', data);
  }, [emit]);

  const emitCreateTagRequest = useCallback((data: any) => {
    console.log('🏷️ [SocketProvider] emitCreateTagRequest:', data);
    emit('create_tag_request', data);
  }, [emit]);

  const emitCancelTagRequest = useCallback((data: any) => {
    console.log('🚫 [SocketProvider] emitCancelTagRequest:', data);
    emit('cancel_tag_request', data);
  }, [emit]);

  const emitDriverLocationUpdate = useCallback((data: any) => {
    emit('driver_location_update', data);
  }, [emit]);

  const emitLocationUpdate = useCallback((data: any) => {
    emit('location_update', data);
  }, [emit]);

  const emitTripStarted = useCallback((data: any) => {
    console.log('🚗 [SocketProvider] emitTripStarted:', data);
    emit('trip_started', data);
  }, [emit]);

  const emitTripEnded = useCallback((data: any) => {
    console.log('🏁 [SocketProvider] emitTripEnded:', data);
    emit('trip_ended', data);
  }, [emit]);

  const forceEndTrip = useCallback((data: any) => {
    console.log('⚡ [SocketProvider] forceEndTrip:', data);
    emit('force_end_trip', data);
  }, [emit]);

  const emitCallInvite = useCallback((data: any) => {
    console.log('📞 [SocketProvider] emitCallInvite:', data);
    emit('call_invite', data);
  }, [emit]);

  const emitCallAccept = useCallback((data: any) => {
    console.log('✅ [SocketProvider] emitCallAccept:', data);
    emit('call_accept', data);
  }, [emit]);

  const emitCallReject = useCallback((data: any) => {
    console.log('❌ [SocketProvider] emitCallReject:', data);
    emit('call_reject', data);
  }, [emit]);

  const emitCallCancel = useCallback((data: any) => {
    console.log('🚫 [SocketProvider] emitCallCancel:', data);
    emit('call_cancel', data);
  }, [emit]);

  const emitCallEnd = useCallback((data: any) => {
    console.log('📴 [SocketProvider] emitCallEnd:', data);
    emit('call_end', data);
  }, [emit]);

  // 🆕 Mesajlaşma - SOCKET BAĞLANTISINA BAKMADAN GÖNDER
  const emitSendMessage = useCallback((data: any) => {
    const socket = getOrCreateSocket();
    console.log('💬 [SocketProvider] emitSendMessage:', JSON.stringify(data).substring(0, 100));
    
    // Direkt emit - bağlantı kontrolü YOK
    // Socket.IO kendi buffer'ına alır, bağlanınca gönderir
    socket.emit('send_message', data);
    console.log('✅ [SocketProvider] send_message EMIT edildi!');
  }, []);

  // ══════════════════════════════════════════════════════════════════
  // CONTEXT VALUE
  // ══════════════════════════════════════════════════════════════════

  const value: SocketContextType = {
    socket: socketRef.current,
    isConnected,
    isRegistered,
    userId,
    userRole,
    connect,
    disconnect,
    emit,
    emitSendOffer,
    emitAcceptOffer,
    emitRejectOffer,
    emitCreateTagRequest,
    emitCancelTagRequest,
    emitDriverLocationUpdate,
    emitLocationUpdate,
    emitTripStarted,
    emitTripEnded,
    forceEndTrip,
    emitCallInvite,
    emitCallAccept,
    emitCallReject,
    emitCallCancel,
    emitCallEnd,
    emitSendMessage,  // 🆕 Mesajlaşma
  };

  return (
    <SocketContext.Provider value={value}>
      {children}
    </SocketContext.Provider>
  );
}

// ═══════════════════════════════════════════════════════════════════
// HOOK
// ═══════════════════════════════════════════════════════════════════

export function useSocketContext() {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocketContext must be used within SocketProvider');
  }
  return context;
}

export default SocketContext;
