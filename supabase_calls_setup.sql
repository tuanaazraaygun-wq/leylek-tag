-- =====================================================
-- LEYLEK TAG - CALLS TABLE RLS & REALTIME
-- Bu SQL'i Supabase Dashboard > SQL Editor'de çalıştırın
-- =====================================================

-- 1. calls tablosu yoksa oluştur
CREATE TABLE IF NOT EXISTS calls (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    caller_id UUID NOT NULL REFERENCES users(id),
    callee_id UUID NOT NULL REFERENCES users(id),
    tag_id UUID REFERENCES tags(id),
    call_type TEXT DEFAULT 'voice',
    channel_name TEXT NOT NULL,
    caller_uid INTEGER,
    callee_uid INTEGER,
    status TEXT DEFAULT 'ringing' CHECK (status IN ('ringing', 'connected', 'ended')),
    started_at TIMESTAMPTZ DEFAULT NOW(),
    answered_at TIMESTAMPTZ,
    ended_at TIMESTAMPTZ,
    ended_by UUID,
    end_reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Index'ler
CREATE INDEX IF NOT EXISTS idx_calls_caller_id ON calls(caller_id);
CREATE INDEX IF NOT EXISTS idx_calls_callee_id ON calls(callee_id);
CREATE INDEX IF NOT EXISTS idx_calls_status ON calls(status);

-- 3. RLS ayarları
ALTER TABLE calls ENABLE ROW LEVEL SECURITY;

-- Mevcut policy'leri temizle
DROP POLICY IF EXISTS "Allow all calls" ON calls;

-- Herkese tam izin ver (anon key ile erişim için)
CREATE POLICY "Allow all calls" ON calls 
FOR ALL TO anon, authenticated 
USING (true) WITH CHECK (true);

-- 4. Realtime etkinleştir
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'calls'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE calls;
    END IF;
END $$;

-- 5. Sonuç kontrolü
SELECT 'calls table ready' as status;
