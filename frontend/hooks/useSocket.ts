/**
 * useSocket.ts - Socket Hook v4.0
 * 
 * KURALLAR:
 * 1. Socket SADECE SocketContext'ten gelir
 * 2. getOrCreateSocket KALDIRILDI
 * 3. Tüm event listener'lar context'teki callback setter'lar ile
 * 4. emit fonksiyonları doğrudan context'ten
 */

import { useEffect, useCallback } from 'react';
import { useSocketContext } from '../contexts/SocketContext';

// ═══════════════════════════════════════════════════════════════════
// HOOK CONFIG
// ═══════════════════════════════════════════════════════════════════

interface UseSocketConfig {
  userId?: string;
  userRole?: 'passenger' | 'driver';
  
  // Event callbacks
  onNewTag?: (data: any) => void;
  onTagCancelled?: (data: any) => void;
  onNewOffer?: (data: any) => void;
  onOfferAccepted?: (data: any) => void;
  onOfferRejected?: (data: any) => void;
  onTripStarted?: (data: any) => void;
  onTripEnded?: (data: any) => void;
  onNewMessage?: (data: any) => void;
  onCallInvite?: (data: any) => void;
  onCallAccepted?: (data: any) => void;
  onCallRejected?: (data: any) => void;
  onCallEnded?: (data: any) => void;
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
  // EVENT CALLBACK'LERİ AYARLA
  // ═══════════════════════════════════════════════════════════════════
  
  useEffect(() => {
    if (config.onNewMessage) {
      setOnNewMessage(config.onNewMessage);
    }
    return () => setOnNewMessage(null);
  }, [config.onNewMessage, setOnNewMessage]);

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

  useEffect(() => {
    if (config.onCallInvite) {
      setOnCallInvite(config.onCallInvite);
    }
    return () => setOnCallInvite(null);
  }, [config.onCallInvite, setOnCallInvite]);

  useEffect(() => {
    if (config.onCallAccepted) {
      setOnCallAccepted(config.onCallAccepted);
    }
    return () => setOnCallAccepted(null);
  }, [config.onCallAccepted, setOnCallAccepted]);

  useEffect(() => {
    if (config.onCallRejected) {
      setOnCallRejected(config.onCallRejected);
    }
    return () => setOnCallRejected(null);
  }, [config.onCallRejected, setOnCallRejected]);

  useEffect(() => {
    if (config.onCallEnded) {
      setOnCallEnded(config.onCallEnded);
    }
    return () => setOnCallEnded(null);
  }, [config.onCallEnded, setOnCallEnded]);

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
