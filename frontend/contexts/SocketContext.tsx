/**
 * SocketContext.tsx - SINGLETON Socket Yönetimi v4.0
 * 
 * KURALLAR:
 * 1. Socket SADECE burada yaratılır (singleton)
 * 2. register() OLMADAN emit YAPILMAZ
 * 3. socket.connected değilse emit YAPILMAZ
 * 4. new_message listener SADECE burada
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
let isSocketRegistered = false;
let lastRegisteredUserId: string | null = null;
let registerInProgress = false;

function createSocket(): Socket {
  if (singletonSocket) {
    return singletonSocket;
  }
  
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
    autoConnect: false,
  });
  
  return singletonSocket;
}

// ═══════════════════════════════════════════════════════════════════
// CONTEXT TYPE
// ═══════════════════════════════════════════════════════════════════

interface SocketContextType {
  socket: Socket | null;
  isConnected: boolean;
  isRegistered: boolean;
  
  // Bağlantı yönetimi
  connectAndRegister: (userId: string, userRole: string) => void;
  disconnect: () => void;
  
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
  
  // Mesajlaşma
  emitSendMessage: (data: any) => void;
  
  // Event callback setter
  setOnNewMessage: (callback: ((data: any) => void) | null) => void;
  setOnNewOffer: (callback: ((data: any) => void) | null) => void;
  setOnOfferAccepted: (callback: ((data: any) => void) | null) => void;
  setOnOfferRejected: (callback: ((data: any) => void) | null) => void;
  setOnNewTag: (callback: ((data: any) => void) | null) => void;
  setOnTagCancelled: (callback: ((data: any) => void) | null) => void;
  setOnTripStarted: (callback: ((data: any) => void) | null) => void;
  setOnTripEnded: (callback: ((data: any) => void) | null) => void;
  setOnCallInvite: (callback: ((data: any) => void) | null) => void;
  setOnCallAccepted: (callback: ((data: any) => void) | null) => void;
  setOnCallRejected: (callback: ((data: any) => void) | null) => void;
  setOnCallEnded: (callback: ((data: any) => void) | null) => void;
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
  
  const socketRef = useRef<Socket | null>(null);
  const userIdRef = useRef<string | null>(null);
  const userRoleRef = useRef<string | null>(null);
  
  // Callback refs
  const onNewMessageRef = useRef<((data: any) => void) | null>(null);
  const onNewOfferRef = useRef<((data: any) => void) | null>(null);
  const onOfferAcceptedRef = useRef<((data: any) => void) | null>(null);
  const onOfferRejectedRef = useRef<((data: any) => void) | null>(null);
  const onNewTagRef = useRef<((data: any) => void) | null>(null);
  const onTagCancelledRef = useRef<((data: any) => void) | null>(null);
  const onTripStartedRef = useRef<((data: any) => void) | null>(null);
  const onTripEndedRef = useRef<((data: any) => void) | null>(null);
  const onCallInviteRef = useRef<((data: any) => void) | null>(null);
  const onCallAcceptedRef = useRef<((data: any) => void) | null>(null);
  const onCallRejectedRef = useRef<((data: any) => void) | null>(null);
  const onCallEndedRef = useRef<((data: any) => void) | null>(null);

  // ══════════════════════════════════════════════════════════════════
  // SOCKET SETUP - Bir kez
  // ══════════════════════════════════════════════════════════════════
  
  useEffect(() => {
    const socket = createSocket();
    socketRef.current = socket;

    // ─────────────────────────────────────────────────────────────────
    // BAĞLANTI EVENT'LERİ
    // ─────────────────────────────────────────────────────────────────
    
    const handleConnect = () => {
      console.log('✅ [SocketProvider] Socket BAĞLANDI:', socket.id);
      setIsConnected(true);
      
      // Otomatik register
      if (userIdRef.current && userRoleRef.current) {
        console.log('📱 [SocketProvider] Auto-register:', userIdRef.current);
        socket.emit('register', { 
          user_id: userIdRef.current, 
          role: userRoleRef.current 
        });
      }
    };

    const handleDisconnect = (reason: string) => {
      console.log('⚠️ [SocketProvider] Socket KOPTU:', reason);
      setIsConnected(false);
      setIsRegistered(false);
      isSocketRegistered = false;
    };

    const handleReconnect = (attemptNumber: number) => {
      console.log('🔄 [SocketProvider] Reconnect başarılı:', attemptNumber);
      // Reconnect'te register yap
      if (userIdRef.current && userRoleRef.current) {
        socket.emit('register', { 
          user_id: userIdRef.current, 
          role: userRoleRef.current 
        });
      }
    };

    const handleRegistered = (data: any) => {
      console.log('✅ [SocketProvider] KAYIT BAŞARILI:', data);
      setIsRegistered(true);
      isSocketRegistered = true;
    };

    // ─────────────────────────────────────────────────────────────────
    // İŞ MANTIĞI EVENT'LERİ
    // ─────────────────────────────────────────────────────────────────
    
    const handleNewMessage = (data: any) => {
      console.log('💬 [SocketProvider] YENİ MESAJ GELDİ:', data);
      if (onNewMessageRef.current) {
        onNewMessageRef.current(data);
      }
    };
    
    const handleNewOffer = (data: any) => {
      console.log('💰 [SocketProvider] YENİ TEKLİF:', data);
      if (onNewOfferRef.current) {
        onNewOfferRef.current(data);
      }
    };
    
    const handleOfferAccepted = (data: any) => {
      console.log('✅ [SocketProvider] TEKLİF KABUL:', data);
      if (onOfferAcceptedRef.current) {
        onOfferAcceptedRef.current(data);
      }
    };
    
    const handleOfferRejected = (data: any) => {
      console.log('❌ [SocketProvider] TEKLİF RED:', data);
      if (onOfferRejectedRef.current) {
        onOfferRejectedRef.current(data);
      }
    };
    
    const handleNewTag = (data: any) => {
      console.log('🏷️ [SocketProvider] YENİ TAG:', data);
      if (onNewTagRef.current) {
        onNewTagRef.current(data);
      }
    };
    
    const handleTagCancelled = (data: any) => {
      console.log('🚫 [SocketProvider] TAG İPTAL:', data);
      if (onTagCancelledRef.current) {
        onTagCancelledRef.current(data);
      }
    };
    
    const handleTripStarted = (data: any) => {
      console.log('🚗 [SocketProvider] YOLCULUK BAŞLADI:', data);
      if (onTripStartedRef.current) {
        onTripStartedRef.current(data);
      }
    };
    
    const handleTripEnded = (data: any) => {
      console.log('🏁 [SocketProvider] YOLCULUK BİTTİ:', data);
      if (onTripEndedRef.current) {
        onTripEndedRef.current(data);
      }
    };
    
    const handleCallInvite = (data: any) => {
      console.log('📞 [SocketProvider] ARAMA GELDİ:', data);
      if (onCallInviteRef.current) {
        onCallInviteRef.current(data);
      }
    };
    
    const handleCallAccepted = (data: any) => {
      console.log('✅ [SocketProvider] ARAMA KABUL:', data);
      if (onCallAcceptedRef.current) {
        onCallAcceptedRef.current(data);
      }
    };
    
    const handleCallRejected = (data: any) => {
      console.log('❌ [SocketProvider] ARAMA RED:', data);
      if (onCallRejectedRef.current) {
        onCallRejectedRef.current(data);
      }
    };
    
    const handleCallEnded = (data: any) => {
      console.log('📴 [SocketProvider] ARAMA BİTTİ:', data);
      if (onCallEndedRef.current) {
        onCallEndedRef.current(data);
      }
    };

    // Event listener'ları ekle
    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('reconnect', handleReconnect);
    socket.on('registered', handleRegistered);
    
    socket.on('new_message', handleNewMessage);
    socket.on('new_offer', handleNewOffer);
    socket.on('offer_accepted', handleOfferAccepted);
    socket.on('offer_rejected', handleOfferRejected);
    socket.on('new_tag', handleNewTag);
    socket.on('tag_cancelled', handleTagCancelled);
    socket.on('trip_started', handleTripStarted);
    socket.on('trip_ended', handleTripEnded);
    socket.on('call_invite', handleCallInvite);
    socket.on('call_accepted', handleCallAccepted);
    socket.on('call_rejected', handleCallRejected);
    socket.on('call_ended', handleCallEnded);

    // Cleanup
    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('reconnect', handleReconnect);
      socket.off('registered', handleRegistered);
      socket.off('new_message', handleNewMessage);
      socket.off('new_offer', handleNewOffer);
      socket.off('offer_accepted', handleOfferAccepted);
      socket.off('offer_rejected', handleOfferRejected);
      socket.off('new_tag', handleNewTag);
      socket.off('tag_cancelled', handleTagCancelled);
      socket.off('trip_started', handleTripStarted);
      socket.off('trip_ended', handleTripEnded);
      socket.off('call_invite', handleCallInvite);
      socket.off('call_accepted', handleCallAccepted);
      socket.off('call_rejected', handleCallRejected);
      socket.off('call_ended', handleCallEnded);
    };
  }, []);

  // ══════════════════════════════════════════════════════════════════
  // APP STATE - Arka plan / Ön plan
  // ══════════════════════════════════════════════════════════════════
  
  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      const socket = socketRef.current;
      if (!socket) return;

      if (nextAppState === 'active') {
        console.log('📱 [SocketProvider] App ön plana geldi');
        if (!socket.connected) {
          socket.connect();
        }
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription.remove();
  }, []);

  // ══════════════════════════════════════════════════════════════════
  // BAĞLANTI YÖNETİMİ
  // ══════════════════════════════════════════════════════════════════
  
  const connectAndRegister = useCallback((userId: string, userRole: string) => {
    const socket = socketRef.current;
    if (!socket) {
      console.error('❌ [SocketProvider] Socket yok!');
      return;
    }
    
    // GUARD: Aynı kullanıcı zaten register edilmişse atla
    if (lastRegisteredUserId === userId && isSocketRegistered) {
      console.log('⏭️ [SocketProvider] Aynı kullanıcı zaten kayıtlı, atlanıyor:', userId);
      return;
    }
    
    // GUARD: Register işlemi devam ediyorsa atla
    if (registerInProgress) {
      console.log('⏭️ [SocketProvider] Register işlemi devam ediyor, atlanıyor');
      return;
    }
    
    console.log('🔌 [SocketProvider] connectAndRegister:', userId, userRole);
    
    userIdRef.current = userId;
    userRoleRef.current = userRole;
    registerInProgress = true;
    
    if (!socket.connected) {
      console.log('🔌 [SocketProvider] Socket bağlanıyor...');
      socket.connect();
    } else {
      // Zaten bağlıysa direkt register
      console.log('📱 [SocketProvider] Zaten bağlı, register yapılıyor...');
      socket.emit('register', { user_id: userId, role: userRole });
      lastRegisteredUserId = userId;
    }
  }, []);

  const disconnect = useCallback(() => {
    const socket = socketRef.current;
    if (socket?.connected) {
      socket.disconnect();
    }
    setIsConnected(false);
    setIsRegistered(false);
    isSocketRegistered = false;
  }, []);

  // ══════════════════════════════════════════════════════════════════
  // EMIT FONKSİYONLARI - SADECE KAYITLIYSA ÇALIŞIR
  // ══════════════════════════════════════════════════════════════════
  
  const safeEmit = useCallback((event: string, data: any) => {
    const socket = socketRef.current;
    
    if (!socket) {
      console.error(`❌ [SocketProvider] Socket YOK! Event: ${event}`);
      return false;
    }
    
    if (!socket.connected) {
      console.error(`❌ [SocketProvider] Socket BAĞLI DEĞİL! Event: ${event}`);
      return false;
    }
    
    if (!isSocketRegistered) {
      console.error(`❌ [SocketProvider] Socket KAYITLI DEĞİL! Event: ${event}`);
      return false;
    }
    
    console.log(`📤 [SocketProvider] EMIT: ${event}`, JSON.stringify(data).substring(0, 100));
    socket.emit(event, data);
    return true;
  }, []);

  // Teklif sistemi
  const emitSendOffer = useCallback((data: any) => {
    safeEmit('send_offer', data);
  }, [safeEmit]);

  const emitAcceptOffer = useCallback((data: any) => {
    safeEmit('accept_offer', data);
  }, [safeEmit]);

  const emitRejectOffer = useCallback((data: any) => {
    safeEmit('reject_offer', data);
  }, [safeEmit]);

  // TAG sistemi
  const emitCreateTagRequest = useCallback((data: any) => {
    safeEmit('create_tag_request', data);
  }, [safeEmit]);

  const emitCancelTagRequest = useCallback((data: any) => {
    safeEmit('cancel_tag_request', data);
  }, [safeEmit]);

  // Konum
  const emitDriverLocationUpdate = useCallback((data: any) => {
    safeEmit('driver_location_update', data);
  }, [safeEmit]);

  const emitLocationUpdate = useCallback((data: any) => {
    safeEmit('location_update', data);
  }, [safeEmit]);

  // Yolculuk
  const emitTripStarted = useCallback((data: any) => {
    safeEmit('trip_started', data);
  }, [safeEmit]);

  const emitTripEnded = useCallback((data: any) => {
    safeEmit('trip_ended', data);
  }, [safeEmit]);

  const forceEndTrip = useCallback((data: any) => {
    safeEmit('force_end_trip', data);
  }, [safeEmit]);

  // Arama
  const emitCallInvite = useCallback((data: any) => {
    safeEmit('call_invite', data);
  }, [safeEmit]);

  const emitCallAccept = useCallback((data: any) => {
    safeEmit('call_accept', data);
  }, [safeEmit]);

  const emitCallReject = useCallback((data: any) => {
    safeEmit('call_reject', data);
  }, [safeEmit]);

  const emitCallCancel = useCallback((data: any) => {
    safeEmit('call_cancel', data);
  }, [safeEmit]);

  const emitCallEnd = useCallback((data: any) => {
    safeEmit('call_end', data);
  }, [safeEmit]);

  // 🆕 MESAJLAŞMA
  const emitSendMessage = useCallback((data: any) => {
    console.log('💬 [SocketProvider] emitSendMessage çağrıldı:', data);
    const result = safeEmit('send_message', data);
    if (result) {
      console.log('✅ [SocketProvider] send_message EMIT EDİLDİ!');
    }
  }, [safeEmit]);

  // ══════════════════════════════════════════════════════════════════
  // CALLBACK SETTERS
  // ══════════════════════════════════════════════════════════════════
  
  const setOnNewMessage = useCallback((callback: ((data: any) => void) | null) => {
    onNewMessageRef.current = callback;
  }, []);
  
  const setOnNewOffer = useCallback((callback: ((data: any) => void) | null) => {
    onNewOfferRef.current = callback;
  }, []);
  
  const setOnOfferAccepted = useCallback((callback: ((data: any) => void) | null) => {
    onOfferAcceptedRef.current = callback;
  }, []);
  
  const setOnOfferRejected = useCallback((callback: ((data: any) => void) | null) => {
    onOfferRejectedRef.current = callback;
  }, []);
  
  const setOnNewTag = useCallback((callback: ((data: any) => void) | null) => {
    onNewTagRef.current = callback;
  }, []);
  
  const setOnTagCancelled = useCallback((callback: ((data: any) => void) | null) => {
    onTagCancelledRef.current = callback;
  }, []);
  
  const setOnTripStarted = useCallback((callback: ((data: any) => void) | null) => {
    onTripStartedRef.current = callback;
  }, []);
  
  const setOnTripEnded = useCallback((callback: ((data: any) => void) | null) => {
    onTripEndedRef.current = callback;
  }, []);
  
  const setOnCallInvite = useCallback((callback: ((data: any) => void) | null) => {
    onCallInviteRef.current = callback;
  }, []);
  
  const setOnCallAccepted = useCallback((callback: ((data: any) => void) | null) => {
    onCallAcceptedRef.current = callback;
  }, []);
  
  const setOnCallRejected = useCallback((callback: ((data: any) => void) | null) => {
    onCallRejectedRef.current = callback;
  }, []);
  
  const setOnCallEnded = useCallback((callback: ((data: any) => void) | null) => {
    onCallEndedRef.current = callback;
  }, []);

  // ══════════════════════════════════════════════════════════════════
  // CONTEXT VALUE
  // ══════════════════════════════════════════════════════════════════
  
  const value: SocketContextType = {
    socket: socketRef.current,
    isConnected,
    isRegistered,
    
    connectAndRegister,
    disconnect,
    
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
    
    emitSendMessage,
    
    setOnNewMessage,
    setOnNewOffer,
    setOnOfferAccepted,
    setOnOfferRejected,
    setOnNewTag,
    setOnTagCancelled,
    setOnTripStarted,
    setOnTripEnded,
    setOnCallInvite,
    setOnCallAccepted,
    setOnCallRejected,
    setOnCallEnded,
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
    throw new Error('useSocketContext must be used within a SocketProvider');
  }
  return context;
}

export default SocketContext;
