# Real Deployment Fix: Run socket_app on Server

The server must run **socket_app** (not **app**) so `/socket.io` works. Follow either the script or the manual steps below.

---

## Option A: Run the fix script on the server

1. Copy the script to the server (from your local machine):
   ```bash
   scp scripts/fix-socket-deployment.sh root@157.173.113.156:/tmp/
   ```

2. SSH and run:
   ```bash
   ssh root@157.173.113.156
   chmod +x /tmp/fix-socket-deployment.sh
   sudo /tmp/fix-socket-deployment.sh
   ```

3. If the script says "No leylek service found", find the service name:
   ```bash
   systemctl list-units --type=service | grep -i leylek
   ```
   Then edit the service manually (Option B).

---

## Option B: Manual steps on the server

### 1. Find the service name
```bash
systemctl list-units --type=service | grep -i leylek
```
Note the name (e.g. `leylektag.service` or `leylek-backend.service`).

### 2. Edit the service file
```bash
sudo nano /etc/systemd/system/<SERVICE_NAME>
```

Find the line that starts with `ExecStart=`.

**If WorkingDirectory is project root** (e.g. `/opt/leylek-tag`):
- Replace with:
  ```ini
  ExecStart=/usr/bin/python3 -m uvicorn backend.server:socket_app --host 0.0.0.0 --port 8001
  ```

**If WorkingDirectory is backend folder** (e.g. `/opt/leylek-backend`):
- Replace with:
  ```ini
  ExecStart=/usr/bin/python3 -m uvicorn server:socket_app --host 0.0.0.0 --port 8001
  ```

Ensure there is **no** `:app` left in the file. Save (Ctrl+O, Enter, Ctrl+X).

### 3. Apply changes
```bash
sudo systemctl daemon-reexec
sudo systemctl daemon-reload
sudo systemctl restart <SERVICE_NAME>
```

### 4. Verify process
```bash
ps aux | grep uvicorn
```
You must see `backend.server:socket_app` or `server:socket_app`, **not** `:app`.

### 5. Test Socket.IO
Open in browser:
```
http://157.173.113.156:8001/socket.io/?EIO=4&transport=polling
```
- Expected: JSON (e.g. `0{"sid":"...","pingInterval":...}`).
- Not: 404 or `{"detail":"Not Found"}`.

### 6. Check logs
```bash
journalctl -u <SERVICE_NAME> -f
```
Open the app; you should see:
```
🔥 SOCKET CLIENT CONNECTED: <sid>
```

---

## Goal

The server must run **socket_app** so that:
- Socket.IO handshake works at `/socket.io`
- Backend prints `🔥 SOCKET CLIENT CONNECTED` when the app connects
- Events like `driver_accept_offer` are received
