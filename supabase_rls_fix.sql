-- =====================================================
-- LEYLEK TAG - OFFERS TABLE RLS POLİCY GÜNCELLEMESİ
-- Bu SQL'i Supabase Dashboard > SQL Editor'de çalıştırın
-- =====================================================

-- 1. Önce mevcut policy'leri listele ve kontrol et
-- SELECT * FROM pg_policies WHERE tablename = 'offers';

-- 2. Eski kısıtlayıcı policy'leri kaldır (varsa)
DROP POLICY IF EXISTS "Offers are viewable by everyone" ON offers;
DROP POLICY IF EXISTS "Service role has full access to offers" ON offers;
DROP POLICY IF EXISTS "Drivers can create offers" ON offers;
DROP POLICY IF EXISTS "Users can view their offers" ON offers;
DROP POLICY IF EXISTS "Passengers can view offers for their tags" ON offers;
DROP POLICY IF EXISTS "Allow all access to offers" ON offers;

-- 3. RLS'i devre dışı bırak (tam erişim için)
-- NOT: Supabase anon key ile frontend'den erişim için RLS tamamen kapatılmalı
-- veya tüm işlemlere izin veren policy eklenmeli

-- SEÇENEK A: RLS'i tamamen kapat (en basit çözüm)
ALTER TABLE offers DISABLE ROW LEVEL SECURITY;

-- VEYA

-- SEÇENEK B: Tüm işlemlere izin veren policy ekle (daha güvenli)
-- Önce RLS'i etkinleştir
-- ALTER TABLE offers ENABLE ROW LEVEL SECURITY;

-- Herkes SELECT yapabilsin
-- CREATE POLICY "Anyone can view offers" 
-- ON offers FOR SELECT 
-- USING (true);

-- Herkes INSERT yapabilsin (backend zaten doğrulama yapıyor)
-- CREATE POLICY "Anyone can create offers" 
-- ON offers FOR INSERT 
-- WITH CHECK (true);

-- Herkes UPDATE yapabilsin
-- CREATE POLICY "Anyone can update offers" 
-- ON offers FOR UPDATE 
-- USING (true);

-- Herkes DELETE yapabilsin
-- CREATE POLICY "Anyone can delete offers" 
-- ON offers FOR DELETE 
-- USING (true);

-- =====================================================
-- TAGS TABLE - Aynı şekilde güncelle
-- =====================================================

DROP POLICY IF EXISTS "Tags are viewable by everyone" ON tags;
DROP POLICY IF EXISTS "Service role has full access to tags" ON tags;
DROP POLICY IF EXISTS "Allow all access to tags" ON tags;

ALTER TABLE tags DISABLE ROW LEVEL SECURITY;

-- =====================================================
-- USERS TABLE - Aynı şekilde güncelle
-- =====================================================

DROP POLICY IF EXISTS "Users are viewable by everyone" ON users;
DROP POLICY IF EXISTS "Service role has full access to users" ON users;
DROP POLICY IF EXISTS "Allow all access to users" ON users;

ALTER TABLE users DISABLE ROW LEVEL SECURITY;

-- =====================================================
-- CALLS TABLE - Arama sistemi için
-- =====================================================

DROP POLICY IF EXISTS "Allow all access to calls" ON calls;

-- Calls tablosu varsa RLS'i kapat
DO $$ 
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'calls') THEN
        ALTER TABLE calls DISABLE ROW LEVEL SECURITY;
    END IF;
END $$;

-- =====================================================
-- Realtime'ı etkinleştir (önemli!)
-- =====================================================

-- Offers tablosu için realtime
ALTER PUBLICATION supabase_realtime ADD TABLE offers;

-- Tags tablosu için realtime
ALTER PUBLICATION supabase_realtime ADD TABLE tags;

-- Calls tablosu için realtime (varsa)
DO $$ 
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'calls') THEN
        EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE calls';
    END IF;
EXCEPTION WHEN OTHERS THEN
    NULL; -- Hata olursa sessizce geç
END $$;

-- =====================================================
-- SONUÇ KONTROLÜ
-- =====================================================

-- RLS durumunu kontrol et
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE tablename IN ('offers', 'tags', 'users', 'calls');

-- =====================================================
-- BU SQL'İ SUPABASE DASHBOARD > SQL EDITOR'DE ÇALIŞTIRIN
-- =====================================================
