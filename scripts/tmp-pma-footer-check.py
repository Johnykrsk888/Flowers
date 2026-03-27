"""Проверка: custom header/footer в HTML phpMyAdmin на сервере."""
from pathlib import Path
import paramiko

ROOT = Path(__file__).resolve().parents[1]
e = {}
for line in (ROOT / ".env").read_text(encoding="utf-8").splitlines():
    line = line.strip()
    if not line or line.startswith("#") or "=" not in line:
        continue
    k, _, v = line.partition("=")
    e[k.strip()] = v.strip()

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect(
    e["SERVER_HOST"],
    username=e["SERVER_USER"],
    password=e["SERVER_PASSWORD"],
    timeout=25,
    allow_agent=False,
    look_for_keys=False,
)


def run(cmd: str) -> str:
    _, stdout, stderr = c.exec_command(cmd)
    stdout.channel.recv_exit_status()
    return (stdout.read() + stderr.read()).decode(errors="replace")


bp = e["PHPMYADMIN_BASIC_PASSWORD"].replace("'", "'\"'\"'")
print("=== header file on server (first 12 lines) ===")
print(run("head -12 /var/www/phpmyadmin/config.header.inc.php 2>&1"))
print("=== footer file on server (first 12 lines) ===")
print(run("head -12 /var/www/phpmyadmin/config.footer.inc.php 2>&1"))
print("=== grep redirect markers in curl index ===")
print(
    run(
        f"curl -s -u 'admin:{bp}' 'https://127.0.0.1/phpmyadmin/index.php?route=/' -k -H 'Host: www.boombuket.ru' 2>&1 | grep -o 'pma_landed_flowers\\|pma_header\\|tick()' | head -5"
    )
)
print("=== grep CommonParams logged_in in first response ===")
print(
    run(
        f"curl -s -u 'admin:{bp}' 'https://127.0.0.1/phpmyadmin/index.php?route=/' -k -H 'Host: www.boombuket.ru' 2>&1 | grep -o 'logged_in[^,]*' | head -3"
    )
)
c.close()
