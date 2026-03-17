# Bildirim düzeltmesini sunucuya deploy et
# Calistirmak: PowerShell'de .\deploy-push-fix.ps1
# Sifre isteyince sunucu sifrenizi girin (2 kez: scp ve ssh icin)

$Server = "157.173.113.156"
$BackendPath = "c:\dev\leylek-tag\backend\server.py"
$RemotePath = "/opt/leylek-backend/server.py"

Write-Host "1. server.py sunucuya kopyalaniyor..." -ForegroundColor Cyan
scp -o StrictHostKeyChecking=no $BackendPath "root@${Server}:$RemotePath"
if ($LASTEXITCODE -ne 0) {
    Write-Host "Kopyalama basarisiz. SSH sifresini girdiniz mi?" -ForegroundColor Red
    exit 1
}

Write-Host "2. Backend servisi yeniden baslatiliyor..." -ForegroundColor Cyan
ssh -o StrictHostKeyChecking=no "root@$Server" "systemctl restart leylek-backend && sleep 2 && systemctl status leylek-backend --no-pager"
if ($LASTEXITCODE -ne 0) {
    Write-Host "Servis yeniden baslatilamadi." -ForegroundColor Red
    exit 1
}

Write-Host "Tamam. Push debug test ediliyor..." -ForegroundColor Green
Invoke-RestMethod -Uri "https://api.leylektag.com/api/admin/push-debug?admin_phone=5326497412" -Method Get | ConvertTo-Json -Depth 5
