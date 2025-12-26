/**
 * useOffers Hook - Teklif Yönetimi
 * Realtime subscription ile anlık teklif güncellemeleri
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { Alert } from 'react-native';
import Constants from 'expo-constants';

const BACKEND_URL = Constants.expoConfig?.extra?.backendUrl || 
                    process.env.EXPO_PUBLIC_BACKEND_URL || 
                    'https://cabapp-bugfix.preview.emergentagent.com';
const API_URL = `${BACKEND_URL}/api`;

// ==================== TYPES ====================

export interface Offer {
  id: string;
  driver_id: string;
  driver_name: string;
  driver_rating: number;
  driver_photo?: string;
  price: number;
  status: string;
  vehicle_model?: string;
  vehicle_color?: string;
  distance_to_passenger_km?: number;
  estimated_arrival_min?: number;
  trip_distance_km?: number;
  trip_duration_min?: number;
  created_at?: string;
}

export interface UseOffersOptions {
  userId: string;
  tagId?: string;
  isDriver?: boolean;
  enabled?: boolean;
}

export interface UseOffersReturn {
  offers: Offer[];
  isLoading: boolean;
  error: string | null;
  sendOffer: (tagId: string, price: number, location?: {latitude: number; longitude: number}) => Promise<boolean>;
  acceptOffer: (offerId: string) => Promise<boolean>;
  rejectOffer: (offerId: string) => Promise<boolean>;
  refetch: () => void;
}

// ==================== HOOK ====================

export function useOffers(options: UseOffersOptions): UseOffersReturn {
  const { userId, tagId, isDriver = false, enabled = true } = options;
  
  const [offers, setOffers] = useState<Offer[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Cleanup için ref'ler
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isMountedRef = useRef(true);
  const abortControllerRef = useRef<AbortController | null>(null);

  // ==================== FETCH OFFERS ====================
  
  const fetchOffers = useCallback(async () => {
    if (!userId || !tagId || !enabled) return;
    
    // Önceki isteği iptal et
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();
    
    try {
      const response = await fetch(
        `${API_URL}/passenger/offers/${tagId}?user_id=${userId}`,
        { signal: abortControllerRef.current.signal }
      );
      
      if (!isMountedRef.current) return;
      
      const data = await response.json();
      
      if (data.success && data.offers) {
        setOffers(data.offers);
        setError(null);
      }
    } catch (err: any) {
      if (err.name === 'AbortError') return; // İptal edildi, hata değil
      if (isMountedRef.current) {
        setError(err.message || 'Teklifler alınamadı');
      }
    }
  }, [userId, tagId, enabled]);

  // ==================== SEND OFFER (DRIVER) ====================
  
  const sendOffer = useCallback(async (
    targetTagId: string,
    price: number,
    location?: {latitude: number; longitude: number}
  ): Promise<boolean> => {
    if (!userId) return false;
    
    setIsLoading(true);
    
    // Optimistic UI update - hemen "gönderiliyor" göster
    const tempOffer: Offer = {
      id: `temp-${Date.now()}`,
      driver_id: userId,
      driver_name: 'Sen',
      driver_rating: 5.0,
      price,
      status: 'sending',
    };
    
    if (isDriver) {
      // Driver kendi tekliflerini görmüyor, sadece loading göster
    }
    
    try {
      const response = await fetch(`${API_URL}/driver/send-offer?user_id=${userId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tag_id: targetTagId,
          price,
          estimated_time: 15,
          notes: 'Hemen geliyorum!',
          latitude: location?.latitude || 0,
          longitude: location?.longitude || 0
        })
      });
      
      const data = await response.json();
      
      if (data.success || data.offer_id) {
        setIsLoading(false);
        return true;
      } else {
        throw new Error(data.detail || 'Teklif gönderilemedi');
      }
    } catch (err: any) {
      setIsLoading(false);
      setError(err.message);
      Alert.alert('Hata', err.message || 'Teklif gönderilemedi');
      return false;
    }
  }, [userId, isDriver]);

  // ==================== ACCEPT OFFER (PASSENGER) ====================
  
  const acceptOffer = useCallback(async (offerId: string): Promise<boolean> => {
    if (!userId || !tagId) return false;
    
    // Optimistic UI - hemen "kabul edildi" göster
    setOffers(prev => prev.map(o => 
      o.id === offerId ? { ...o, status: 'accepting' } : o
    ));
    
    try {
      const response = await fetch(
        `${API_URL}/passenger/accept-offer/${offerId}?user_id=${userId}&tag_id=${tagId}`,
        { method: 'POST' }
      );
      
      const data = await response.json();
      
      if (data.success) {
        // Diğer teklifleri temizle
        setOffers(prev => prev.filter(o => o.id === offerId));
        return true;
      } else {
        // Geri al
        setOffers(prev => prev.map(o => 
          o.id === offerId ? { ...o, status: 'pending' } : o
        ));
        throw new Error(data.detail || 'Teklif kabul edilemedi');
      }
    } catch (err: any) {
      Alert.alert('Hata', err.message || 'Teklif kabul edilemedi');
      return false;
    }
  }, [userId, tagId]);

  // ==================== REJECT OFFER ====================
  
  const rejectOffer = useCallback(async (offerId: string): Promise<boolean> => {
    if (!userId) return false;
    
    // Optimistic UI - hemen listeden kaldır
    setOffers(prev => prev.filter(o => o.id !== offerId));
    
    try {
      const response = await fetch(
        `${API_URL}/passenger/reject-offer/${offerId}?user_id=${userId}`,
        { method: 'POST' }
      );
      
      const data = await response.json();
      
      if (!data.success) {
        // Başarısız olursa geri getir
        fetchOffers();
      }
      
      return data.success;
    } catch {
      fetchOffers();
      return false;
    }
  }, [userId, fetchOffers]);

  // ==================== POLLING & CLEANUP ====================
  
  useEffect(() => {
    isMountedRef.current = true;
    
    if (!enabled || !tagId) return;
    
    // İlk fetch
    fetchOffers();
    
    // Polling başlat (2 saniyede bir)
    pollingIntervalRef.current = setInterval(fetchOffers, 2000);
    
    // CLEANUP - Component unmount olduğunda
    return () => {
      isMountedRef.current = false;
      
      // Polling'i durdur
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
      
      // Devam eden request'i iptal et
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
      
      console.log('🧹 useOffers cleanup completed');
    };
  }, [enabled, tagId, fetchOffers]);

  // ==================== RETURN ====================
  
  return {
    offers,
    isLoading,
    error,
    sendOffer,
    acceptOffer,
    rejectOffer,
    refetch: fetchOffers
  };
}

export default useOffers;
