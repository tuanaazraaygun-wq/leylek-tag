-- Faz 1 güncelleme: eşleşme isteği tekilliği yalnızca status = 'pending' iken.
-- rejected / cancelled / accepted satırlarından sonra aynı üçlü ile yeni pending açılabilir.
-- Önceki indeks: (listing_id, sender_user_id) WHERE pending — aynı anlamı (alıcı ilan sahibi) üçlü ile netleştirir.

DROP INDEX IF EXISTS public.uq_listing_match_one_pending_per_sender;

CREATE UNIQUE INDEX IF NOT EXISTS uq_lmr_pending_listing_sender_receiver
  ON public.listing_match_requests (listing_id, sender_user_id, receiver_user_id)
  WHERE (status = 'pending');

COMMENT ON INDEX public.uq_lmr_pending_listing_sender_receiver IS
  'Aynı ilan + gönderen + alıcı için tek pending; diğer durumlarda yeni satır serbest.';
