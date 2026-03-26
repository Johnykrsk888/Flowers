#!/usr/bin/env python3
"""
Загружает в GitHub Actions (Repository secrets): DEPLOY_SSH_KEY, DEPLOY_HOST, DEPLOY_USER.

Нужен доступ к API репозитория:
  • один раз:  gh auth login
  • или:       $env:GITHUB_TOKEN = "ghp_..."   (classic: scope repo; fine-grained: Actions secrets)

Запуск из корня репозитория:
  python scripts/set-github-deploy-secrets.py
"""

from __future__ import annotations

import json
import os
import re
import shutil
import ssl
import subprocess
import sys
from base64 import b64encode
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]


def _load_dotenv(path: Path) -> dict[str, str]:
    env: dict[str, str] = {}
    if not path.is_file():
        return env
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, _, v = line.partition("=")
        env[k.strip()] = v.strip().strip('"').strip("'")
    return env


def _git_owner_repo(root: Path) -> tuple[str, str]:
    r = subprocess.run(
        ["git", "-C", str(root), "remote", "get-url", "origin"],
        capture_output=True,
        text=True,
        check=True,
    )
    url = r.stdout.strip()
    m = re.search(r"github\.com[:/]([^/]+)/([^/.]+)", url)
    if not m:
        raise SystemExit(f"Не удалось разобрать origin: {url}")
    return m.group(1), m.group(2)


def _token_from_git_credential() -> str | None:
    """Токен из Git Credential Manager (тот же, что для git push на github.com)."""
    try:
        r = subprocess.run(
            ["git", "-C", str(ROOT), "credential", "fill"],
            input=b"protocol=https\nhost=github.com\n\n",
            capture_output=True,
            timeout=15,
        )
        if r.returncode != 0:
            return None
        for line in r.stdout.decode("utf-8", errors="replace").splitlines():
            if line.startswith("password="):
                return line.split("=", 1)[1].strip() or None
    except (OSError, subprocess.TimeoutExpired):
        return None
    return None


def _token() -> str:
    for name in ("GITHUB_TOKEN", "GH_TOKEN"):
        t = os.environ.get(name, "").strip()
        if t:
            return t
    t = _token_from_git_credential()
    if t:
        return t
    gh_paths: list[str] = []
    w = shutil.which("gh")
    if w:
        gh_paths.append(w)
    win_gh = r"C:\Program Files\GitHub CLI\gh.exe"
    if os.path.isfile(win_gh) and win_gh not in gh_paths:
        gh_paths.append(win_gh)
    for gh in gh_paths:
        r = subprocess.run(
            [gh, "auth", "token"],
            capture_output=True,
            text=True,
            cwd=str(ROOT),
        )
        if r.returncode == 0 and r.stdout.strip():
            return r.stdout.strip()
    print(
        "Нет токена. Сделайте один из вариантов:\n"
        "  1) В PowerShell:  gh auth login\n"
        "  2) Или:  $env:GITHUB_TOKEN = 'ghp_...'  (PAT с правом repo или Actions secrets)\n",
        file=sys.stderr,
    )
    raise SystemExit(1)


def _encrypt(public_key_b64: str, secret: str) -> str:
    from nacl import encoding, public

    pk = public.PublicKey(public_key_b64.encode("utf-8"), encoding.Base64Encoder())
    box = public.SealedBox(pk)
    return b64encode(box.encrypt(secret.encode("utf-8"))).decode("utf-8")


def _api_json(method: str, url: str, token: str, body: dict | None = None) -> tuple[int, dict | None]:
    data = None if body is None else json.dumps(body).encode("utf-8")
    req = Request(url, data=data, method=method)
    req.add_header("Authorization", f"Bearer {token}")
    req.add_header("Accept", "application/vnd.github+json")
    req.add_header("X-GitHub-Api-Version", "2022-11-28")
    if body is not None:
        req.add_header("Content-Type", "application/json")
    ctx = ssl.create_default_context()
    try:
        with urlopen(req, context=ctx, timeout=60) as resp:
            raw = resp.read().decode()
            if not raw:
                return resp.status, None
            return resp.status, json.loads(raw)
    except HTTPError as e:
        err_body = e.read().decode() if e.fp else ""
        raise SystemExit(f"HTTP {e.code} {url}\n{err_body}") from e
    except URLError as e:
        raise SystemExit(f"Сеть: {e}") from e


def main() -> None:
    try:
        import nacl  # noqa: F401
    except ImportError:
        print("Установите: pip install pynacl", file=sys.stderr)
        raise SystemExit(1)

    token = _token()
    owner, repo = _git_owner_repo(ROOT)
    env_file = ROOT / ".env"
    dot = _load_dotenv(env_file)

    key_path = ROOT / ".deploy" / "github-actions-deploy"
    if not key_path.is_file():
        raise SystemExit(f"Нет приватного ключа: {key_path}")

    private_key = key_path.read_text(encoding="utf-8")
    if "BEGIN" not in private_key or "PRIVATE KEY" not in private_key:
        raise SystemExit("Файл ключа похож на неверный формат.")

    host = dot.get("SERVER_HOST", "").strip()
    user = dot.get("SERVER_USER", "").strip()
    if not host or not user:
        raise SystemExit("В .env задайте SERVER_HOST и SERVER_USER.")

    base = f"https://api.github.com/repos/{owner}/{repo}"
    status, pub = _api_json("GET", f"{base}/actions/secrets/public-key", token)
    if status != 200 or not pub:
        raise SystemExit("Не удалось получить public-key для секретов.")
    key_id = pub["key_id"]
    pub_key = pub["key"]

    secrets_map = {
        "DEPLOY_SSH_KEY": private_key,
        "DEPLOY_HOST": host,
        "DEPLOY_USER": user,
    }

    for name, value in secrets_map.items():
        enc = _encrypt(pub_key, value)
        url = f"{base}/actions/secrets/{name}"
        _api_json("PUT", url, token, {"encrypted_value": enc, "key_id": key_id})
        print(f"OK: {name}")

    print("Готово. Запусти workflow в Actions или сделай push в main.")


if __name__ == "__main__":
    main()
