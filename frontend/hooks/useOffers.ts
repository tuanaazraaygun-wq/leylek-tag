/**
 * useOffers Hook v2.0 - Socket.IO ONLY
 * 
 * REFACTORED: 
 * - NO Supabase Realtime (REMOVED)
 * - Socket.IO ONLY for realtime events
 * - request_id for duplicate prevention
 * - Optimistic UI supported
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { Alert } from 'react-native';
import Constants from 'expo-constants';

const BACKEND_URL = Constants.expoConfig?.extra?.backendUrl || 
                    process.env.EXPO_PUBLIC_BACKEND_URL || 
                    'https://riderlink-1.preview.emergentagent.com';
const API_URL = `${BACKEND_URL}/api`;

// ==================== TYPES ====================

export interface Offer {
  id: string;
  offer_id?: string;  // Socket'ten gelen offer_id
  request_id?: string;
  tag_id: string;
  driver_id: string;
  driver_name: string;
  driver_rating: number;
  driver_photo?: string;
  price: number;
  notes?: string;
  status: string;
  vehicle_model?: string;
  vehicle_color?: string;
  distance_km?: number;
  distance_to_passenger_km?: number;
  estimated_arrival_min?: number;
  trip_distance_km?: number;
  trip_duration_min?: number;
  created_at?: string;
  _optimistic?: boolean;
}

export interface UseOffersOptions {
  userId: string;
  tagId?: string;
  requestId?: string;  // NEW: request_id for duplicate prevention
  isDriver?: boolean;
  enabled?: boolean;
  socket?: any;  // Socket.IO instance
  emitAcceptOffer?: (data: any) => void;  // 🔥 Direct emit function from useSocket
  emitRejectOffer?: (data: any) => void;  // 🔥 Direct emit function from useSocket
  // 🔥 REMOVED: onNewOffer - artık addOffer fonksiyonu kullanılıyor
  onOfferAccepted?: (data: any) => void;
  onOfferRejected?: (data: any) => void;
}

export interface UseOffersReturn {
  offers: Offer[];
  isLoading: boolean;
  error: string | null;
  sendOffer: (tagId: string, price: number, requestId: string, location?: {latitude: number; longitude: number}, driverName?: string) => Promise<boolean>;
  acceptOffer: (offerId: string, driverId: string) => Promise<boolean>;
  rejectOffer: (offerId: string, driverId: string) => Promise<boolean>;
  clearOffers: () => void;
  addOffer: (offer: Offer) => void;
}

// ==================== HOOK ====================

export function useOffers(options: UseOffersOptions): UseOffersReturn {
  const { 
    userId, 
    tagId, 
    requestId,
    isDriver = false, 
    enabled = true, 
    socket,
    emitAcceptOffer,  // 🔥 Direct emit
    emitRejectOffer,  // 🔥 Direct emit
    // 🔥 REMOVED: onNewOffer
    onOfferAccepted,
    onOfferRejected
  } = options;
  
  const [offers, setOffers] = useState<Offer[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const isMountedRef = useRef(true);
  const seenOfferIdsRef = useRef<Set<string>>(new Set()); // Duplicate prevention
  const currentRequestIdRef = useRef<string | null>(null);

  // ==================== SOCKET EVENT LISTENERS ====================
  // 🔥 REFACTORED: new_offer listener KALDIRILDI
  // Artık sadece addOffer() fonksiyonu ile dışarıdan ekleniyor (index.tsx'teki onNewOffer callback'ından)
  // Bu sayede çift listener sorunu çözüldü
  
  useEffect(() => {
    isMountedRef.current = true;
    
    // Request ID değiştiğinde eski teklifleri temizle
    if (requestId && requestId !== currentRequestIdRef.current) {
      console.log('🔄 [useOffers] Request ID changed, clearing offers');
      currentRequestIdRef.current = requestId;
      setOffers([]);
      seenOfferIdsRef.current.clear();
    }
    
    // Socket yoksa veya disabled ise sadece cleanup yap
    if (!enabled || !socket) {
      console.log('⚠️ [useOffers] Socket listeners NOT registered (disabled or no socket)');
      return;
    }
    
    // OFFER ACCEPTED - driver side (şoförün teklifinin kabul edildiği bildirimi)
    const handleOfferAccepted = (data: any) => {
      if (!isMountedRef.current) return;
      console.log('✅ [useOffers] OFFER ACCEPTED:', data);
      
      setOffers(prev => prev.map(o => 
        (o.id === data.offer_id || o.offer_id === data.offer_id) 
          ? { ...o, status: 'accepted' } 
          : o
      ));
      
      onOfferAccepted?.(data);
    };
    
    // OFFER REJECTED - driver side (şoförün teklifinin reddedildiği bildirimi)
    const handleOfferRejected = (data: any) => {
      if (!isMountedRef.current) return;
      console.log('❌ [useOffers] OFFER REJECTED:', data);
      
      setOffers(prev => prev.filter(o => 
        o.id !== data.offer_id && o.offer_id !== data.offer_id
      ));
      
      onOfferRejected?.(data);
    };
    
    // OFFER SENT ACK - driver side (teklif gönderildiğinin onayı)
    const handleOfferSentAck = (data: any) => {
      if (!isMountedRef.current) return;
      console.log('✅ [useOffers] Offer sent acknowledged:', data);
      setIsLoading(false);
      
      // Update optimistic offer with real ID
      if (data.offer_id) {
        setOffers(prev => prev.map(o => 
          o._optimistic 
            ? { ...o, id: data.offer_id, offer_id: data.offer_id, _optimistic: false }
            : o
        ));
      }
    };
    
    // TAG CANCELLED
    const handleTagCancelled = (data: any) => {
      if (!isMountedRef.current) return;
      
      if (data.request_id === requestId || data.tag_id === tagId) {
        console.log('🚫 [useOffers] TAG CANCELLED, clearing offers');
        setOffers([]);
        seenOfferIdsRef.current.clear();
      }
    };
    
    // 🔥 NOT: socket.on('new_offer') KALDIRILDI - useSocket hook'undaki listener yeterli
    // Register listeners (new_offer HARIC)
    socket.on('offer_accepted', handleOfferAccepted);
    socket.on('offer_rejected', handleOfferRejected);
    socket.on('offer_sent_ack', handleOfferSentAck);
    socket.on('tag_cancelled', handleTagCancelled);
    
    console.log('📡 [useOffers] Socket listeners registered (new_offer HARIC - addOffer kullanılıyor)');
    
    return () => {
      isMountedRef.current = false;
      socket.off('offer_accepted', handleOfferAccepted);
      socket.off('offer_rejected', handleOfferRejected);
      socket.off('offer_sent_ack', handleOfferSentAck);
      socket.off('tag_cancelled', handleTagCancelled);
      console.log('🧹 [useOffers] Socket listeners removed');
    };
  }, [enabled, socket, requestId, tagId, onOfferAccepted, onOfferRejected]);

  // ==================== SEND OFFER (Driver) ====================
  
  const sendOffer = useCallback(async (
    targetTagId: string,
    price: number,
    targetRequestId: string,
    location?: {latitude: number; longitude: number},
    driverName?: string
  ): Promise<boolean> => {
    if (!userId || !socket) return false;
    
    // 1. OPTIMISTIC UI
    const optimisticId = `optimistic_${Date.now()}`;
    const optimisticOffer: Offer = {
      id: optimisticId,
      request_id: targetRequestId,
      tag_id: targetTagId,
      driver_id: userId,
      driver_name: driverName || 'Sen',
      driver_rating: 5,
      price: price,
      status: 'pending',
      notes: 'Gönderiliyor...',
      created_at: new Date().toISOString(),
      _optimistic: true
    };
    
    setOffers(prev => [optimisticOffer, ...prev]);
    setIsLoading(true);
    
    // 2. Send via Socket.IO (also save to backend)
    try {
      // First, save to backend for persistence
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);
      
      const response = await fetch(`${API_URL}/driver/send-offer?user_id=${userId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tag_id: targetTagId,
          request_id: targetRequestId,
          price,
          latitude: location?.latitude || 0,
          longitude: location?.longitude || 0
        }),
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (!isMountedRef.current) return true;
      
      const data = await response.json();
      
      if (data.success || data.offer_id) {
        // 3. Emit via socket for realtime notification
        socket.emit('send_offer', {
          request_id: targetRequestId,
          tag_id: targetTagId,
          offer_id: data.offer_id,
          driver_id: userId,
          driver_name: driverName,
          price: price,
          notes: ''
        });
        
        // Update optimistic offer
        setOffers(prev => prev.map(o => 
          o.id === optimisticId 
            ? { ...o, id: data.offer_id, offer_id: data.offer_id, notes: '', _optimistic: false }
            : o
        ));
        
        console.log('✅ [useOffers] Offer sent:', data.offer_id);
        setIsLoading(false);
        return true;
      } else {
        // Failed - remove optimistic
        setOffers(prev => prev.filter(o => o.id !== optimisticId));
        setIsLoading(false);
        Alert.alert('Hata', data.detail || 'Teklif gönderilemedi');
        return false;
      }
    } catch (err: any) {
      if (!isMountedRef.current) return false;
      
      setIsLoading(false);
      setOffers(prev => prev.filter(o => o.id !== optimisticId));
      
      if (err.name === 'AbortError') {
        Alert.alert('Zaman Aşımı', 'Sunucu yanıt vermedi');
      } else {
        Alert.alert('Hata', 'Bağlantı hatası');
      }
      return false;
    }
  }, [userId, socket]);

  // ==================== ACCEPT OFFER (Passenger) ====================
  
  const acceptOffer = useCallback(async (offerId: string, driverId: string): Promise<boolean> => {
    if (!userId) return false;
    
    // Optimistic UI
    setOffers(prev => prev.map(o => 
      o.id === offerId || o.offer_id === offerId 
        ? { ...o, status: 'accepting' } 
        : o
    ));
    
    try {
      // Save to backend
      const response = await fetch(
        `${API_URL}/passenger/accept-offer?user_id=${userId}&offer_id=${offerId}`,
        { method: 'POST' }
      );
      
      if (!isMountedRef.current) return true;
      
      const data = await response.json();
      
      if (data.success) {
        // 🔥 FIX: Use emitAcceptOffer from useSocket if available, otherwise try socket
        const acceptPayload = {
          request_id: requestId,
          offer_id: offerId,
          driver_id: driverId,
          tag_id: tagId,
          passenger_id: userId
        };
        
        console.log('🔥 [useOffers] Accept offer payload:', acceptPayload);
        
        if (emitAcceptOffer) {
          console.log('✅ [useOffers] Using emitAcceptOffer from useSocket');
          emitAcceptOffer(acceptPayload);
        } else if (socket?.connected) {
          console.log('✅ [useOffers] Using socket.emit directly');
          socket.emit('accept_offer', acceptPayload);
        } else {
          console.warn('⚠️ [useOffers] No socket available for accept_offer!');
        }
        
        // Keep only accepted offer
        setOffers(prev => prev.filter(o => o.id === offerId || o.offer_id === offerId));
        return true;
      } else {
        // Rollback
        setOffers(prev => prev.map(o => 
          o.id === offerId || o.offer_id === offerId 
            ? { ...o, status: 'pending' } 
            : o
        ));
        Alert.alert('Hata', data.detail || 'Teklif kabul edilemedi');
        return false;
      }
    } catch (err) {
      if (!isMountedRef.current) return false;
      setOffers(prev => prev.map(o => 
        o.id === offerId || o.offer_id === offerId 
          ? { ...o, status: 'pending' } 
          : o
      ));
      Alert.alert('Hata', 'Bağlantı hatası');
      return false;
    }
  }, [userId, socket, emitAcceptOffer, requestId, tagId]);

  // ==================== REJECT OFFER (Passenger) ====================
  
  const rejectOffer = useCallback(async (offerId: string, driverId: string): Promise<boolean> => {
    if (!userId || !socket) return false;
    
    // Optimistic UI - remove immediately
    const removedOffer = offers.find(o => o.id === offerId || o.offer_id === offerId);
    setOffers(prev => prev.filter(o => o.id !== offerId && o.offer_id !== offerId));
    
    try {
      await fetch(
        `${API_URL}/passenger/dismiss-offer?user_id=${userId}&offer_id=${offerId}`,
        { method: 'POST' }
      );
      
      // Emit via socket
      socket.emit('reject_offer', {
        request_id: requestId,
        offer_id: offerId,
        driver_id: driverId
      });
      
      return true;
    } catch {
      // Rollback
      if (removedOffer && isMountedRef.current) {
        setOffers(prev => [removedOffer, ...prev]);
      }
      return false;
    }
  }, [userId, socket, requestId, offers]);

  // ==================== UTILITY FUNCTIONS ====================
  
  const clearOffers = useCallback(() => {
    setOffers([]);
    seenOfferIdsRef.current.clear();
    console.log('🧹 [useOffers] Offers cleared');
  }, []);
  
  const addOffer = useCallback((offer: Offer) => {
    const offerId = offer.id || offer.offer_id;
    if (offerId && !seenOfferIdsRef.current.has(offerId)) {
      seenOfferIdsRef.current.add(offerId);
      setOffers(prev => [offer, ...prev]);
    }
  }, []);

  // ==================== RETURN ====================
  
  return {
    offers: offers.filter(o => o.status === 'pending' || o.status === 'accepting' || o.status === 'accepted'),
    isLoading,
    error,
    sendOffer,
    acceptOffer,
    rejectOffer,
    clearOffers,
    addOffer
  };
}

export default useOffers;
