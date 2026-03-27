#!/usr/bin/env bash
# MariaDB + php-fpm + phpMyAdmin + HTTP Basic для nginx.
# Запуск на сервере от root: bash install-phpmyadmin.sh
set -euo pipefail

if [[ "${EUID:-0}" -ne 0 ]]; then
  echo "Запустите от root"
  exit 1
fi

export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y \
  mariadb-server nginx \
  php-fpm php-mysql php-mbstring php-xml php-zip php-gd php-curl php-json php-bcmath php-intl \
  apache2-utils wget ca-certificates

systemctl enable --now mariadb

MYSQL_ROOT=$(openssl rand -hex 16)
mariadb -e "ALTER USER 'root'@'localhost' IDENTIFIED BY '${MYSQL_ROOT}'; FLUSH PRIVILEGES;" || \
  mysql -e "ALTER USER 'root'@'localhost' IDENTIFIED BY '${MYSQL_ROOT}'; FLUSH PRIVILEGES;"

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

WEB_PASS=$(openssl rand -hex 12)
htpasswd -bcB /etc/nginx/.htpasswd-phpmyadmin admin "${WEB_PASS}" >/dev/null
chmod 640 /etc/nginx/.htpasswd-phpmyadmin
chown root:www-data /etc/nginx/.htpasswd-phpmyadmin

install -d -m 0750 /etc/flowers
umask 077
cat > /etc/flowers/phpmyadmin-access.txt <<ACC
phpMyAdmin (MariaDB)
====================
URL: https://www.boombuket.ru/phpmyadmin/

Шаг 1 — окно браузера (HTTP Basic):
  Логин: admin
  Пароль: ${WEB_PASS}

Шаг 2 — форма phpMyAdmin (MySQL/MariaDB), если не включён автовход:
  Пользователь: root
  Пароль: ${MYSQL_ROOT}
  Автовход: bash configure-phpmyadmin-config-auth.sh (в репозитории deploy/)

Примечание: база PostgreSQL «flowers» в phpMyAdmin не отображается — это отдельный движок.
ACC
chmod 600 /etc/flowers/phpmyadmin-access.txt

install -d -m 0755 /etc/nginx/snippets
# shellcheck disable=SC2016
cat > /etc/nginx/snippets/phpmyadmin_location.conf <<'NGX'
# phpMyAdmin (сгенерировано install-phpmyadmin.sh)
location = /phpmyadmin {
    return 301 https://$host/phpmyadmin/;
}
location ^~ /phpmyadmin/ {
    client_max_body_size 64M;
    auth_basic "phpMyAdmin";
    auth_basic_user_file /etc/nginx/.htpasswd-phpmyadmin;
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

echo "Готово. Учётные данные: cat /etc/flowers/phpmyadmin-access.txt"
