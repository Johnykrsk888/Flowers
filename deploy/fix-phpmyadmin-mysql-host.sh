#!/usr/bin/env bash
# phpMyAdmin с host=127.0.0.1 подключается по TCP; у root часто только localhost+сокет.
# Меняем на localhost — mysqli/php использует Unix socket.
set -euo pipefail
CONF=/var/www/phpmyadmin/config.inc.php
[[ -f "$CONF" ]] || { echo "Нет $CONF"; exit 1; }
sed -i "s/'127.0.0.1'/'localhost'/" "$CONF"
grep -F "host" "$CONF" | head -3
echo "Готово. Обновите страницу phpMyAdmin (лучше инкогнито)."
