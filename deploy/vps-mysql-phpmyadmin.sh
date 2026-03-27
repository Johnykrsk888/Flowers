#!/usr/bin/env bash
# Пустая БД MariaDB + phpMyAdmin + nginx (HTTP Basic). Запуск на VPS от root:
#   cd /root/flowers-deploy   # или где лежит deploy/
#   bash deploy/vps-mysql-phpmyadmin.sh
#
# Опционально задать до запуска (иначе пароли сгенерированы случайно):
#   export MYSQL_DATABASE=flowers_mysql
#   export MYSQL_USER=flowers_mysql
#   export MYSQL_PASSWORD='...'
#   export MARIADB_ROOT_PASSWORD='...'
#   export PHPMYADMIN_BASIC_PASSWORD='...'
#
# После выполнения: cat /etc/flowers/mysql-dotenv.txt — скопируйте строки в локальный .env
set -euo pipefail

if [[ "${EUID:-0}" -ne 0 ]]; then
  echo "Запустите от root: sudo bash $0"
  exit 1
fi

export DEBIAN_FRONTEND=noninteractive

DB_NAME="${MYSQL_DATABASE:-flowers_mysql}"
DB_USER="${MYSQL_USER:-flowers_mysql}"
ROOT_PW="${MARIADB_ROOT_PASSWORD:-$(openssl rand -hex 16)}"
BASIC_PW="${PHPMYADMIN_BASIC_PASSWORD:-$(openssl rand -hex 12)}"
APP_PW="${MYSQL_PASSWORD:-$(openssl rand -hex 16)}"

apt-get update -y
apt-get install -y \
  mariadb-server nginx \
  php-fpm php-mysql php-mbstring php-xml php-zip php-gd php-curl php-json php-bcmath php-intl \
  apache2-utils wget ca-certificates

systemctl enable --now mariadb

# root MariaDB
mariadb -e "ALTER USER 'root'@'localhost' IDENTIFIED BY '${ROOT_PW}'; FLUSH PRIVILEGES;" || \
  mariadb -uroot -e "ALTER USER 'root'@'localhost' IDENTIFIED BY '${ROOT_PW}'; FLUSH PRIVILEGES;"

mariadb -uroot -p"${ROOT_PW}" -e "
CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS '${DB_USER}'@'localhost' IDENTIFIED BY '${APP_PW}';
ALTER USER '${DB_USER}'@'localhost' IDENTIFIED BY '${APP_PW}';
GRANT ALL PRIVILEGES ON \`${DB_NAME}\`.* TO '${DB_USER}'@'localhost';
FLUSH PRIVILEGES;
"

PHP_SOCK=$(ls /run/php/php*-fpm.sock 2>/dev/null | head -1 || true)
if [[ -z "$PHP_SOCK" ]]; then
  systemctl restart "php$(ls /etc/php 2>/dev/null | grep -E '^[0-9]' | head -1)-fpm" 2>/dev/null || true
  PHP_SOCK=$(ls /run/php/php*-fpm.sock 2>/dev/null | head -1)
fi
if [[ -z "$PHP_SOCK" ]]; then
  echo "Не найден сокет php-fpm в /run/php/"
  exit 1
fi

PMA_VER="5.2.2"
cd /tmp
rm -rf "phpMyAdmin-${PMA_VER}-all-languages" "phpMyAdmin-${PMA_VER}-all-languages.tar.gz"
wget -q "https://files.phpmyadmin.net/phpMyAdmin/${PMA_VER}/phpMyAdmin-${PMA_VER}-all-languages.tar.gz"
tar xzf "phpMyAdmin-${PMA_VER}-all-languages.tar.gz"
rm -rf /var/www/phpmyadmin
mv "phpMyAdmin-${PMA_VER}-all-languages" /var/www/phpmyadmin
chown -R www-data:www-data /var/www/phpmyadmin
install -d -m 0770 -o www-data -g www-data /var/www/phpmyadmin/tmp

BF=$(openssl rand -hex 16)
cat > /var/www/phpmyadmin/config.inc.php <<CFG
<?php
declare(strict_types=1);
\$cfg['blowfish_secret'] = '${BF}';
\$cfg['TempDir'] = '/var/www/phpmyadmin/tmp';
\$i = 0;
\$cfg['Servers'][\$i]['host'] = 'localhost';
\$cfg['Servers'][\$i]['compress'] = false;
\$cfg['Servers'][\$i]['AllowNoPassword'] = false;
CFG
chown root:www-data /var/www/phpmyadmin/config.inc.php
chmod 640 /var/www/phpmyadmin/config.inc.php

install -d -m 0755 /var/www/phpmyadmin
htpasswd -bcB /var/www/phpmyadmin/.htpasswd admin "${BASIC_PW}" >/dev/null
chown www-data:www-data /var/www/phpmyadmin/.htpasswd
chmod 600 /var/www/phpmyadmin/.htpasswd

install -d -m 0750 /etc/flowers
umask 077
cat > /etc/flowers/mysql-dotenv.txt <<DOTENV
# Скопируйте в локальный .env (не коммитьте .env)
PHPMYADMIN_URL=https://www.boombuket.ru/phpmyadmin/
PHPMYADMIN_BASIC_USER=admin
PHPMYADMIN_BASIC_PASSWORD=${BASIC_PW}
MYSQL_HOST=127.0.0.1
MYSQL_PORT=3306
MYSQL_DATABASE=${DB_NAME}
MYSQL_USER=${DB_USER}
MYSQL_PASSWORD=${APP_PW}
PHPMYADMIN_MYSQL_USER=root
PHPMYADMIN_MYSQL_PASSWORD=${ROOT_PW}
DOTENV
chmod 600 /etc/flowers/mysql-dotenv.txt

cat > /etc/flowers/phpmyadmin-access.txt <<ACC
phpMyAdmin + MariaDB
====================
URL: https://www.boombuket.ru/phpmyadmin/

1) HTTP Basic: логин admin, пароль см. PHPMYADMIN_BASIC_PASSWORD в mysql-dotenv.txt
2) Форма phpMyAdmin: пользователь root или ${DB_USER}
   - root + PHPMYADMIN_MYSQL_PASSWORD — полный доступ
   - ${DB_USER} + MYSQL_PASSWORD — только база ${DB_NAME}

Переменные для .env: cat /etc/flowers/mysql-dotenv.txt
ACC
chmod 600 /etc/flowers/phpmyadmin-access.txt

install -d -m 0755 /etc/nginx/snippets
# shellcheck disable=SC2016
cat > /etc/nginx/snippets/phpmyadmin_location.conf <<'NGX'
# phpMyAdmin (vps-mysql-phpmyadmin.sh)
location = /phpmyadmin {
    return 301 https://$host/phpmyadmin/;
}
location ^~ /phpmyadmin/ {
    client_max_body_size 64M;
    auth_basic "phpMyAdmin";
    auth_basic_user_file /var/www/phpmyadmin/.htpasswd;
    alias /var/www/phpmyadmin/;
    index index.php;
    location ~ ^/phpmyadmin/(.+\.php)$ {
        alias /var/www/phpmyadmin/$1;
        fastcgi_pass unix:__PHP_FPM_SOCK__;
        fastcgi_param SCRIPT_FILENAME /var/www/phpmyadmin/$1;
        include fastcgi_params;
    }
}
NGX
sed -i "s|__PHP_FPM_SOCK__|${PHP_SOCK}|g" /etc/nginx/snippets/phpmyadmin_location.conf

FLOWERS_CONF="/etc/nginx/sites-available/flowers"
if [[ -f "$FLOWERS_CONF" ]] && ! grep -q 'phpmyadmin_location.conf' "$FLOWERS_CONF"; then
  sed -i '/index index.html;/a\    include /etc/nginx/snippets/phpmyadmin_location.conf;' "$FLOWERS_CONF"
fi

nginx -t
systemctl reload nginx

echo ""
echo "Готово. Пустая БД: ${DB_NAME}, пользователь приложения: ${DB_USER}"
echo "Строки для .env: cat /etc/flowers/mysql-dotenv.txt"
