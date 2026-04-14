/**
 * useOffers Hook v3.0 - SIMPLIFIED
 * 
 * 🔥 REFACTORED: Socket listener'lar KALDIRILDI
 * - Bu hook artık sadece state management ve API çağrıları yapar
 * - Socket eventleri index.tsx'teki useSocket hook'u ile dinlenir
 * - Yeni teklifler addOffer() fonksiyonu ile eklenir
 * 
 * Bu yaklaşımın avantajları:
 * 1. Çift listener sorunu çözüldü
 * 2. Daha basit ve anlaşılır kod
 * 3. Hook sıralaması sorunu yok
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { Alert } from 'react-native';
import { API_BASE_URL } from '../lib/backendConfig';

// ==================== TYPES ====================

export interface Offer {
  id: string;
  offer_id?: string;
  request_id?: string;
  tag_id: string;
  driver_id: string;
  driver_name: string;
  driver_rating?: number;
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
  requestId?: string;
  isDriver?: boolean;
  enabled?: boolean;
}

export interface UseOffersReturn {
  offers: Offer[];
  isLoading: boolean;
  error: string | null;
  acceptOffer: (offerId: string, driverId: string, tagId?: string, requestId?: string) => Promise<boolean>;
  rejectOffer: (offerId: string, driverId: string) => Promise<boolean>;
  clearOffers: () => void;
  addOffer: (offer: Partial<Offer>) => void;
  removeOffer: (offerId: string) => void;
  updateOfferStatus: (offerId: string, status: string) => void;
  /** DB’de güncellenen mesafe/süre alanlarını çeker (socket minimal geldiğinde). */
  refreshOffersForTag: (tagId: string) => Promise<void>;
}

// ==================== HOOK ====================

export function useOffers(options: UseOffersOptions): UseOffersReturn {
  const { 
    userId, 
    tagId, 
    requestId,
    isDriver = false, 
    enabled = true
  } = options;
  
  const [offers, setOffers] = useState<Offer[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const isMountedRef = useRef(true);
  const seenOfferIdsRef = useRef<Set<string>>(new Set());
  const currentRequestIdRef = useRef<string | null>(null);

  // Lifecycle
  useEffect(() => {
    isMountedRef.current = true;
    return () => { isMountedRef.current = false; };
  }, []);

  // Request ID değiştiğinde teklifleri temizle
  useEffect(() => {
    if (requestId && requestId !== currentRequestIdRef.current) {
      console.log('🔄 [useOffers] Request ID changed:', currentRequestIdRef.current, '->', requestId);
      currentRequestIdRef.current = requestId;
      setOffers([]);
      seenOfferIdsRef.current.clear();
    }
  }, [requestId]);

  // ==================== ADD OFFER (Socket'ten) ====================
  
  const addOffer = useCallback((offerData: Partial<Offer>) => {
    const offerId = offerData.id || offerData.offer_id || `offer_${Date.now()}`;
    
    // Duplicate prevention
    if (seenOfferIdsRef.current.has(offerId)) {
      console.log('⚠️ [useOffers] Duplicate offer ignored:', offerId);
      return;
    }
    
    seenOfferIdsRef.current.add(offerId);
    
    const newOffer: Offer = {
      id: offerId,
      offer_id: offerData.offer_id || offerId,
      request_id: offerData.request_id || requestId,
      tag_id: offerData.tag_id || tagId || '',
      driver_id: offerData.driver_id || '',
      driver_name: offerData.driver_name || 'Şoför',
      driver_rating: offerData.driver_rating || 5,
      driver_photo: offerData.driver_photo,
      price: offerData.price || 0,
      notes: offerData.notes,
      status: offerData.status || 'pending',
      vehicle_model: offerData.vehicle_model,
      vehicle_color: offerData.vehicle_color,
      distance_km: offerData.distance_km,
      distance_to_passenger_km: offerData.distance_to_passenger_km,
      estimated_arrival_min: offerData.estimated_arrival_min,
      trip_distance_km: offerData.trip_distance_km,
      trip_duration_min: offerData.trip_duration_min,
      created_at: offerData.created_at || new Date().toISOString(),
      _optimistic: offerData._optimistic || false
    };
    
    console.log('📥 [useOffers] ADD OFFER:', newOffer.price, 'TL from', newOffer.driver_name);
    
    setOffers(prev => {
      // Son kontrol - state'te duplicate var mı?
      if (prev.some(o => o.id === offerId || o.offer_id === offerId)) {
        return prev;
      }
      return [newOffer, ...prev];
    });
  }, [requestId, tagId]);

  const refreshOffersForTag = useCallback(
    async (tId: string) => {
      if (!userId || !tId) return;
      try {
        const url = `${API_BASE_URL}/passenger/offers?user_id=${encodeURIComponent(userId)}&tag_id=${encodeURIComponent(tId)}`;
        const response = await fetch(url);
        const data = await response.json();
        if (!data.success || !Array.isArray(data.offers)) return;

        const mapRow = (u: Record<string, unknown>): Offer => {
          const id = String(u.id ?? '');
          const num = (x: unknown) => (typeof x === 'number' && Number.isFinite(x) ? x : null);
          const dtp = num(u.distance_to_passenger_km);
          const earr = num(u.estimated_arrival_min);
          const tdk = num(u.trip_distance_km);
          const tdm = num(u.trip_duration_min);
          return {
            id,
            offer_id: id,
            request_id: requestId,
            tag_id: tId,
            driver_id: String(u.driver_id ?? ''),
            driver_name: String(u.driver_name ?? 'Şoför'),
            driver_rating: typeof u.driver_rating === 'number' ? u.driver_rating : 5,
            driver_photo: typeof u.driver_photo === 'string' ? u.driver_photo : undefined,
            price: typeof u.price === 'number' ? u.price : Number(u.price) || 0,
            notes: typeof u.notes === 'string' ? u.notes : undefined,
            status: String(u.status || 'pending'),
            vehicle_model: typeof u.vehicle_model === 'string' ? u.vehicle_model : undefined,
            vehicle_color: typeof u.vehicle_color === 'string' ? u.vehicle_color : undefined,
            distance_to_passenger_km: dtp ?? undefined,
            estimated_arrival_min: earr ?? undefined,
            trip_distance_km: tdk ?? undefined,
            trip_duration_min: tdm != null ? Math.round(tdm) : undefined,
            created_at: typeof u.created_at === 'string' ? u.created_at : new Date().toISOString(),
          };
        };

        setOffers((prev) => {
          const fromApi = (data.offers as Record<string, unknown>[]).map((row) => mapRow(row));
          const apiById = new Map(fromApi.map((o) => [o.id, o]));
          const merged = new Map<string, Offer>();

          for (const o of fromApi) {
            const loc = prev.find((p) => p.id === o.id || p.offer_id === o.id);
            merged.set(o.id, { ...(loc || {}), ...o, tag_id: tId } as Offer);
          }
          for (const p of prev) {
            if (apiById.has(p.id) || apiById.has(p.offer_id || '')) continue;
            if (p.status === 'pending' || p.status === 'accepting') {
              merged.set(p.id, p);
            }
          }
          return Array.from(merged.values());
        });

        for (const row of data.offers as { id?: string }[]) {
          const oid = row.id != null ? String(row.id) : '';
          if (oid) seenOfferIdsRef.current.add(oid);
        }
      } catch (e) {
        console.warn('[useOffers] refreshOffersForTag:', e);
      }
    },
    [userId, requestId],
  );

  // ==================== REMOVE OFFER ====================
  
  const removeOffer = useCallback((offerId: string) => {
    setOffers(prev => prev.filter(o => o.id !== offerId && o.offer_id !== offerId));
    seenOfferIdsRef.current.delete(offerId);
  }, []);

  // ==================== UPDATE OFFER STATUS ====================
  
  const updateOfferStatus = useCallback((offerId: string, status: string) => {
    setOffers(prev => prev.map(o => 
      (o.id === offerId || o.offer_id === offerId) 
        ? { ...o, status } 
        : o
    ));
  }, []);

  // ==================== ACCEPT OFFER (API) ====================
  
  const acceptOffer = useCallback(async (
    offerId: string, 
    driverId: string,
    offerTagId?: string,
    offerRequestId?: string
  ): Promise<boolean> => {
    if (!userId) return false;
    
    // Optimistic UI
    updateOfferStatus(offerId, 'accepting');
    setIsLoading(true);
    
    try {
      // 🔥 driver_id ve tag_id de gönder - backend bu bilgilerle teklifi bulabilir
      const params = new URLSearchParams({
        user_id: userId,
        offer_id: offerId,
      });
      if (driverId) params.append('driver_id', driverId);
      if (offerTagId) params.append('tag_id', offerTagId);
      
      console.log('🔥 [useOffers] Accept offer API call:', params.toString());
      
      const response = await fetch(
        `${API_BASE_URL}/passenger/accept-offer?${params.toString()}`,
        { method: 'POST' }
      );
      
      if (!isMountedRef.current) return true;
      
      const data = await response.json();
      setIsLoading(false);
      
      console.log('📥 [useOffers] Accept offer API response:', JSON.stringify(data));
      
      if (data.success) {
        // Sadece kabul edilen teklifi tut
        setOffers(prev => prev.filter(o => o.id === offerId || o.offer_id === offerId));
        updateOfferStatus(offerId, 'accepted');
        console.log('✅ [useOffers] Offer accepted via API:', offerId);
        return true;
      } else {
        // Rollback
        updateOfferStatus(offerId, 'pending');
        Alert.alert('Hata', data.detail || 'Teklif kabul edilemedi');
        return false;
      }
    } catch (err) {
      if (!isMountedRef.current) return false;
      setIsLoading(false);
      updateOfferStatus(offerId, 'pending');
      console.error('❌ [useOffers] Accept offer error:', err);
      Alert.alert('Hata', 'Bağlantı hatası');
      return false;
    }
  }, [userId, updateOfferStatus]);

  // ==================== REJECT OFFER (API) ====================
  
  const rejectOffer = useCallback(async (offerId: string, driverId: string): Promise<boolean> => {
    if (!userId) return false;
    
    // Optimistic UI - hemen kaldır
    const removedOffer = offers.find(o => o.id === offerId || o.offer_id === offerId);
    removeOffer(offerId);
    
    try {
      await fetch(
        `${API_BASE_URL}/passenger/dismiss-offer?user_id=${userId}&offer_id=${offerId}`,
        { method: 'POST' }
      );
      console.log('❌ [useOffers] Offer rejected via API:', offerId);
      return true;
    } catch {
      // Rollback
      if (removedOffer && isMountedRef.current) {
        addOffer(removedOffer);
      }
      return false;
    }
  }, [userId, offers, removeOffer, addOffer]);

  // ==================== CLEAR OFFERS ====================
  
  const clearOffers = useCallback(() => {
    setOffers([]);
    seenOfferIdsRef.current.clear();
    console.log('🧹 [useOffers] Offers cleared');
  }, []);

  // ==================== RETURN ====================
  
  return {
    offers: offers.filter(o => o.status === 'pending' || o.status === 'accepting' || o.status === 'accepted'),
    isLoading,
    error,
    acceptOffer,
    rejectOffer,
    clearOffers,
    addOffer,
    removeOffer,
    updateOfferStatus,
    refreshOffersForTag,
  };
}

export default useOffers;
