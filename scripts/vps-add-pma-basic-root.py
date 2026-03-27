#!/usr/bin/env python3
"""Добавить пользователя root в HTTP Basic для /phpmyadmin (пароль = MariaDB root из .env)."""
from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def load_env(path: Path) -> dict[str, str]:
    out: dict[str, str] = {}
    for line in path.read_text(encoding="utf-8", errors="replace").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, _, v = line.partition("=")
        out[k.strip()] = v.strip()
    return out


def main() -> int:
    import paramiko

    env = load_env(ROOT / ".env")
    mysql_pw = env["PHPMYADMIN_MYSQL_PASSWORD"]
    # Escape for bash single-quoted string
    esc = mysql_pw.replace("'", "'\"'\"'")

    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(
        hostname=env["SERVER_HOST"],
        username=env.get("SERVER_USER", "root"),
        password=env["SERVER_PASSWORD"],
        timeout=30,
        allow_agent=False,
        look_for_keys=False,
    )

    cmd = """
set -e
HT=/var/www/phpmyadmin/.htpasswd
install -d -m 0755 /var/www/phpmyadmin
[[ -f "$HT" ]] || touch "$HT"
chown www-data:www-data "$HT"
chmod 600 "$HT"
htpasswd -bB "$HT" root '""" + esc + """'
chown www-data:www-data "$HT"
chmod 600 "$HT"
echo 'HTPASSWD_OK'
grep -c '^root:' "$HT" || true
"""
    stdin, stdout, stderr = client.exec_command(cmd)
    out = (stdout.read() + stderr.read()).decode(errors="replace")
    client.close()
    print(out.strip())
    return 0 if "HTPASSWD_OK" in out else 1


if __name__ == "__main__":
    raise SystemExit(main())
