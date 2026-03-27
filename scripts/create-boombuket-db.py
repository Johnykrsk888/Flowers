#!/usr/bin/env python3
"""Создать БД boombuket на VPS (MariaDB). Пароли из .env."""
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
    try:
        import paramiko
    except ImportError:
        print("pip install paramiko", file=sys.stderr)
        return 1

    env = load_env(ROOT / ".env")
    root_pw = env.get("PHPMYADMIN_MYSQL_PASSWORD", "")
    if not root_pw:
        print("Нет PHPMYADMIN_MYSQL_PASSWORD в .env", file=sys.stderr)
        return 1

    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(
        hostname=env.get("SERVER_HOST", "79.174.91.140"),
        username=env.get("SERVER_USER", "root"),
        password=env.get("SERVER_PASSWORD", ""),
        timeout=30,
        allow_agent=False,
        look_for_keys=False,
    )
    stmts = [
        "CREATE DATABASE IF NOT EXISTS boombuket CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci",
        "GRANT ALL ON boombuket.* TO 'flowers_mysql'@'localhost'",
        "FLUSH PRIVILEGES",
    ]
    for stmt in stmts:
        cmd = "mysql -uroot -p'" + root_pw.replace("'", "'\"'\"'") + "' -e " + repr(stmt)
        _, stdout, stderr = client.exec_command(cmd)
        err = (stdout.read() + stderr.read()).decode(errors="replace")
        if err.strip():
            print(err.strip())
    client.close()
    print("OK")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
