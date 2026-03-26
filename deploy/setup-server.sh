#!/usr/bin/env bash
# Запускать на сервере Linux (root): bash setup-server.sh
# Перед запуском задайте учётные данные МойСклад (как в локальном .env):
#   export MOYSKLAD_LOGIN='admin@example.com'
#   export MOYSKLAD_PASSWORD='secret'
set -euo pipefail

if [[ "${MOYSKLAD_LOGIN:-}" == "" || "${MOYSKLAD_PASSWORD:-}" == "" ]]; then
  echo "Задайте переменные: MOYSKLAD_LOGIN и MOYSKLAD_PASSWORD"
  echo "Пример: export MOYSKLAD_LOGIN='...' && export MOYSKLAD_PASSWORD='...' && bash setup-server.sh"
  exit 1
fi

export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y nginx ufw openssl

# Фаервол: SSH + HTTP/HTTPS
ufw allow OpenSSH
ufw allow 'Nginx HTTP'
ufw allow 'Nginx HTTPS'
echo "y" | ufw enable || true
ufw status verbose

BASIC_B64=$(printf '%s:%s' "$MOYSKLAD_LOGIN" "$MOYSKLAD_PASSWORD" | base64 | tr -d '\n')

install -d -m 0755 /etc/nginx/snippets
cat > /etc/nginx/snippets/moysklad_proxy_headers.conf << EOF
# Автогенерация — не править вручную (setup-server.sh)
proxy_set_header Authorization "Basic ${BASIC_B64}";
EOF
chmod 0644 /etc/nginx/snippets/moysklad_proxy_headers.conf

install -d -m 0755 /var/www/flowers
[[ -f /var/www/flowers/index.html ]] || echo '<!DOCTYPE html><html><body><p>Загрузите сюда сборку: <code>npm run build</code> → dist/</p></body></html>' > /var/www/flowers/index.html
chown -R www-data:www-data /var/www/flowers

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [[ -f "$SCRIPT_DIR/nginx/flowers.conf" ]]; then
  cp "$SCRIPT_DIR/nginx/flowers.conf" /etc/nginx/sites-available/flowers
else
  echo "Не найден flowers.conf рядом со скриптом (deploy/nginx/flowers.conf)."
  exit 1
fi

ln -sf /etc/nginx/sites-available/flowers /etc/nginx/sites-enabled/flowers
rm -f /etc/nginx/sites-enabled/default

nginx -t
systemctl enable nginx
systemctl restart nginx

echo "Готово. Проверка: curl -sI -o /dev/null -w '%{http_code}' http://127.0.0.1/api/moysklad/entity/product?limit=1"
echo "Ожидается 401 или 200 от api.moysklad.ru (не 502)."
