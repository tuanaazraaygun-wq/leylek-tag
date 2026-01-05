/**
 * useSocket - Socket.IO Hook for Real-time Communication
 * 
 * v2.1 - DRIVER SOCKET FIX
 * - Socket connection GLOBAL ve KALICI
 * - forceNew: false - aynı socket instance kullanılır
 * - Cleanup'ta disconnect YOK
 * - Register her zaman yapılır
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

// 🔥 GLOBAL SOCKET INSTANCE - Tüm componentler arasında paylaşılır
let globalSocket: Socket | null = null;
let globalUserId: string | null = null;
let globalUserRole: string | null = null;

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
  // 🆕 Anlık bitirme eventi
  onTripForceEnded?: (data: { 
    tag_id: string; 
    ended_by: string; 
    ender_type: string;
    points_deducted: number;
    new_points?: number;
    new_rating?: number;
  }) => void;
  // 🆕 Daily.co Video/Audio Call eventleri
  onIncomingDailyCall?: (data: {
    room_url: string;
    room_name: string;
    caller_id: string;
    caller_name: string;
    call_type: 'video' | 'audio';
    tag_id: string;
  }) => void;
  // 🆕 YENİ: call_accepted - Her iki tarafa aynı anda gönderiliyor
  onCallAcceptedNew?: (data: {
    room_url: string;
    room_name: string;
    call_type: string;
    caller_id: string;
    receiver_id: string;
  }) => void;
  onDailyCallAccepted?: (data: { room_url: string; accepted: boolean }) => void;
  onDailyCallRejected?: (data: { rejected: boolean }) => void;
  onDailyCallEnded?: (data: { ended: boolean; room_name: string }) => void;
  // 🆕 YENİ: call_cancelled, call_ended
  onCallCancelled?: (data: { cancelled: boolean; by: string }) => void;
  onCallEndedNew?: (data: { ended: boolean; by: string; room_name: string }) => void;
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
  onTripForceEnded,
  onIncomingDailyCall,
  onCallAcceptedNew,
  onDailyCallAccepted,
  onDailyCallRejected,
  onDailyCallEnded,
  onCallCancelled,
  onCallEndedNew,
}: UseSocketProps) {
  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isRegistered, setIsRegistered] = useState(false);
  const reconnectAttempts = useRef(0);
  
  // Callback refs - dependency array'i küçültmek için
  const callbackRefs = useRef({
    onIncomingCall, onCallAccepted, onCallRejected, onCallEnded, onCallRinging,
    onTagCreated, onTagCancelled, onTagUpdated, onTagMatched, onNewOffer,
    onOfferAccepted, onOfferRejected, onOfferSentAck, onLocationUpdated,
    onTripStarted, onTripEnded, onTripEndRequested, onTripEndResponse,
    onTripForceEnded, onIncomingDailyCall, onCallAcceptedNew,
    onDailyCallAccepted, onDailyCallRejected, onDailyCallEnded,
    onCallCancelled, onCallEndedNew
  });
  
  // Callback'leri güncelle
  useEffect(() => {
    callbackRefs.current = {
      onIncomingCall, onCallAccepted, onCallRejected, onCallEnded, onCallRinging,
      onTagCreated, onTagCancelled, onTagUpdated, onTagMatched, onNewOffer,
      onOfferAccepted, onOfferRejected, onOfferSentAck, onLocationUpdated,
      onTripStarted, onTripEnded, onTripEndRequested, onTripEndResponse,
      onTripForceEnded, onIncomingDailyCall, onCallAcceptedNew,
      onDailyCallAccepted, onDailyCallRejected, onDailyCallEnded,
      onCallCancelled, onCallEndedNew
    };
  });

  // ════════════════════════════════════════════════════════════════════
  // BAĞLANTI YÖNETİMİ - GLOBAL SOCKET
  // ════════════════════════════════════════════════════════════════════

  const connect = useCallback(() => {
    // 🔥 Global socket varsa ve bağlıysa, yeniden bağlanma
    if (globalSocket?.connected) {
      console.log('🔌 Global socket zaten bağlı, register yapılıyor...');
      socketRef.current = globalSocket;
      setIsConnected(true);
      
      // Her zaman register yap
      if (userId) {
        console.log('📱 RE-REGISTER gönderiliyor:', userId, 'Role:', userRole);
        globalSocket.emit('register', { user_id: userId, role: userRole });
      }
      return;
    }

    console.log('🔌 Global Socket.IO bağlanıyor...');

    const socket = io(SOCKET_URL, {
      path: SOCKET_PATH,
      transports: ['websocket', 'polling'],
      forceNew: false,  // 🔥 KRITIK: Aynı socket instance kullan
      reconnection: true,
      reconnectionAttempts: Infinity,  // 🔥 Sonsuz reconnect
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000,
    });

    // ══════════ BAĞLANTI EVENTLERİ ══════════
    
    socket.on('connect', () => {
      console.log('✅ Socket.IO bağlandı:', socket.id);
      setIsConnected(true);
      reconnectAttempts.current = 0;

      // 🔥 ZORUNLU REGISTER - Her bağlantıda
      if (userId) {
        console.log('📱 REGISTER gönderiliyor (connect):', userId, 'Role:', userRole);
        socket.emit('register', { user_id: userId, role: userRole });
      }
    });

    socket.on('disconnect', (reason) => {
      console.log('⚠️ Socket.IO bağlantı kesildi:', reason);
      setIsConnected(false);
      setIsRegistered(false);
      // 🔥 DISCONNECT'TE SOCKET'I NULL YAPMA - otomatik reconnect olacak
    });

    socket.on('reconnect', (attemptNumber) => {
      console.log('🔄 Socket.IO yeniden bağlandı, attempt:', attemptNumber);
      // 🔥 Reconnect'te de register yap
      if (userId) {
        console.log('📱 REGISTER gönderiliyor (reconnect):', userId, 'Role:', userRole);
        socket.emit('register', { user_id: userId, role: userRole });
      }
    });

    socket.on('connect_error', (error) => {
      console.error('❌ Socket.IO bağlantı hatası:', error.message);
      reconnectAttempts.current++;
    });

    socket.on('registered', (data) => {
      console.log('✅ Socket.IO kullanıcı KAYITLI:', data);
      setIsRegistered(true);
    });

    // ══════════ ARAMA EVENTLERİ ══════════

    socket.on('incoming_call', (data: CallData) => {
      console.log('📞 GELEN ARAMA:', data);
      callbackRefs.current.onIncomingCall?.(data);
    });

    socket.on('call_accepted', (data) => {
      console.log('✅ ARAMA KABUL EDİLDİ:', data);
      callbackRefs.current.onCallAccepted?.(data);
    });

    socket.on('call_rejected', (data) => {
      console.log('❌ ARAMA REDDEDİLDİ:', data);
      callbackRefs.current.onCallRejected?.(data);
    });

    socket.on('call_ended', (data) => {
      console.log('📴 ARAMA SONLANDIRILDI:', data);
      callbackRefs.current.onCallEnded?.(data);
    });

    socket.on('call_ringing', (data) => {
      console.log('🔔 ARAMA ÇALIYOR:', data);
      callbackRefs.current.onCallRinging?.(data);
    });

    // ══════════ TAG EVENTLERİ ══════════

    socket.on('tag_created', (data: TagData) => {
      console.log('🏷️ YENİ TAG:', data);
      callbackRefs.current.onTagCreated?.(data);
    });

    socket.on('tag_cancelled', (data) => {
      console.log('🚫 TAG İPTAL:', data);
      callbackRefs.current.onTagCancelled?.(data);
    });

    socket.on('tag_updated', (data: TagData) => {
      console.log('🔄 TAG GÜNCELLENDİ:', data);
      callbackRefs.current.onTagUpdated?.(data);
    });

    socket.on('tag_matched', (data) => {
      console.log('🤝 TAG EŞLEŞTİ:', data);
      callbackRefs.current.onTagMatched?.(data);
    });

    socket.on('tag_created_ack', (data) => {
      console.log('✅ TAG ACK:', data);
    });

    // ══════════ TEKLİF EVENTLERİ ══════════

    socket.on('new_offer', (data: OfferData) => {
      console.log('💰 YENİ TEKLİF ALINDI:', data);
      callbackRefs.current.onNewOffer?.(data);
    });

    socket.on('offer_accepted', (data: OfferData) => {
      console.log('✅ TEKLİF KABUL EDİLDİ:', data);
      callbackRefs.current.onOfferAccepted?.(data);
    });

    socket.on('offer_rejected', (data: OfferData) => {
      console.log('❌ TEKLİF REDDEDİLDİ:', data);
      callbackRefs.current.onOfferRejected?.(data);
    });

    socket.on('offer_sent_ack', (data) => {
      console.log('📤 TEKLİF GÖNDERİLDİ ACK:', data);
      callbackRefs.current.onOfferSentAck?.(data);
    });

    // ══════════ KONUM EVENTLERİ ══════════

    socket.on('location_updated', (data: LocationData) => {
      callbackRefs.current.onLocationUpdated?.(data);
    });

    // ══════════ YOLCULUK EVENTLERİ ══════════

    socket.on('trip_started', (data) => {
      console.log('🚗 YOLCULUK BAŞLADI:', data);
      callbackRefs.current.onTripStarted?.(data);
    });

    socket.on('trip_ended', (data) => {
      console.log('🏁 YOLCULUK BİTTİ:', data);
      callbackRefs.current.onTripEnded?.(data);
    });

    socket.on('trip_end_requested', (data) => {
      console.log('🛑 YOLCULUK BİTİRME TALEBİ:', data);
      callbackRefs.current.onTripEndRequested?.(data);
    });

    socket.on('trip_end_response', (data) => {
      console.log('📝 YOLCULUK BİTİRME YANITI:', data);
      callbackRefs.current.onTripEndResponse?.(data);
    });

    // 🆕 ANLIK BİTİRME EVENTİ
    socket.on('trip_force_ended', (data) => {
      console.log('⚡ YOLCULUK ANINDA BİTİRİLDİ:', data);
      callbackRefs.current.onTripForceEnded?.(data);
    });

    socket.on('trip_completed', (data) => {
      console.log('✅ YOLCULUK TAMAMLANDI:', data);
      callbackRefs.current.onTripEnded?.(data);
    });

    // 🆕 DAILY.CO VIDEO/AUDIO CALL EVENTLERİ
    socket.on('incoming_daily_call', (data) => {
      console.log('📹 DAILY.CO GELEN ARAMA:', data);
      callbackRefs.current.onIncomingDailyCall?.(data);
    });

    // 🆕 YENİ: call_accepted - HER İKİ TARAFA aynı anda gönderiliyor
    socket.on('call_accepted', (data) => {
      console.log('✅ CALL_ACCEPTED (SYNC) - DAILY ODASI HAZIR:', data);
      callbackRefs.current.onCallAcceptedNew?.(data);
    });

    // 🆕 YENİ: call_rejected
    socket.on('call_rejected', (data) => {
      console.log('❌ CALL_REJECTED:', data);
      callbackRefs.current.onDailyCallRejected?.(data);
    });

    // 🆕 YENİ: call_cancelled - Arayan iptal etti
    socket.on('call_cancelled', (data) => {
      console.log('🚫 CALL_CANCELLED:', data);
      callbackRefs.current.onCallCancelled?.(data);
    });

    // 🆕 YENİ: call_ended - Görüşme bitti
    socket.on('call_ended', (data) => {
      console.log('📴 CALL_ENDED:', data);
      callbackRefs.current.onCallEndedNew?.(data);
    });

    // Eski eventler (geriye uyumluluk)
    socket.on('daily_call_accepted', (data) => {
      console.log('✅ DAILY.CO ARAMA KABUL EDİLDİ (ESKİ):', data);
      callbackRefs.current.onDailyCallAccepted?.(data);
    });

    socket.on('daily_call_rejected', (data) => {
      console.log('❌ DAILY.CO ARAMA REDDEDİLDİ:', data);
      callbackRefs.current.onDailyCallRejected?.(data);
    });

    socket.on('daily_call_ended', (data) => {
      console.log('📴 DAILY.CO ARAMA BİTTİ:', data);
      callbackRefs.current.onDailyCallEnded?.(data);
    });

    // 🔥 GLOBAL SOCKET'I SET ET
    globalSocket = socket;
    globalUserId = userId;
    globalUserRole = userRole;
    socketRef.current = socket;
  }, [userId, userRole]);

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

  // 🆕 YENİ: create_tag_request - 20km radius şoförlere gönder
  const emitCreateTagRequest = useCallback((data: {
    request_id: string;
    tag_id: string;
    passenger_id: string;
    passenger_name: string;
    pickup_location: string;
    pickup_lat: number;
    pickup_lng: number;
    dropoff_location: string;
    dropoff_lat: number;
    dropoff_lng: number;
    notes?: string;
  }) => {
    if (socketRef.current?.connected) {
      console.log('🏷️ TAG REQUEST gönderiliyor (20km radius):', data);
      socketRef.current.emit('create_tag_request', data);
    } else {
      console.error('❌ Socket bağlı değil, TAG REQUEST gönderilemedi');
    }
  }, []);

  // 🆕 YENİ: cancel_tag_request - request_id ile iptal
  const emitCancelTagRequest = useCallback((data: {
    request_id: string;
    tag_id: string;
    passenger_id: string;
  }) => {
    if (socketRef.current?.connected) {
      console.log('🚫 TAG REQUEST iptal ediliyor:', data);
      socketRef.current.emit('cancel_tag_request', data);
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

  // 🆕 YENİ: driver_location_update - Şoför konumu güncelleme (RAM'de tutulur)
  const emitDriverLocationUpdate = useCallback((data: {
    driver_id: string;
    lat: number;
    lng: number;
  }) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('driver_location_update', data);
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

  // 🚀 FORCE END TRIP - Anlık bitirme (-3 puan)
  const forceEndTrip = useCallback((data: {
    tag_id: string;
    ender_id: string;
    ender_type: 'passenger' | 'driver';
    passenger_id: string;
    driver_id: string;
  }) => {
    if (socketRef.current?.connected) {
      console.log('⚡ FORCE END TRIP gönderiliyor:', data);
      socketRef.current.emit('force_end_trip', data);
    }
  }, []);

  // ════════════════════════════════════════════════════════════════════
  // 🆕 DAILY.CO CALL INVITE SIGNALING (Socket only for ringing)
  // ════════════════════════════════════════════════════════════════════

  const emitCallInvite = useCallback((data: {
    caller_id: string;
    caller_name: string;
    receiver_id: string;
    room_url: string;
    room_name: string;
    call_type: 'audio' | 'video';
    tag_id: string;
  }) => {
    if (socketRef.current?.connected) {
      console.log('📞 CALL INVITE gönderiliyor:', data);
      socketRef.current.emit('call_invite', data);
    } else {
      console.error('❌ Socket bağlı değil, call invite gönderilemedi');
    }
  }, []);

  const emitCallAccepted = useCallback((data: {
    caller_id: string;
    receiver_id: string;
    room_url: string;
  }) => {
    if (socketRef.current?.connected) {
      console.log('✅ CALL ACCEPTED gönderiliyor:', data);
      socketRef.current.emit('call_accepted_signal', data);
    }
  }, []);

  const emitCallRejected = useCallback((data: {
    caller_id: string;
    receiver_id: string;
  }) => {
    if (socketRef.current?.connected) {
      console.log('❌ CALL REJECTED gönderiliyor:', data);
      socketRef.current.emit('call_rejected_signal', data);
    }
  }, []);

  // 🆕 YENİ: call_accept - Aranan kabul ettiğinde
  // Bu, Daily room oluşturulması ve HER İKİ TARAFA call_accepted gönderilmesini tetikler
  const emitCallAccept = useCallback((data: {
    caller_id: string;
    receiver_id: string;
    call_type: 'audio' | 'video';
    tag_id: string;
  }) => {
    if (socketRef.current?.connected) {
      console.log('✅ CALL_ACCEPT gönderiliyor (Room oluşturulacak):', data);
      socketRef.current.emit('call_accept', data);
    } else {
      console.error('❌ Socket bağlı değil, call accept gönderilemedi');
    }
  }, []);

  // 🆕 YENİ: call_reject - Aranan reddetti
  const emitCallReject = useCallback((data: {
    caller_id: string;
    receiver_id: string;
  }) => {
    if (socketRef.current?.connected) {
      console.log('❌ CALL_REJECT gönderiliyor:', data);
      socketRef.current.emit('call_reject', data);
    }
  }, []);

  // 🆕 YENİ: call_cancel - Arayan iptal etti
  const emitCallCancel = useCallback((data: {
    caller_id: string;
    receiver_id: string;
  }) => {
    if (socketRef.current?.connected) {
      console.log('🚫 CALL_CANCEL gönderiliyor:', data);
      socketRef.current.emit('call_cancel', data);
    }
  }, []);

  // 🆕 YENİ: call_end - Görüşme bitti
  const emitCallEnd = useCallback((data: {
    caller_id: string;
    receiver_id: string;
    ended_by: string;
    room_name: string;
  }) => {
    if (socketRef.current?.connected) {
      console.log('📴 CALL_END gönderiliyor:', data);
      socketRef.current.emit('call_end', data);
    }
  }, []);

  const acceptDailyCall = useCallback((data: {
    caller_id: string;
    room_url: string;
  }) => {
    if (socketRef.current?.connected) {
      console.log('✅ Daily.co arama kabul ediliyor:', data);
      socketRef.current.emit('accept_daily_call', data);
    }
  }, []);

  const rejectDailyCall = useCallback((data: {
    caller_id: string;
  }) => {
    if (socketRef.current?.connected) {
      console.log('❌ Daily.co arama reddediliyor:', data);
      socketRef.current.emit('reject_daily_call', data);
    }
  }, []);

  const endDailyCall = useCallback((data: {
    other_user_id: string;
    room_name: string;
  }) => {
    if (socketRef.current?.connected) {
      console.log('📴 Daily.co arama sonlandırılıyor:', data);
      socketRef.current.emit('end_daily_call', data);
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
    emitCreateTagRequest,      // 🆕 YENİ
    emitCancelTagRequest,      // 🆕 YENİ
    emitCancelTag,
    emitUpdateTag,
    // Teklif
    emitSendOffer,
    emitAcceptOffer,
    emitRejectOffer,
    // Konum
    emitLocationUpdate,
    emitDriverLocationUpdate,  // 🆕 YENİ
    subscribeToLocation,
    // Yolculuk
    emitTripStarted,
    emitTripEnded,
    requestTripEnd,
    respondTripEnd,
    forceEndTrip,
    // 🆕 Daily.co Call Invite Signaling
    emitCallInvite,
    emitCallAccepted,
    emitCallRejected,
    // 🆕 YENİ: Sync Call Events
    emitCallAccept,
    emitCallReject,
    emitCallCancel,
    emitCallEnd,
    // Eski Daily events (geriye uyumluluk)
    acceptDailyCall,
    rejectDailyCall,
    endDailyCall,
  };
}
