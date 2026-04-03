# Backend deploy: SSH -> /opt/leylektag git pull -> CANLI kodu /opt/leylek-backend ile senkron -> restart
#
# ONEMLI: systemd loglarinda uvicorn bazen /opt/leylek-backend altindan calisir; sadece git merge
# yeterli degil — asagidaki cp ile server.py (ve bagli .py) prod dizinine kopyalanir.
# Prerequisite: push commits to origin/main before running.
# Run: .\deploy-backend.ps1  (SSH key or password)

$Server = "157.173.113.156"

$RemoteBash = @'
set -e
PROD=/opt/leylektag
LIVE=/opt/leylek-backend
if [ ! -d "$PROD/.git" ]; then
  echo "ERROR: $PROD is not a git clone"
  exit 1
fi
echo "=== Deploy: $PROD ==="
cd "$PROD"
git fetch origin
git merge origin/main --no-edit
if [ -d "$LIVE" ] && [ -d "$PROD/backend" ]; then
  echo "=== Sync $PROD/backend/*.py -> $LIVE/ (systemd calisma dizini) ==="
  for f in server.py supabase_client.py expo_push_channels.py route_service.py; do
    if [ -f "$PROD/backend/$f" ]; then cp -f "$PROD/backend/$f" "$LIVE/$f"; fi
  done
  if [ -d "$PROD/backend/services" ]; then
    mkdir -p "$LIVE/services"
    cp -f "$PROD/backend/services/"*.py "$LIVE/services/" 2>/dev/null || true
  fi
else
  echo "WARN: $LIVE veya $PROD/backend yok — yalnizca repo guncellendi; systemd baska dizinden calisiyorsa manuel kopyalayin."
fi
sudo systemctl restart leylektag.service
sleep 2
sudo systemctl status leylektag.service 2>&1 || true
'@

Write-Host "Deploy: git merge + sync backend/*.py -> /opt/leylek-backend + restart leylektag" -ForegroundColor Cyan
Write-Host "Server: root@$Server" -ForegroundColor Gray

# Windows CRLF -> LF (aksi halde uzak bash'te `| cat\r` gibi hatalar)
$RemoteBash = $RemoteBash -replace "`r`n", "`n"
$RemoteBash | ssh -o StrictHostKeyChecking=no "root@$Server" "bash -s"
if ($LASTEXITCODE -ne 0) {
    Write-Host "Deploy failed." -ForegroundColor Red
    exit 1
}

Write-Host "Optional: /api/admin/push-test-by-phone ..." -ForegroundColor Green
try {
    $url = "https://api.leylektag.com/api/admin/push-test-by-phone?admin_phone=5326497412&phone=5326497412"
    $r = Invoke-RestMethod -Uri $url -Method Get
    $r | ConvertTo-Json -Depth 5
    if ($r.success) { Write-Host "Endpoint OK." -ForegroundColor Green } else { Write-Host "Endpoint responded; check push/debug." -ForegroundColor Yellow }
} catch {
    Write-Host "Request failed: $_" -ForegroundColor Red
}
