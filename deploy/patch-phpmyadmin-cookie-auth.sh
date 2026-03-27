#!/usr/bin/env bash
# Убрать auth_type=config — в 5.2.x сессия остаётся logged_in:false, дерево БД не строится.
# Обычный вход: форма (логин root, пароль MariaDB) после HTTP Basic.
set -euo pipefail
BF="${1:-8cdd9b2cf693fd7ba75b42aed88758f6}"
CONF=/var/www/phpmyadmin/config.inc.php

cat > "$CONF" <<EOF
<?php
declare(strict_types=1);
\$cfg['blowfish_secret'] = '${BF}';
\$cfg['TempDir'] = '/var/www/phpmyadmin/tmp';
\$i = 0;
\$cfg['Servers'][\$i]['host'] = 'localhost';
\$cfg['Servers'][\$i]['compress'] = false;
\$cfg['Servers'][\$i]['AllowNoPassword'] = false;
EOF
chown root:www-data "$CONF"
chmod 640 "$CONF"
php -l "$CONF"
echo "OK: cookie auth (форма входа в MariaDB). После Basic: root + пароль из PHPMYADMIN_MYSQL_PASSWORD"
