# Socket.IO Deployment (404 Düzeltmesi)

## Sorun
- `/socket.io` için 404 dönüyorsa, büyük ihtimalle uvicorn **app** ile çalışıyor; **socket_app** ile çalıştırılmalı.

## Çözüm

### 1. Uvicorn entrypoint
**Mutlaka** şu şekilde başlatın:
```bash
uvicorn backend.server:socket_app --host 0.0.0.0 --port 8001
```
Proje kökü yerine backend klasöründen çalıştırıyorsanız:
```bash
uvicorn server:socket_app --host 0.0.0.0 --port 8001
```

### 2. Systemd servisi (leylektag / leylek-backend)
Servis dosyasında (`/etc/systemd/system/leylek-backend.service` veya `leylektag.service`):
```ini
ExecStart=/usr/bin/python3 -m uvicorn server:socket_app --host 0.0.0.0 --port 8001
```
(WorkingDirectory `/opt/leylek-backend` ise modül adı `server` olur.)

Güncelleme sonrası:
```bash
sudo systemctl daemon-reload
sudo systemctl restart leylek-backend
# veya
sudo systemctl restart leylektag
```

### 3. Doğrulama
Tarayıcıda veya curl ile:
```
http://157.173.113.156:8001/socket.io/?EIO=4&transport=polling
```
Yanıt **JSON** olmalı (örn. `0{"sid":"..."}`); **404** olmamalı.

### 4. Beklenen backend logları
- İstemci bağlanınca: `🔥 SOCKET CLIENT CONNECTED: <sid>`
- `driver_accept_offer` gelince: `🔥 SOCKET driver_accept_offer RECEIVED: ...`
