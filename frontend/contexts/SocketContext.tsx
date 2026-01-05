/**
 * SocketContext.tsx - SINGLETON Socket Yönetimi
 * 
 * Bu context, socket bağlantısını uygulama seviyesinde yönetir.
 * Component yaşam döngüsünden TAMAMEN BAĞIMSIZ.
 * 
 * Kullanım:
 * 1. _layout.tsx'de SocketProvider ile sar
 * 2. Herhangi bir component'te useSocketContext() ile eriş
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
let isInitialized = false;

function getSocket(): Socket {
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
  
  // Emit fonksiyonları
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
}

const SocketContext = createContext<SocketContextType | null>(null);

// ═══════════════════════════════════════════════════════════════════
// SOCKET PROVIDER
// ═══════════════════════════════════════════════════════════════════

interface SocketProviderProps {
  children: React.ReactNode;
  onNewOffer?: (data: any) => void;
  onOfferAccepted?: (data: any) => void;
  onOfferRejected?: (data: any) => void;
  onOfferSentAck?: (data: any) => void;
  onTagCreated?: (data: any) => void;
  onTagCancelled?: (data: any) => void;
  onTagMatched?: (data: any) => void;
  onTripStarted?: (data: any) => void;
  onTripEnded?: (data: any) => void;
  onTripForceEnded?: (data: any) => void;
  onLocationUpdated?: (data: any) => void;
  onIncomingDailyCall?: (data: any) => void;
  onCallAccepted?: (data: any) => void;
  onCallRejected?: (data: any) => void;
  onCallCancelled?: (data: any) => void;
  onCallEnded?: (data: any) => void;
}

export function SocketProvider({ children, ...callbacks }: SocketProviderProps) {
  const [isConnected, setIsConnected] = useState(false);
  const [isRegistered, setIsRegistered] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  
  const socketRef = useRef<Socket | null>(null);
  const callbacksRef = useRef(callbacks);
  
  // Callback'leri güncelle
  useEffect(() => {
    callbacksRef.current = callbacks;
  }, [callbacks]);

  // ══════════════════════════════════════════════════════════════════
  // SOCKET BAĞLANTISI - TEK SEFER
  // ══════════════════════════════════════════════════════════════════
  
  const setupSocketListeners = useCallback((socket: Socket) => {
    // Bağlantı eventleri
    socket.on('connect', () => {
      console.log('✅ [SocketContext] Socket bağlandı:', socket.id);
      setIsConnected(true);
      
      // Otomatik register
      if (userId && userRole) {
        console.log('📱 [SocketContext] Auto-register:', userId, userRole);
        socket.emit('register', { user_id: userId, role: userRole });
      }
    });

    socket.on('disconnect', (reason) => {
      console.log('⚠️ [SocketContext] Socket koptu:', reason);
      setIsConnected(false);
      setIsRegistered(false);
    });

    socket.on('reconnect', (attemptNumber) => {
      console.log('🔄 [SocketContext] Reconnect başarılı, attempt:', attemptNumber);
      if (userId && userRole) {
        socket.emit('register', { user_id: userId, role: userRole });
      }
    });

    socket.on('registered', (data) => {
      console.log('✅ [SocketContext] Kayıt başarılı:', data);
      setIsRegistered(true);
    });

    // ══════════ TEKLİF EVENTLERİ ══════════
    socket.on('new_offer', (data) => {
      console.log('💰 [SocketContext] YENİ TEKLİF:', data);
      callbacksRef.current.onNewOffer?.(data);
    });

    socket.on('offer_accepted', (data) => {
      console.log('✅ [SocketContext] TEKLİF KABUL:', data);
      callbacksRef.current.onOfferAccepted?.(data);
    });

    socket.on('offer_rejected', (data) => {
      console.log('❌ [SocketContext] TEKLİF RED:', data);
      callbacksRef.current.onOfferRejected?.(data);
    });

    socket.on('offer_sent_ack', (data) => {
      console.log('📤 [SocketContext] TEKLİF ACK:', data);
      callbacksRef.current.onOfferSentAck?.(data);
    });

    // ══════════ TAG EVENTLERİ ══════════
    socket.on('new_tag', (data) => {
      console.log('🏷️ [SocketContext] YENİ TAG:', data);
      callbacksRef.current.onTagCreated?.(data);
    });

    socket.on('tag_cancelled', (data) => {
      console.log('🚫 [SocketContext] TAG İPTAL:', data);
      callbacksRef.current.onTagCancelled?.(data);
    });

    socket.on('tag_matched', (data) => {
      console.log('🤝 [SocketContext] TAG EŞLEŞTİ:', data);
      callbacksRef.current.onTagMatched?.(data);
    });

    // ══════════ YOLCULUK EVENTLERİ ══════════
    socket.on('trip_started', (data) => {
      console.log('🚗 [SocketContext] YOLCULUK BAŞLADI:', data);
      callbacksRef.current.onTripStarted?.(data);
    });

    socket.on('trip_ended', (data) => {
      console.log('🏁 [SocketContext] YOLCULUK BİTTİ:', data);
      callbacksRef.current.onTripEnded?.(data);
    });

    socket.on('trip_force_ended', (data) => {
      console.log('⚡ [SocketContext] YOLCULUK ZORLA BİTTİ:', data);
      callbacksRef.current.onTripForceEnded?.(data);
    });

    // ══════════ KONUM EVENTLERİ ══════════
    socket.on('location_updated', (data) => {
      callbacksRef.current.onLocationUpdated?.(data);
    });

    // ══════════ ARAMA EVENTLERİ ══════════
    socket.on('incoming_daily_call', (data) => {
      console.log('📞 [SocketContext] GELEN ARAMA:', data);
      callbacksRef.current.onIncomingDailyCall?.(data);
    });

    socket.on('call_accepted', (data) => {
      console.log('✅ [SocketContext] ARAMA KABUL:', data);
      callbacksRef.current.onCallAccepted?.(data);
    });

    socket.on('call_rejected', (data) => {
      console.log('❌ [SocketContext] ARAMA RED:', data);
      callbacksRef.current.onCallRejected?.(data);
    });

    socket.on('call_cancelled', (data) => {
      console.log('🚫 [SocketContext] ARAMA İPTAL:', data);
      callbacksRef.current.onCallCancelled?.(data);
    });

    socket.on('call_ended', (data) => {
      console.log('📴 [SocketContext] ARAMA BİTTİ:', data);
      callbacksRef.current.onCallEnded?.(data);
    });
  }, [userId, userRole]);

  // ══════════════════════════════════════════════════════════════════
  // CONNECT FONKSİYONU
  // ══════════════════════════════════════════════════════════════════
  
  const connect = useCallback((newUserId: string, newUserRole: string) => {
    console.log('🔌 [SocketContext] Connect çağrıldı:', newUserId, newUserRole);
    
    setUserId(newUserId);
    setUserRole(newUserRole);
    
    const socket = getSocket();
    socketRef.current = socket;
    
    // Listener'ları sadece bir kez ekle
    if (!isInitialized) {
      setupSocketListeners(socket);
      isInitialized = true;
    }
    
    // Bağlan
    if (!socket.connected) {
      console.log('🔌 [SocketContext] Socket.connect() çağrılıyor...');
      socket.connect();
    } else {
      console.log('🔌 [SocketContext] Socket zaten bağlı, register yapılıyor...');
      socket.emit('register', { user_id: newUserId, role: newUserRole });
    }
  }, [setupSocketListeners]);

  // ══════════════════════════════════════════════════════════════════
  // DISCONNECT - ASLA ÇAĞIRILMAMALI (sadece logout için)
  // ══════════════════════════════════════════════════════════════════
  
  const disconnect = useCallback(() => {
    console.log('⚠️ [SocketContext] Disconnect çağrıldı - YAPILMIYOR');
    // Socket'i KAPATMA - sadece user bilgilerini temizle
    setUserId(null);
    setUserRole(null);
    setIsRegistered(false);
  }, []);

  // ══════════════════════════════════════════════════════════════════
  // APP STATE - Arka plan / Ön plan
  // ══════════════════════════════════════════════════════════════════
  
  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active' && userId && userRole) {
        console.log('📱 [SocketContext] App aktif, re-register...');
        const socket = socketRef.current;
        if (socket?.connected) {
          socket.emit('register', { user_id: userId, role: userRole });
        } else if (socket) {
          socket.connect();
        }
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription.remove();
  }, [userId, userRole]);

  // ══════════════════════════════════════════════════════════════════
  // EMIT FONKSİYONLARI
  // ══════════════════════════════════════════════════════════════════
  
  const emit = useCallback((event: string, data: any) => {
    const socket = socketRef.current;
    if (socket?.connected) {
      console.log(`📤 [SocketContext] Emit: ${event}`, data);
      socket.emit(event, data);
    } else {
      console.error(`❌ [SocketContext] Socket bağlı değil! Event: ${event}`);
    }
  }, []);

  const emitSendOffer = useCallback((data: any) => {
    console.log('💰 [SocketContext] emitSendOffer:', data);
    emit('send_offer', data);
  }, [emit]);

  const emitAcceptOffer = useCallback((data: any) => {
    emit('accept_offer', data);
  }, [emit]);

  const emitRejectOffer = useCallback((data: any) => {
    emit('reject_offer', data);
  }, [emit]);

  const emitCreateTagRequest = useCallback((data: any) => {
    console.log('🏷️ [SocketContext] emitCreateTagRequest:', data);
    emit('create_tag_request', data);
  }, [emit]);

  const emitCancelTagRequest = useCallback((data: any) => {
    emit('cancel_tag_request', data);
  }, [emit]);

  const emitDriverLocationUpdate = useCallback((data: any) => {
    emit('driver_location_update', data);
  }, [emit]);

  const emitLocationUpdate = useCallback((data: any) => {
    emit('location_update', data);
  }, [emit]);

  const emitTripStarted = useCallback((data: any) => {
    emit('trip_started', data);
  }, [emit]);

  const emitTripEnded = useCallback((data: any) => {
    emit('trip_ended', data);
  }, [emit]);

  const forceEndTrip = useCallback((data: any) => {
    emit('force_end_trip', data);
  }, [emit]);

  const emitCallInvite = useCallback((data: any) => {
    emit('call_invite', data);
  }, [emit]);

  const emitCallAccept = useCallback((data: any) => {
    emit('call_accept', data);
  }, [emit]);

  const emitCallReject = useCallback((data: any) => {
    emit('call_reject', data);
  }, [emit]);

  const emitCallCancel = useCallback((data: any) => {
    emit('call_cancel', data);
  }, [emit]);

  const emitCallEnd = useCallback((data: any) => {
    emit('call_end', data);
  }, [emit]);

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
