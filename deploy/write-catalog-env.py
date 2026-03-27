#!/usr/bin/env python3
"""Пишет /tmp/catalog.env для systemd flowers-catalog.

Источник логина/пароля MariaDB (по приоритету):
  1) переменные окружения MU и MP (GitHub: CATALOG_MYSQL_* или MYSQL_*)
  2) файл --from-file (например mysql-dotenv.txt с VPS)
"""
from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path


def parse_dotenv_file(path: Path) -> dict[str, str]:
    """Простой парсер KEY=VALUE (значение может содержать =)."""
    out: dict[str, str] = {}
    text = path.read_text(encoding="utf-8")
    for raw in text.splitlines():
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        k, sep, v = line.partition("=")
        if not sep:
            continue
        key = k.strip()
        val = v.strip()
        if len(val) >= 2 and val[0] == val[-1] and val[0] in "\"'":
            val = val[1:-1]
        out[key] = val
    return out


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument(
        "--from-file",
        metavar="PATH",
        help="Файл с MYSQL_USER и MYSQL_PASSWORD (как mysql-dotenv.txt)",
    )
    args = ap.parse_args()

    out = Path(os.environ.get("CATALOG_ENV_OUT", "/tmp/catalog.env"))

    mu = os.environ.get("MU", "").strip()
    mp = os.environ.get("MP", "").strip()

    if args.from_file:
        d = parse_dotenv_file(Path(args.from_file))
        mu = mu or d.get("MYSQL_USER", "").strip()
        mp = mp or d.get("MYSQL_PASSWORD", "").strip()

    if not mu or not mp:
        print(
            "Нужны MU и MP (MariaDB) или --from-file с MYSQL_USER/MYSQL_PASSWORD",
            file=sys.stderr,
        )
        raise SystemExit(1)

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


if __name__ == "__main__":
    main()
