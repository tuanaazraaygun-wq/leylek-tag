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
import { BACKEND_BASE_URL } from '../lib/backendConfig';
import { waitForPersistedAccessToken } from '../lib/sessionToken';
import { setSocketRegisterScheduler } from '../lib/socketRegisterScheduler';
import { publishSocketSessionRefresh } from '../lib/socketSessionRefresh';
import { useNotifications } from './NotificationContext';

// REST ile aynı origin (lib/backendConfig) — ayrı sunucu = teklif görünmez
const SOCKET_URL = BACKEND_BASE_URL;

// ═══════════════════════════════════════════════════════════════════
// EMIT WITH LOG - Debug için tüm emit'lerde kullanılabilir
// ═══════════════════════════════════════════════════════════════════
export const emitWithLog = (socket: Socket, event: string, payload: any) => {
  console.log('📤 EMIT:', event, payload);
  socket.emit(event, payload);
};

// ═══════════════════════════════════════════════════════════════════
// SINGLETON SOCKET - Modül seviyesinde TEK instance
// ═══════════════════════════════════════════════════════════════════
let singletonSocket: Socket | null = null;
let pingInterval: NodeJS.Timeout | null = null;
let lastRegisteredSocketSid: string | null = null;
let lastRegisteredSocketUserId: string | null = null;

export function getLastRegisteredSocketSid(): string | null {
  return lastRegisteredSocketSid;
}

export function getLastRegisteredSocketUserId(): string | null {
  return lastRegisteredSocketUserId;
}

export function getOrCreateSocket(): Socket {
  if (singletonSocket) {
    return singletonSocket;
  }

  console.log(
    '🔌 [SocketContext] Socket URL =',
    SOCKET_URL,
    '(app.json extra.backendUrl / EXPO_PUBLIC_BACKEND_URL — API ile aynı olmalı)'
  );

  singletonSocket = io(SOCKET_URL, {
    path: '/socket.io',
    transports: ['websocket', 'polling'],
    forceNew: false,
    autoConnect: true,
    reconnection: true,
    reconnectionAttempts: Number.POSITIVE_INFINITY,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    timeout: 20000,
  });

  singletonSocket.on('connect', () => {
    const id = singletonSocket?.id;
    console.log('[socket] connected', id);
    console.log(`[socket] connect sid=${id || 'null'}`);
    if (pingInterval) clearInterval(pingInterval);
    pingInterval = setInterval(() => {
      if (singletonSocket?.connected) {
        singletonSocket.emit('heartbeat', { timestamp: Date.now() });
      }
    }, 20000);
    publishSocketSessionRefresh('socket_connect');
  });

  singletonSocket.on('connect_error', (err) => {
    console.warn('❌ [SocketContext] connect_error:', err.message, '| SOCKET_URL=', SOCKET_URL, '| path=/socket.io');
    console.warn(
      '[SocketContext] nginx: /socket.io/ → socket_app (uvicorn socket_app, örn. 8001). /api/ ayrı porta gidiyorsa bile socket kök hostta /socket.io olmalı (BACKEND_BASE_URL’e /api eklemeyin). Örnek: deploy/nginx-api-socket-split.example.conf',
    );
  });

  singletonSocket.on('disconnect', (reason) => {
    console.log('[socket] disconnect', reason);
    console.log(`[socket] disconnect sid=${singletonSocket?.id || 'null'} reason=${String(reason || '')}`);
    lastRegisteredSocketSid = null;
    lastRegisteredSocketUserId = null;
    if (pingInterval) {
      clearInterval(pingInterval);
      pingInterval = null;
    }
    if (reason === 'io server disconnect') {
      singletonSocket?.connect();
    }
  });

  try {
    const mgr = singletonSocket.io;
    mgr.on('reconnect_attempt', (attempt: number) => {
      console.log('[socket] reconnect_attempt', attempt);
      console.log(`[socket] reconnect_attempt n=${attempt}`);
    });
    mgr.on('reconnect_error', (err: Error) => {
      console.warn('[socket] reconnect_error', err?.message || err);
    });
    mgr.on('reconnect_failed', () => {
      console.warn('[socket] reconnect_failed');
    });
  } catch (e) {
    console.warn('[socket] manager reconnect listeners:', e);
  }

  singletonSocket.on('reconnect', (attempt?: number) => {
    console.log('[socket] reconnect', { id: singletonSocket?.id, attempt });
    console.log(`[socket] reconnect sid=${singletonSocket?.id || 'null'}`);
    publishSocketSessionRefresh('socket_reconnect');
  });

  singletonSocket.on('pong_keepalive', () => {});

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
  /** Emit with console log for debugging outgoing events */
  emitWithLog: (event: string, payload: any, ack?: (response: any) => void) => void;
  
  // Teklif sistemi
  emitSendOffer: (data: any) => void;
  emitAcceptOffer: (data: any) => void;
  emitRejectOffer: (data: any) => void;
  /** Sürücü yolcu teklifini kabul — backend driver_accept_offer */
  emitDriverAcceptOffer: (data: { tag_id: string; driver_id: string; driver_name?: string }) => void;
  
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
  
  // 🆕 Mesajlaşma
  emitSendMessage: (data: any) => void;
  
  // 🔥 GELEN ARAMA - MERKEZİ STATE (Agora / voice)
  incomingCallData: {
    callerId: string;
    callerName: string;
    callType: 'audio' | 'video';
    callId: string;
    channelName: string;
    agoraToken: string;
    tagId: string;
  } | null;
  clearIncomingCall: () => void;
  getIncomingCallData: () => {
    callerId: string;
    callerName: string;
    callType: 'audio' | 'video';
    callId: string;
    channelName: string;
    agoraToken: string;
    tagId: string;
  } | null;
  /** incoming_call / push ile state yazıldığında artar — index’te CallScreen açmak için */
  incomingCallPresentToken: number;
  /**
   * App kökü (index) user / rol değiştikçe çağırır — connect() yalnızca dashboard’da olduğu için
   * login / role-select sırasında da userIdRef + userRoleRef güncel kalır.
   */
  syncSocketSessionFromApp: (patch: { userId?: string | null; role?: string | null }) => void;
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
    callId: string;
    channelName: string;
    agoraToken: string;
    tagId: string;
  } | null>(null);
  const [incomingCallPresentToken, setIncomingCallPresentToken] = useState(0);

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

  /** JWT + user_<id> room: token veya user ref’leri gecikirse birkaç kez dene (ilk açılış / reconnect / resume). */
  const registerGenRef = useRef(0);
  const registerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSocketIdRef = useRef<string | null>(null);
  /** Son register emit'inden sonra `registered` success ack geldi mi (watchdog için). */
  const registerAckOkRef = useRef(false);

  const scheduleSocketRegister = useCallback((reason: string) => {
    console.log('SCHEDULE_REGISTER_START', {
      reason,
      connected: socketRef.current?.connected ?? false,
      userId: userIdRef.current,
      role: userRoleRef.current,
    });
    registerGenRef.current += 1;
    const myGen = registerGenRef.current;
    if (registerTimerRef.current) {
      clearTimeout(registerTimerRef.current);
      registerTimerRef.current = null;
    }
    const maxAttempts = 80;
    const baseDelayMs = 400;
    const tryOnce = (attempt: number) => {
      void (async () => {
        if (myGen !== registerGenRef.current) {
          console.log('SCHEDULE_REGISTER_SKIP', {
            reason: 'stale_schedule_generation',
            userId: userIdRef.current,
            role: userRoleRef.current,
            connected: socketRef.current?.connected ?? false,
          });
          return;
        }
        const sock = socketRef.current;
        if (!sock?.connected) {
          if (attempt < maxAttempts) {
            console.log('SCHEDULE_REGISTER_SKIP', {
              reason: 'socket_not_connected_scheduling_retry',
              userId: userIdRef.current,
              role: userRoleRef.current,
              connected: false,
              attempt,
            });
            registerTimerRef.current = setTimeout(() => tryOnce(attempt + 1), baseDelayMs);
          } else {
            console.log('SCHEDULE_REGISTER_SKIP', {
              reason: 'socket_not_connected_max_attempts_exhausted',
              userId: userIdRef.current,
              role: userRoleRef.current,
              connected: false,
              attempt,
            });
          }
          return;
        }
        const uid = userIdRef.current;
        const role = userRoleRef.current;
        if (!uid || !role) {
          console.log('REGISTER_BLOCKED_MISSING_USER_OR_ROLE', {
            userId: userIdRef.current,
            role: userRoleRef.current,
          });
          return;
        }
        console.log('SCHEDULE_REGISTER_BEFORE_TOKEN', {
          userId: uid,
          role,
          reason,
          waitingForPersistedToken: true,
          maxWaitMs: 19 * 250,
        });
        const token = await waitForPersistedAccessToken();
        console.log('SCHEDULE_REGISTER_TOKEN_RESULT', {
          hasToken: !!token,
          userId: uid,
          role,
          reason,
          waitedForPersistedToken: true,
        });
        if (!token) {
          console.log('SCHEDULE_REGISTER_NO_TOKEN_FINAL', { userId: uid, role, reason });
          return;
        }
        if (myGen !== registerGenRef.current) {
          console.log('SCHEDULE_REGISTER_SKIP', {
            reason: 'stale_schedule_generation_after_token',
            userId: userIdRef.current,
            role: userRoleRef.current,
            connected: socketRef.current?.connected ?? false,
          });
          return;
        }
        if (attempt === 0) {
          console.log('FRONTEND_SOCKET_REGISTER_USER', { userId: uid, role, reason, attempt });
        } else {
          console.log('FRONTEND_SOCKET_REGISTER_RETRY', { userId: uid, role, reason, attempt });
        }
        registerAckOkRef.current = false;
        const registerPayload = { user_id: uid, token, role };
        console.log('SOCKET REGISTER EMIT', uid);
        console.log(`[socket] register emit sid=${sock.id || 'null'} user_id=${uid}`);
        console.log('REGISTER_EMIT_PAYLOAD', registerPayload);
        sock.emit('register', registerPayload);
        registerTimerRef.current = setTimeout(() => {
          if (myGen !== registerGenRef.current) return;
          if (!registerAckOkRef.current && socketRef.current?.connected && userIdRef.current && userRoleRef.current) {
            console.log('FRONTEND_SOCKET_REGISTER_RETRY', {
              userId: userIdRef.current,
              role: userRoleRef.current,
              reason: 'register_no_ack_within_8s',
            });
            scheduleSocketRegister('register_no_ack_within_8s');
          }
        }, 8000);
      })();
    };
    tryOnce(0);
  }, []);

  useEffect(() => {
    setSocketRegisterScheduler(scheduleSocketRegister);
    return () => setSocketRegisterScheduler(null);
  }, [scheduleSocketRegister]);

  /** Push / bildirim / socket: aynı payload şeması; arayan === ben ise yok say */
  const applyIncomingCallPayload = useCallback((data: any, source: string) => {
    if (!data || data.type !== 'incoming_call') return;
    const myId = userIdRef.current;
    const callerId = data.caller_id != null ? String(data.caller_id) : '';
    if (!callerId || (myId && callerId === String(myId))) {
      console.log(`🔕 [SocketProvider] ${source}: incoming_call yok sayıldı (kendi araması)`);
      return;
    }
    const callId = data.call_id != null ? String(data.call_id) : '';
    const channelName = data.channel_name != null ? String(data.channel_name) : '';
    if (!callId || !channelName) {
      console.warn(`⚠️ [SocketProvider] ${source}: call_id / channel_name eksik`);
      return;
    }
    const prev = incomingCallDataRef.current;
    if (prev?.callId === callId && prev?.callerId === callerId) return;

    const rawType = data.call_type || 'audio';
    const callType: 'audio' | 'video' = rawType === 'video' ? 'video' : 'audio';
    const newCallData = {
      callerId,
      callerName: data.caller_name != null ? String(data.caller_name) : 'Bilinmeyen',
      callType,
      callId,
      channelName,
      agoraToken: data.agora_token != null ? String(data.agora_token) : '',
      tagId: data.tag_id != null ? String(data.tag_id) : '',
    };
    console.log(`🔔 [SocketProvider] Gelen arama state güncellendi (${source})`, callId);
    setIncomingCallData(newCallData);
    incomingCallDataRef.current = newCallData;
    setIncomingCallPresentToken((n) => n + 1);
  }, []);

  const { notification, lastTappedNotificationData } = useNotifications();

  useEffect(() => {
    const data = notification?.request?.content?.data as Record<string, unknown> | undefined;
    if (data?.type === 'incoming_call') {
      applyIncomingCallPayload(data, 'push-foreground');
    }
  }, [notification, applyIncomingCallPayload]);

  useEffect(() => {
    const data = lastTappedNotificationData as Record<string, unknown> | null | undefined;
    if (data?.type === 'incoming_call') {
      applyIncomingCallPayload(data, 'push-tap');
    }
  }, [lastTappedNotificationData, applyIncomingCallPayload]);

  // ══════════════════════════════════════════════════════════════════
  // SOCKET SETUP - Bir kez
  // ══════════════════════════════════════════════════════════════════
  
  useEffect(() => {
    const socket = getOrCreateSocket();
    socketRef.current = socket;

    // Bağlantı durumu listener'ları
    const handleConnect = () => {
      console.log('HANDLE_CONNECT_START', {
        connected: socket.connected,
        hasUserIdRef: !!userIdRef.current,
        userId: userIdRef.current,
        role: userRoleRef.current,
      });
      scheduleSocketRegister('handle_connect_direct');
      const sid = socket.id ?? null;
      console.log('✅ [SocketProvider] Socket bağlandı:', sid);
      setIsConnected(true);
      setIsRegistered(false);
      registerAckOkRef.current = false;
      if (sid && lastSocketIdRef.current !== sid) {
        console.log('FRONTEND_SOCKET_ID_CHANGED', { socket_id: sid, prev: lastSocketIdRef.current });
        lastSocketIdRef.current = sid;
      } else if (sid) {
        lastSocketIdRef.current = sid;
      }
      scheduleSocketRegister('socket_connect');
    };

    const handleDisconnect = (reason: string) => {
      console.log('⚠️ [SocketProvider] Socket koptu:', reason);
      setIsConnected(false);
      setIsRegistered(false);
      lastSocketIdRef.current = null;
    };

    const handleReconnect = (attemptNumber: number) => {
      console.log('🔄 [SocketProvider] Reconnect başarılı, attempt:', attemptNumber);
      setIsRegistered(false);
      scheduleSocketRegister('socket_reconnect');
    };

    const handleRegistered = (data: any) => {
      console.log('FRONTEND_SOCKET_REGISTER_ACK', data);
      if (data?.success === true && data?.room) {
        registerAckOkRef.current = true;
        lastRegisteredSocketSid = socket.id ?? null;
        lastRegisteredSocketUserId =
          data?.resolved_user_id != null
            ? String(data.resolved_user_id)
            : data?.user_id != null
              ? String(data.user_id)
              : userIdRef.current;
        console.log(`[socket] registered sid=${lastRegisteredSocketSid || 'null'} user_id=${lastRegisteredSocketUserId || 'null'}`);
        setIsRegistered(true);
        if (registerTimerRef.current) {
          clearTimeout(registerTimerRef.current);
          registerTimerRef.current = null;
        }
        return;
      }
      registerAckOkRef.current = false;
      setIsRegistered(false);
      console.warn('⚠️ [SocketProvider] register başarısız veya room yok:', data);
      registerTimerRef.current = setTimeout(() => {
        scheduleSocketRegister('register_ack_failed');
      }, 1500);
    };

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('reconnect', handleReconnect);
    socket.on('registered', handleRegistered);
    
    // 🔥 GELEN ARAMA - DİREKT DİNLE!
    const handleIncomingCall = (data: any) => {
      console.log('🔔 [SocketProvider] GELEN ARAMA (incoming_call)', data);
      const myId = userIdRef.current;
      if (myId && data?.caller_id != null && String(data.caller_id) === String(myId)) {
        console.log('🔕 [SocketProvider] incoming_call yok sayıldı (socket: arayan kendisi)');
        return;
      }
      const currentData = incomingCallDataRef.current;
      const rawType = data.call_type || currentData?.callType || 'audio';
      const callType: 'audio' | 'video' = rawType === 'video' ? 'video' : 'audio';

      const newCallData = {
        callerId: data.caller_id || currentData?.callerId || '',
        callerName: data.caller_name || currentData?.callerName || 'Bilinmeyen',
        callType,
        callId: data.call_id || currentData?.callId || '',
        channelName: data.channel_name || currentData?.channelName || '',
        agoraToken: data.agora_token || currentData?.agoraToken || '',
        tagId: data.tag_id || currentData?.tagId || '',
      };

      setIncomingCallData(newCallData);
      incomingCallDataRef.current = newCallData;
      setIncomingCallPresentToken((n) => n + 1);
    };
    socket.on('incoming_call', handleIncomingCall);

    // Socket zaten bağlıysa `connect` bir daha tetiklenmez (ilk yükleme yarışı, Fast Refresh).
    // Her başarılı oturumda sunucuya register gitmesi için aynı yolu çalıştır.
    if (socket.connected) {
      handleConnect();
    }

    // Cleanup - AMA SOCKET'İ KAPATMA!
    return () => {
      if (registerTimerRef.current) {
        clearTimeout(registerTimerRef.current);
        registerTimerRef.current = null;
      }
      registerGenRef.current += 1;
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('reconnect', handleReconnect);
      socket.off('registered', handleRegistered);
      socket.off('incoming_call', handleIncomingCall);
      // Socket'i KAPATMIYORUZ - singleton kalıcı
    };
  }, [scheduleSocketRegister]);

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
            scheduleSocketRegister('app_foreground');
            publishSocketSessionRefresh('app_active');
            // 🔥 Bağlıysa bile 30 saniyeden fazla arka plandaysa yeniden register ol
            if (backgroundDuration > 30000 && userIdRef.current && userRoleRef.current) {
              console.log('📱 [SocketProvider] Uzun arka plan süresi, re-register yapılıyor...');
              scheduleSocketRegister('app_foreground_long_bg');
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
  }, [scheduleSocketRegister]);

  /** Bağlantı önce, kimlik sonra geldiyse veya ilk deneme bloklandıysa — state değişince mutlaka yeniden dene */
  useEffect(() => {
    if (!isConnected || !userId || !userRole) return;
    console.log('LATE_IDENTITY_RECOVERY_TRIGGER', {
      userId,
      role: userRole,
    });
    scheduleSocketRegister('late_identity_recovery');
  }, [isConnected, userId, userRole, scheduleSocketRegister]);

  // ══════════════════════════════════════════════════════════════════
  // CONNECT FONKSİYONU
  // ══════════════════════════════════════════════════════════════════
  
  const syncSocketSessionFromApp = useCallback(
    (patch: { userId?: string | null; role?: string | null }) => {
      let identityTouched = false;
      if (patch.userId !== undefined) {
        identityTouched = true;
        const id = patch.userId;
        if (id) console.log('USER_ID_REF_UPDATE', id);
        userIdRef.current = id ?? null;
        setUserId(id ?? null);
      }
      if (patch.role !== undefined) {
        identityTouched = true;
        const r = patch.role;
        if (r) console.log('USER_ROLE_REF_UPDATE', r);
        userRoleRef.current = r ?? null;
        setUserRole(r ?? null);
      }
      if (identityTouched) {
        scheduleSocketRegister('session_identity_sync');
      }
    },
    [scheduleSocketRegister]
  );

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
      console.log('🔌 [SocketProvider] Socket zaten bağlı, register planlanıyor...');
    }
    scheduleSocketRegister('connect_function');
  }, [scheduleSocketRegister]);

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

  const emitWithLogFromContext = useCallback((event: string, payload: any, ack?: (response: any) => void) => {
    const socket = getOrCreateSocket();
    const run = () => {
      console.log('📤 EMIT:', event, payload);
      if (typeof ack === 'function') {
        socket.emit(event, payload, ack);
      } else {
        socket.emit(event, payload);
      }
    };
    if (socket.connected) {
      run();
      return;
    }
    console.warn(`⚠️ [SocketProvider] Socket bağlı değil; connect sonrası emit: ${event}`);
    socket.connect();
    socket.once('connect', run);
  }, []);

  const emitSendOffer = useCallback((data: any) => {
    console.log('💰 [SocketProvider] emitSendOffer:', JSON.stringify(data));
    emit('send_offer', data);
  }, [emit]);

  /** Backend: @sio.on("driver_accept_offer") — bağlantı yoksa connect sonrası gönderilir */
  const emitDriverAcceptOffer = useCallback(
    (data: { tag_id: string; driver_id: string; driver_name?: string }) => {
      console.log('✅ [SocketProvider] driver_accept_offer:', data);
      emit('driver_accept_offer', data);
    },
    [emit]
  );

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
    emitWithLog: emitWithLogFromContext,
    emitSendOffer,
    emitDriverAcceptOffer,
    emitAcceptOffer,
    emitRejectOffer,
    emitCreateTagRequest,
    emitCancelTagRequest,
    emitDriverLocationUpdate,
    emitLocationUpdate,
    emitTripStarted,
    emitTripEnded,
    forceEndTrip,
    emitSendMessage,  // 🆕 Mesajlaşma
    // 🔥 GELEN ARAMA - MERKEZİ STATE
    incomingCallData,
    clearIncomingCall,
    getIncomingCallData,  // 🔥 REF GETTER
    incomingCallPresentToken,
    syncSocketSessionFromApp,
  };

  return <SocketContext.Provider value={value}>{children}</SocketContext.Provider>;
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
