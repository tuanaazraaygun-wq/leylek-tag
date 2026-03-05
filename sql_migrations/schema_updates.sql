-- =====================================================
-- LeylekTag Database Schema Updates
-- Bu SQL komutlarını Supabase SQL Editor'da çalıştırın
-- =====================================================

-- 1. PROMOTIONS TABLE (Promosyon Kodları)
-- Bu tablo sürücü aktivasyon promosyon kodlarını saklar
CREATE TABLE IF NOT EXISTS promotions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(20) UNIQUE NOT NULL,
    hours INTEGER NOT NULL DEFAULT 3,
    max_uses INTEGER NOT NULL DEFAULT 100,
    used_count INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_promotions_code ON promotions(code);
CREATE INDEX IF NOT EXISTS idx_promotions_active ON promotions(is_active);

-- 2. DRIVER_KYC TABLE (Sürücü Belge Doğrulama)
-- Bu tablo sürücü kayıt başvurularını saklar
CREATE TABLE IF NOT EXISTS driver_kyc (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
    name VARCHAR(100),
    phone VARCHAR(20),
    plate_number VARCHAR(20),
    vehicle_brand VARCHAR(50),
    vehicle_model VARCHAR(50),
    vehicle_year INTEGER,
    vehicle_color VARCHAR(30),
    vehicle_photo_url TEXT,
    license_photo_url TEXT,
    status VARCHAR(20) DEFAULT 'pending', -- pending, approved, rejected
    rejection_reason TEXT,
    reviewed_by UUID REFERENCES auth.users(id),
    reviewed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for KYC
CREATE INDEX IF NOT EXISTS idx_driver_kyc_status ON driver_kyc(status);
CREATE INDEX IF NOT EXISTS idx_driver_kyc_user ON driver_kyc(user_id);

-- 3. ADD end_method COLUMN TO TAGS TABLE
-- Bu kolon yolculuğun nasıl bitirildiğini kaydeder (qr, manual, system, etc.)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'tags' AND column_name = 'end_method'
    ) THEN
        ALTER TABLE tags ADD COLUMN end_method VARCHAR(20);
    END IF;
END $$;

-- 4. DISPATCH_QUEUE TABLE (Sürücü Eşleştirme Kuyruğu)
-- Bu tablo otomatik sürücü eşleştirme sistemini destekler
CREATE TABLE IF NOT EXISTS dispatch_queue (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tag_id UUID REFERENCES tags(id) ON DELETE CASCADE,
    driver_id UUID REFERENCES auth.users(id),
    priority INTEGER NOT NULL DEFAULT 0,
    status VARCHAR(20) NOT NULL DEFAULT 'waiting', -- waiting, sent, accepted, rejected, expired
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    sent_at TIMESTAMP WITH TIME ZONE,
    responded_at TIMESTAMP WITH TIME ZONE,
    UNIQUE(tag_id, driver_id)
);

-- Indexes for dispatch queue
CREATE INDEX IF NOT EXISTS idx_dispatch_queue_tag ON dispatch_queue(tag_id);
CREATE INDEX IF NOT EXISTS idx_dispatch_queue_driver ON dispatch_queue(driver_id);
CREATE INDEX IF NOT EXISTS idx_dispatch_queue_status ON dispatch_queue(status);

-- 5. Enable Row Level Security (RLS) for new tables
ALTER TABLE promotions ENABLE ROW LEVEL SECURITY;
ALTER TABLE driver_kyc ENABLE ROW LEVEL SECURITY;
ALTER TABLE dispatch_queue ENABLE ROW LEVEL SECURITY;

-- 6. RLS Policies (Basic - adjust as needed)
-- Promotions: Only admins can manage
CREATE POLICY IF NOT EXISTS "Promotions are viewable by authenticated users" 
    ON promotions FOR SELECT 
    USING (auth.role() = 'authenticated');

-- Driver KYC: Users can see their own, admins can see all
CREATE POLICY IF NOT EXISTS "Users can view their own KYC" 
    ON driver_kyc FOR SELECT 
    USING (auth.uid() = user_id OR auth.role() = 'authenticated');

-- Dispatch Queue: Drivers can see their own entries
CREATE POLICY IF NOT EXISTS "Drivers can view their dispatch entries" 
    ON dispatch_queue FOR SELECT 
    USING (auth.uid() = driver_id OR auth.role() = 'authenticated');

-- =====================================================
-- Migration Complete!
-- =====================================================
