-- Muhabbet ses mesajları: 30 gün saklama (expires_at uygulamada audio için created_at+30d).
-- Metin mesajları: mevcut default (90 gün) veya açıkça set edilen expires_at.
-- Okuma: expires_at > now() VEYA expires_at IS NULL (eski/kenar satırlar).

ALTER TABLE public.muhabbet_messages
  ALTER COLUMN expires_at DROP NOT NULL;

COMMENT ON COLUMN public.muhabbet_messages.expires_at IS
  'Yoksa (NULL) istemci listelerinde süresi dolmamış sayılabilir; audio için API created_at+30d yazar.';

-- Yardımcı: süresi geçmiş ses satırlarını temizlemek için (backend cleanup job)
CREATE INDEX IF NOT EXISTS idx_muhabbet_messages_audio_expired
  ON public.muhabbet_messages (message_type, expires_at)
  WHERE message_type = 'audio';
