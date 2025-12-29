/**
 * useOffers Hook - Teklif Yönetimi
 * Supabase Realtime ile anlık teklif güncellemeleri
 * OPTIMISTIC UI - Backend cevabı beklenmeden UI güncellenir
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { Alert } from 'react-native';
import { createClient, RealtimeChannel } from '@supabase/supabase-js';
import Constants from 'expo-constants';

const BACKEND_URL = Constants.expoConfig?.extra?.backendUrl || 
                    process.env.EXPO_PUBLIC_BACKEND_URL || 
                    'https://ridely-app-1.preview.emergentagent.com';
const API_URL = `${BACKEND_URL}/api`;

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://ujvploftywsxprlzejgc.supabase.co';
const SUPABASE_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVqdnBsb2Z0eXdzeHBybHplamdjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY0MTgwNzYsImV4cCI6MjA4MTk5NDA3Nn0.c3I-1K7Guc5OmOxHdc_mhw-pSEsobVE6DN7m-Z9Re8k';

// Singleton Supabase client
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ==================== TYPES ====================

export interface Offer {
  id: string;
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
  distance_to_passenger_km?: number;
  estimated_arrival_min?: number;
  trip_distance_km?: number;
  trip_duration_min?: number;
  created_at?: string;
  _optimistic?: boolean; // Optimistic UI marker
}

export interface UseOffersOptions {
  userId: string;
  tagId?: string;
  isDriver?: boolean;
  enabled?: boolean;
  onNewOffer?: (offer: Offer) => void;
}

export interface UseOffersReturn {
  offers: Offer[];
  isLoading: boolean;
  error: string | null;
  sendOffer: (tagId: string, price: number, location?: {latitude: number; longitude: number}, driverName?: string) => Promise<boolean>;
  acceptOffer: (offerId: string) => Promise<boolean>;
  rejectOffer: (offerId: string) => Promise<boolean>;
  refetch: () => void;
}

// ==================== HOOK ====================

export function useOffers(options: UseOffersOptions): UseOffersReturn {
  const { userId, tagId, isDriver = false, enabled = true, onNewOffer } = options;
  
  const [offers, setOffers] = useState<Offer[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Refs for cleanup and state tracking
  const channelRef = useRef<RealtimeChannel | null>(null);
  const isMountedRef = useRef(true);
  const currentTagIdRef = useRef<string | null>(null);

  // ==================== SUPABASE REALTIME ====================
  // Sadece tagId değiştiğinde subscription kurulur
  
  useEffect(() => {
    // Component mount
    isMountedRef.current = true;
    
    // Cleanup function
    return () => {
      isMountedRef.current = false;
      // KESIN CLEANUP - channel varsa kapat
      if (channelRef.current) {
        console.log('🧹 useOffers CLEANUP - channel kapatılıyor');
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, []); // Sadece mount/unmount'ta çalışır

  useEffect(() => {
    // Enabled değilse veya tagId yoksa subscription kurma
    if (!enabled || !tagId) {
      // Eski subscription varsa kapat
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
        console.log('🧹 Offers channel removed (disabled/no tagId)');
      }
      setOffers([]);
      return;
    }
    
    // TagId değişmediyse tekrar subscription kurma
    if (currentTagIdRef.current === tagId && channelRef.current) {
      return;
    }
    
    // Eski subscription'ı kapat
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
    
    currentTagIdRef.current = tagId;
    console.log('📡 Offers Realtime subscription kuruluyor:', tagId);
    
    // İlk yükleme - async olarak
    fetchOffersInternal(tagId);
    
    // Yeni subscription kur
    const channel = supabase
      .channel(`offers_${tagId}_${Date.now()}`) // Unique channel name
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'offers',
          filter: `tag_id=eq.${tagId}`
        },
        (payload) => {
          if (!isMountedRef.current) return;
          const newOffer = payload.new as Offer;
          console.log('📥 REALTIME: Yeni teklif geldi:', newOffer.price, 'TL');
          
          setOffers(prev => {
            // Duplicate veya optimistic offer kontrolü
            const existing = prev.find(o => o.id === newOffer.id || (o._optimistic && o.price === newOffer.price));
            if (existing) {
              // Optimistic offer'ı gerçek verilerle değiştir
              return prev.map(o => 
                (o.id === newOffer.id || (o._optimistic && o.price === newOffer.price)) 
                  ? { ...newOffer, _optimistic: false } 
                  : o
              );
            }
            return [newOffer, ...prev];
          });
          
          onNewOffer?.(newOffer);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'offers',
          filter: `tag_id=eq.${tagId}`
        },
        (payload) => {
          if (!isMountedRef.current) return;
          const updatedOffer = payload.new as Offer;
          setOffers(prev => prev.map(o => 
            o.id === updatedOffer.id ? { ...updatedOffer, _optimistic: false } : o
          ));
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'offers',
          filter: `tag_id=eq.${tagId}`
        },
        (payload) => {
          if (!isMountedRef.current) return;
          const deletedId = (payload.old as any).id;
          setOffers(prev => prev.filter(o => o.id !== deletedId));
        }
      )
      .subscribe((status) => {
        console.log('📡 Offers Realtime status:', status);
      });
    
    channelRef.current = channel;
    
    // Cleanup for this effect
    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
        console.log('🧹 Offers channel removed (tagId changed)');
      }
    };
  }, [enabled, tagId]); // Sadece enabled veya tagId değişince

  // ==================== FETCH OFFERS (Internal) ====================
  
  const fetchOffersInternal = async (tid: string) => {
    if (!tid || !isMountedRef.current) return;
    
    try {
      const { data, error: fetchError } = await supabase
        .from('offers')
        .select('*')
        .eq('tag_id', tid)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });
      
      if (fetchError) throw fetchError;
      if (isMountedRef.current && data) {
        setOffers(data);
      }
    } catch (err: any) {
      console.error('Fetch offers error:', err);
      if (isMountedRef.current) {
        setError(err.message);
      }
    }
  };

  // ==================== REFETCH (Public) ====================
  
  const refetch = useCallback(() => {
    if (tagId) {
      fetchOffersInternal(tagId);
    }
  }, [tagId]);

  // ==================== SEND OFFER (OPTIMISTIC UI) ====================
  
  const sendOffer = useCallback(async (
    targetTagId: string,
    price: number,
    location?: {latitude: number; longitude: number},
    driverName?: string
  ): Promise<boolean> => {
    if (!userId) return false;
    
    // 1. OPTIMISTIC UI - Hemen ekle, backend bekleme
    const optimisticId = `optimistic_${Date.now()}`;
    const optimisticOffer: Offer = {
      id: optimisticId,
      tag_id: targetTagId,
      driver_id: userId,
      driver_name: driverName || 'Sürücü',
      driver_rating: 5,
      price: price,
      status: 'pending',
      notes: 'Gönderiliyor...',
      created_at: new Date().toISOString(),
      _optimistic: true
    };
    
    // UI'ı hemen güncelle
    setOffers(prev => [optimisticOffer, ...prev]);
    setIsLoading(true);
    
    // 2. Backend'e gönder (arka planda)
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 saniye timeout
      
      const response = await fetch(`${API_URL}/driver/send-offer?user_id=${userId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tag_id: targetTagId,
          price,
          latitude: location?.latitude || 0,
          longitude: location?.longitude || 0
        }),
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (!isMountedRef.current) return true;
      
      const data = await response.json();
      setIsLoading(false);
      
      if (data.success || data.offer_id) {
        // Optimistic offer'ı gerçek ID ile güncelle (Realtime zaten yapacak ama yine de)
        setOffers(prev => prev.map(o => 
          o.id === optimisticId 
            ? { ...o, id: data.offer_id || optimisticId, notes: '', _optimistic: false }
            : o
        ));
        console.log('✅ Teklif başarıyla gönderildi');
        return true;
      } else {
        // Hata - optimistic offer'ı kaldır
        setOffers(prev => prev.filter(o => o.id !== optimisticId));
        Alert.alert('Hata', data.detail || 'Teklif gönderilemedi');
        return false;
      }
    } catch (err: any) {
      if (!isMountedRef.current) return false;
      
      setIsLoading(false);
      // Hata - optimistic offer'ı kaldır
      setOffers(prev => prev.filter(o => o.id !== optimisticId));
      
      if (err.name === 'AbortError') {
        Alert.alert('Zaman Aşımı', 'Sunucu yanıt vermedi. Lütfen tekrar deneyin.');
      } else {
        Alert.alert('Hata', 'Bağlantı hatası');
      }
      return false;
    }
  }, [userId]);

  // ==================== ACCEPT OFFER (OPTIMISTIC UI) ====================
  
  const acceptOffer = useCallback(async (offerId: string): Promise<boolean> => {
    if (!userId || !tagId) return false;
    
    // Optimistic UI - hemen status değiştir
    setOffers(prev => prev.map(o => 
      o.id === offerId ? { ...o, status: 'accepting' } : o
    ));
    
    try {
      const response = await fetch(
        `${API_URL}/passenger/accept-offer?user_id=${userId}&offer_id=${offerId}`,
        { method: 'POST' }
      );
      
      if (!isMountedRef.current) return true;
      
      const data = await response.json();
      
      if (data.success) {
        // Sadece kabul edilen teklifi tut
        setOffers(prev => prev.filter(o => o.id === offerId));
        return true;
      } else {
        // Rollback
        setOffers(prev => prev.map(o => 
          o.id === offerId ? { ...o, status: 'pending' } : o
        ));
        Alert.alert('Hata', data.detail || 'Teklif kabul edilemedi');
        return false;
      }
    } catch (err) {
      if (!isMountedRef.current) return false;
      // Rollback
      refetch();
      Alert.alert('Hata', 'Bağlantı hatası');
      return false;
    }
  }, [userId, tagId, refetch]);

  // ==================== REJECT OFFER (OPTIMISTIC UI) ====================
  
  const rejectOffer = useCallback(async (offerId: string): Promise<boolean> => {
    if (!userId) return false;
    
    // Optimistic UI - hemen kaldır
    const removedOffer = offers.find(o => o.id === offerId);
    setOffers(prev => prev.filter(o => o.id !== offerId));
    
    try {
      await fetch(
        `${API_URL}/passenger/dismiss-offer?user_id=${userId}&offer_id=${offerId}`,
        { method: 'POST' }
      );
      return true;
    } catch {
      // Rollback - geri ekle
      if (removedOffer && isMountedRef.current) {
        setOffers(prev => [removedOffer, ...prev]);
      }
      return false;
    }
  }, [userId, offers]);

  // ==================== RETURN ====================
  
  return {
    offers: offers.filter(o => !o._optimistic || o.status === 'pending'), // Sadece geçerli teklifleri döndür
    isLoading,
    error,
    sendOffer,
    acceptOffer,
    rejectOffer,
    refetch
  };
}

export default useOffers;
