/**
 * GET к JSON API МойСклад через прокси: единые заголовки (без пауз и ретраев).
 */
export async function msFetchJson(url: string, init?: RequestInit): Promise<Response> {
  const headers = new Headers(init?.headers);
  if (!headers.has("Accept")) {
    headers.set("Accept", "application/json;charset=utf-8");
  }
  if (!headers.has("Cache-Control")) {
    headers.set("Cache-Control", "no-cache");
  }
  return fetch(url, { ...init, cache: "no-store", headers });
}
