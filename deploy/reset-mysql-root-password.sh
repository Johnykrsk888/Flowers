#!/usr/bin/env bash
# Сброс пароля root@localhost (и при необходимости root@127.0.0.1) в MariaDB.
# Запуск на сервере от root: bash reset-mysql-root-password.sh 'НОВЫЙ_ПАРОЛЬ'
set -euo pipefail
PW="${1:?Укажите пароль}"

# Без пароля через сокет (локальный root Linux)
mariadb -e "ALTER USER 'root'@'localhost' IDENTIFIED BY '${PW}'; FLUSH PRIVILEGES;"

# Если есть учётка root@127.0.0.1 — тот же пароль (на случай TCP)
if mariadb -Nse "SELECT COUNT(*) FROM mysql.user WHERE User='root' AND Host='127.0.0.1'" | grep -qx 1; then
  mariadb -e "ALTER USER 'root'@'127.0.0.1' IDENTIFIED BY '${PW}'; FLUSH PRIVILEGES;"
else
  mariadb -e "CREATE USER 'root'@'127.0.0.1' IDENTIFIED BY '${PW}'; GRANT ALL PRIVILEGES ON *.* TO 'root'@'127.0.0.1' WITH GRANT OPTION; FLUSH PRIVILEGES;" || true
fi

mariadb -uroot -p"${PW}" -e "SELECT 'OK' AS login_test;" || { echo "Проверка пароля не прошла"; exit 1; }
echo "Пароль root обновлён."
