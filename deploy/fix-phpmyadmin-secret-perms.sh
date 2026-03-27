#!/usr/bin/env bash
# www-data должен читать пароль для phpMyAdmin (config auth).
# /etc/flowers с 0750 блокировал чтение секрета из PHP.
set -euo pipefail
[[ "${EUID:-0}" -eq 0 ]] || { echo "root only"; exit 1; }

PW="${1:-}"
SECRET=/etc/flowers/phpmyadmin-mysql.secret
ALT=/var/www/phpmyadmin/.mysql_root_secret

install -d -m 0755 /etc/flowers
chmod 755 /etc/flowers

if [[ -n "$PW" ]]; then
  printf '%s' "$PW" > "$SECRET"
  chown root:www-data "$SECRET"
  chmod 640 "$SECRET"
fi

if [[ -f "$SECRET" ]]; then
  cp -a "$SECRET" "$ALT"
  chown www-data:www-data "$ALT"
  chmod 600 "$ALT"
fi

CONF=/var/www/phpmyadmin/config.inc.php
if [[ -f "$CONF" ]] && grep -q 'phpmyadmin-mysql.secret' "$CONF" 2>/dev/null; then
  sed -i "s|/etc/flowers/phpmyadmin-mysql.secret|/var/www/phpmyadmin/.mysql_root_secret|g" "$CONF"
fi

chown root:www-data "$CONF"
chmod 640 "$CONF"

sudo -u www-data test -r "$ALT" || { echo "FAIL read secret"; exit 1; }
echo "OK: www-data читает $ALT"
php -r '$p=trim(file_get_contents("/var/www/phpmyadmin/.mysql_root_secret")); $m=@mysqli_connect("localhost","root",$p); echo $m?"OK mysqli\n":mysqli_connect_error();'
