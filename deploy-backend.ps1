# Backend deploy: server.py -> /opt/leylektag/, restart leylektag.service
# Run in PowerShell: .\deploy-backend.ps1
# You will be prompted for SSH password (scp and ssh).

$Server = "157.173.113.156"
$BackendPath = "c:\dev\leylek-tag\backend\server.py"
$RemotePath = "/opt/leylektag/server.py"

Write-Host "1. Uploading server.py to /opt/leylektag/..." -ForegroundColor Cyan
scp -o StrictHostKeyChecking=no $BackendPath "root@${Server}:$RemotePath"
if ($LASTEXITCODE -ne 0) {
    Write-Host "Upload failed. Did you enter the SSH password?" -ForegroundColor Red
    exit 1
}

Write-Host "2. Restarting leylektag.service..." -ForegroundColor Cyan
ssh -o StrictHostKeyChecking=no "root@$Server" "sudo systemctl restart leylektag.service && sleep 2 && sudo systemctl status leylektag.service --no-pager"
if ($LASTEXITCODE -ne 0) {
    Write-Host "Service restart failed." -ForegroundColor Red
    exit 1
}

Write-Host "3. Confirming endpoint /api/admin/push-test-by-phone..." -ForegroundColor Green
try {
    $url = "https://api.leylektag.com/api/admin/push-test-by-phone?admin_phone=5326497412&phone=5326497412"
    $r = Invoke-RestMethod -Uri $url -Method Get
    $r | ConvertTo-Json -Depth 5
    if ($r.success) { Write-Host "Endpoint OK. Push sent." -ForegroundColor Green } else { Write-Host "Endpoint responded but push failed (check debug)." -ForegroundColor Yellow }
} catch {
    Write-Host "Request failed: $_" -ForegroundColor Red
}
