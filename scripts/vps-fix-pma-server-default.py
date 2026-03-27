#!/usr/bin/env python3
"""
Привести config.inc.php к одному серверу: $cfg['Servers'][1] и $cfg['ServerDefault'] = 1.
Старые установки с $i=0 и ServerDefault=0 дают пустой Server или ошибку «неверный индекс сервера».
Сохраняет существующий blowfish_secret.
"""
from __future__ import annotations

import re
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
    if not env.get("SERVER_PASSWORD"):
        print("В .env нет SERVER_PASSWORD", file=sys.stderr)
        return 1

    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(
        hostname=env.get("SERVER_HOST", "79.174.91.140"),
        username=env.get("SERVER_USER", "root"),
        password=env["SERVER_PASSWORD"],
        timeout=30,
        allow_agent=False,
        look_for_keys=False,
    )
    sftp = client.open_sftp()
    remote = "/var/www/phpmyadmin/config.inc.php"
    with sftp.open(remote, "r") as f:
        text = f.read().decode("utf-8", errors="replace")

    m = re.search(r"hex2bin\s*\(\s*'([0-9a-fA-F]{64})'\s*\)", text)
    if not m:
        print("Не найден blowfish hex2bin в config.inc.php", file=sys.stderr)
        sftp.close()
        client.close()
        return 1
    hex64 = m.group(1)

    body = f"""<?php
declare(strict_types=1);
$cfg['blowfish_secret'] = hex2bin('{hex64}');
$cfg['TempDir'] = '/var/www/phpmyadmin/tmp';
$cfg['ServerDefault'] = 1;
$i = 1;
$cfg['Servers'][$i]['host'] = 'localhost';
$cfg['Servers'][$i]['socket'] = '/run/mysqld/mysqld.sock';
$cfg['Servers'][$i]['compress'] = false;
$cfg['Servers'][$i]['AllowNoPassword'] = false;
"""

    tmp = "/tmp/config.inc.php.fixsd"
    with sftp.open(tmp, "w") as f:
        f.write(body)
    sftp.chmod(tmp, 0o640)
    sftp.close()

    stdin, stdout, stderr = client.exec_command(
        f"install -m 0640 -o root -g www-data {tmp} /var/www/phpmyadmin/config.inc.php && rm -f {tmp} && "
        "php -l /var/www/phpmyadmin/config.inc.php && "
        "systemctl reload php8.4-fpm 2>/dev/null || systemctl reload php-fpm 2>/dev/null || true && echo OK"
    )
    out = (stdout.read() + stderr.read()).decode(errors="replace")
    client.close()
    print(out.strip())
    return 0 if "OK" in out else 1


if __name__ == "__main__":
    raise SystemExit(main())
