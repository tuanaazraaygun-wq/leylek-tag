/**
 * useSocket - Socket.IO Hook for Real-time Communication
 * 
 * ÖZELLIKLER:
 * - Arama sinyalleri (call_user, incoming_call, accept, reject, end)
 * - TAG sistemi (new_tag, cancel_tag, tag_created, tag_cancelled)
 * - Teklif sistemi (send_offer, accept_offer, reject_offer)
 * - Konum takibi (location_update)
 * - Yolculuk yönetimi (trip_started, trip_ended)
 */

import { useEffect, useRef, useCallback, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { AppState, AppStateStatus } from 'react-native';

// Socket.IO Sunucusu
const SOCKET_URL = 'https://socket.leylektag.com';
const SOCKET_PATH = '/socket.io';

console.log('🔌 Socket URL:', SOCKET_URL);

// ════════════════════════════════════════════════════════════════════
// INTERFACES
// ════════════════════════════════════════════════════════════════════

interface CallData {
  call_id: string;
  caller_id: string;
  caller_name: string;
  receiver_id: string;
  channel_name: string;
  agora_token: string;
  call_type: 'audio' | 'video';
}

interface TagData {
  tag_id: string;
  passenger_id: string;
  passenger_name?: string;
  pickup_lat: number;
  pickup_lng: number;
  pickup_address?: string;
  dropoff_lat?: number;
  dropoff_lng?: number;
  dropoff_address?: string;
  city?: string;
  status?: string;
}

interface OfferData {
  offer_id?: string;
  tag_id: string;
  driver_id: string;
  driver_name?: string;
  passenger_id: string;
  price?: number;
  eta_minutes?: number;
  distance_km?: number;
}

interface LocationData {
  user_id: string;
  latitude: number;
  longitude: number;
  target_id?: string;
}

interface UseSocketProps {
  userId: string | null;
  userRole?: 'passenger' | 'driver' | null;
  // Arama eventleri
  onIncomingCall?: (data: CallData) => void;
  onCallAccepted?: (data: { call_id: string; accepted_by: string }) => void;
  onCallRejected?: (data: { call_id: string; rejected_by: string }) => void;
  onCallEnded?: (data: { call_id: string; ended_by: string }) => void;
  onCallRinging?: (data: { success: boolean; receiver_online: boolean; reason?: string }) => void;
  // TAG eventleri
  onTagCreated?: (data: TagData) => void;
  onTagCancelled?: (data: { tag_id: string }) => void;
  onTagUpdated?: (data: TagData) => void;
  onTagMatched?: (data: { tag_id: string; driver_id: string }) => void;
  // Teklif eventleri
  onNewOffer?: (data: OfferData) => void;
  onOfferAccepted?: (data: OfferData) => void;
  onOfferRejected?: (data: OfferData) => void;
  onOfferSentAck?: (data: { success: boolean; passenger_online: boolean }) => void;
  // Konum eventleri
  onLocationUpdated?: (data: LocationData) => void;
  // Yolculuk eventleri
  onTripStarted?: (data: { tag_id: string; passenger_id: string; driver_id: string }) => void;
  onTripEnded?: (data: { tag_id: string }) => void;
  onTripEndRequested?: (data: { tag_id: string; requester_id: string }) => void;
  onTripEndResponse?: (data: { tag_id: string; accepted: boolean }) => void;
}

export default function useSocket({
  userId,
  userRole,
  onIncomingCall,
  onCallAccepted,
  onCallRejected,
  onCallEnded,
  onCallRinging,
  onTagCreated,
  onTagCancelled,
  onTagUpdated,
  onTagMatched,
  onNewOffer,
  onOfferAccepted,
  onOfferRejected,
  onOfferSentAck,
  onLocationUpdated,
  onTripStarted,
  onTripEnded,
  onTripEndRequested,
  onTripEndResponse,
}: UseSocketProps) {
  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isRegistered, setIsRegistered] = useState(false);
  const reconnectAttempts = useRef(0);

  // ════════════════════════════════════════════════════════════════════
  // BAĞLANTI YÖNETİMİ
  // ════════════════════════════════════════════════════════════════════

  const connect = useCallback(() => {
    if (socketRef.current?.connected) {
      console.log('🔌 Socket zaten bağlı');
      return;
    }

    console.log('🔌 Socket.IO bağlanıyor...');

    const socket = io(SOCKET_URL, {
      path: SOCKET_PATH,
      transports: ['websocket', 'polling'],
      forceNew: true,
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      timeout: 20000,
    });

    // ══════════ BAĞLANTI EVENTLERİ ══════════
    
    socket.on('connect', () => {
      console.log('✅ Socket.IO bağlandı:', socket.id);
      setIsConnected(true);
      reconnectAttempts.current = 0;

      if (userId) {
        console.log('📱 Register gönderiliyor:', userId, 'Role:', userRole);
        socket.emit('register', { user_id: userId, role: userRole });
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

    // ══════════ ARAMA EVENTLERİ ══════════

    socket.on('incoming_call', (data: CallData) => {
      console.log('📞 GELEN ARAMA:', data);
      onIncomingCall?.(data);
    });

    socket.on('call_accepted', (data) => {
      console.log('✅ ARAMA KABUL EDİLDİ:', data);
      onCallAccepted?.(data);
    });

    socket.on('call_rejected', (data) => {
      console.log('❌ ARAMA REDDEDİLDİ:', data);
      onCallRejected?.(data);
    });

    socket.on('call_ended', (data) => {
      console.log('📴 ARAMA SONLANDIRILDI:', data);
      onCallEnded?.(data);
    });

    socket.on('call_ringing', (data) => {
      console.log('🔔 ARAMA ÇALIYOR:', data);
      onCallRinging?.(data);
    });

    // ══════════ TAG EVENTLERİ ══════════

    socket.on('tag_created', (data: TagData) => {
      console.log('🏷️ YENİ TAG:', data);
      onTagCreated?.(data);
    });

    socket.on('tag_cancelled', (data) => {
      console.log('🚫 TAG İPTAL:', data);
      onTagCancelled?.(data);
    });

    socket.on('tag_updated', (data: TagData) => {
      console.log('🔄 TAG GÜNCELLENDİ:', data);
      onTagUpdated?.(data);
    });

    socket.on('tag_matched', (data) => {
      console.log('🤝 TAG EŞLEŞTİ:', data);
      onTagMatched?.(data);
    });

    socket.on('tag_created_ack', (data) => {
      console.log('✅ TAG ACK:', data);
    });

    // ══════════ TEKLİF EVENTLERİ ══════════

    socket.on('new_offer', (data: OfferData) => {
      console.log('💰 YENİ TEKLİF:', data);
      onNewOffer?.(data);
    });

    socket.on('offer_accepted', (data: OfferData) => {
      console.log('✅ TEKLİF KABUL EDİLDİ:', data);
      onOfferAccepted?.(data);
    });

    socket.on('offer_rejected', (data: OfferData) => {
      console.log('❌ TEKLİF REDDEDİLDİ:', data);
      onOfferRejected?.(data);
    });

    socket.on('offer_sent_ack', (data) => {
      console.log('📤 TEKLİF GÖNDERİLDİ ACK:', data);
      onOfferSentAck?.(data);
    });

    // ══════════ KONUM EVENTLERİ ══════════

    socket.on('location_updated', (data: LocationData) => {
      // Çok sık log basmasın
      onLocationUpdated?.(data);
    });

    // ══════════ YOLCULUK EVENTLERİ ══════════

    socket.on('trip_started', (data) => {
      console.log('🚗 YOLCULUK BAŞLADI:', data);
      onTripStarted?.(data);
    });

    socket.on('trip_ended', (data) => {
      console.log('🏁 YOLCULUK BİTTİ:', data);
      onTripEnded?.(data);
    });

    socket.on('trip_end_requested', (data) => {
      console.log('🛑 YOLCULUK BİTİRME TALEBİ:', data);
      onTripEndRequested?.(data);
    });

    socket.on('trip_end_response', (data) => {
      console.log('📝 YOLCULUK BİTİRME YANITI:', data);
      onTripEndResponse?.(data);
    });

    socketRef.current = socket;
  }, [userId, userRole, onIncomingCall, onCallAccepted, onCallRejected, onCallEnded, onCallRinging,
      onTagCreated, onTagCancelled, onTagUpdated, onTagMatched, onNewOffer, onOfferAccepted, 
      onOfferRejected, onOfferSentAck, onLocationUpdated, onTripStarted, onTripEnded,
      onTripEndRequested, onTripEndResponse]);

  const disconnect = useCallback(() => {
    if (socketRef.current) {
      console.log('🔌 Socket.IO bağlantısı kesiliyor...');
      socketRef.current.disconnect();
      socketRef.current = null;
      setIsConnected(false);
      setIsRegistered(false);
    }
  }, []);

  const registerUser = useCallback((uid: string, role?: string) => {
    if (socketRef.current?.connected) {
      console.log('📱 Kullanıcı kaydediliyor:', uid, role);
      socketRef.current.emit('register', { user_id: uid, role });
    }
  }, []);

  // ════════════════════════════════════════════════════════════════════
  // ARAMA FONKSİYONLARI
  // ════════════════════════════════════════════════════════════════════

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
      console.error('❌ Socket bağlı değil');
    }
  }, []);

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

  // ════════════════════════════════════════════════════════════════════
  // TAG FONKSİYONLARI
  // ════════════════════════════════════════════════════════════════════

  const emitNewTag = useCallback((data: TagData) => {
    if (socketRef.current?.connected) {
      console.log('🏷️ Yeni TAG yayınlanıyor:', data);
      socketRef.current.emit('new_tag', data);
    } else {
      console.error('❌ Socket bağlı değil, TAG yayınlanamadı');
    }
  }, []);

  const emitCancelTag = useCallback((tagId: string) => {
    if (socketRef.current?.connected) {
      console.log('🚫 TAG iptal ediliyor:', tagId);
      socketRef.current.emit('cancel_tag', { tag_id: tagId });
    }
  }, []);

  const emitUpdateTag = useCallback((data: Partial<TagData> & { tag_id: string }) => {
    if (socketRef.current?.connected) {
      console.log('🔄 TAG güncelleniyor:', data);
      socketRef.current.emit('update_tag', data);
    }
  }, []);

  // ════════════════════════════════════════════════════════════════════
  // TEKLİF FONKSİYONLARI
  // ════════════════════════════════════════════════════════════════════

  const emitSendOffer = useCallback((data: OfferData) => {
    if (socketRef.current?.connected) {
      console.log('💰 Teklif gönderiliyor:', data);
      socketRef.current.emit('send_offer', data);
    } else {
      console.error('❌ Socket bağlı değil, teklif gönderilemedi');
    }
  }, []);

  const emitAcceptOffer = useCallback((data: OfferData) => {
    if (socketRef.current?.connected) {
      console.log('✅ Teklif kabul ediliyor:', data);
      socketRef.current.emit('accept_offer', data);
    }
  }, []);

  const emitRejectOffer = useCallback((data: { driver_id: string; tag_id: string }) => {
    if (socketRef.current?.connected) {
      console.log('❌ Teklif reddediliyor:', data);
      socketRef.current.emit('reject_offer', data);
    }
  }, []);

  // ════════════════════════════════════════════════════════════════════
  // KONUM FONKSİYONLARI
  // ════════════════════════════════════════════════════════════════════

  const emitLocationUpdate = useCallback((data: LocationData) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('location_update', data);
    }
  }, []);

  const subscribeToLocation = useCallback((targetId: string) => {
    if (socketRef.current?.connected && userId) {
      console.log('📍 Konum takibi başlatılıyor:', targetId);
      socketRef.current.emit('subscribe_location', { 
        target_id: targetId,
        subscriber_id: userId 
      });
    }
  }, [userId]);

  // ════════════════════════════════════════════════════════════════════
  // YOLCULUK FONKSİYONLARI
  // ════════════════════════════════════════════════════════════════════

  const emitTripStarted = useCallback((data: { 
    tag_id: string; 
    passenger_id: string; 
    driver_id: string 
  }) => {
    if (socketRef.current?.connected) {
      console.log('🚗 Yolculuk başladı yayınlanıyor:', data);
      socketRef.current.emit('trip_started', data);
    }
  }, []);

  const emitTripEnded = useCallback((data: { 
    tag_id: string; 
    passenger_id: string; 
    driver_id: string 
  }) => {
    if (socketRef.current?.connected) {
      console.log('🏁 Yolculuk bitti yayınlanıyor:', data);
      socketRef.current.emit('trip_ended', data);
    }
  }, []);

  const requestTripEnd = useCallback((data: {
    tag_id: string;
    requester_id: string;
    target_id: string;
  }) => {
    if (socketRef.current?.connected) {
      console.log('🛑 Trip end request gönderiliyor:', data);
      socketRef.current.emit('request_trip_end', data);
    }
  }, []);

  const respondTripEnd = useCallback((data: {
    tag_id: string;
    accepted: boolean;
    target_id: string;
  }) => {
    if (socketRef.current?.connected) {
      console.log('📝 Trip end response gönderiliyor:', data);
      socketRef.current.emit('respond_trip_end', data);
    }
  }, []);

  // ════════════════════════════════════════════════════════════════════
  // EFFECTS
  // ════════════════════════════════════════════════════════════════════

  // App state değişikliklerini dinle
  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active') {
        if (!socketRef.current?.connected && userId) {
          console.log('📱 Uygulama aktif, Socket.IO yeniden bağlanıyor...');
          connect();
        }
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription.remove();
  }, [userId, connect]);

  // Kullanıcı değiştiğinde bağlan
  useEffect(() => {
    if (userId) {
      connect();
      if (socketRef.current?.connected) {
        socketRef.current.emit('register', { user_id: userId, role: userRole });
      }
    } else {
      disconnect();
    }
  }, [userId, userRole, connect, disconnect]);

  return {
    socket: socketRef.current,
    isConnected,
    isRegistered,
    // Bağlantı
    connect,
    disconnect,
    registerUser,
    // Arama
    startCall,
    acceptCall,
    rejectCall,
    endCall,
    // TAG
    emitNewTag,
    emitCancelTag,
    emitUpdateTag,
    // Teklif
    emitSendOffer,
    emitAcceptOffer,
    emitRejectOffer,
    // Konum
    emitLocationUpdate,
    subscribeToLocation,
    // Yolculuk
    emitTripStarted,
    emitTripEnded,
    requestTripEnd,
    respondTripEnd,
  };
}
