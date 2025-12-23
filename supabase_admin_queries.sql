-- =====================================================
-- LEYLEK TAG - SUPABASE YÖNETİM SORGULARI
-- Bu sorguları Supabase Dashboard > SQL Editor'de çalıştırın
-- =====================================================


-- ==================== KULLANICILAR ====================

-- 1. Tüm kullanıcıları listele
SELECT 
    id,
    name,
    phone,
    role,
    rating,
    is_active,
    is_premium,
    city,
    created_at
FROM users 
ORDER BY created_at DESC;

-- 2. Sadece şoförleri listele
SELECT 
    id,
    name,
    phone,
    rating,
    is_active,
    driver_details->>'vehicle_model' as arac_model,
    driver_details->>'vehicle_color' as arac_renk,
    driver_details->>'vehicle_plate' as plaka,
    created_at
FROM users 
WHERE role = 'driver'
ORDER BY created_at DESC;

-- 3. Sadece yolcuları listele
SELECT 
    id,
    name,
    phone,
    rating,
    is_active,
    city,
    created_at
FROM users 
WHERE role = 'passenger'
ORDER BY created_at DESC;

-- 4. Aktif olmayan (yasaklı) kullanıcılar
SELECT * FROM users WHERE is_active = false;

-- 5. Premium kullanıcılar
SELECT * FROM users WHERE is_premium = true;

-- 6. Belirli telefon numarasıyla kullanıcı ara
SELECT * FROM users WHERE phone LIKE '%5551234567%';

-- 7. Bugün kayıt olan kullanıcılar
SELECT * FROM users 
WHERE created_at >= CURRENT_DATE 
ORDER BY created_at DESC;

-- 8. Toplam kullanıcı sayısı
SELECT 
    COUNT(*) as toplam_kullanici,
    COUNT(*) FILTER (WHERE role = 'driver') as sofor_sayisi,
    COUNT(*) FILTER (WHERE role = 'passenger') as yolcu_sayisi,
    COUNT(*) FILTER (WHERE is_premium = true) as premium_sayisi
FROM users;


-- ==================== YOLCULUKLAR (TAGS) ====================

-- 9. Tüm yolculuk taleplerini listele
SELECT 
    t.id,
    t.status,
    t.pickup_location,
    t.dropoff_location,
    t.final_price,
    t.created_at,
    u.name as yolcu_adi,
    u.phone as yolcu_tel
FROM tags t
LEFT JOIN users u ON t.passenger_id = u.id
ORDER BY t.created_at DESC;

-- 10. Aktif yolculuklar (devam eden)
SELECT 
    t.*,
    p.name as yolcu,
    d.name as sofor
FROM tags t
LEFT JOIN users p ON t.passenger_id = p.id
LEFT JOIN users d ON t.driver_id = d.id
WHERE t.status IN ('pending', 'offers_received', 'matched', 'in_progress')
ORDER BY t.created_at DESC;

-- 11. Tamamlanan yolculuklar
SELECT 
    t.*,
    p.name as yolcu,
    d.name as sofor
FROM tags t
LEFT JOIN users p ON t.passenger_id = p.id
LEFT JOIN users d ON t.driver_id = d.id
WHERE t.status = 'completed'
ORDER BY t.completed_at DESC;

-- 12. Bugünkü yolculuklar
SELECT * FROM tags 
WHERE created_at >= CURRENT_DATE
ORDER BY created_at DESC;

-- 13. Yolculuk istatistikleri
SELECT 
    status,
    COUNT(*) as sayi
FROM tags
GROUP BY status;

-- 14. Toplam kazanç (tamamlanan yolculuklar)
SELECT 
    SUM(final_price) as toplam_kazanc,
    COUNT(*) as tamamlanan_yolculuk,
    AVG(final_price) as ortalama_ucret
FROM tags 
WHERE status = 'completed';


-- ==================== TEKLİFLER ====================

-- 15. Tüm teklifleri listele
SELECT 
    o.*,
    d.name as sofor_adi,
    t.pickup_location,
    t.dropoff_location
FROM offers o
LEFT JOIN users d ON o.driver_id = d.id
LEFT JOIN tags t ON o.tag_id = t.id
ORDER BY o.created_at DESC;

-- 16. Bekleyen teklifler
SELECT * FROM offers WHERE status = 'pending';

-- 17. Kabul edilen teklifler
SELECT * FROM offers WHERE status = 'accepted';


-- ==================== ARAMALAR (CALLS) ====================

-- 18. Tüm aramaları listele
SELECT 
    c.*,
    caller.name as arayan,
    receiver.name as aranan
FROM calls c
LEFT JOIN users caller ON c.caller_id = caller.id
LEFT JOIN users receiver ON c.receiver_id = receiver.id
ORDER BY c.created_at DESC;

-- 19. Aktif (çalan) aramalar
SELECT * FROM calls WHERE status = 'ringing';

-- 20. Bugünkü aramalar
SELECT 
    c.*,
    caller.name as arayan,
    receiver.name as aranan
FROM calls c
LEFT JOIN users caller ON c.caller_id = caller.id
LEFT JOIN users receiver ON c.receiver_id = receiver.id
WHERE c.created_at >= CURRENT_DATE
ORDER BY c.created_at DESC;

-- 21. Arama istatistikleri
SELECT 
    status,
    call_type,
    COUNT(*) as sayi
FROM calls
GROUP BY status, call_type;

-- 22. Cevapsız aramalar
SELECT * FROM calls WHERE status = 'missed';


-- ==================== ŞİKAYETLER ====================

-- 23. Tüm şikayetleri listele
SELECT 
    r.*,
    reporter.name as sikayet_eden,
    reported.name as sikayet_edilen
FROM reports r
LEFT JOIN users reporter ON r.reporter_id = reporter.id
LEFT JOIN users reported ON r.reported_id = reported.id
ORDER BY r.created_at DESC;

-- 24. Çözülmemiş şikayetler
SELECT * FROM reports WHERE status = 'pending' OR status IS NULL;


-- ==================== ENGELLENEN KULLANICILAR ====================

-- 25. Engelleme listesi
SELECT 
    b.*,
    blocker.name as engelleyen,
    blocked.name as engellenen
FROM blocked_users b
LEFT JOIN users blocker ON b.user_id = blocker.id
LEFT JOIN users blocked ON b.blocked_user_id = blocked.id
ORDER BY b.created_at DESC;


-- ==================== GENEL İSTATİSTİKLER ====================

-- 26. Uygulama genel durumu
SELECT 
    (SELECT COUNT(*) FROM users) as toplam_kullanici,
    (SELECT COUNT(*) FROM users WHERE role = 'driver') as toplam_sofor,
    (SELECT COUNT(*) FROM users WHERE role = 'passenger') as toplam_yolcu,
    (SELECT COUNT(*) FROM tags) as toplam_yolculuk,
    (SELECT COUNT(*) FROM tags WHERE status = 'completed') as tamamlanan_yolculuk,
    (SELECT COALESCE(SUM(final_price), 0) FROM tags WHERE status = 'completed') as toplam_kazanc,
    (SELECT COUNT(*) FROM calls) as toplam_arama,
    (SELECT COUNT(*) FROM reports) as toplam_sikayet;

-- 27. Son 7 günlük aktivite
SELECT 
    DATE(created_at) as tarih,
    COUNT(*) as yolculuk_sayisi
FROM tags
WHERE created_at >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY DATE(created_at)
ORDER BY tarih DESC;

-- 28. En çok yolculuk yapan şoförler
SELECT 
    d.name,
    d.phone,
    COUNT(*) as yolculuk_sayisi,
    SUM(t.final_price) as toplam_kazanc
FROM tags t
JOIN users d ON t.driver_id = d.id
WHERE t.status = 'completed'
GROUP BY d.id, d.name, d.phone
ORDER BY yolculuk_sayisi DESC
LIMIT 10;

-- 29. En çok yolculuk talep eden yolcular
SELECT 
    p.name,
    p.phone,
    COUNT(*) as yolculuk_sayisi
FROM tags t
JOIN users p ON t.passenger_id = p.id
GROUP BY p.id, p.name, p.phone
ORDER BY yolculuk_sayisi DESC
LIMIT 10;


-- ==================== YÖNETİM İŞLEMLERİ ====================

-- 30. Kullanıcıyı yasakla (is_active = false yap)
-- UPDATE users SET is_active = false WHERE id = 'KULLANICI_ID';

-- 31. Kullanıcı yasağını kaldır
-- UPDATE users SET is_active = true WHERE id = 'KULLANICI_ID';

-- 32. Kullanıcıyı premium yap
-- UPDATE users SET is_premium = true WHERE id = 'KULLANICI_ID';

-- 33. Premium'u kaldır
-- UPDATE users SET is_premium = false WHERE id = 'KULLANICI_ID';

-- 34. Tüm aktif aramaları sonlandır (acil durum)
-- UPDATE calls SET status = 'ended', ended_at = NOW() WHERE status IN ('ringing', 'connected');

-- 35. Eski aramaları temizle (30 günden eski)
-- DELETE FROM calls WHERE created_at < NOW() - INTERVAL '30 days';


-- =====================================================
-- NOT: # ile başlayan satırları çalıştırmadan önce
-- KULLANICI_ID yerine gerçek ID yazın
-- =====================================================
