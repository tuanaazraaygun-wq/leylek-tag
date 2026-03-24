# Backend deploy: SSH -> find server.py under /root -> git pull -> restart leylektag.service
# No hardcoded backend folder name; works if the directory is renamed.
# Prerequisite: push commits to the remote the server uses before running.
# Run: .\deploy-backend.ps1  (SSH password when prompted)

$Server = "157.173.113.156"

# Bash runs on the server only; PowerShell single-quoted here-string — do not use "@" double-quote form or $( ) expands locally.
$RemoteBash = @'
set -e
echo "=== find /root -name server.py ==="
find /root -name server.py 2>/dev/null || true
PY=$(find /root -name server.py 2>/dev/null | head -n1)
if [ -z "$PY" ]; then
  echo "ERROR: No server.py found under /root"
  exit 1
fi
DIR=$(dirname "$PY")
echo "Backend directory: $DIR"
cd "$DIR"
git pull
sudo systemctl restart leylektag.service
sleep 2
sudo systemctl status leylektag.service --no-pager
'@

Write-Host "Deploy: find /root -> server.py -> dirname -> cd -> git pull -> restart leylektag.service" -ForegroundColor Cyan
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
