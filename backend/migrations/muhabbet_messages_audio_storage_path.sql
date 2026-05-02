-- Muhabbet sesli mesajlar: Storage nesne yolu (private bucket); oynatma yalnızca backend signed URL ile.
-- Dashboard: bucket `muhabbet-audio` için public erişimi kapatın; yükleme mevcut INSERT policy ile kalır.

ALTER TABLE public.muhabbet_messages
  ADD COLUMN IF NOT EXISTS audio_storage_path text NULL;

COMMENT ON COLUMN public.muhabbet_messages.audio_storage_path IS
  'Supabase Storage nesne yolu (bucket muhabbet-audio); kalıcı kaynak; client için audio_url signed olmalı.';

-- Ses satırında ya yeni yol ya da (legacy) doğrudan audio_url olmalı.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'muhabbet_messages' AND column_name = 'message_type'
  )
     AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'muhabbet_messages' AND column_name = 'audio_url'
  ) THEN
    ALTER TABLE public.muhabbet_messages DROP CONSTRAINT IF EXISTS muhabbet_messages_audio_source_chk;
    ALTER TABLE public.muhabbet_messages
      ADD CONSTRAINT muhabbet_messages_audio_source_chk CHECK (
        message_type IS DISTINCT FROM 'audio'
        OR (
          (audio_storage_path IS NOT NULL AND btrim(audio_storage_path) <> '')
          OR (audio_url IS NOT NULL AND btrim(audio_url::text) <> '')
        )
      );
  END IF;
END $$;
