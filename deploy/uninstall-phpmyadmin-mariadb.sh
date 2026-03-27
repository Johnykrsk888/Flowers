#!/usr/bin/env bash
# Удаление phpMyAdmin (файлы + nginx) и MariaDB с сервера Debian/Ubuntu.
# Запуск от root: bash uninstall-phpmyadmin-mariadb.sh
#
# Опции окружения:
#   SKIP_PHP_PURGE=1   — не удалять php-fpm и пакеты PHP (если нужны для другого).
#   KEEP_MYSQL_DATA=1  — не удалять /var/lib/mysql (данные MariaDB останутся на диске).
set -euo pipefail

if [[ "${EUID:-0}" -ne 0 ]]; then
  echo "Запустите от root: sudo bash $0"
  exit 1
fi

export DEBIAN_FRONTEND=noninteractive

FLOWERS_CONF="/etc/nginx/sites-available/flowers"
if [[ -f "$FLOWERS_CONF" ]] && grep -q 'phpmyadmin_location.conf' "$FLOWERS_CONF"; then
  sed -i '/phpmyadmin_location.conf/d' "$FLOWERS_CONF"
  echo "Убран include phpMyAdmin из $FLOWERS_CONF"
fi

if command -v nginx >/dev/null 2>&1; then
  nginx -t
  systemctl reload nginx
fi

systemctl stop mariadb 2>/dev/null || true
systemctl disable mariadb 2>/dev/null || true

rm -rf /var/www/phpmyadmin
rm -f /etc/nginx/snippets/phpmyadmin_location.conf
rm -f /etc/flowers/phpmyadmin-access.txt /etc/flowers/phpmyadmin-mysql.secret

if dpkg -l | grep -q '^ii.*mariadb'; then
  apt-get remove --purge -y mariadb-server mariadb-client mariadb-common || true
  apt-get autoremove --purge -y
fi

if [[ "${KEEP_MYSQL_DATA:-0}" != "1" ]]; then
  rm -rf /var/lib/mysql
  rm -rf /etc/mysql
  echo "Каталоги данных MariaDB (/var/lib/mysql, /etc/mysql) удалены."
fi

if [[ "${SKIP_PHP_PURGE:-0}" != "1" ]]; then
  shopt -s nullglob
  for svc in /lib/systemd/system/php*-fpm.service; do
    systemctl stop "$(basename "$svc")" 2>/dev/null || true
    systemctl disable "$(basename "$svc")" 2>/dev/null || true
  done
  shopt -u nullglob
  apt-get remove --purge -y \
    php-fpm php-mysql php-mbstring php-xml php-zip php-gd php-curl php-json php-bcmath php-intl \
    2>/dev/null || true
  mapfile -t PHP_VER_PKGS < <(dpkg-query -W -f='${Package}\n' 2>/dev/null | grep -E '^php[0-9.]+-(fpm|mysql|mbstring|xml|zip|gd|curl|json|bcmath|intl|cli)$' || true)
  if ((${#PHP_VER_PKGS[@]})); then
    apt-get remove --purge -y "${PHP_VER_PKGS[@]}" || true
  fi
  apt-get autoremove --purge -y
  rm -rf /etc/php /var/lib/php/sessions 2>/dev/null || true
  echo "Пакеты PHP (как в install-phpmyadmin.sh) сняты."
fi

if command -v nginx >/dev/null 2>&1; then
  nginx -t
  systemctl reload nginx
fi

echo "Готово: phpMyAdmin и MariaDB удалены. Сайт nginx / static / API МойСклад не трогались."
