-- Tek tag için en fazla bir aktif (pending veya accepted) trust_sessions satırı.
-- Yarışta ikinci INSERT Postgresql'de unique ihlali verir; uygulama trust_race_lost döner.
-- ended / rejected / expired satırları bu indekse dahil değildir; tamamlandıktan sonra yeni istek mümkün.
--
-- Not: Migration öncesi aynı tag'de birden fazla pending|accepted satırı varsa indeks oluşturma başarısız olur;
-- böyle bir durumda eski çift kayıtlar elle temizlenmelidir.

CREATE UNIQUE INDEX IF NOT EXISTS idx_trust_sessions_one_active_per_tag
ON trust_sessions (tag_id)
WHERE status IN ('pending', 'accepted');

COMMENT ON INDEX idx_trust_sessions_one_active_per_tag IS
  'En fazla bir pending veya accepted trust oturumu (yarış güvenliği).';
