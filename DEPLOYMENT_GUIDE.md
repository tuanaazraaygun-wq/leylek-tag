# 🚀 Leylek TAG - Gerçek Sunucuya Deployment Rehberi

## 📋 MEVCUT DURUMUNUZ

Şu an elinizde:
- ✅ **Socket Server**: 157.173.113.156 (zaten çalışıyor)
- ✅ **Supabase**: Veritabanı ve Auth (zaten çalışıyor)
- ✅ **Daily.co**: Video/Sesli arama (zaten çalışıyor)
- ⏳ **Backend API**: Emergent'te çalışıyor (taşınması gerekiyor)

---

## 🎯 EN KOLAY YÖNTEM: Mevcut VPS'i Kullan

Zaten bir VPS'iniz var (157.173.113.156). Backend'i de buraya taşıyabilirsiniz.

### Adım 1: VPS'e Backend Kur

```bash
# SSH ile bağlan
ssh root@157.173.113.156

# Gerekli paketleri kur
apt update
apt install python3 python3-pip nginx certbot python3-certbot-nginx -y

# Backend klasörü oluştur
mkdir -p /opt/leylek-backend
cd /opt/leylek-backend

# Backend dosyalarını kopyala (kendi bilgisayarından)
# scp -r /app/backend/* root@157.173.113.156:/opt/leylek-backend/

# Python bağımlılıklarını kur
pip3 install -r requirements.txt

# .env dosyası oluştur
cat > .env << EOF
SUPABASE_URL=https://ujvploftywsxprlzejgc.supabase.co
SUPABASE_KEY=your_supabase_key_here
DAILY_API_KEY=your_daily_api_key_here
EOF
```

### Adım 2: Systemd Servisi Oluştur

```bash
cat > /etc/systemd/system/leylek-backend.service << EOF
[Unit]
Description=Leylek TAG Backend API
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/leylek-backend
# CRITICAL: Use socket_app so /socket.io is served. Using app would return 404 for Socket.IO.
ExecStart=/usr/bin/python3 -m uvicorn server:socket_app --host 0.0.0.0 --port 8001
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

# Servisi başlat (mevcut servisi güncellediyseniz: daemon-reload + restart)
sudo systemctl daemon-reload
sudo systemctl enable leylek-backend
sudo systemctl start leylek-backend
# Güncelleme sonrası: sudo systemctl restart leylek-backend
```

**Socket.IO doğrulama:** Backend çalışırken şu URL'yi açın; JSON yanıt (404 değil) görmelisiniz:
`http://157.173.113.156:8001/socket.io/?EIO=4&transport=polling`

### Adım 3: Nginx ile HTTPS Ayarla

```bash
# Domain'inizi DNS'te VPS IP'sine yönlendirin
# Örnek: api.leylektag.com -> 157.173.113.156

cat > /etc/nginx/sites-available/leylek << EOF
server {
    listen 80;
    server_name api.leylektag.com;

    location / {
        proxy_pass http://127.0.0.1:8001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
    }
}

server {
    listen 80;
    server_name socket.leylektag.com;

    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
    }
}
EOF

ln -s /etc/nginx/sites-available/leylek /etc/nginx/sites-enabled/
nginx -t
systemctl reload nginx

# SSL sertifikası al
certbot --nginx -d api.leylektag.com -d socket.leylektag.com
```

### Adım 4: Uygulama URL'lerini Güncelle

Frontend'te `.env` dosyasını güncelle:
```
EXPO_PUBLIC_BACKEND_URL=https://api.leylektag.com
EXPO_PUBLIC_SOCKET_URL=https://socket.leylektag.com
```

---

## 🌐 ALTERNATİF: Hazır Servisler Kullan

### Seçenek A: Railway (En Kolay)

1. https://railway.app adresine git
2. GitHub hesabınla giriş yap
3. "New Project" -> "Deploy from GitHub"
4. Backend kodunu yükle
5. Otomatik deploy olur

**Avantaj**: Ücretsiz başlangıç, otomatik SSL, kolay
**Maliyet**: ~$5/ay

### Seçenek B: Render

1. https://render.com adresine git
2. "New Web Service" seç
3. GitHub repo bağla
4. Build command: `pip install -r requirements.txt`
5. Start command: `uvicorn server:socket_app --host 0.0.0.0 --port $PORT`

**Avantaj**: Ücretsiz tier var
**Maliyet**: Ücretsiz (kısıtlı) veya $7/ay

### Seçenek C: DigitalOcean App Platform

1. https://cloud.digitalocean.com/apps
2. "Create App" seç
3. GitHub bağla
4. Otomatik tespit eder

**Avantaj**: Güvenilir, hızlı
**Maliyet**: $5/ay

---

## 📱 UYGULAMA YAYINLAMA

### Google Play Store

1. **Developer Hesabı**: https://play.google.com/console ($25 tek seferlik)

2. **APK yerine AAB oluştur**:
```bash
cd frontend
npx eas build --platform android --profile production
```

3. **Store Listing** hazırla:
   - Uygulama adı
   - Açıklama
   - Ekran görüntüleri
   - Gizlilik politikası URL'i

4. **Upload & Yayınla**

### App Store (iOS)

1. **Apple Developer**: https://developer.apple.com ($99/yıl)

2. **IPA oluştur**:
```bash
npx eas build --platform ios --profile production
```

3. **App Store Connect'e yükle**

---

## 🔧 HIZLI BAŞLANGIÇ CHECKLIST

- [ ] Domain satın al (Namecheap, GoDaddy, vb.)
- [ ] DNS'te A kayıtları ekle:
  - `api.leylektag.com` -> VPS IP
  - `socket.leylektag.com` -> VPS IP
- [ ] Backend'i VPS'e kur
- [ ] SSL sertifikası al (Let's Encrypt - ücretsiz)
- [ ] Frontend .env güncelle
- [ ] Yeni APK oluştur
- [ ] Test et
- [ ] Play Store'a yükle

---

## 💰 TAHMİNİ MALİYETLER

| Kalem | Maliyet |
|-------|---------|
| VPS (mevcut) | ~$5-20/ay |
| Domain | ~$10-15/yıl |
| Supabase | Ücretsiz (başlangıç) |
| Daily.co | Ücretsiz (1000 dk/ay) |
| Google Play | $25 (tek seferlik) |
| **TOPLAM** | ~$30-50 başlangıç + ~$10/ay |

---

## ❓ SORULARINIZ İÇİN

Deployment konusunda yardıma ihtiyacınız olursa sorun!
