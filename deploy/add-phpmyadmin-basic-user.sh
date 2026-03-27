#!/usr/bin/env bash
# Добавить пользователя в HTTP Basic для /phpmyadmin (nginx htpasswd).
# Первое окно браузера проверяет только этот файл — не MariaDB.
# Использование: bash add-phpmyadmin-basic-user.sh ИМЯ ПАРОЛЬ
set -euo pipefail
[[ "${EUID:-0}" -eq 0 ]] || { echo "root only"; exit 1; }

USER="${1:?имя}"
PASS="${2:?пароль}"

HT=/var/www/phpmyadmin/.htpasswd
install -d -m 0755 /var/www/phpmyadmin
[[ -f "$HT" ]] || touch "$HT"
chown www-data:www-data "$HT"
chmod 600 "$HT"

if ! command -v htpasswd >/dev/null; then
  apt-get update -y && apt-get install -y apache2-utils
fi

htpasswd -bB "$HT" "$USER" "$PASS"
nginx -t
systemctl reload nginx
echo "OK: в HTTP Basic добавлен пользователь $USER (файл $HT)"
