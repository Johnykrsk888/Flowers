#!/usr/bin/env bash
# Жёстко прописать пароль MariaDB в config (без file_get_contents) — устраняет сбой автовхода в phpMyAdmin 5.2 + strict_types.
# Запуск от root: bash patch-phpmyadmin-inline-password.sh 'ПАРОЛЬ_ROOT'
set -euo pipefail
PW="${1:?пароль root MariaDB}"
BF_HEX="${2:-$(openssl rand -hex 32)}"
if [[ "${#BF_HEX}" -ne 64 ]]; then
  echo "Второй аргумент — 64 hex-символа blowfish_secret или оставьте пустым для openssl rand -hex 32"
  exit 1
fi

cat > /var/www/phpmyadmin/config.inc.php <<EOF
<?php
declare(strict_types=1);
\$cfg['blowfish_secret'] = hex2bin('${BF_HEX}');
\$cfg['TempDir'] = '/var/www/phpmyadmin/tmp';
\$i = 0;
\$cfg['Servers'][\$i]['host'] = 'localhost';
\$cfg['Servers'][\$i]['socket'] = '/run/mysqld/mysqld.sock';
\$cfg['Servers'][\$i]['compress'] = false;
\$cfg['Servers'][\$i]['AllowNoPassword'] = false;
\$cfg['Servers'][\$i]['auth_type'] = 'config';
\$cfg['Servers'][\$i]['user'] = 'root';
\$cfg['Servers'][\$i]['password'] = '${PW}';
EOF
chown root:www-data /var/www/phpmyadmin/config.inc.php
chmod 640 /var/www/phpmyadmin/config.inc.php
php -l /var/www/phpmyadmin/config.inc.php
echo OK
