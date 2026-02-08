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
  onTripForceEnded?: (data: { 
    tag_id: string; 
    ended_by: string; 
    ender_type: string;
    points_deducted: number;
    new_points?: number;
    new_rating?: number;
  }) => void;
  // Daily.co Video/Audio Call eventleri
  onIncomingDailyCall?: (data: {
    room_url: string;
    room_name: string;
    caller_id: string;
    caller_name: string;
    call_type: 'video' | 'audio';
    tag_id: string;
  }) => void;
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
  onNewMessage,  // 🆕 Mesajlaşma
  onMessageSent,  // 🆕 Mesajlaşma
}: UseSocketProps) {
  
  // ════════════════════════════════════════════════════════════════════
  // 🔥 SINGLETON SOCKET FROM CONTEXT
  // ════════════════════════════════════════════════════════════════════
  
  const socketContext = useSocketContext();
  const {
    socket,
    isConnected,
    isRegistered,
    connect,
    disconnect,
    emit,
    emitSendOffer: contextEmitSendOffer,
    emitAcceptOffer: contextEmitAcceptOffer,
    emitRejectOffer: contextEmitRejectOffer,
    emitCreateTagRequest: contextEmitCreateTagRequest,
    emitCancelTagRequest: contextEmitCancelTagRequest,
    emitDriverLocationUpdate: contextEmitDriverLocationUpdate,
    emitLocationUpdate: contextEmitLocationUpdate,
    emitTripStarted: contextEmitTripStarted,
    emitTripEnded: contextEmitTripEnded,
    forceEndTrip: contextForceEndTrip,
    emitCallInvite: contextEmitCallInvite,
    emitCallAccept: contextEmitCallAccept,
    emitCallReject: contextEmitCallReject,
    emitCallCancel: contextEmitCallCancel,
    emitCallEnd: contextEmitCallEnd,
    emitSendMessage: contextEmitSendMessage,  // 🆕 Mesajlaşma
  } = socketContext;

  // Callback refs - dependency array'i küçültmek için
  const callbackRefs = useRef({
    onIncomingCall, onCallAccepted, onCallRejected, onCallEnded, onCallRinging,
    onTagCreated, onTagCancelled, onTagUpdated, onTagMatched, onNewOffer,
    onOfferAccepted, onOfferRejected, onOfferSentAck, onLocationUpdated,
    onTripStarted, onTripEnded, onTripEndRequested, onTripEndResponse,
    onTripForceEnded, onIncomingDailyCall, onCallAcceptedNew,
    onDailyCallAccepted, onDailyCallRejected, onDailyCallEnded,
    onCallCancelled, onCallEndedNew, onNewMessage, onMessageSent
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
      onCallCancelled, onCallEndedNew, onNewMessage, onMessageSent
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
      // YENİ: call_accepted sync event
      callbackRefs.current.onCallAcceptedNew?.(data);
    };

    const handleCallRejected = (data: any) => {
      console.log('❌ [useSocket] ARAMA RED:', data);
      callbackRefs.current.onCallRejected?.(data);
      callbackRefs.current.onDailyCallRejected?.(data);
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

    // ══════════ DAILY.CO EVENTLERİ ══════════

    const handleIncomingDailyCall = (data: any) => {
      console.log('📹 [useSocket] DAILY.CO GELEN ARAMA:', data);
      callbackRefs.current.onIncomingDailyCall?.(data);
    };

    const handleDailyCallAccepted = (data: any) => {
      console.log('✅ [useSocket] DAILY.CO ARAMA KABUL (ESKİ):', data);
      callbackRefs.current.onDailyCallAccepted?.(data);
    };

    const handleDailyCallEnded = (data: any) => {
      console.log('📴 [useSocket] DAILY.CO ARAMA BİTTİ:', data);
      callbackRefs.current.onDailyCallEnded?.(data);
    };

    // ══════════ MESAJLAŞMA EVENTLERİ ══════════

    const handleNewMessage = (data: any) => {
      console.log('💬 [useSocket] YENİ MESAJ GELDİ:', data);
      callbackRefs.current.onNewMessage?.(data);
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
    socket.on('new_passenger_offer', handleNewTag); // 🆕 MARTI TAG
    socket.on('tag_cancelled', handleTagCancelled);
    socket.on('passenger_offer_cancelled', handleTagCancelled); // 🆕 MARTI TAG
    socket.on('passenger_offer_taken', handleTagCancelled); // 🆕 MARTI TAG - Başka sürücü aldı
    socket.on('tag_updated', handleTagUpdated);
    socket.on('tag_matched', handleTagMatched);
    socket.on('offer_accepted_success', handleTagMatched); // 🆕 MARTI TAG - Sürücü kabul etti
    
    socket.on('new_offer', handleNewOffer);
    socket.on('offer_accepted', handleOfferAccepted);
    socket.on('offer_rejected', handleOfferRejected);
    socket.on('offer_sent_ack', handleOfferSentAck);
    
    socket.on('location_updated', handleLocationUpdated);
    
    socket.on('trip_started', handleTripStarted);
    socket.on('trip_ended', handleTripEnded);
    socket.on('trip_completed', handleTripEnded); // Alias
    socket.on('trip_end_requested', handleTripEndRequested);
    socket.on('trip_end_response', handleTripEndResponse);
    socket.on('trip_force_ended', handleTripForceEnded);
    
    socket.on('incoming_daily_call', handleIncomingDailyCall);
    socket.on('daily_call_accepted', handleDailyCallAccepted);
    socket.on('daily_call_rejected', handleCallRejected);
    socket.on('daily_call_ended', handleDailyCallEnded);
    
    // 🆕 Mesajlaşma eventleri
    socket.on('new_message', handleNewMessage);
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
      socket.off('new_passenger_offer', handleNewTag); // 🆕 MARTI TAG
      socket.off('tag_cancelled', handleTagCancelled);
      socket.off('passenger_offer_cancelled', handleTagCancelled); // 🆕 MARTI TAG
      socket.off('passenger_offer_taken', handleTagCancelled); // 🆕 MARTI TAG
      socket.off('tag_updated', handleTagUpdated);
      socket.off('tag_matched', handleTagMatched);
      socket.off('offer_accepted_success', handleTagMatched); // 🆕 MARTI TAG
      
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
      
      socket.off('incoming_daily_call', handleIncomingDailyCall);
      socket.off('daily_call_accepted', handleDailyCallAccepted);
      socket.off('daily_call_rejected', handleCallRejected);
      socket.off('daily_call_ended', handleDailyCallEnded);
      
      // 🆕 Mesajlaşma
      socket.off('new_message', handleNewMessage);
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
    if (socket?.connected) {
      console.log('📱 [useSocket] Kullanıcı kaydediliyor:', uid, role);
      socket.emit('register', { user_id: uid, role });
    }
  }, [socket]);

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
    notes?: string;
  }) => {
    console.log('🏷️ [useSocket] TAG REQUEST gönderiliyor:', data);
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

  // 🆕 MARTI TAG: Sürücü teklifi kabul eder
  const emitDriverAcceptOffer = useCallback((data: {
    tag_id: string;
    driver_id: string;
    driver_name: string;
  }) => {
    if (socket?.connected) {
      console.log('✅ [useSocket] SÜRÜCÜ TEKLİFİ KABUL EDİYOR:', data);
      socket.emit('driver_accept_offer', data);
    }
  }, [socket]);

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

  // ══════════ DAILY.CO CALL FONKSİYONLARI ══════════

  const emitCallInvite = useCallback((data: {
    caller_id: string;
    caller_name: string;
    receiver_id: string;
    room_url: string;
    room_name: string;
    call_type: 'audio' | 'video';
    tag_id: string;
  }) => {
    console.log('📞 [useSocket] CALL INVITE gönderiliyor:', data);
    contextEmitCallInvite(data);
  }, [contextEmitCallInvite]);

  const emitCallAccepted = useCallback((data: {
    caller_id: string;
    receiver_id: string;
    room_url: string;
  }) => {
    if (socket?.connected) {
      console.log('✅ [useSocket] CALL ACCEPTED gönderiliyor:', data);
      socket.emit('call_accepted_signal', data);
    }
  }, [socket]);

  const emitCallRejected = useCallback((data: {
    caller_id: string;
    receiver_id: string;
  }) => {
    if (socket?.connected) {
      console.log('❌ [useSocket] CALL REJECTED gönderiliyor:', data);
      socket.emit('call_rejected_signal', data);
    }
  }, [socket]);

  const emitCallAccept = useCallback((data: {
    caller_id: string;
    receiver_id: string;
    call_type: 'audio' | 'video';
    tag_id: string;
  }) => {
    console.log('✅ [useSocket] CALL_ACCEPT gönderiliyor:', data);
    contextEmitCallAccept(data);
  }, [contextEmitCallAccept]);

  const emitCallReject = useCallback((data: {
    caller_id: string;
    receiver_id: string;
  }) => {
    console.log('❌ [useSocket] CALL_REJECT gönderiliyor:', data);
    contextEmitCallReject(data);
  }, [contextEmitCallReject]);

  const emitCallCancel = useCallback((data: {
    caller_id: string;
    receiver_id: string;
  }) => {
    console.log('🚫 [useSocket] CALL_CANCEL gönderiliyor:', data);
    contextEmitCallCancel(data);
  }, [contextEmitCallCancel]);

  const emitCallEnd = useCallback((data: {
    caller_id: string;
    receiver_id: string;
    ended_by: string;
    room_name: string;
  }) => {
    console.log('📴 [useSocket] CALL_END gönderiliyor:', data);
    contextEmitCallEnd(data);
  }, [contextEmitCallEnd]);

  const acceptDailyCall = useCallback((data: {
    caller_id: string;
    room_url: string;
  }) => {
    if (socket?.connected) {
      console.log('✅ [useSocket] Daily.co arama kabul ediliyor:', data);
      socket.emit('accept_daily_call', data);
    }
  }, [socket]);

  const rejectDailyCall = useCallback((data: {
    caller_id: string;
  }) => {
    if (socket?.connected) {
      console.log('❌ [useSocket] Daily.co arama reddediliyor:', data);
      socket.emit('reject_daily_call', data);
    }
  }, [socket]);

  const endDailyCall = useCallback((data: {
    other_user_id: string;
    room_name: string;
  }) => {
    if (socket?.connected) {
      console.log('📴 [useSocket] Daily.co arama sonlandırılıyor:', data);
      socket.emit('end_daily_call', data);
    }
  }, [socket]);

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
    // Daily.co Call Invite Signaling
    emitCallInvite,
    emitCallAccepted,
    emitCallRejected,
    // Sync Call Events
    emitCallAccept,
    emitCallReject,
    emitCallCancel,
    emitCallEnd,
    // Eski Daily events (geriye uyumluluk)
    acceptDailyCall,
    rejectDailyCall,
    endDailyCall,
    // 🆕 Mesajlaşma
    emitSendMessage,
  };
}
