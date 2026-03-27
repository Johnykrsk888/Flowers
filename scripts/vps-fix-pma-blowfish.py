#!/usr/bin/env python3
"""Исправить blowfish_secret в phpMyAdmin (32 байта для Sodium) + socket. Пароль SSH из .env."""
from __future__ import annotations

import secrets
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

CONFIG = """<?php
declare(strict_types=1);
$cfg['blowfish_secret'] = hex2bin('{hex64}');
$cfg['TempDir'] = '/var/www/phpmyadmin/tmp';
$i = 0;
$cfg['Servers'][$i]['host'] = 'localhost';
$cfg['Servers'][$i]['socket'] = '/run/mysqld/mysqld.sock';
$cfg['Servers'][$i]['compress'] = false;
$cfg['Servers'][$i]['AllowNoPassword'] = false;
"""


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
    hex64 = secrets.token_hex(32)
    body = CONFIG.format(hex64=hex64)

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
    sftp = client.open_sftp()
    remote = "/tmp/config.inc.php.pmafix"
    with sftp.open(remote, "w") as f:
        f.write(body)
    sftp.chmod(remote, 0o640)
    sftp.close()

    stdin, stdout, stderr = client.exec_command(
        f"install -m 0640 -o root -g www-data {remote} /var/www/phpmyadmin/config.inc.php "
        f"&& rm -f {remote} && php -l /var/www/phpmyadmin/config.inc.php && systemctl reload php8.4-fpm 2>/dev/null || systemctl reload php-fpm 2>/dev/null || true && echo OK"
    )
    out = (stdout.read() + stderr.read()).decode(errors="replace")
    client.close()
    print(out.strip())
    return 0 if "OK" in out else 1


if __name__ == "__main__":
    raise SystemExit(main())
