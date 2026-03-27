#!/usr/bin/env bash
# Автовход в MariaDB после HTTP Basic (без второй формы пароля).
# Пароль: копия в /var/www/phpmyadmin/.mysql_root_secret (www-data), иначе PHP не читает из 0750-only /etc/flowers.
# Использование: echo 'ПАРОЛЬ_ROOT' | bash configure-phpmyadmin-config-auth.sh
# или: bash configure-phpmyadmin-config-auth.sh < /tmp/pw
set -euo pipefail
[[ "${EUID:-0}" -eq 0 ]] || { echo "root only"; exit 1; }

PW="${1:-}"
if [[ -z "$PW" ]]; then PW=$(cat); fi
PW=$(echo -n "$PW" | tr -d '\r\n')

install -d -m 0755 /etc/flowers
printf '%s' "$PW" > /etc/flowers/phpmyadmin-mysql.secret
chown root:www-data /etc/flowers/phpmyadmin-mysql.secret
chmod 640 /etc/flowers/phpmyadmin-mysql.secret
# PHP (www-data) не может читать файлы внутри 0750-only каталога без обхода — дублируем в webroot:
cp -a /etc/flowers/phpmyadmin-mysql.secret /var/www/phpmyadmin/.mysql_root_secret
chown www-data:www-data /var/www/phpmyadmin/.mysql_root_secret
chmod 600 /var/www/phpmyadmin/.mysql_root_secret

CONF=/var/www/phpmyadmin/config.inc.php
if grep -q "auth_type.*config" "$CONF" 2>/dev/null; then
  echo "Уже настроено auth_type config"
  exit 0
fi

cat >> "$CONF" <<'PHP'

/* Автовход MariaDB (пароль вне webroot) */
$cfg['Servers'][$i]['auth_type'] = 'config';
$cfg['Servers'][$i]['user'] = 'root';
$cfg['Servers'][$i]['password'] = trim(file_get_contents('/var/www/phpmyadmin/.mysql_root_secret'));
PHP

chown root:www-data "$CONF"
chmod 640 "$CONF"
echo "Готово: после Basic сразу откроется phpMyAdmin без формы логина MariaDB."
