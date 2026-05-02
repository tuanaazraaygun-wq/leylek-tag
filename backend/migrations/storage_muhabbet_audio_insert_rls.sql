-- Muhabbet ses: yükleme yolu `conversation_id / user_id / dosya.m4a`
-- İkinci klasör segmenti gönderen kullanıcı olmalı (storage.foldername 1-based).
-- İstemci: Authorization Bearer = kullanıcı JWT (anon key değil).

DROP POLICY IF EXISTS "muhabbet_audio_insert_authenticated" ON storage.objects;

CREATE POLICY "muhabbet_audio_insert_authenticated"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'muhabbet-audio'
  AND coalesce(array_length(storage.foldername(name), 1), 0) >= 2
  AND (storage.foldername(name))[2]::uuid = auth.uid()
);

COMMENT ON POLICY "muhabbet_audio_insert_authenticated" ON storage.objects IS
  'Muhabbet ses: path segment [2] = auth.uid(); segment [1] = conversation_id.';
