#!/usr/bin/env bash
# Установить config.footer.inc.php: после логина в phpMyAdmin открывается выбранная БД (по умолчанию flowers_mysql).
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
SRC="$SCRIPT_DIR/phpmyadmin/config.footer.inc.php"
if [[ ! -f "$SRC" ]]; then
  echo "Нет файла $SRC"
  exit 1
fi

TMP=$(mktemp)
cp "$SRC" "$TMP"
sed -i "s|\\\$db = 'flowers_mysql';|\\\$db = '${DB_NAME}';|" "$TMP"
install -m 0644 -o root -g www-data "$TMP" "$PMA_ROOT/config.footer.inc.php"
rm -f "$TMP"

echo "OK: $PMA_ROOT/config.footer.inc.php (БД: $DB_NAME)"
