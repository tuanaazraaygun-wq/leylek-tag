-- =====================================================
-- LEYLEK TAG - CALLS TABLOSU (Arama Sistemi)
-- Bu SQL'i Supabase Dashboard > SQL Editor'de çalıştırın
-- =====================================================

-- Önce varsa eski tabloyu kontrol et (call_logs farklı yapıda, kullanılmıyor)
-- DROP TABLE IF EXISTS calls;

-- Calls tablosu oluştur
CREATE TABLE IF NOT EXISTS calls (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    call_id TEXT UNIQUE NOT NULL,
    channel_name TEXT NOT NULL,
    
    -- Taraflar
    caller_id UUID REFERENCES users(id) ON DELETE SET NULL,
    receiver_id UUID REFERENCES users(id) ON DELETE SET NULL,
    tag_id UUID REFERENCES tags(id) ON DELETE SET NULL,
    
    -- Arama bilgileri
    call_type TEXT DEFAULT 'voice',
    status TEXT DEFAULT 'ringing',
    agora_token TEXT,
    
    -- Zaman damgaları
    created_at TIMESTAMPTZ DEFAULT NOW(),
    answered_at TIMESTAMPTZ,
    ended_at TIMESTAMPTZ,
    
    -- Sonlandırma bilgisi
    ended_by UUID REFERENCES users(id) ON DELETE SET NULL
);

-- İndeksler
CREATE INDEX IF NOT EXISTS idx_calls_caller_id ON calls(caller_id);
CREATE INDEX IF NOT EXISTS idx_calls_receiver_id ON calls(receiver_id);
CREATE INDEX IF NOT EXISTS idx_calls_status ON calls(status);
CREATE INDEX IF NOT EXISTS idx_calls_created_at ON calls(created_at DESC);

-- RLS politikaları
ALTER TABLE calls ENABLE ROW LEVEL SECURITY;

-- Tüm erişimlere izin ver (API üzerinden)
CREATE POLICY "Allow all access to calls" ON calls FOR ALL USING (true) WITH CHECK (true);

-- Realtime'ı aktif et (opsiyonel)
-- ALTER PUBLICATION supabase_realtime ADD TABLE calls;

-- =====================================================
-- BU SQL'İ SUPABASE DASHBOARD > SQL EDITOR'DE ÇALIŞTIRIN
-- =====================================================
