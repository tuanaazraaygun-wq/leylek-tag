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
let pingInterval: NodeJS.Timeout | null = null;

function getOrCreateSocket(): Socket {
  if (!singletonSocket) {
    console.log('🔌 [SocketContext] Singleton socket oluşturuluyor...');
    singletonSocket = io(SOCKET_URL, {
      path: '/socket.io',
      transports: ['websocket', 'polling'],  // WebSocket öncelikli, polling fallback
      forceNew: false,
      reconnection: true,
      reconnectionAttempts: Infinity,       // Sonsuz deneme
      reconnectionDelay: 500,               // 🔥 Daha hızlı başla (0.5 saniye)
      reconnectionDelayMax: 3000,           // 🔥 Max 3 saniye bekle
      randomizationFactor: 0.3,             // Rastgelelik ekle
      timeout: 30000,                       // 🔥 30 saniye timeout
      autoConnect: true,                    // 🔥 HEMEN BAĞLAN - bekletme!
    });
    
    let reconnectAttempts = 0;
    
    // Temel bağlantı logları
    singletonSocket.on('connect', () => {
      console.log('✅ [SocketContext] Socket bağlandı:', singletonSocket?.id);
      reconnectAttempts = 0; // Reset
      
      // 🔥 HEARTBEAT mekanizması - bağlantıyı canlı tut
      if (pingInterval) clearInterval(pingInterval);
      pingInterval = setInterval(() => {
        if (singletonSocket?.connected) {
          singletonSocket.emit('heartbeat', { timestamp: Date.now() });
        }
      }, 20000); // Her 20 saniyede heartbeat
    });
    
    singletonSocket.on('disconnect', (reason) => {
      console.log('⚠️ [SocketContext] Socket koptu:', reason);
      
      // Heartbeat'i durdur
      if (pingInterval) {
        clearInterval(pingInterval);
        pingInterval = null;
      }
      
      // 🔥 Agresif yeniden bağlanma stratejisi
      if (reason === 'io server disconnect') {
        // Server bizi attı - hemen bağlan
        console.log('🔄 [SocketContext] Server disconnect - hemen bağlanılıyor...');
        singletonSocket?.connect();
      } else if (reason === 'transport close' || reason === 'transport error') {
        // Transport sorunu - kademeli bekleme
        reconnectAttempts++;
        const delay = Math.min(500 * reconnectAttempts, 3000);
        console.log(`🔄 [SocketContext] Transport error - ${delay}ms sonra bağlanılıyor (attempt: ${reconnectAttempts})`);
        setTimeout(() => {
          if (singletonSocket && !singletonSocket.connected) {
            singletonSocket.connect();
          }
        }, delay);
      } else if (reason === 'ping timeout') {
        // Ping timeout - hemen bağlan
        console.log('🔄 [SocketContext] Ping timeout - hemen bağlanılıyor...');
        singletonSocket?.connect();
      }
      // 'io client disconnect' durumunda otomatik bağlanmıyoruz (kullanıcı kasten kapattı)
    });
    
    singletonSocket.on('reconnect', (attemptNumber) => {
      console.log('🔄 [SocketContext] Reconnect başarılı, attempt:', attemptNumber);
      reconnectAttempts = 0;
    });
    
    singletonSocket.on('reconnect_attempt', (attemptNumber) => {
      console.log(`🔄 [SocketContext] Reconnect deneme #${attemptNumber}`);
    });
    
    singletonSocket.on('reconnect_error', (error) => {
      console.error('❌ [SocketContext] Reconnect hatası:', error.message);
    });
    
    singletonSocket.on('connect_error', (error) => {
      console.error('❌ [SocketContext] Bağlantı hatası:', error.message);
      // 🔥 Bağlantı hatası durumunda transport'u değiştir
      if (singletonSocket) {
        const currentTransport = singletonSocket.io.opts.transports;
        if (currentTransport && currentTransport[0] === 'websocket') {
          console.log('🔄 [SocketContext] Polling\'e geçiliyor...');
          // Polling'i öne al
          singletonSocket.io.opts.transports = ['polling', 'websocket'];
        }
      }
    });
    
    singletonSocket.on('registered', (data) => {
      console.log('✅ [SocketContext] Kayıt başarılı:', data);
    });
    
    // 🔥 Server'dan pong gelirse logla
    singletonSocket.on('pong_keepalive', () => {
      // Sessiz - sadece bağlantı canlı
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
  
  // 🔥 GELEN ARAMA - MERKEZİ STATE
  incomingCallData: {
    callerId: string;
    callerName: string;
    callType: 'audio' | 'video';
    roomUrl: string;
    roomName: string;
    tagId: string;
  } | null;
  clearIncomingCall: () => void;
  // 🔥 REF GETTER - Callback'lerde güncel veri için!
  getIncomingCallData: () => {
    callerId: string;
    callerName: string;
    callType: 'audio' | 'video';
    roomUrl: string;
    roomName: string;
    tagId: string;
  } | null;
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
  
  // 🔥 GELEN ARAMA STATE - Direkt burada!
  const [incomingCallData, setIncomingCallData] = useState<{
    callerId: string;
    callerName: string;
    callType: 'audio' | 'video';
    roomUrl: string;
    roomName: string;
    tagId: string;
  } | null>(null);
  
  // 🔥 REF - Callback'lerde güncel veri için!
  const incomingCallDataRef = useRef<typeof incomingCallData>(null);
  
  const socketRef = useRef<Socket | null>(null);
  const userIdRef = useRef<string | null>(null);
  const userRoleRef = useRef<string | null>(null);

  // 🔥 Refs'i güncelle (closure sorununu önlemek için)
  useEffect(() => {
    incomingCallDataRef.current = incomingCallData;
  }, [incomingCallData]);
  
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
    
    // 🔥 GELEN ARAMA - DİREKT DİNLE!
    const handleIncomingCall = (data: any) => {
      console.log('🔔🔔🔔 [SocketProvider] GELEN ARAMA!', data);
      console.log('   room_url:', data.room_url);
      console.log('   room_name:', data.room_name);
      console.log('   is_ringing:', data.is_ringing);
      
      // 🔥 AKILLI GÜNCELLEME: Mevcut veriyle merge et
      const currentData = incomingCallDataRef.current;
      
      // Eğer yeni event daha fazla bilgi içeriyorsa (room_url var) kullan
      // Aksi halde mevcut veriyi koru ama eksik alanları güncelle
      const newRoomUrl = data.room_url || currentData?.roomUrl || '';
      const newRoomName = data.room_name || currentData?.roomName || '';
      
      const newCallData = {
        callerId: data.caller_id || currentData?.callerId || '',
        callerName: data.caller_name || currentData?.callerName || 'Bilinmeyen',
        callType: data.call_type || currentData?.callType || 'audio',
        roomUrl: newRoomUrl,
        roomName: newRoomName,
        tagId: data.tag_id || currentData?.tagId || '',
      };
      
      // 🔥 KRITIK: Hem state hem ref'i AYNI ANDA güncelle!
      setIncomingCallData(newCallData);
      incomingCallDataRef.current = newCallData;
      
      console.log('✅ [SocketProvider] incomingCallData güncellendi:');
      console.log('   roomUrl:', newCallData.roomUrl);
      console.log('   roomName:', newCallData.roomName);
    };
    socket.on('incoming_daily_call', handleIncomingCall);

    // Cleanup - AMA SOCKET'İ KAPATMA!
    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('reconnect', handleReconnect);
      socket.off('registered', handleRegistered);
      socket.off('incoming_daily_call', handleIncomingCall);
      // Socket'i KAPATMIYORUZ - singleton kalıcı
    };
  }, []);

  // ══════════════════════════════════════════════════════════════════
  // APP STATE - Arka plan / Ön plan - 🔥 GELİŞTİRİLMİŞ
  // ══════════════════════════════════════════════════════════════════
  
  useEffect(() => {
    let backgroundTimer: NodeJS.Timeout | null = null;
    let lastActiveTime = Date.now();
    
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      const socket = socketRef.current;
      
      if (nextAppState === 'active') {
        console.log('📱 [SocketProvider] App aktif oldu');
        
        // Arka plan timer'ını temizle
        if (backgroundTimer) {
          clearTimeout(backgroundTimer);
          backgroundTimer = null;
        }
        
        const backgroundDuration = Date.now() - lastActiveTime;
        console.log(`📱 [SocketProvider] Arka planda ${Math.round(backgroundDuration / 1000)} saniye kaldı`);
        
        if (socket) {
          if (!socket.connected) {
            // 🔥 Bağlı değilse HEMEN bağlan
            console.log('🔄 [SocketProvider] Socket bağlı değil, bağlanıyor...');
            socket.connect();
          } else {
            // 🔥 Bağlıysa bile 30 saniyeden fazla arka plandaysa yeniden register ol
            if (backgroundDuration > 30000 && userIdRef.current && userRoleRef.current) {
              console.log('📱 [SocketProvider] Uzun arka plan süresi, re-register yapılıyor...');
              socket.emit('register', { user_id: userIdRef.current, role: userRoleRef.current });
            }
          }
        }
        
        lastActiveTime = Date.now();
        
      } else if (nextAppState === 'background') {
        console.log('📱 [SocketProvider] App arka plana alındı');
        lastActiveTime = Date.now();
        
        // 🔥 Arka planda 2 dakikadan fazla kalırsa socket'i koru ama periodic ping at
        // (Socket'i kapatmıyoruz - sadece izliyoruz)
        
      } else if (nextAppState === 'inactive') {
        console.log('📱 [SocketProvider] App inactive');
        // iOS'ta geçici durum - bir şey yapma
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => {
      subscription.remove();
      if (backgroundTimer) clearTimeout(backgroundTimer);
    };
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

  // 🆕 Mesajlaşma - Socket connected kontrolü OLMADAN direkt emit
  const emitSendMessage = useCallback((data: any) => {
    const socket = getOrCreateSocket();
    console.log('💬 [SocketProvider] emitSendMessage:', JSON.stringify(data).substring(0, 100));
    console.log('💬 [SocketProvider] Socket connected:', socket.connected);
    
    // Bağlı değilse bağlan
    if (!socket.connected) {
      console.log('🔌 [SocketProvider] Socket bağlı değil, bağlanıyor...');
      socket.connect();
    }
    
    // Her durumda emit yap - Socket.IO buffer'a alır
    socket.emit('send_message', data);
    console.log('✅ [SocketProvider] send_message emit edildi!');
  }, []);

  // 🔥 GELEN ARAMA TEMİZLE - Kabul/Red/İptal sonrası çağır
  const clearIncomingCall = useCallback(() => {
    console.log('🧹 [SocketProvider] Gelen arama temizlendi');
    setIncomingCallData(null);
    incomingCallDataRef.current = null;  // 🔥 Ref'i de temizle!
  }, []);

  // 🔥 REF GETTER - Callback'lerde güncel veri için!
  const getIncomingCallData = useCallback(() => {
    return incomingCallDataRef.current;
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
    // 🔥 GELEN ARAMA - MERKEZİ STATE
    incomingCallData,
    clearIncomingCall,
    getIncomingCallData,  // 🔥 REF GETTER
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
