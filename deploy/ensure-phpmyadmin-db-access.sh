#!/usr/bin/env bash
# Полный доступ к MariaDB через phpMyAdmin:
# 1) HTTP Basic: и admin, и root (оба в htpasswd)
# 2) MariaDB: пароль root = переданный MYSQL_PASS
# 3) Секрет для PHP + config.inc.php с автовходом
set -euo pipefail
[[ "${EUID:-0}" -eq 0 ]] || { echo "root only"; exit 1; }

ADMIN_BASIC="${1:?admin basic password}"
MYSQL_PASS="${2:?mysql root password}"

export DEBIAN_FRONTEND=noninteractive
command -v htpasswd >/dev/null || apt-get update -y && apt-get install -y apache2-utils

# Файл в /var/www/phpmyadmin — nginx (www-data) должен читать; путь в /etc/nginx часто блокируется AppArmor.
HT=/var/www/phpmyadmin/.htpasswd
install -d -m 0755 /var/www/phpmyadmin
[[ -f "$HT" ]] || touch "$HT"
chown www-data:www-data "$HT"
chmod 600 "$HT"

# Два входа в первое окно браузера: admin или root
htpasswd -bB "$HT" admin "$ADMIN_BASIC"
htpasswd -bB "$HT" root "$MYSQL_PASS"

# MariaDB root
if mariadb -uroot -p"$MYSQL_PASS" -e "SELECT 1" >/dev/null 2>&1; then
  echo "MariaDB root: пароль OK"
else
  mariadb -e "ALTER USER 'root'@'localhost' IDENTIFIED BY '${MYSQL_PASS}'; FLUSH PRIVILEGES;" || true
fi

install -d -m 0755 /var/www/phpmyadmin
printf '%s' "$MYSQL_PASS" > /var/www/phpmyadmin/.mysql_root_secret
chown www-data:www-data /var/www/phpmyadmin/.mysql_root_secret
chmod 600 /var/www/phpmyadmin/.mysql_root_secret

CONF=/var/www/phpmyadmin/config.inc.php
if ! grep -q "auth_type.*config" "$CONF" 2>/dev/null; then
  cat >> "$CONF" <<'PHP'

/* Автовход MariaDB */
$cfg['Servers'][$i]['auth_type'] = 'config';
$cfg['Servers'][$i]['user'] = 'root';
$cfg['Servers'][$i]['password'] = trim(file_get_contents('/var/www/phpmyadmin/.mysql_root_secret'));
PHP
fi
chown root:www-data "$CONF"
chmod 640 "$CONF"

sudo -u www-data test -r /var/www/phpmyadmin/.mysql_root_secret
php -r '$p=trim(file_get_contents("/var/www/phpmyadmin/.mysql_root_secret")); $m=@mysqli_connect("localhost","root",$p); echo $m?"OK mysqli\n":mysqli_connect_error();'

nginx -t
systemctl reload nginx

install -d -m 0750 /etc/flowers
cat > /etc/flowers/phpmyadmin-access.txt <<ACC
phpMyAdmin — доступ к MariaDB
==============================
URL: https://www.boombuket.ru/phpmyadmin/

Шаг 1 — окно браузера (HTTP Basic), можно ЛЮБОЙ из:
  логин admin  пароль: (как в .env PHPMYADMIN_BASIC_PASSWORD)
  логин root   пароль: (как пароль MariaDB / PHPMYADMIN_MYSQL_PASSWORD)

Шаг 2: после входа автоматически подключение к MariaDB как root (без второй формы).
ACC
chmod 600 /etc/flowers/phpmyadmin-access.txt

echo "Готово."
