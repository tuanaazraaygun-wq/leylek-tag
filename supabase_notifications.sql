-- =====================================================
-- LEYLEK TAG - BİLDİRİM VE İNAKTİVİTE TABLOLARI
-- Supabase Dashboard > SQL Editor'de çalıştırın
-- =====================================================

-- 1. Bildirimler Tablosu
CREATE TABLE IF NOT EXISTS notifications (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    
    -- Bildirim hedefi
    target_type TEXT NOT NULL DEFAULT 'all', -- 'all', 'drivers', 'passengers', 'user'
    target_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    
    -- Bildirim içeriği
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    
    -- Gönderen
    sent_by UUID REFERENCES users(id) ON DELETE SET NULL,
    sent_by_phone TEXT,
    
    -- Durum
    status TEXT DEFAULT 'sent', -- 'sent', 'delivered', 'read'
    
    -- Zaman
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Ek bilgiler
    metadata JSONB DEFAULT '{}'
);

-- İndeksler
CREATE INDEX IF NOT EXISTS idx_notifications_target ON notifications(target_type);
CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_target_user ON notifications(target_user_id);

-- RLS
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all notifications" ON notifications FOR ALL USING (true) WITH CHECK (true);

-- 2. Kullanıcı Aktivite Tablosu (son aktivite takibi)
-- users tablosuna last_activity sütunu ekle
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_activity TIMESTAMPTZ DEFAULT NOW();

-- 3. TAG'lere inaktivite kontrolü için sütun
ALTER TABLE tags ADD COLUMN IF NOT EXISTS last_activity TIMESTAMPTZ DEFAULT NOW();

-- =====================================================
-- BU SQL'İ SUPABASE'DE ÇALIŞTIRIN
-- =====================================================
