#!/bin/bash
# Run this script ON THE SERVER (e.g. via ssh root@157.173.113.156)
# Fix: Run socket_app instead of app so /socket.io works (no 404).

set -e

echo "=== 1. Finding Leylek systemd service ==="
SERVICE=$(systemctl list-units --type=service --all --no-legend 2>/dev/null | grep -i leylek | awk '{print $1}' | head -1)
if [ -z "$SERVICE" ]; then
  echo "No leylek service found. Try: systemctl list-units --type=service | grep -i leylek"
  exit 1
fi
echo "Found service: $SERVICE"

SERVICE_FILE="/etc/systemd/system/$SERVICE"
if [ ! -f "$SERVICE_FILE" ]; then
  echo "Service file not found: $SERVICE_FILE"
  exit 1
fi

echo ""
echo "=== 2. Current ExecStart ==="
grep -E "ExecStart|WorkingDirectory" "$SERVICE_FILE" || true

echo ""
echo "=== 3. Backing up and editing service file ==="
sudo cp "$SERVICE_FILE" "${SERVICE_FILE}.bak.$(date +%Y%m%d%H%M%S)"

# Replace :app with :socket_app in ExecStart (keeps backend.server vs server and rest of args)
sudo sed -i '/^ExecStart=.*uvicorn/s/:app/:socket_app/g' "$SERVICE_FILE"
# Ensure --host 0.0.0.0 --port 8001 exist (append if missing)
if ! sudo grep -q "ExecStart=.*--host.*0.0.0.0.*--port.*8001" "$SERVICE_FILE"; then
  sudo sed -i '/^ExecStart=/s|$| --host 0.0.0.0 --port 8001|' "$SERVICE_FILE"
fi
echo "Replaced :app with :socket_app in ExecStart"
sudo grep "^ExecStart=" "$SERVICE_FILE"

echo ""
echo "=== 4. Verify no :app left ==="
if sudo grep -q "uvicorn.*:app" "$SERVICE_FILE"; then
  echo "WARNING: Service file still contains :app. Edit manually: sudo nano $SERVICE_FILE"
  exit 1
fi
sudo grep ExecStart "$SERVICE_FILE"

echo ""
echo "=== 5. Applying changes ==="
sudo systemctl daemon-reexec
sudo systemctl daemon-reload
sudo systemctl restart "$SERVICE"
echo "Restarted $SERVICE"

sleep 2
echo ""
echo "=== 6. Verify process ==="
ps aux | grep uvicorn | grep -v grep || true
if ps aux | grep uvicorn | grep -v grep | grep -q ":app"; then
  echo "ERROR: Process still running :app. Check service file."
  exit 1
fi
if ps aux | grep uvicorn | grep -v grep | grep -q "socket_app"; then
  echo "OK: socket_app is running."
fi

echo ""
echo "=== 7. Test Socket.IO endpoint ==="
curl -s -o /dev/null -w "%{http_code}" "http://127.0.0.1:8001/socket.io/?EIO=4&transport=polling" && echo " (expect 200)" || true
curl -s "http://127.0.0.1:8001/socket.io/?EIO=4&transport=polling" | head -c 200
echo ""

echo ""
echo "=== 8. Follow logs (Ctrl+C to stop) ==="
echo "Run: journalctl -u $SERVICE -f"
echo "Then open the app; you should see: 🔥 SOCKET CLIENT CONNECTED"
