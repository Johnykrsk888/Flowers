/**
 * GET к JSON API МойСклад через прокси: заголовки + повтор при 429 (nginx / МойСклад).
 */
/** Долгие ретраи блокируют UI минутами. */
const MAX_429_RETRIES = 5;

function moyskladBasicAuthHeader(): string | undefined {
  if (typeof process === "undefined" || !process.env?.MOYSKLAD_LOGIN) return undefined;
  const login = process.env.MOYSKLAD_LOGIN;
  const password = process.env.MOYSKLAD_PASSWORD ?? "";
  if (typeof Buffer !== "undefined") {
    return `Basic ${Buffer.from(`${login}:${password}`).toString("base64")}`;
  }
  return undefined;
}

export async function msFetchJson(url: string, init?: RequestInit): Promise<Response> {
  const headers = new Headers(init?.headers);
  const basic = moyskladBasicAuthHeader();
  if (basic && !headers.has("Authorization")) {
    headers.set("Authorization", basic);
  }
  if (!headers.has("Accept")) {
    headers.set("Accept", "application/json;charset=utf-8");
  }
  if (!headers.has("Cache-Control")) {
    headers.set("Cache-Control", "no-cache");
  }
  const merged: RequestInit = { ...init, cache: "no-store", headers };

  let last: Response | undefined;
  for (let attempt = 0; attempt <= MAX_429_RETRIES; attempt++) {
    last = await fetch(url, merged);
    if (last.status !== 429) {
      return last;
    }
    const ra = last.headers.get("Retry-After");
    const sec = ra ? parseInt(ra, 10) : NaN;
    const backoffMs = Number.isFinite(sec) && sec >= 0
      ? Math.min(8_000, Math.max(sec * 1000, 400))
      : Math.min(8_000, 500 * 2 ** attempt);
    await new Promise((r) => setTimeout(r, backoffMs));
  }
  return last!;
}
