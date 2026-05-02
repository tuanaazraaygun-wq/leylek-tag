-- Muhabbet 1:1: sesli mesaj (audio) kolonları + metin kısıtları güncellemesi
--
-- Supabase Storage: `muhabbet-audio` bucket'ını Dashboard → Storage'dan oluşturun;
-- genelde public okuma + authenticated yükleme politikası gerekir (anon key ile yükleme
-- RLS'e bağlıdır — üretimde genelde signed upload veya Edge Function tercih edilir).

ALTER TABLE public.muhabbet_messages
  ADD COLUMN IF NOT EXISTS message_type text NOT NULL DEFAULT 'text';

ALTER TABLE public.muhabbet_messages
  ADD COLUMN IF NOT EXISTS audio_url text NULL;

ALTER TABLE public.muhabbet_messages
  ADD COLUMN IF NOT EXISTS audio_duration_ms integer NULL;

ALTER TABLE public.muhabbet_messages
  ADD COLUMN IF NOT EXISTS audio_mime_type text NULL;

UPDATE public.muhabbet_messages SET message_type = 'text' WHERE message_type IS NULL OR message_type = '';

ALTER TABLE public.muhabbet_messages DROP CONSTRAINT IF EXISTS muhabbet_messages_text_len;

ALTER TABLE public.muhabbet_messages DROP CONSTRAINT IF EXISTS muhabbet_messages_message_type_allowed;
ALTER TABLE public.muhabbet_messages
  ADD CONSTRAINT muhabbet_messages_message_type_allowed
  CHECK (message_type IN ('text', 'audio'));

ALTER TABLE public.muhabbet_messages DROP CONSTRAINT IF EXISTS muhabbet_messages_text_by_type;
ALTER TABLE public.muhabbet_messages
  ADD CONSTRAINT muhabbet_messages_text_by_type
  CHECK (
    (message_type = 'text' AND char_length(text) >= 1 AND char_length(text) <= 2000)
    OR (message_type = 'audio' AND char_length(text) <= 2000)
  );

ALTER TABLE public.muhabbet_messages DROP CONSTRAINT IF EXISTS muhabbet_messages_audio_payload;
ALTER TABLE public.muhabbet_messages
  ADD CONSTRAINT muhabbet_messages_audio_payload
  CHECK (
    message_type <> 'audio'
    OR (
      audio_url IS NOT NULL
      AND btrim(audio_url) <> ''
      AND audio_duration_ms IS NOT NULL
      AND audio_duration_ms > 0
      AND audio_duration_ms <= 30000
      AND audio_mime_type IS NOT NULL
      AND audio_mime_type IN ('audio/m4a', 'audio/aac', 'audio/mpeg', 'audio/mp4')
    )
  );

COMMENT ON COLUMN public.muhabbet_messages.message_type IS 'text | audio; varsayılan text';
COMMENT ON COLUMN public.muhabbet_messages.audio_url IS 'Ses dosyası URL; sohbet kimliği URL veya path içinde doğrulanır.';
COMMENT ON COLUMN public.muhabbet_messages.audio_duration_ms IS 'Ses süresi ms; audio için zorunlu, max 30000';
COMMENT ON COLUMN public.muhabbet_messages.audio_mime_type IS 'İzin verilen MIME listesi CHECK içinde';
