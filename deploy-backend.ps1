# Backend deploy: SSH -> /opt/leylektag -> git fetch/merge origin/main -> restart leylektag.service
# Canli systemd WorkingDirectory=/opt/leylektag/backend — repo kokunu guncellemek gerekir.
# Prerequisite: push commits to the remote the server uses before running.
# Run: .\deploy-backend.ps1  (SSH key or password)

$Server = "157.173.113.156"

$RemoteBash = @'
set -e
PROD=/opt/leylektag
if [ ! -d "$PROD/.git" ]; then
  echo "ERROR: $PROD is not a git clone"
  exit 1
fi
echo "=== Deploy: $PROD ==="
cd "$PROD"
git fetch origin
git merge origin/main --no-edit
sudo systemctl restart leylektag.service
sleep 2
sudo systemctl status leylektag.service 2>&1 | cat
'@

Write-Host "Deploy: /opt/leylektag -> git merge origin/main -> systemctl restart leylektag" -ForegroundColor Cyan
Write-Host "Server: root@$Server" -ForegroundColor Gray

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
