#!/usr/bin/env bash
# Создание БД PostgreSQL для товаров. Запуск на сервере от root.
# Использование: bash create-products-db.sh [путь/products_schema.sql]
# По умолчанию схема: /tmp/products_schema.sql
set -euo pipefail

SCHEMA="${1:-/tmp/products_schema.sql}"
if [[ ! -f "$SCHEMA" ]]; then
  echo "Нет файла схемы: $SCHEMA"
  exit 1
fi

if [[ "${EUID:-0}" -ne 0 ]]; then
  echo "Запустите от root: sudo bash create-products-db.sh"
  exit 1
fi

export DEBIAN_FRONTEND=noninteractive
if ! command -v psql >/dev/null 2>&1; then
  apt-get update -y
  apt-get install -y postgresql postgresql-contrib
fi

install -d -m 0700 /etc/flowers

if [[ -z "${FLOWERS_DB_PASSWORD:-}" ]]; then
  if [[ -f /etc/flowers/db-password ]]; then
    FLOWERS_DB_PASSWORD=$(tr -d '\n\r' < /etc/flowers/db-password)
  else
    FLOWERS_DB_PASSWORD=$(openssl rand -hex 16)
    umask 077
    printf '%s' "$FLOWERS_DB_PASSWORD" > /etc/flowers/db-password
    chmod 600 /etc/flowers/db-password
    echo "Пароль пользователя БД flowers_app записан в /etc/flowers/db-password"
  fi
fi

ROLE_EXISTS=$(sudo -u postgres psql -Atqc "SELECT 1 FROM pg_roles WHERE rolname='flowers_app'")
if [[ "$ROLE_EXISTS" != "1" ]]; then
  sudo -u postgres psql -v ON_ERROR_STOP=1 -c \
    "CREATE ROLE flowers_app WITH LOGIN PASSWORD '${FLOWERS_DB_PASSWORD}';"
else
  sudo -u postgres psql -v ON_ERROR_STOP=1 -c \
    "ALTER ROLE flowers_app WITH PASSWORD '${FLOWERS_DB_PASSWORD}';"
fi

DB_EXISTS=$(sudo -u postgres psql -Atqc "SELECT 1 FROM pg_database WHERE datname='flowers'")
if [[ "$DB_EXISTS" != "1" ]]; then
  sudo -u postgres psql -v ON_ERROR_STOP=1 -c \
    "CREATE DATABASE flowers OWNER flowers_app ENCODING 'UTF8' TEMPLATE template0;"
fi

sudo -u postgres psql -d flowers -v ON_ERROR_STOP=1 -f "$SCHEMA"

sudo -u postgres psql -d flowers -v ON_ERROR_STOP=1 -c \
  "GRANT USAGE ON SCHEMA public TO flowers_app;
   GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO flowers_app;
   GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO flowers_app;
   ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO flowers_app;"

echo "Готово: БД flowers, пользователь flowers_app, таблица products."
echo "Строка подключения (сервер): postgresql://flowers_app:ПАРОЛЬ@127.0.0.1:5432/flowers"
echo "Пароль см. /etc/flowers/db-password"
