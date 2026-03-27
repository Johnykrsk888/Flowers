#!/usr/bin/env bash
# Установить config.header.inc.php (+ пустой footer): после логина в phpMyAdmin открывается выбранная БД (по умолчанию flowers_mysql).
# Запуск на VPS от root из каталога с deploy/:
#   bash deploy/patch-phpmyadmin-default-db.sh
# Опционально:
#   DEFAULT_MYSQL_DB=mydb bash deploy/patch-phpmyadmin-default-db.sh
set -euo pipefail

if [[ "${EUID:-0}" -ne 0 ]]; then
  echo "Запустите от root"
  exit 1
fi

PMA_ROOT="${PMA_ROOT:-/var/www/phpmyadmin}"
DB_NAME="${DEFAULT_MYSQL_DB:-flowers_mysql}"

if [[ ! -d "$PMA_ROOT" ]]; then
  echo "Нет каталога phpMyAdmin: $PMA_ROOT"
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SRC_HEADER="$SCRIPT_DIR/phpmyadmin/config.header.inc.php"
SRC_FOOTER="$SCRIPT_DIR/phpmyadmin/config.footer.inc.php"
if [[ ! -f "$SRC_HEADER" ]] || [[ ! -f "$SRC_FOOTER" ]]; then
  echo "Нет $SRC_HEADER или $SRC_FOOTER"
  exit 1
fi

TMP_H=$(mktemp)
cp "$SRC_HEADER" "$TMP_H"
sed -i "s|\\\$db = 'flowers_mysql';|\\\$db = '${DB_NAME}';|" "$TMP_H"
install -m 0644 -o root -g www-data "$TMP_H" "$PMA_ROOT/config.header.inc.php"
rm -f "$TMP_H"

install -m 0644 -o root -g www-data "$SRC_FOOTER" "$PMA_ROOT/config.footer.inc.php"

echo "OK: $PMA_ROOT/config.header.inc.php + config.footer.inc.php (БД: $DB_NAME)"
