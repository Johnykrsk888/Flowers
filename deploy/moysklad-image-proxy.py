#!/usr/bin/env python3
"""
Слушает 127.0.0.1:8787. GET /api/moysklad/img-proxy/... или /api/moysklad/ms-image/download/...
→ скачивает с api.moysklad.ru с Basic auth, следует редиректам (urllib) с IP сервера.
"""
from __future__ import annotations

import base64
import os
import sys
import urllib.error
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse

LISTEN = ("127.0.0.1", 8787)
PREFIX = "/api/moysklad/img-proxy"
LEGACY_MS = "/api/moysklad/ms-image/download"
API_BASE = "https://api.moysklad.ru/api/remap/1.2"


def _auth_header() -> str:
    login = os.environ.get("MOYSKLAD_LOGIN", "").strip()
    password = os.environ.get("MOYSKLAD_PASSWORD", "").strip()
    if not login or not password:
        print("MOYSKLAD_LOGIN / MOYSKLAD_PASSWORD не заданы", file=sys.stderr)
        sys.exit(1)
    raw = f"{login}:{password}".encode()
    return "Basic " + base64.b64encode(raw).decode()


def _normalize_path(path: str) -> str:
    """Старые сборки: /ms-image/download/{uuid} → /img-proxy/download/{uuid}."""
    if path.startswith(LEGACY_MS + "/"):
        uuid = path.rstrip("/").split("/")[-1]
        return f"{PREFIX}/download/{uuid}"
    return path


class Handler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def log_message(self, fmt: str, *args) -> None:
        return

    def do_GET(self) -> None:
        path = _normalize_path(urlparse(self.path).path)
        parsed = urlparse(self.path)
        if not path.startswith(PREFIX + "/") and path != PREFIX:
            self.send_error(404, "path")
            return
        rest = path[len(PREFIX) :]
        if not rest.startswith("/"):
            rest = "/" + rest
        upstream = API_BASE + rest
        q = parsed.query
        if q:
            upstream += "?" + q
        req = urllib.request.Request(
            upstream,
            headers={
                "Accept": "*/*",
                "Authorization": _auth_header(),
                "User-Agent": "boombuket-image-proxy/1",
            },
            method="GET",
        )
        try:
            with urllib.request.urlopen(req, timeout=120) as resp:
                body = resp.read()
                ctype = resp.headers.get("Content-Type", "application/octet-stream")
                self.send_response(200)
                self.send_header("Content-Type", ctype)
                self.send_header("Content-Length", str(len(body)))
                self.send_header("Cache-Control", "public, max-age=120")
                self.end_headers()
                self.wfile.write(body)
        except urllib.error.HTTPError as e:
            self.send_error(e.code, e.reason)
        except Exception as e:
            self.send_error(502, str(e)[:200])


def main() -> None:
    httpd = ThreadingHTTPServer(LISTEN, Handler)
    print(f"moysklad-image-proxy on http://{LISTEN[0]}:{LISTEN[1]}", file=sys.stderr)
    httpd.serve_forever()


if __name__ == "__main__":
    main()
