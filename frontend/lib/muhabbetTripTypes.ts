/**
 * Muhabbet Leylek trip — doğruluk kaynağı REST (`GET /muhabbet/trip-sessions/:id` ve ilgili POST’lar).
 * Socket yalnızca `muhabbet_trip_session_updated` ile GET yenilemesini hızlandırabilir; iş sonucu socket’e bağlı olmamalıdır.
 */
export type MuhabbetTripStatus = 'ready' | 'started' | 'active' | 'cancelled' | 'finished' | 'expired';

export type MuhabbetTripSession = {
  id: string;
  session_id?: string;
  conversion_request_id?: string | null;
  conversation_id?: string | null;
  listing_id?: string | null;
  listing_match_request_id?: string | null;
  requester_user_id?: string | null;
  passenger_id: string;
  driver_id: string;
  status: MuhabbetTripStatus;
  city?: string | null;
  pickup_text?: string | null;
  pickup_lat?: number | null;
  pickup_lng?: number | null;
  dropoff_text?: string | null;
  dropoff_lat?: number | null;
  dropoff_lng?: number | null;
  agreed_price?: number | string | null;
  vehicle_kind?: 'car' | 'motorcycle' | null;
  payment_method?: 'cash' | 'card' | null;
  payment_method_selected_at?: string | null;
  route_polyline?: string | null;
  route_distance_km?: number | null;
  route_duration_min?: number | null;
  route_source?: string | null;
  route_updated_at?: string | null;
  /** Sunucu: ready | pending | unavailable */
  route_projection_status?: 'ready' | 'pending' | 'unavailable' | string | null;
  passenger_location_lat?: number | null;
  passenger_location_lng?: number | null;
  passenger_location_updated_at?: string | null;
  driver_location_lat?: number | null;
  driver_location_lng?: number | null;
  driver_location_updated_at?: string | null;
  trust_status?: 'requested' | 'accepted' | 'declined' | null;
  trust_requested_by_user_id?: string | null;
  trust_resolved_by_user_id?: string | null;
  trust_requested_at?: string | null;
  trust_resolved_at?: string | null;
  navigation_status?: string | null;
  started_at?: string | null;
  cancelled_at?: string | null;
  cancelled_by_user_id?: string | null;
  cancel_reason?: string | null;
  finished_at?: string | null;
  finished_by_user_id?: string | null;
  finish_method?: 'qr' | 'forced' | 'forced_timeout' | null;
  forced_finish_requested_by_user_id?: string | null;
  forced_finish_requested_at?: string | null;
  forced_finish_started_at?: string | null;
  forced_finish_timeout_at?: string | null;
  forced_finish_request_id?: string | null;
  forced_finish_resolved_at?: string | null;
  forced_finish_confirmed_by_user_id?: string | null;
  forced_finish_confirmed_at?: string | null;
  forced_finish_other_user_response?:
    | 'accepted'
    | 'declined'
    | 'timeout'
    | 'timeout_auto_accepted'
    | null;
  finish_score_delta?: number | null;
  finish_note?: string | null;
  expires_at?: string | null;
  expired_at?: string | null;
  expire_reason?: string | null;
  /** GET ile gösterim — biniş QR gösterimi için */
  boarding_qr_token?: string | null;
  boarding_qr_created_at?: string | null;
  boarding_qr_expires_at?: string | null;
  boarding_qr_confirmed_at?: string | null;
  boarding_qr_confirmed_by_user_id?: string | null;
  qr_finish_token_created_at?: string | null;
  finish_qr_created_at?: string | null;
  finish_qr_expires_at?: string | null;
  finish_qr_confirmed_at?: string | null;
  finish_qr_confirmed_by_user_id?: string | null;
  /** Bitiş QR (sunucu finish_qr_token veya qr_finish_token) */
  finish_qr_token?: string | null;
  qr_finish_token?: string | null;
  /** Sesli görüşme — REST + polling */
  call_active?: boolean | null;
  caller_id?: string | null;
  call_started_at?: string | null;
  call_state?: 'ringing' | 'active' | 'ended' | string | null;
  call_channel_name?: string | null;
  /** Zorla bitir özeti (pending / accepted / declined) */
  force_finish_state?: 'none' | 'pending' | 'accepted' | 'declined' | 'timeout' | string | null;
  created_at?: string | null;
  updated_at?: string | null;
  /** Muhabbet çoklu yolcu (1 = tekli) */
  seat_capacity?: number | null;
  /** Çoklu oturum fazı — status kolonundan ayrı */
  ride_status?:
    | 'waiting'
    | 'boarding'
    | 'active'
    | 'finished'
    | 'cancelled'
    | 'expired'
    | string
    | null;
  accepted_passenger_ids?: string[] | null;
  boarded_passenger_ids?: string[] | null;
  pickup_order?: string[] | null;
  /** Çoklu koltuk: sıradaki biniş yolcusu */
  next_pickup_user_id?: string | null;
  next_pickup_display_name?: string | null;
  next_pickup_location?: { lat: number; lng: number } | null;
  multi_seat_strings?: {
    phase_line?: string;
    accepted_line?: string;
    boarded_line?: string;
    driver_boarding_line?: string;
    driver_next_passenger_line?: string;
    active_line?: string;
  } | null;
  expired_but_extendable?: boolean | null;
};

export type MuhabbetTripSessionSocketPayload = {
  session_id?: string;
  sessionId?: string;
  request_id?: string;
  conversation_id?: string;
  session?: MuhabbetTripSession;
};

export type MuhabbetTripCallSocketPayload = {
  session_id?: string;
  sessionId?: string;
  conversation_id?: string | null;
  channel_name?: string;
  caller_id?: string;
  callee_id?: string;
  /** Sunucu canonical: session:start_ts veya session benzersizliği */
  call_id?: string;
  /** Optimistik UI — sunucu REST ile eşleştirir */
  started_at?: string;
  target_user_id?: string;
  accepted_by_user_id?: string;
  declined_by_user_id?: string;
  joined_user_id?: string;
  ended_by_user_id?: string;
  /** Backend: driver | passenger */
  ended_by_role?: string;
  agora_app_id?: string;
  agora_token?: string;
  agora_uid?: number;
};

export type MuhabbetTripTrustSocketPayload = {
  session_id?: string;
  sessionId?: string;
  conversation_id?: string | null;
  requester_user_id?: string;
  target_user_id?: string;
  status?: 'requested' | 'accepted' | 'declined';
  session?: MuhabbetTripSession;
};

export type MuhabbetTripFinishSocketPayload = {
  session_id?: string;
  sessionId?: string;
  conversation_id?: string | null;
  requester_user_id?: string;
  target_user_id?: string;
  responder_user_id?: string;
  response?: 'accepted' | 'declined' | 'timeout';
  score_delta?: number;
  boarding_qr_token?: string;
  qr_finish_token?: string;
  finish_qr_token?: string;
  expires_at?: string;
  session?: MuhabbetTripSession;
};
