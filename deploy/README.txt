GitHub Actions → автодеплой на boombuket.ru
============================================
Репозиторий: .github/workflows/deploy-vps.yml (push в main).

Секреты в GitHub (Settings → Secrets and variables → Actions):
  DEPLOY_HOST, DEPLOY_USER, DEPLOY_SSH_KEY (приватный ключ; на сервере — соответствующий public key в authorized_keys).

Настройка nginx + ufw + прокси МойСклад на сервере Linux
============================================================

1) Скопируйте папку deploy/ на сервер (с ПК с Windows, в PowerShell из каталога проекта):

   scp -r deploy root@79.174.91.140:/root/flowers-deploy

2) Подключитесь по SSH:

   ssh root@79.174.91.140

3) На сервере задайте логин/пароль API МойСклад (как в локальном .env) и запустите скрипт:

   export MOYSKLAD_LOGIN='ваш_логин'
   export MOYSKLAD_PASSWORD='ваш_пароль'
   cd /root/flowers-deploy
   chmod +x setup-server.sh
   bash setup-server.sh

4) Загрузите сборку сайта в /var/www/flowers (после npm run build — содержимое dist/):

   scp -r dist/* root@79.174.91.140:/var/www/flowers/

5) В .env на машине сборки укажите префикс API:

   VITE_MOYSKLAD_API_PREFIX=https://www.boombuket.ru/api/moysklad

   Пересоберите: npm run build

HTTPS (уже настроено на сервере):
  certbot --nginx -d www.boombuket.ru -d boombuket.ru --agree-tos -m ваш@email --redirect
  Обновление по таймеру: systemctl status certbot.timer

Проверка:
  curl -sI https://www.boombuket.ru/ | head -1
  curl -s -o /dev/null -w "%{http_code}" -k "https://127.0.0.1/api/moysklad/entity/product?limit=1" -H "Host: www.boombuket.ru"

Ограничение нагрузки на прокси API (rate limit):
  см. deploy/SECURITY-nginx.txt и файлы deploy/nginx/conf.d/rate-limit-moysklad.conf,
  deploy/nginx/snippets/moysklad_rate_limits.conf

Важно — API МойСклад с IP сервера:
Если запросы к http://ВАШ_IP/api/moysklad/... возвращают 415, а с домашнего ПК к api.moysklad.ru — 200,
в аккаунте МойСклад проверьте ограничение доступа по IP (безопасность / разрешённые адреса)
и добавьте IP сервера 79.174.91.140 или обратитесь в поддержку МойСклад.

PostgreSQL — каталог товаров на сервере
========================================
Установлено: БД flowers, пользователь flowers_app, таблица products (см. deploy/sql/products_schema.sql).

Повторное создание (PuTTY / SSH от root), если файлы уже в /tmp:
  bash /tmp/create-products-db.sh /tmp/products_schema.sql

Пароль приложения: только на сервере, файл /etc/flowers/db-password (chmod 600).
Подключение с сервера: postgresql://flowers_app:ПАРОЛЬ_из_файла@127.0.0.1:5432/flowers

Проверка:
  sudo -u postgres psql -d flowers -c "\dt"

MariaDB / phpMyAdmin (пустая БД для приложения)
===============================================
Установка на VPS (MariaDB + phpMyAdmin + пустая БД flowers_mysql + пользователь flowers_mysql):

  bash deploy/vps-mysql-phpmyadmin.sh

Строки для .env на ПК: на сервере выполните cat /etc/flowers/mysql-dotenv.txt и вставьте в локальный .env.

URL: https://www.boombuket.ru/phpmyadmin/ — сначала HTTP Basic (admin + PHPMYADMIN_BASIC_PASSWORD), затем форма: root или flowers_mysql с паролями из mysql-dotenv.txt.

После входа под root (и любыми учётными данными) открывается сразу структура БД flowers_mysql: файл /var/www/phpmyadmin/config.footer.inc.php (ставит vps-mysql-phpmyadmin.sh или bash deploy/patch-phpmyadmin-default-db.sh; с ПК: python scripts/vps-apply-phpmyadmin-footer.py). Повторный переход на «главную» в той же вкладке — без редиректа (sessionStorage).

Каталог товаров (PostgreSQL) — отдельно, см. раздел выше.

Удаление MariaDB и phpMyAdmin: bash deploy/uninstall-phpmyadmin-mariadb.sh
Альтернатива без пустой БД: deploy/install-phpmyadmin.sh
