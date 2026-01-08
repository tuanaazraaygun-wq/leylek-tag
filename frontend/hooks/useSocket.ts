/**
 * useSocket.ts - Socket Hook v4.1
 * 
 * TÜM callback'ler dahil - Mevcut kod ile uyumlu
 */

import { useEffect, useCallback } from 'react';
import { useSocketContext } from '../contexts/SocketContext';

// ═══════════════════════════════════════════════════════════════════
// HOOK CONFIG - TÜM CALLBACK'LER
// ═══════════════════════════════════════════════════════════════════

interface UseSocketConfig {
  userId?: string | null;
  userRole?: 'passenger' | 'driver';
  
  // TAG callbacks
  onNewTag?: (data: any) => void;
  onTagCancelled?: (data: any) => void;
  onTagMatched?: (data: any) => void;
  
  // Offer callbacks
  onNewOffer?: (data: any) => void;
  onOfferAccepted?: (data: any) => void;
  onOfferRejected?: (data: any) => void;
  
  // Trip callbacks
  onTripStarted?: (data: any) => void;
  onTripEnded?: (data: any) => void;
  
  // Message callbacks
  onNewMessage?: (data: any) => void;
  
  // Call callbacks - STANDART
  onCallInvite?: (data: any) => void;
  onCallAccepted?: (data: any) => void;
  onCallRejected?: (data: any) => void;
  onCallEnded?: (data: any) => void;
  onCallCancelled?: (data: any) => void;
  onCallRinging?: (data: any) => void;
  
  // Call callbacks - YENİ (Daily.co)
  onCallAcceptedNew?: (data: any) => void;
  onCallEndedNew?: (data: any) => void;
  onIncomingDailyCall?: (data: any) => void;
  onDailyCallAccepted?: (data: any) => void;
  onDailyCallRejected?: (data: any) => void;
  onDailyCallEnded?: (data: any) => void;
  
  // Eski callbacks (uyumluluk için)
  onIncomingCall?: (data: any) => void;
}

// ═══════════════════════════════════════════════════════════════════
// HOOK
// ═══════════════════════════════════════════════════════════════════

export function useSocket(config: UseSocketConfig = {}) {
  const {
    socket,
    isConnected,
    isRegistered,
    connectAndRegister,
    disconnect,
    
    // Emit fonksiyonları
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
    
    // Callback setters
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
  } = useSocketContext();

  // ═══════════════════════════════════════════════════════════════════
  // BAĞLANTI VE KAYIT
  // ═══════════════════════════════════════════════════════════════════
  
  useEffect(() => {
    if (config.userId && config.userRole) {
      console.log(`🔌 [useSocket] connectAndRegister: ${config.userId} (${config.userRole})`);
      connectAndRegister(config.userId, config.userRole);
    }
  }, [config.userId, config.userRole, connectAndRegister]);

  // ═══════════════════════════════════════════════════════════════════
  // EVENT CALLBACK'LERİ - Context üzerinden
  // ═══════════════════════════════════════════════════════════════════
  
  // Message
  useEffect(() => {
    if (config.onNewMessage) {
      setOnNewMessage(config.onNewMessage);
    }
    return () => setOnNewMessage(null);
  }, [config.onNewMessage, setOnNewMessage]);

  // Offer
  useEffect(() => {
    if (config.onNewOffer) {
      setOnNewOffer(config.onNewOffer);
    }
    return () => setOnNewOffer(null);
  }, [config.onNewOffer, setOnNewOffer]);

  useEffect(() => {
    if (config.onOfferAccepted) {
      setOnOfferAccepted(config.onOfferAccepted);
    }
    return () => setOnOfferAccepted(null);
  }, [config.onOfferAccepted, setOnOfferAccepted]);

  useEffect(() => {
    if (config.onOfferRejected) {
      setOnOfferRejected(config.onOfferRejected);
    }
    return () => setOnOfferRejected(null);
  }, [config.onOfferRejected, setOnOfferRejected]);

  // Tag
  useEffect(() => {
    if (config.onNewTag) {
      setOnNewTag(config.onNewTag);
    }
    return () => setOnNewTag(null);
  }, [config.onNewTag, setOnNewTag]);

  useEffect(() => {
    if (config.onTagCancelled) {
      setOnTagCancelled(config.onTagCancelled);
    }
    return () => setOnTagCancelled(null);
  }, [config.onTagCancelled, setOnTagCancelled]);

  // Trip
  useEffect(() => {
    if (config.onTripStarted) {
      setOnTripStarted(config.onTripStarted);
    }
    return () => setOnTripStarted(null);
  }, [config.onTripStarted, setOnTripStarted]);

  useEffect(() => {
    if (config.onTripEnded) {
      setOnTripEnded(config.onTripEnded);
    }
    return () => setOnTripEnded(null);
  }, [config.onTripEnded, setOnTripEnded]);

  // Call - STANDART (call_invite event'i için)
  useEffect(() => {
    // call_invite geldiğinde hangi callback'i çağıracağız?
    // Önce onIncomingDailyCall, yoksa onCallInvite
    const handler = config.onIncomingDailyCall || config.onCallInvite;
    if (handler) {
      setOnCallInvite(handler);
    }
    return () => setOnCallInvite(null);
  }, [config.onIncomingDailyCall, config.onCallInvite, setOnCallInvite]);

  // Call Accepted - call_accepted event'i için
  useEffect(() => {
    // Önce onCallAcceptedNew, yoksa onDailyCallAccepted, yoksa onCallAccepted
    const handler = config.onCallAcceptedNew || config.onDailyCallAccepted || config.onCallAccepted;
    if (handler) {
      setOnCallAccepted(handler);
    }
    return () => setOnCallAccepted(null);
  }, [config.onCallAcceptedNew, config.onDailyCallAccepted, config.onCallAccepted, setOnCallAccepted]);

  // Call Rejected - call_rejected event'i için
  useEffect(() => {
    const handler = config.onDailyCallRejected || config.onCallRejected;
    if (handler) {
      setOnCallRejected(handler);
    }
    return () => setOnCallRejected(null);
  }, [config.onDailyCallRejected, config.onCallRejected, setOnCallRejected]);

  // Call Ended - call_ended event'i için
  useEffect(() => {
    const handler = config.onCallEndedNew || config.onDailyCallEnded || config.onCallEnded;
    if (handler) {
      setOnCallEnded(handler);
    }
    return () => setOnCallEnded(null);
  }, [config.onCallEndedNew, config.onDailyCallEnded, config.onCallEnded, setOnCallEnded]);

  // ═══════════════════════════════════════════════════════════════════
  // RETURN
  // ═══════════════════════════════════════════════════════════════════
  
  return {
    // Durum
    socket,
    isConnected,
    isRegistered,
    socketConnected: isConnected && isRegistered,
    
    // Bağlantı
    connectAndRegister,
    disconnect,
    
    // Teklif
    emitSendOffer,
    emitAcceptOffer,
    emitRejectOffer,
    
    // TAG
    emitCreateTagRequest,
    emitCancelTagRequest,
    
    // Konum
    emitDriverLocationUpdate,
    emitLocationUpdate,
    
    // Yolculuk
    emitTripStarted,
    emitTripEnded,
    forceEndTrip,
    
    // Arama
    emitCallInvite,
    emitCallAccept,
    emitCallReject,
    emitCallCancel,
    emitCallEnd,
    
    // Mesajlaşma
    emitSendMessage,
  };
}

export default useSocket;
