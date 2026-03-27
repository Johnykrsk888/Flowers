#!/usr/bin/env bash
# Cookie-авторизация MariaDB (форма после HTTP Basic).
# blowfish_secret должен быть 32 байта (64 hex), иначе phpMyAdmin 5.2 + Sodium ломает вход.
# Запуск от root: bash patch-phpmyadmin-cookie-auth.sh
# Опционально: BF_HEX=64_символа_hex bash patch-phpmyadmin-cookie-auth.sh
set -euo pipefail

BF_HEX="${BF_HEX:-$(openssl rand -hex 32)}"
if [[ "${#BF_HEX}" -ne 64 ]]; then
  echo "BF_HEX должен быть 64 hex-символа (32 байта)"
  exit 1
fi

CONF=/var/www/phpmyadmin/config.inc.php
cat > "$CONF" <<EOF
<?php
declare(strict_types=1);
\$cfg['blowfish_secret'] = hex2bin('${BF_HEX}');
\$cfg['TempDir'] = '/var/www/phpmyadmin/tmp';
\$i = 0;
\$cfg['Servers'][\$i]['host'] = 'localhost';
\$cfg['Servers'][\$i]['socket'] = '/run/mysqld/mysqld.sock';
\$cfg['Servers'][\$i]['compress'] = false;
\$cfg['Servers'][\$i]['AllowNoPassword'] = false;
EOF
chown root:www-data "$CONF"
chmod 640 "$CONF"
php -l "$CONF"
echo "OK: cookie auth. После Basic: root + PHPMYADMIN_MYSQL_PASSWORD"
