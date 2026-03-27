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

URL: https://www.boombuket.ru/phpmyadmin/ — сначала HTTP Basic: либо admin + PHPMYADMIN_BASIC_PASSWORD, либо root + PHPMYADMIN_MYSQL_PASSWORD (оба пользователя должны быть в .htpasswd; vps-mysql-phpmyadmin.sh и install-phpmyadmin.sh добавляют root). Затем форма MariaDB: root + PHPMYADMIN_MYSQL_PASSWORD или flowers_mysql + MYSQL_PASSWORD.

После входа под root (и любыми учётными данными) открывается сразу структура БД flowers_mysql: файл /var/www/phpmyadmin/config.header.inc.php (на странице входа minimal footer не выводится, поэтому скрипт в header). config.footer.inc.php — заглушка. Ставит vps-mysql-phpmyadmin.sh или bash deploy/patch-phpmyadmin-default-db.sh; с ПК: python scripts/vps-apply-phpmyadmin-footer.py. Повторный переход на «главную» в той же вкладке — без редиректа (sessionStorage).

Если нет формы входа MariaDB (только «Appearance settings») или «неверный индекс сервера»: при одном сервере в config.inc.php нужны $i = 1, $cfg['Servers'][1] и $cfg['ServerDefault'] = 1 (см. deploy/vps-mysql-phpmyadmin.sh). Исправление на уже установленном: python scripts/vps-fix-pma-server-default.py

Если «не принимает» пароль root при верном пароле MariaDB: в phpMyAdmin 5.2 ключ blowfish_secret должен быть 32 байта (в config — hex2bin из 64 hex-символов). Исправление на сервере: python scripts/vps-fix-pma-blowfish.py или bash deploy/patch-phpmyadmin-cookie-auth.sh

Каталог товаров (PostgreSQL) — отдельно, см. раздел выше.

Каталог на сайте из MariaDB «boombuket» (МойСклад → БД + файлы)
================================================================
Товары после синхронизации лежат в БД `boombuket` (создание: `python scripts/create-boombuket-db.py` на сервере или вручную).
На ПК в `.env`: `MYSQL_HOST`, `MYSQL_PORT`, `MYSQL_USER`, `MYSQL_PASSWORD`, при необходимости `MYSQL_DATABASE_BOOMBUKET` (по умолчанию `boombuket`).

Локальная начальная загрузка с ПК, если MariaDB только на VPS:
  ssh -L 3307:127.0.0.1:3306 root@ВАШ_СЕРВЕР
  В другом окне: в `.env` задать `MYSQL_HOST=127.0.0.1`, `MYSQL_PORT=3307`, затем:
  npm run sync:catalog

На сервере: установить Node.js, склонировать/скопировать проект, положить `.env`, затем:
  npm ci && npm run sync:catalog
  (один раз — начальная загрузка; кнопка на сайте вызывает POST /api/catalog/sync.)

Сервис каталога (Express): порт по умолчанию **8788** (`CATALOG_SERVER_PORT`), чтобы не пересекаться с Python img-proxy на **8787**.
  npm run catalog-server
  Проверка: curl -s http://127.0.0.1:8788/api/catalog/products | head -c 200

В nginx уже добавлены `location` для `/api/catalog/` и `/uploads/` → 127.0.0.1:8788 (см. deploy/nginx/flowers.conf). После правки конфига: `nginx -t && systemctl reload nginx`.

В продакшене держите `catalog-server` под systemd (или pm2), рядом с существующим Python на 8787. Статика картинок: каталог `server/data/uploads/` на машине, где крутится Node; публичные URL вида `/uploads/products/...`.

GitHub Actions (push в main) разворачивает код в /opt/flowers-catalog и поднимает systemd unit `flowers-catalog` (см. deploy/systemd/flowers-catalog.service).
В GitHub → Settings → Secrets → Actions добавьте: CATALOG_MYSQL_USER и CATALOG_MYSQL_PASSWORD (тот же пользователь MariaDB, что и для БД boombuket, чаще всего flowers_mysql и пароль из mysql-dotenv).

502 Bad Gateway на /api/catalog или /uploads: nginx не достучался до 127.0.0.1:8788 — сервис не запущен или нет /etc/flowers/catalog.env.
На сервере: systemctl status flowers-catalog
  journalctl -u flowers-catalog -n 50 --no-pager
  curl -sS -o /dev/null -w "%{http_code}" http://127.0.0.1:8788/api/catalog/products

Удаление MariaDB и phpMyAdmin: bash deploy/uninstall-phpmyadmin-mariadb.sh
Альтернатива без пустой БД: deploy/install-phpmyadmin.sh
