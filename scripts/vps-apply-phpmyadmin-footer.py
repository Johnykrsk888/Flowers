#!/usr/bin/env python3
"""Залить config.footer.inc.php на VPS (пароли из .env)."""
from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def load_env(path: Path) -> dict[str, str]:
    out: dict[str, str] = {}
    if not path.is_file():
        return out
    for line in path.read_text(encoding="utf-8", errors="replace").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, _, v = line.partition("=")
        out[k.strip()] = v.strip()
    return out


def main() -> int:
    try:
        import paramiko
    except ImportError:
        print("pip install paramiko", file=sys.stderr)
        return 1

    env = load_env(ROOT / ".env")
    host = env.get("SERVER_HOST", "79.174.91.140")
    password = env.get("SERVER_PASSWORD", "")
    db = env.get("MYSQL_DATABASE", "flowers_mysql")
    if not password:
        print("В .env нет SERVER_PASSWORD", file=sys.stderr)
        return 1

    src = ROOT / "deploy" / "phpmyadmin" / "config.footer.inc.php"
    if not src.is_file():
        print(f"Нет {src}", file=sys.stderr)
        return 1

    text = src.read_text(encoding="utf-8")
    text = text.replace("$db = 'flowers_mysql';", f"$db = '{db}';")

    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(
        hostname=host,
        username=env.get("SERVER_USER", "root"),
        password=password,
        timeout=30,
        allow_agent=False,
        look_for_keys=False,
    )
    sftp = client.open_sftp()
    remote = "/tmp/config.footer.inc.php"
    with sftp.open(remote, "w") as f:
        f.write(text)
    sftp.chmod(remote, 0o644)
    sftp.close()

    stdin, stdout, stderr = client.exec_command(
        f"install -m 0644 -o root -g www-data {remote} /var/www/phpmyadmin/config.footer.inc.php && "
        f"rm -f {remote} && echo OK"
    )
    out = stdout.read().decode() + stderr.read().decode()
    client.close()
    print(out.strip())
    return 0 if "OK" in out else 1


if __name__ == "__main__":
    raise SystemExit(main())
