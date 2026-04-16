/**
 * useSocket - Socket.IO Hook for Real-time Communication
 * 
 * v3.0 - SINGLETON SOCKET via SocketContext
 * 
 * ⚠️ ARTIK KENDİ SOCKET BAĞLANTISI OLUŞTURMUYOR!
 * SocketContext'ten global singleton socket'i kullanıyor.
 * 
 * Bu sayede:
 * - Component unmount olsa bile socket kalıcı
 * - Tüm componentler aynı socket instance'ı kullanıyor
 * - send_offer gibi kritik eventler kaybolmuyor
 */

import { useEffect, useRef, useCallback, useState } from 'react';
import { useSocketContext } from '../contexts/SocketContext';
import { getPersistedAccessToken } from '../lib/sessionToken';
import { AppState, AppStateStatus } from 'react-native';

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

/** Backend `accept_ride`: `ride_accepted` (yolcu) / `ride_matched` (sürücü) */
export interface RideMatchSocketData {
  tag_id: string;
  status?: string;
  driver_id?: string;
  driver_name?: string;
  passenger_id?: string;
  passenger_name?: string;
  pickup_location?: string;
  pickup_lat?: number;
  pickup_lng?: number;
  dropoff_location?: string;
  dropoff_lat?: number;
  dropoff_lng?: number;
  final_price?: number;
  matched_at?: string;
  passenger_payment_method?: 'cash' | 'card';
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
  /** Backend doğrudan eşleşme: yolcuya */
  onRideAccepted?: (data: RideMatchSocketData) => void;
  /** Backend doğrudan eşleşme: sürücüye */
  onRideMatched?: (data: RideMatchSocketData) => void;
  // Teklif eventleri
  onNewOffer?: (data: OfferData) => void;
  onOfferAccepted?: (data: OfferData) => void;
  onOfferRejected?: (data: OfferData) => void;
  /** Başka sürücü aldı veya atomik kilit kaybedildi (driver_accept_offer) */
  onOfferAlreadyTaken?: (data: { tag_id?: string }) => void;
  onOfferSentAck?: (data: { success: boolean; passenger_online: boolean }) => void;
  // Konum eventleri
  onLocationUpdated?: (data: LocationData) => void;
  // Yolculuk eventleri
  onTripStarted?: (data: { tag_id: string; passenger_id: string; driver_id: string }) => void;
  onTripEnded?: (data: { tag_id: string }) => void;
  onTripEndRequested?: (data: { tag_id: string; requester_id: string }) => void;
  onTripEndResponse?: (data: { tag_id: string; accepted: boolean }) => void;
  onTripForceEnded?: (data: {
    tag_id: string;
    ended_by?: string;
    ender_id?: string;
    ender_type: string;
    ender_name?: string;
    points_deducted: number;
    new_points?: number;
    new_rating?: number;
    should_rate?: boolean;
  }) => void;
  /** Zorla bitir — karşı tarafa tek onay modalı */
  onForceEndCounterpartyPrompt?: (data: {
    tag_id: string;
    initiator_id: string;
    initiator_type: string;
    initiator_name?: string;
  }) => void;
  // 🆕 QR ile yolculuk bitirme - Puanlama modalı
  onShowRatingModal?: (data: {
    tag_id: string;
    rate_user_id: string;
    rate_user_name: string;
    message: string;
    should_rate?: boolean;
  }) => void;
  onCallCancelled?: (data: { cancelled: boolean; by: string }) => void;
  onCallEndedNew?: (data: { ended: boolean; by: string; room_name: string }) => void;
  // 🆕 Mesajlaşma eventleri
  onNewMessage?: (data: {
    id: string;
    sender_id: string;
    sender_name: string;
    receiver_id: string;
    message: string;
    tag_id?: string;
    timestamp: string;
  }) => void;
  /** Karşı taraf bu eşleşmede ilk kez yazdı (push ile aynı mantık) */
  onFirstChatMessage?: (data: {
    tag_id: string;
    sender_id: string;
    sender_name: string;
    message: string;
    message_preview?: string;
    from_driver: boolean;
    created_at?: string;
  }) => void;
  onMessageSent?: (data: { success: boolean; message_id: string }) => void;
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
  onRideAccepted,
  onRideMatched,
  onNewOffer,
  onOfferAccepted,
  onOfferRejected,
  onOfferAlreadyTaken,
  onOfferSentAck,
  onLocationUpdated,
  onTripStarted,
  onTripEnded,
  onTripEndRequested,
  onTripEndResponse,
  onTripForceEnded,
  onForceEndCounterpartyPrompt,
  onShowRatingModal,  // 🆕 QR puanlama modalı
  onCallCancelled,
  onCallEndedNew,
  onNewMessage,  // 🆕 Mesajlaşma
  onFirstChatMessage,
  onMessageSent,  // 🆕 Mesajlaşma
}: UseSocketProps) {
  
  // ════════════════════════════════════════════════════════════════════
  // 🔥 SINGLETON SOCKET FROM CONTEXT
  // ════════════════════════════════════════════════════════════════════
  
  const socketContext = useSocketContext();
  const {
    socket,
    emitWithLog,
    isConnected,
    isRegistered,
    connect,
    disconnect,
    emit,
    emitSendOffer: contextEmitSendOffer,
    emitDriverAcceptOffer: contextEmitDriverAcceptOffer,
    emitAcceptOffer: contextEmitAcceptOffer,
    emitRejectOffer: contextEmitRejectOffer,
    emitCreateTagRequest: contextEmitCreateTagRequest,
    emitCancelTagRequest: contextEmitCancelTagRequest,
    emitDriverLocationUpdate: contextEmitDriverLocationUpdate,
    emitLocationUpdate: contextEmitLocationUpdate,
    emitTripStarted: contextEmitTripStarted,
    emitTripEnded: contextEmitTripEnded,
    forceEndTrip: contextForceEndTrip,
    emitSendMessage: contextEmitSendMessage,  // 🆕 Mesajlaşma
  } = socketContext;

  // Callback refs - dependency array'i küçültmek için
  const callbackRefs = useRef({
    onIncomingCall, onCallAccepted, onCallRejected, onCallEnded, onCallRinging,
    onTagCreated, onTagCancelled, onTagUpdated, onTagMatched, onRideAccepted, onRideMatched, onNewOffer,
    onOfferAccepted, onOfferRejected, onOfferAlreadyTaken, onOfferSentAck, onLocationUpdated,
    onTripStarted, onTripEnded, onTripEndRequested, onTripEndResponse,
    onTripForceEnded, onForceEndCounterpartyPrompt, onShowRatingModal,
    onCallCancelled, onCallEndedNew, onNewMessage, onFirstChatMessage, onMessageSent
  });
  
  // Callback'leri güncelle
  useEffect(() => {
    callbackRefs.current = {
      onIncomingCall, onCallAccepted, onCallRejected, onCallEnded, onCallRinging,
      onTagCreated, onTagCancelled, onTagUpdated, onTagMatched, onRideAccepted, onRideMatched, onNewOffer,
      onOfferAccepted, onOfferRejected, onOfferAlreadyTaken, onOfferSentAck, onLocationUpdated,
      onTripStarted, onTripEnded, onTripEndRequested, onTripEndResponse,
      onTripForceEnded, onForceEndCounterpartyPrompt, onShowRatingModal,
      onCallCancelled, onCallEndedNew, onNewMessage, onFirstChatMessage, onMessageSent
    };
  });

  // ════════════════════════════════════════════════════════════════════
  // SOCKET EVENT LISTENERS - Her component kendi callback'lerini register eder
  // ════════════════════════════════════════════════════════════════════

  useEffect(() => {
    if (!socket) {
      console.log('⚠️ [useSocket] Socket henüz hazır değil');
      return;
    }

    console.log(`🔌 [useSocket] Event listener'lar ekleniyor (${userRole})`);

    // ══════════ ARAMA EVENTLERİ ══════════

    const handleIncomingCall = (data: CallData) => {
      console.log('📞 [useSocket] GELEN ARAMA:', data);
      callbackRefs.current.onIncomingCall?.(data);
    };

    const handleCallAccepted = (data: any) => {
      console.log('✅ [useSocket] ARAMA KABUL:', data);
      callbackRefs.current.onCallAccepted?.(data);
    };

    const handleCallRejected = (data: any) => {
      console.log('❌ [useSocket] ARAMA RED:', data);
      callbackRefs.current.onCallRejected?.(data);
    };

    const handleCallEnded = (data: any) => {
      console.log('📴 [useSocket] ARAMA BİTTİ:', data);
      callbackRefs.current.onCallEnded?.(data);
      callbackRefs.current.onCallEndedNew?.(data);
    };

    const handleCallRinging = (data: any) => {
      console.log('🔔 [useSocket] ARAMA ÇALIYOR:', data);
      callbackRefs.current.onCallRinging?.(data);
    };

    const handleCallCancelled = (data: any) => {
      console.log('🚫 [useSocket] ARAMA İPTAL:', data);
      callbackRefs.current.onCallCancelled?.(data);
    };

    // ══════════ TAG EVENTLERİ ══════════

    const handleNewTag = (data: any) => {
      console.log('🏷️ [useSocket] YENİ TAG:', data);
      callbackRefs.current.onTagCreated?.(data);
    };

    const handleTagCancelled = (data: any) => {
      console.log('🚫 [useSocket] TAG İPTAL:', data);
      callbackRefs.current.onTagCancelled?.(data);
    };

    const handleTagUpdated = (data: any) => {
      console.log('🔄 [useSocket] TAG GÜNCELLENDİ:', data);
      callbackRefs.current.onTagUpdated?.(data);
    };

    const handleTagMatched = (data: any) => {
      console.log('🤝 [useSocket] TAG EŞLEŞTİ:', data);
      callbackRefs.current.onTagMatched?.(data);
    };

    const handleRideAccepted = (data: any) => {
      console.log('✅ [useSocket] ride_accepted:', data);
      callbackRefs.current.onRideAccepted?.(data as RideMatchSocketData);
    };

    const handleRideMatched = (data: any) => {
      console.log('✅ [useSocket] ride_matched:', data);
      callbackRefs.current.onRideMatched?.(data as RideMatchSocketData);
    };

    // ══════════ TEKLİF EVENTLERİ ══════════

    const handleNewOffer = (data: any) => {
      console.log('💰 [useSocket] YENİ TEKLİF:', data);
      callbackRefs.current.onNewOffer?.(data);
    };

    const handleOfferAccepted = (data: any) => {
      console.log('✅ [useSocket] TEKLİF KABUL:', data);
      callbackRefs.current.onOfferAccepted?.(data);
    };

    const handleOfferRejected = (data: any) => {
      console.log('❌ [useSocket] TEKLİF RED:', data);
      callbackRefs.current.onOfferRejected?.(data);
    };

    const handleOfferAlreadyTaken = (data: any) => {
      console.log('❌ [useSocket] TEKLİF ZATEN ALINMIŞ / KİLİT KAYBI:', data);
      if (callbackRefs.current.onOfferAlreadyTaken) {
        callbackRefs.current.onOfferAlreadyTaken(data);
      } else {
        callbackRefs.current.onOfferRejected?.(data);
      }
    };

    const handleOfferSentAck = (data: any) => {
      console.log('📤 [useSocket] TEKLİF ACK:', data);
      callbackRefs.current.onOfferSentAck?.(data);
    };

    // ══════════ KONUM EVENTLERİ ══════════

    const handleLocationUpdated = (data: any) => {
      callbackRefs.current.onLocationUpdated?.(data);
    };

    // ══════════ YOLCULUK EVENTLERİ ══════════

    const handleTripStarted = (data: any) => {
      console.log('🚗 [useSocket] YOLCULUK BAŞLADI:', data);
      callbackRefs.current.onTripStarted?.(data);
    };

    const handleTripEnded = (data: any) => {
      console.log('🏁 [useSocket] YOLCULUK BİTTİ:', data);
      callbackRefs.current.onTripEnded?.(data);
    };

    const handleTripEndRequested = (data: any) => {
      console.log('🛑 [useSocket] YOLCULUK BİTİRME TALEBİ:', data);
      callbackRefs.current.onTripEndRequested?.(data);
    };

    const handleTripEndResponse = (data: any) => {
      console.log('📝 [useSocket] YOLCULUK BİTİRME YANITI:', data);
      callbackRefs.current.onTripEndResponse?.(data);
    };

    const handleTripForceEnded = (data: any) => {
      console.log('⚡ [useSocket] YOLCULUK ZORLA BİTTİ:', data);
      callbackRefs.current.onTripForceEnded?.(data);
    };

    const handleForceEndCounterpartyPrompt = (data: any) => {
      console.log('⚡ [useSocket] force_end_counterparty_prompt:', data);
      callbackRefs.current.onForceEndCounterpartyPrompt?.(data);
    };

    // ══════════ MESAJLAŞMA EVENTLERİ ══════════

    const handleNewMessage = (data: any) => {
      console.log('💬 [useSocket] YENİ MESAJ GELDİ:', data);
      callbackRefs.current.onNewMessage?.(data);
    };

    const handleFirstChatMessage = (data: any) => {
      console.log('💬 [useSocket] İLK SOHBET MESAJI:', data);
      callbackRefs.current.onFirstChatMessage?.(data);
    };

    const handleMessageSent = (data: any) => {
      console.log('✅ [useSocket] MESAJ GÖNDERİLDİ:', data);
      callbackRefs.current.onMessageSent?.(data);
    };

    // Event listener'ları ekle
    socket.on('incoming_call', handleIncomingCall);
    socket.on('call_accepted', handleCallAccepted);
    socket.on('call_rejected', handleCallRejected);
    socket.on('call_ended', handleCallEnded);
    socket.on('call_ringing', handleCallRinging);
    socket.on('call_cancelled', handleCallCancelled);
    
    socket.on('new_tag', handleNewTag);
    socket.on('tag_created', handleNewTag); // Alias
    // Sürücü room'una giden teklif; yolcu room'una gitmez. Rol yanlış yazılsa bile kaçırmamak için her zaman dinle.
    socket.on('new_passenger_offer', handleNewTag);
    socket.on('tag_cancelled', handleTagCancelled);
    socket.on('passenger_offer_cancelled', handleTagCancelled); // 🆕 MARTI TAG
    socket.on('passenger_offer_taken', handleTagCancelled); // 🆕 MARTI TAG - Başka sürücü aldı
    socket.on('passenger_offer_revoked', handleTagCancelled); // Sıralı dispatch: süre doldu / sıra geçti
    socket.on('remove_offer', handleTagCancelled); // Rolling batch: batch dışı / kabul sonrası teklifi kaldır
    socket.on('tag_updated', handleTagUpdated);
    socket.on('tag_matched', handleTagMatched);
    socket.on('offer_accepted_success', handleTagMatched); // 🆕 MARTI TAG - Sürücü kabul etti
    
    socket.on('new_offer', handleNewOffer);
    socket.on('offer_accepted', handleOfferAccepted);
    socket.on('offer_rejected', handleOfferRejected);
    socket.on('offer_sent_ack', handleOfferSentAck);
    socket.on('driver_matched', handleTagMatched); // 🆕 MARTI TAG - Yolcuya sürücü eşleşti
    socket.on('ride_accepted', handleRideAccepted);
    socket.on('ride_matched', handleRideMatched);
    socket.on('offer_already_taken', handleOfferAlreadyTaken);
    
    socket.on('location_updated', handleLocationUpdated);
    
    socket.on('trip_started', handleTripStarted);
    socket.on('trip_ended', handleTripEnded);
    socket.on('trip_completed', handleTripEnded); // Alias
    socket.on('trip_end_requested', handleTripEndRequested);
    socket.on('trip_end_response', handleTripEndResponse);
    socket.on('trip_force_ended', handleTripForceEnded);
    socket.on('force_end_counterparty_prompt', handleForceEndCounterpartyPrompt);
    
    // 🆕 QR ile yolculuk bitirme - Puanlama modalı
    socket.on('show_rating_modal', (data: any) => {
      console.log('⭐ [Socket] Puanlama modalı göster:', data);
      callbackRefs.current.onShowRatingModal?.(data);
    });
    
    // 🆕 Mesajlaşma eventleri
    socket.on('new_message', handleNewMessage);
    socket.on('first_chat_message', handleFirstChatMessage);
    socket.on('message_sent', handleMessageSent);

    // Cleanup - listener'ları kaldır
    return () => {
      console.log(`🔌 [useSocket] Event listener'lar kaldırılıyor (${userRole})`);
      
      socket.off('incoming_call', handleIncomingCall);
      socket.off('call_accepted', handleCallAccepted);
      socket.off('call_rejected', handleCallRejected);
      socket.off('call_ended', handleCallEnded);
      socket.off('call_ringing', handleCallRinging);
      socket.off('call_cancelled', handleCallCancelled);
      
      socket.off('new_tag', handleNewTag);
      socket.off('tag_created', handleNewTag);
      socket.off('new_passenger_offer', handleNewTag);
      socket.off('tag_cancelled', handleTagCancelled);
      socket.off('passenger_offer_cancelled', handleTagCancelled); // 🆕 MARTI TAG
      socket.off('passenger_offer_taken', handleTagCancelled); // 🆕 MARTI TAG
      socket.off('passenger_offer_revoked', handleTagCancelled);
      socket.off('remove_offer', handleTagCancelled);
      socket.off('tag_updated', handleTagUpdated);
      socket.off('tag_matched', handleTagMatched);
      socket.off('offer_accepted_success', handleTagMatched); // 🆕 MARTI TAG
      socket.off('driver_matched', handleTagMatched);
      socket.off('ride_accepted', handleRideAccepted);
      socket.off('ride_matched', handleRideMatched);
      socket.off('offer_already_taken', handleOfferAlreadyTaken);
      
      socket.off('new_offer', handleNewOffer);
      socket.off('offer_accepted', handleOfferAccepted);
      socket.off('offer_rejected', handleOfferRejected);
      socket.off('offer_sent_ack', handleOfferSentAck);
      
      socket.off('location_updated', handleLocationUpdated);
      
      socket.off('trip_started', handleTripStarted);
      socket.off('trip_ended', handleTripEnded);
      socket.off('trip_completed', handleTripEnded);
      socket.off('trip_end_requested', handleTripEndRequested);
      socket.off('trip_end_response', handleTripEndResponse);
      socket.off('trip_force_ended', handleTripForceEnded);
      socket.off('force_end_counterparty_prompt', handleForceEndCounterpartyPrompt);
      
      // 🆕 QR ile puanlama modalı
      socket.off('show_rating_modal');
      
      // 🆕 Mesajlaşma
      socket.off('new_message', handleNewMessage);
      socket.off('first_chat_message', handleFirstChatMessage);
      socket.off('message_sent', handleMessageSent);
    };
  }, [socket, userRole]);

  // ════════════════════════════════════════════════════════════════════
  // KULLANICI DEĞİŞTİĞİNDE BAĞLAN
  // ════════════════════════════════════════════════════════════════════

  useEffect(() => {
    if (userId && userRole) {
      console.log(`🔌 [useSocket] Connect çağrılıyor: ${userId} (${userRole})`);
      connect(userId, userRole);
    }
  }, [userId, userRole, connect]);

  // ════════════════════════════════════════════════════════════════════
  // WRAPPER FONKSİYONLAR - Eski API uyumluluğu için
  // ════════════════════════════════════════════════════════════════════

  const registerUser = useCallback((uid: string, role?: string) => {
    if (!socket?.connected) return;
    void (async () => {
      const token = await getPersistedAccessToken();
      if (!token) {
        console.warn('[useSocket] register atlandı: access_token yok');
        return;
      }
      const r = role ?? userRole ?? 'driver';
      console.log('📱 [useSocket] Kullanıcı kaydediliyor (JWT):', uid, r);
      console.log('FRONTEND_SOCKET_REGISTER_USER', { userId: uid, role: r, reason: 'registerUser' });
      socket.emit('register', { token, role: r, user_id: uid });
    })();
  }, [socket, userRole]);

  useEffect(() => {
    if (!socket?.connected || !userId || !userRole) return;
    registerUser(userId, userRole);
  }, [socket?.connected, socket?.id, userId, userRole, registerUser]);

  // ══════════ ARAMA FONKSİYONLARI ══════════

  const startCall = useCallback((data: {
    caller_id: string;
    caller_name: string;
    receiver_id: string;
    call_id: string;
    channel_name: string;
    agora_token: string;
    call_type: 'audio' | 'video';
  }) => {
    if (socket?.connected) {
      console.log('📞 [useSocket] Arama başlatılıyor:', data);
      socket.emit('call_user', data);
    }
  }, [socket]);

  const acceptCall = useCallback((data: {
    call_id: string;
    caller_id: string;
    receiver_id: string;
  }) => {
    if (socket?.connected) {
      console.log('✅ [useSocket] Arama kabul ediliyor:', data);
      socket.emit('accept_call', data);
    }
  }, [socket]);

  const rejectCall = useCallback((data: {
    call_id: string;
    caller_id: string;
    receiver_id: string;
  }) => {
    if (socket?.connected) {
      console.log('❌ [useSocket] Arama reddediliyor:', data);
      socket.emit('reject_call', data);
    }
  }, [socket]);

  const endCall = useCallback((data: {
    call_id: string;
    caller_id: string;
    receiver_id: string;
    ended_by: string;
  }) => {
    if (socket?.connected) {
      console.log('📴 [useSocket] Arama sonlandırılıyor:', data);
      socket.emit('end_call', data);
    }
  }, [socket]);

  // ══════════ TAG FONKSİYONLARI ══════════

  const emitNewTag = useCallback((data: TagData) => {
    if (socket?.connected) {
      console.log('🏷️ [useSocket] Yeni TAG yayınlanıyor:', data);
      socket.emit('new_tag', data);
    }
  }, [socket]);

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
    // 🆕 MARTI TAG parametreleri
    offered_price?: number;
    distance_km?: number;
    estimated_minutes?: number;
    notes?: string;
    passenger_payment_method?: 'cash' | 'card';
  }) => {
    console.log('🏷️ [useSocket] TAG REQUEST gönderiliyor:', data);
    console.log('   offered_price:', data.offered_price);
    contextEmitCreateTagRequest(data);
  }, [contextEmitCreateTagRequest]);

  const emitCancelTagRequest = useCallback((data: {
    request_id: string;
    tag_id: string;
    passenger_id: string;
  }) => {
    console.log('🚫 [useSocket] TAG REQUEST iptal ediliyor:', data);
    contextEmitCancelTagRequest(data);
  }, [contextEmitCancelTagRequest]);

  const emitCancelTag = useCallback((tagId: string) => {
    if (socket?.connected) {
      console.log('🚫 [useSocket] TAG iptal ediliyor:', tagId);
      socket.emit('cancel_tag', { tag_id: tagId });
    }
  }, [socket]);

  const emitUpdateTag = useCallback((data: Partial<TagData> & { tag_id: string }) => {
    if (socket?.connected) {
      console.log('🔄 [useSocket] TAG güncelleniyor:', data);
      socket.emit('update_tag', data);
    }
  }, [socket]);

  // ══════════ TEKLİF FONKSİYONLARI ══════════

  const emitSendOffer = useCallback((data: OfferData) => {
    console.log('💰 [useSocket] TEKLİF GÖNDERİLİYOR (send_offer):', JSON.stringify(data));
    contextEmitSendOffer(data);
  }, [contextEmitSendOffer]);

  const emitAcceptOffer = useCallback((data: OfferData) => {
    console.log('✅ [useSocket] Teklif kabul ediliyor:', data);
    contextEmitAcceptOffer(data);
  }, [contextEmitAcceptOffer]);

  const emitRejectOffer = useCallback((data: { driver_id: string; tag_id: string }) => {
    console.log('❌ [useSocket] Teklif reddediliyor:', data);
    contextEmitRejectOffer(data);
  }, [contextEmitRejectOffer]);

  // 🆕 MARTI TAG: Sürücü teklifi kabul — backend driver_accept_offer (connect-safe emit)
  const emitDriverAcceptOffer = useCallback(
    (data: { tag_id: string; driver_id: string; driver_name?: string; trip_id?: string }) => {
      contextEmitDriverAcceptOffer({
        tag_id: data.tag_id,
        driver_id: data.driver_id,
        driver_name: data.driver_name,
      });
    },
    [contextEmitDriverAcceptOffer]
  );

  // ══════════ KONUM FONKSİYONLARI ══════════

  const emitLocationUpdate = useCallback((data: LocationData) => {
    contextEmitLocationUpdate(data);
  }, [contextEmitLocationUpdate]);

  const emitDriverLocationUpdate = useCallback((data: {
    driver_id: string;
    lat: number;
    lng: number;
  }) => {
    contextEmitDriverLocationUpdate(data);
  }, [contextEmitDriverLocationUpdate]);

  const subscribeToLocation = useCallback((targetId: string) => {
    if (socket?.connected && userId) {
      console.log('📍 [useSocket] Konum takibi başlatılıyor:', targetId);
      socket.emit('subscribe_location', { 
        target_id: targetId,
        subscriber_id: userId 
      });
    }
  }, [socket, userId]);

  // ══════════ YOLCULUK FONKSİYONLARI ══════════

  const emitTripStarted = useCallback((data: { 
    tag_id: string; 
    passenger_id: string; 
    driver_id: string 
  }) => {
    console.log('🚗 [useSocket] Yolculuk başladı yayınlanıyor:', data);
    contextEmitTripStarted(data);
  }, [contextEmitTripStarted]);

  const emitTripEnded = useCallback((data: { 
    tag_id: string; 
    passenger_id: string; 
    driver_id: string 
  }) => {
    console.log('🏁 [useSocket] Yolculuk bitti yayınlanıyor:', data);
    contextEmitTripEnded(data);
  }, [contextEmitTripEnded]);

  const requestTripEnd = useCallback((data: {
    tag_id: string;
    requester_id: string;
    target_id: string;
  }) => {
    if (socket?.connected) {
      console.log('🛑 [useSocket] Trip end request gönderiliyor:', data);
      socket.emit('request_trip_end', data);
    }
  }, [socket]);

  const respondTripEnd = useCallback((data: {
    tag_id: string;
    accepted: boolean;
    target_id: string;
  }) => {
    if (socket?.connected) {
      console.log('📝 [useSocket] Trip end response gönderiliyor:', data);
      socket.emit('respond_trip_end', data);
    }
  }, [socket]);

  const forceEndTrip = useCallback((data: {
    tag_id: string;
    ender_id: string;
    ender_type: 'passenger' | 'driver';
    passenger_id: string;
    driver_id: string;
  }) => {
    console.log('⚡ [useSocket] FORCE END TRIP gönderiliyor:', data);
    contextForceEndTrip(data);
  }, [contextForceEndTrip]);

  // ══════════ MESAJLAŞMA FONKSİYONLARI ══════════

  const emitSendMessage = useCallback((data: {
    sender_id: string;
    sender_name: string;
    receiver_id: string;
    message: string;
    tag_id?: string;
  }) => {
    console.log('💬 [useSocket] Mesaj gönderiliyor (context emit):', data);
    contextEmitSendMessage(data);
  }, [contextEmitSendMessage]);

  // ════════════════════════════════════════════════════════════════════
  // RETURN - Eski API ile tam uyumlu
  // ════════════════════════════════════════════════════════════════════

  return {
    socket,
    isConnected,
    isRegistered,
    // Bağlantı
    connect: useCallback((uid?: string, role?: string) => {
      if (uid && role) connect(uid, role);
    }, [connect]),
    disconnect,
    registerUser,
    // Arama
    startCall,
    acceptCall,
    rejectCall,
    endCall,
    // TAG
    emitNewTag,
    emitCreateTagRequest,
    emitCancelTagRequest,
    emitCancelTag,
    emitUpdateTag,
    // Teklif
    emitSendOffer,
    emitAcceptOffer,
    emitRejectOffer,
    emitDriverAcceptOffer, // 🆕 MARTI TAG
    // Konum
    emitLocationUpdate,
    emitDriverLocationUpdate,
    subscribeToLocation,
    // Yolculuk
    emitTripStarted,
    emitTripEnded,
    requestTripEnd,
    respondTripEnd,
    forceEndTrip,
    // 🆕 Mesajlaşma
    emitSendMessage,
  };
}
