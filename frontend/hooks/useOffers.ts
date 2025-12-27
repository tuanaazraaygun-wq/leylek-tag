/**
 * useOffers Hook - Teklif Yönetimi
 * Supabase Realtime ile anlık teklif güncellemeleri
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { Alert } from 'react-native';
import { createClient, RealtimeChannel } from '@supabase/supabase-js';
import Constants from 'expo-constants';

const BACKEND_URL = Constants.expoConfig?.extra?.backendUrl || 
                    process.env.EXPO_PUBLIC_BACKEND_URL || 
                    'https://cabapp-bugfix.preview.emergentagent.com';
const API_URL = `${BACKEND_URL}/api`;

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://ujvploftywsxprlzejgc.supabase.co';
const SUPABASE_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVqdnBsb2Z0eXdzeHBybHplamdjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzQ1NzExMTQsImV4cCI6MjA1MDE0NzExNH0.MM0zFnocqN4mpuqWVqxfLZJqDDC-2uaHa7TXCodDrCY';

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
  sendOffer: (tagId: string, price: number, location?: {latitude: number; longitude: number}) => Promise<boolean>;
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
  
  // Refs for cleanup
  const channelRef = useRef<RealtimeChannel | null>(null);
  const isMountedRef = useRef(true);

  // ==================== SUPABASE REALTIME ====================
  
  useEffect(() => {
    if (!enabled || !tagId) return;
    
    isMountedRef.current = true;
    
    // İlk yükleme
    fetchOffers();
    
    // Offers tablosunu realtime subscribe et
    const channel = supabase
      .channel(`offers:${tagId}`)
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
          console.log('📥 Yeni teklif geldi:', newOffer.price, 'TL');
          
          setOffers(prev => {
            // Duplicate kontrolü
            if (prev.find(o => o.id === newOffer.id)) return prev;
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
            o.id === updatedOffer.id ? updatedOffer : o
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
      .subscribe();
    
    channelRef.current = channel;
    
    // CLEANUP
    return () => {
      isMountedRef.current = false;
      
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
        console.log('🧹 Offers channel removed');
      }
    };
  }, [enabled, tagId]);

  // ==================== FETCH OFFERS ====================
  
  const fetchOffers = useCallback(async () => {
    if (!tagId) return;
    
    try {
      const { data, error } = await supabase
        .from('offers')
        .select('*')
        .eq('tag_id', tagId)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      if (isMountedRef.current && data) {
        setOffers(data);
      }
    } catch (err: any) {
      console.error('Fetch offers error:', err);
      if (isMountedRef.current) {
        setError(err.message);
      }
    }
  }, [tagId]);

  // ==================== SEND OFFER ====================
  
  const sendOffer = useCallback(async (
    targetTagId: string,
    price: number,
    location?: {latitude: number; longitude: number}
  ): Promise<boolean> => {
    if (!userId) return false;
    
    setIsLoading(true);
    
    try {
      // Backend'e gönder - Supabase Realtime ile yolcuya anında ulaşacak
      const response = await fetch(`${API_URL}/driver/send-offer?user_id=${userId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tag_id: targetTagId,
          price,
          latitude: location?.latitude || 0,
          longitude: location?.longitude || 0
        })
      });
      
      const data = await response.json();
      setIsLoading(false);
      
      if (data.success || data.offer_id) {
        return true;
      } else {
        Alert.alert('Hata', data.detail || 'Teklif gönderilemedi');
        return false;
      }
    } catch (err: any) {
      setIsLoading(false);
      Alert.alert('Hata', 'Bağlantı hatası');
      return false;
    }
  }, [userId]);

  // ==================== ACCEPT OFFER ====================
  
  const acceptOffer = useCallback(async (offerId: string): Promise<boolean> => {
    if (!userId || !tagId) return false;
    
    // Optimistic UI
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
      fetchOffers();
      Alert.alert('Hata', 'Bağlantı hatası');
      return false;
    }
  }, [userId, tagId, fetchOffers]);

  // ==================== REJECT OFFER ====================
  
  const rejectOffer = useCallback(async (offerId: string): Promise<boolean> => {
    if (!userId) return false;
    
    // Optimistic UI
    setOffers(prev => prev.filter(o => o.id !== offerId));
    
    try {
      await fetch(
        `${API_URL}/passenger/reject-offer/${offerId}?user_id=${userId}`,
        { method: 'POST' }
      );
      return true;
    } catch {
      fetchOffers();
      return false;
    }
  }, [userId, fetchOffers]);

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
