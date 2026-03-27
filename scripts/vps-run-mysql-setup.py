#!/usr/bin/env python3
"""Одноразовый запуск deploy/vps-mysql-phpmyadmin.sh на VPS (пароль из .env). Не коммитить секреты."""
from __future__ import annotations

import re
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
    user = env.get("SERVER_USER", "root")
    password = env.get("SERVER_PASSWORD", "")
    if not password:
        print("В .env нет SERVER_PASSWORD", file=sys.stderr)
        return 1

    script_local = ROOT / "deploy" / "vps-mysql-phpmyadmin.sh"
    if not script_local.is_file():
        print(f"Нет файла: {script_local}", file=sys.stderr)
        return 1

    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(
        hostname=host,
        username=user,
        password=password,
        timeout=30,
        allow_agent=False,
        look_for_keys=False,
    )

    sftp = client.open_sftp()
    remote = "/tmp/vps-mysql-phpmyadmin.sh"
    sftp.put(str(script_local), remote)
    sftp.chmod(remote, 0o755)
    sftp.close()

    # PTY — чтобы apt/dpkg не ругались на отсутствие TTY
    stdin, stdout, stderr = client.exec_command(f"bash -x {remote} 2>&1", get_pty=True, timeout=900)
    log = stdout.read().decode("utf-8", errors="replace")
    print(log)
    code = stdout.channel.recv_exit_status()
    if code != 0:
        print(f"--- exit {code} ---", file=sys.stderr)
        client.close()
        return code

    stdin, stdout, stderr = client.exec_command("cat /etc/flowers/mysql-dotenv.txt")
    dotenv_remote = stdout.read().decode("utf-8", errors="replace")
    err = stderr.read().decode("utf-8", errors="replace")
    client.close()
    if err:
        print(err, file=sys.stderr)

    # Обновить локальный .env
    env_path = ROOT / ".env"
    text = env_path.read_text(encoding="utf-8", errors="replace")
    new_vars: dict[str, str] = {}
    for line in dotenv_remote.splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, _, v = line.partition("=")
        new_vars[k.strip()] = v.strip()

    for key, val in new_vars.items():
        pat = re.compile(rf"^{re.escape(key)}=.*$", re.MULTILINE)
        if pat.search(text):
            text = pat.sub(f"{key}={val}", text)
        else:
            text = text.rstrip() + f"\n{key}={val}\n"

    env_path.write_text(text, encoding="utf-8", newline="\n")
    print("\n[OK] Локальный .env обновлён из /etc/flowers/mysql-dotenv.txt")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
