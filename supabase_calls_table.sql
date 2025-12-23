-- =====================================================
-- LEYLEK TAG - ARAMA SİSTEMİ TABLOSU
-- Tüm aramalar Supabase'de kalıcı olarak saklanacak
-- =====================================================

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
    call_type TEXT DEFAULT 'voice' CHECK (call_type IN ('voice', 'video')),
    status TEXT DEFAULT 'ringing' CHECK (status IN ('ringing', 'connected', 'ended', 'rejected', 'cancelled', 'missed')),
    
    -- Zaman damgaları
    created_at TIMESTAMPTZ DEFAULT NOW(),
    answered_at TIMESTAMPTZ,
    ended_at TIMESTAMPTZ,
    
    -- Agora bilgileri
    agora_token TEXT,
    
    -- Sonlandırma bilgisi
    ended_by UUID REFERENCES users(id) ON DELETE SET NULL,
    end_reason TEXT
);

-- İndeksler - hızlı sorgulama için
CREATE INDEX IF NOT EXISTS idx_calls_caller_id ON calls(caller_id);
CREATE INDEX IF NOT EXISTS idx_calls_receiver_id ON calls(receiver_id);
CREATE INDEX IF NOT EXISTS idx_calls_status ON calls(status);
CREATE INDEX IF NOT EXISTS idx_calls_created_at ON calls(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_calls_channel_name ON calls(channel_name);

-- Aktif aramaları hızlı bulmak için
CREATE INDEX IF NOT EXISTS idx_calls_active ON calls(receiver_id, status) WHERE status = 'ringing';

-- Realtime için RLS (Row Level Security) politikaları
ALTER TABLE calls ENABLE ROW LEVEL SECURITY;

-- Herkes kendi aramalarını görebilir
CREATE POLICY "Users can view their own calls" ON calls
    FOR SELECT USING (
        auth.uid()::text = caller_id::text OR 
        auth.uid()::text = receiver_id::text
    );

-- Anonim erişim için (API üzerinden)
CREATE POLICY "Allow anonymous select" ON calls
    FOR SELECT USING (true);

CREATE POLICY "Allow anonymous insert" ON calls
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow anonymous update" ON calls
    FOR UPDATE USING (true);

-- Realtime'ı aktif et
ALTER PUBLICATION supabase_realtime ADD TABLE calls;

-- =====================================================
-- BU SQL'İ SUPABASE DASHBOARD > SQL EDITOR'DE ÇALIŞTIRIN
-- =====================================================
