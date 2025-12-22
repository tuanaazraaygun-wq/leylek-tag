/**
 * Supabase Client for Leylek TAG Frontend
 * Real-time konum takibi ve Storage için kullanılır
 */

import { createClient, SupabaseClient, RealtimeChannel } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

// Supabase client instance
let supabaseClient: SupabaseClient | null = null;

/**
 * Supabase client'ı başlat ve döndür
 */
export function getSupabase(): SupabaseClient | null {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.warn('⚠️ Supabase credentials eksik');
    return null;
  }

  if (!supabaseClient) {
    supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      realtime: {
        params: {
          eventsPerSecond: 10,
        },
      },
    });
    console.log('✅ Supabase client oluşturuldu');
  }

  return supabaseClient;
}

// ==================== REALTIME LOCATION TRACKING ====================

interface LocationUpdate {
  user_id: string;
  latitude: number;
  longitude: number;
  heading?: number;
  speed?: number;
  trip_id?: string;
}

/**
 * Canlı konum güncellemesi yayınla (şoför veya yolcu)
 */
export async function broadcastLocation(
  channelName: string,
  location: LocationUpdate
): Promise<boolean> {
  const supabase = getSupabase();
  if (!supabase) return false;

  try {
    const channel = supabase.channel(channelName);
    
    await channel.send({
      type: 'broadcast',
      event: 'location_update',
      payload: {
        ...location,
        timestamp: new Date().toISOString(),
      },
    });

    return true;
  } catch (error) {
    console.error('❌ Konum yayını hatası:', error);
    return false;
  }
}

/**
 * Canlı konum dinlemeye başla
 */
export function subscribeToLocation(
  channelName: string,
  onLocationUpdate: (location: LocationUpdate) => void
): RealtimeChannel | null {
  const supabase = getSupabase();
  if (!supabase) return null;

  try {
    const channel = supabase
      .channel(channelName)
      .on('broadcast', { event: 'location_update' }, (payload) => {
        if (payload.payload) {
          onLocationUpdate(payload.payload as LocationUpdate);
        }
      })
      .subscribe((status) => {
        console.log(`📡 Kanal durumu (${channelName}):`, status);
      });

    return channel;
  } catch (error) {
    console.error('❌ Konum dinleme hatası:', error);
    return null;
  }
}

/**
 * Konum kanalından çık
 */
export async function unsubscribeFromLocation(channel: RealtimeChannel): Promise<void> {
  const supabase = getSupabase();
  if (!supabase || !channel) return;

  try {
    await supabase.removeChannel(channel);
    console.log('🔌 Kanaldan çıkıldı');
  } catch (error) {
    console.error('❌ Kanal çıkış hatası:', error);
  }
}

// ==================== TRIP EVENTS ====================

interface TripEvent {
  trip_id: string;
  event_type: 'offer_sent' | 'offer_accepted' | 'trip_started' | 'trip_completed' | 'trip_cancelled' | 'location_update';
  data?: Record<string, unknown>;
}

/**
 * Trip event yayınla
 */
export async function broadcastTripEvent(tripId: string, event: TripEvent): Promise<boolean> {
  const supabase = getSupabase();
  if (!supabase) return false;

  try {
    const channel = supabase.channel(`trip_${tripId}`);
    
    await channel.send({
      type: 'broadcast',
      event: 'trip_event',
      payload: {
        ...event,
        timestamp: new Date().toISOString(),
      },
    });

    return true;
  } catch (error) {
    console.error('❌ Trip event yayını hatası:', error);
    return false;
  }
}

/**
 * Trip events dinlemeye başla
 */
export function subscribeToTripEvents(
  tripId: string,
  onEvent: (event: TripEvent) => void
): RealtimeChannel | null {
  const supabase = getSupabase();
  if (!supabase) return null;

  try {
    const channel = supabase
      .channel(`trip_${tripId}`)
      .on('broadcast', { event: 'trip_event' }, (payload) => {
        if (payload.payload) {
          onEvent(payload.payload as TripEvent);
        }
      })
      .subscribe();

    return channel;
  } catch (error) {
    console.error('❌ Trip events dinleme hatası:', error);
    return null;
  }
}

// ==================== STORAGE HELPERS ====================

/**
 * Profil fotoğrafı URL'i oluştur
 */
export function getProfilePhotoUrl(userId: string): string {
  if (!SUPABASE_URL) return '';
  return `${SUPABASE_URL}/storage/v1/object/public/profile-photos/${userId}/profile.jpg`;
}

/**
 * Araç fotoğrafı URL'i oluştur
 */
export function getVehiclePhotoUrl(userId: string): string {
  if (!SUPABASE_URL) return '';
  return `${SUPABASE_URL}/storage/v1/object/public/vehicle-photos/${userId}/vehicle.jpg`;
}

// ==================== PRESENCE (Online Status) ====================

interface UserPresence {
  user_id: string;
  user_name: string;
  role: 'driver' | 'passenger';
  location?: {
    latitude: number;
    longitude: number;
  };
  online_at: string;
}

/**
 * Online durumu paylaş ve diğer kullanıcıları gör
 */
export function joinPresenceChannel(
  channelName: string,
  myPresence: UserPresence,
  onSync: (presences: UserPresence[]) => void
): RealtimeChannel | null {
  const supabase = getSupabase();
  if (!supabase) return null;

  try {
    const channel = supabase
      .channel(channelName)
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        const presences: UserPresence[] = [];
        
        Object.values(state).forEach((userPresences: any[]) => {
          userPresences.forEach((presence) => {
            presences.push(presence as UserPresence);
          });
        });
        
        onSync(presences);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({
            ...myPresence,
            online_at: new Date().toISOString(),
          });
        }
      });

    return channel;
  } catch (error) {
    console.error('❌ Presence channel hatası:', error);
    return null;
  }
}

// ==================== UTILITY FUNCTIONS ====================

/**
 * Channel adı oluştur (trip için)
 */
export function getTripChannelName(tripId: string): string {
  return `leylek_trip_${tripId}`;
}

/**
 * Channel adı oluştur (user location için)
 */
export function getUserLocationChannelName(userId: string): string {
  return `leylek_location_${userId}`;
}

/**
 * Channel adı oluştur (city için - yakındaki şoförler)
 */
export function getCityChannelName(city: string): string {
  return `leylek_city_${city.toLowerCase().replace(/\s/g, '_')}`;
}

export default {
  getSupabase,
  broadcastLocation,
  subscribeToLocation,
  unsubscribeFromLocation,
  broadcastTripEvent,
  subscribeToTripEvents,
  getProfilePhotoUrl,
  getVehiclePhotoUrl,
  joinPresenceChannel,
  getTripChannelName,
  getUserLocationChannelName,
  getCityChannelName,
};
