-- Eşleşme kabul (accept) sonrası sohbet / konuşma thread kimliği (Faz2 öncesi placeholder UUID, API üretir)
ALTER TABLE public.listing_match_requests
  ADD COLUMN IF NOT EXISTS conversation_id uuid NULL;

COMMENT ON COLUMN public.listing_match_requests.conversation_id IS
  'Kabul anında üretilen conversation id; feed accepted durumunda client’a döner.';
