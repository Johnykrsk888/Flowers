#!/usr/bin/env bash
# Жёстко прописать пароль MariaDB в config (без file_get_contents) — устраняет сбой автовхода в phpMyAdmin 5.2 + strict_types.
# Запуск от root: bash patch-phpmyadmin-inline-password.sh 'ПАРОЛЬ_ROOT'
set -euo pipefail
PW="${1:?пароль root MariaDB}"
BF="${2:-8cdd9b2cf693fd7ba75b42aed88758f6}"

cat > /var/www/phpmyadmin/config.inc.php <<EOF
<?php
declare(strict_types=1);
\$cfg['blowfish_secret'] = '${BF}';
\$cfg['TempDir'] = '/var/www/phpmyadmin/tmp';
\$i = 0;
\$cfg['Servers'][\$i]['host'] = 'localhost';
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
