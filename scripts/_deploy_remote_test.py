"""One-off: upload server.py, restart service, smoke test. Do not commit secrets."""
import os
import sys
from pathlib import Path

import paramiko

ROOT = Path(__file__).resolve().parents[1]
LOCAL = ROOT / "backend" / "server.py"
REMOTE = "/opt/leylektag/server.py"
HOST = "157.173.113.156"
USER = "root"


def main() -> int:
    password = os.environ.get("LEYLEK_DEPLOY_PW", "").strip()
    if not password:
        print("Set LEYLEK_DEPLOY_PW", file=sys.stderr)
        return 2
    if not LOCAL.is_file():
        print("Missing", LOCAL, file=sys.stderr)
        return 2

    c = paramiko.SSHClient()
    c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    c.connect(HOST, username=USER, password=password, timeout=45, allow_agent=False, look_for_keys=False)
    try:
        sftp = c.open_sftp()
        sftp.put(str(LOCAL), REMOTE)
        sftp.close()
        print("Uploaded", REMOTE)

        bash = r"""
set -e
systemctl restart leylektag.service
sleep 2
systemctl is-active leylektag.service
for p in 8001 8000 8080 3000; do
  if curl -sS -m 5 "http://127.0.0.1:${p}/api/cities" 2>/dev/null | head -c 5 | grep -q .; then
    echo "OK curl http://127.0.0.1:${p}/api/cities (first bytes):"
    curl -sS -m 5 "http://127.0.0.1:${p}/api/cities" | head -c 400
    echo
    exit 0
  fi
done
echo "WARN: /api/cities not reachable on 8000/8080/3000"
systemctl cat leylektag.service 2>/dev/null | head -40 || true
journalctl -u leylektag.service -n 20 --no-pager
"""
        stdin, stdout, stderr = c.exec_command(bash, timeout=120)
        out = stdout.read().decode(errors="replace")
        err = stderr.read().decode(errors="replace")
        enc = getattr(sys.stdout, "encoding", None) or "utf-8"
        safe = lambda s: s.encode(enc, errors="replace").decode(enc, errors="replace")
        print(safe(out))
        if err.strip():
            print("stderr:", safe(err), file=sys.stderr)
    finally:
        c.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
