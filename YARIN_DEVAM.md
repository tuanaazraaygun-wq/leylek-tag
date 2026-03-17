# Yarın Devam — Yapılacaklar

Bilgisayarı kapatmadan önce bu adımları tamamla; yarın projeyi açtığında buradan devam edebilirsin.

---

## 1. Verileri kaydet (şimdi)

Tüm değişiklikler bilgisayarında. Git’e commit edip push’la ki yarın güncel olsun:

```bash
cd c:\dev\leylek-tag
git add -A
git status
git commit -m "Socket.IO: socket_app deploy fix, frontend path /socket.io, deployment scripts"
git push
```

(Eğer push için şifre/token isterse gir.)

---

## 2. Yarın: Sunucuda deploy düzeltmesi

Kod tarafı hazır. **Sunucu hâlâ eski `app` ile çalışıyor olabilir**; Socket.IO’nun çalışması için sunucuda `socket_app` çalıştırılmalı.

**Seçenek A — Script ile (kolay):**

1. Kendi bilgisayarından:
   ```bash
   scp c:\dev\leylek-tag\scripts\fix-socket-deployment.sh root@157.173.113.156:/tmp/
   ```
2. Sunucuya gir ve script’i çalıştır:
   ```bash
   ssh root@157.173.113.156
   chmod +x /tmp/fix-socket-deployment.sh
   sudo /tmp/fix-socket-deployment.sh
   ```

**Seçenek B — Manuel:**  
`scripts/DEPLOYMENT_FIX_README.md` dosyasındaki “Option B: Manual steps” adımlarını uygula.

**Kontrol:** Tarayıcıda aç:  
http://157.173.113.156:8001/socket.io/?EIO=4&transport=polling  
→ JSON gelmeli, 404 olmamalı.

---

## 3. Bu oturumda yapılanlar (özet)

- **Backend (server.py):** `fastapi_app` + `app` alias, `socket_app` ile birleştirildi, path `/socket.io`
- **Frontend (SocketContext):** path `/socket.io`, transport sadece `polling`
- **Deploy dokümanları:** DEPLOYMENT_GUIDE, SOCKET_IO_DEPLOYMENT, ExecStart → `socket_app`
- **Scriptler:** `scripts/fix-socket-deployment.sh` ve `scripts/DEPLOYMENT_FIX_README.md` eklendi

Yarın projeyi aç, bu dosyayı (YARIN_DEVAM.md) oku, önce “1. Verileri kaydet” yapılmadıysa onu yap, sonra “2. Yarın: Sunucuda deploy” adımını uygula.
