#!/usr/bin/env python3
"""Пишет /tmp/catalog.env для systemd flowers-catalog (переменные из окружения)."""
import os
from pathlib import Path

out = Path(os.environ.get("CATALOG_ENV_OUT", "/tmp/catalog.env"))

mu = os.environ.get("MU", "").strip()
mp = os.environ.get("MP", "").strip()
if not mu or not mp:
    raise SystemExit("MU и MP (CATALOG_MYSQL_*) должны быть заданы")

lines = [
    "MYSQL_HOST=127.0.0.1",
    "MYSQL_PORT=3306",
    f"MYSQL_USER={mu}",
    f"MYSQL_PASSWORD={mp}",
    "MYSQL_DATABASE_BOOMBUKET=boombuket",
    "CATALOG_SERVER_PORT=8788",
]
lg = os.environ.get("LOGIN", "").strip()
pw = os.environ.get("PASS", "").strip()
if lg and pw:
    lines.append(f"MOYSKLAD_LOGIN={lg}")
    lines.append(f"MOYSKLAD_PASSWORD={pw}")

out.write_text("\n".join(lines) + "\n", encoding="utf-8")
print(f"Wrote {out}")
