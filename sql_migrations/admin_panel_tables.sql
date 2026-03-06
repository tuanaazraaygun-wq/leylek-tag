-- =====================================================
-- LeylekTag Admin Panel - Ek SQL Migrations
-- Bu SQL'i Supabase SQL Editor'da calistirin
-- =====================================================

-- 1. LOGIN_LOGS TABLE (Giris Loglari)
CREATE TABLE IF NOT EXISTS login_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID,
    phone VARCHAR(20),
    ip_address VARCHAR(50),
    device_id VARCHAR(100),
    device_info TEXT,
    success BOOLEAN DEFAULT true,
    fail_reason VARCHAR(50),
    country VARCHAR(20) DEFAULT 'TR',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_login_logs_phone ON login_logs(phone);
CREATE INDEX IF NOT EXISTS idx_login_logs_created ON login_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_login_logs_country ON login_logs(country);

-- 2. NOTIFICATION_LOGS TABLE (Bildirim Loglari)
CREATE TABLE IF NOT EXISTS notification_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    admin_phone VARCHAR(20),
    title VARCHAR(200),
    message TEXT,
    target VARCHAR(20),
    sent_count INTEGER DEFAULT 0,
    failed_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notification_logs_created ON notification_logs(created_at DESC);

-- 3. USERS tablosuna yeni kolonlar ekle (soft delete ve login bilgisi icin)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'is_deleted') THEN
        ALTER TABLE users ADD COLUMN is_deleted BOOLEAN DEFAULT false;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'deleted_at') THEN
        ALTER TABLE users ADD COLUMN deleted_at TIMESTAMP WITH TIME ZONE;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'deleted_reason') THEN
        ALTER TABLE users ADD COLUMN deleted_reason TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'last_ip') THEN
        ALTER TABLE users ADD COLUMN last_ip VARCHAR(50);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'last_device_id') THEN
        ALTER TABLE users ADD COLUMN last_device_id VARCHAR(100);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'last_device_info') THEN
        ALTER TABLE users ADD COLUMN last_device_info TEXT;
    END IF;
END $$;

-- 4. RLS (Row Level Security) - Opsiyonel
ALTER TABLE login_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_logs ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read (for admin panel)
CREATE POLICY IF NOT EXISTS "Authenticated can read login_logs" ON login_logs FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY IF NOT EXISTS "Authenticated can read notification_logs" ON notification_logs FOR SELECT USING (auth.role() = 'authenticated');

-- =====================================================
-- Migration Complete!
-- =====================================================
