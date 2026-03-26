/** База JSON API — ссылки на api.moysklad.ru требуют авторизации; в dev проксируем через Vite. */

const MS_API_PREFIX = "https://api.moysklad.ru/api/remap/1.2";
const MS_REL_PREFIX = "/api/remap/1.2";
const REMAP_SEGMENT = "/api/remap/1.2";

const UUID_IN_PATH =
  /([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/gi;

/** Внешнее хранилище файлов МойСклад (подписанный URL истекает → 401; грузим через /download/{uuid}). */
function extractUuidFromMoyskladStorageUrl(url: string): string | null {
  try {
    const u = new URL(url);
    const h = u.hostname.toLowerCase();
    const path = u.pathname;
    const storageLike =
      h === "storage.moysklad.ru" ||
      h.includes("storage.files.") ||
      (h.includes("storage.") && /\/(goodimage|image-prod|image\/)/i.test(path));
    if (!storageLike) return null;
    const matches = [...path.matchAll(UUID_IN_PATH)];
    if (!matches.length) return null;
    return matches[matches.length - 1][1] ?? null;
  } catch {
    return null;
  }
}

/** Прод: /download/{uuid} → /ms-image/download/{uuid} — сегмент перед /download/, иначе nginx матчит только JSON-location (415). */
const PROD_DOWNLOAD_ALIAS = "/ms-image";

function proxyRemapRest(rest: string, fallbackUrl: string): string {
  if (import.meta.env.DEV) {
    return `/api/moysklad${rest}`;
  }
  const prefix = import.meta.env.VITE_MOYSKLAD_API_PREFIX?.replace(/\/$/, "");
  if (prefix) {
    if (rest.startsWith("/download/")) {
      return `${prefix}${PROD_DOWNLOAD_ALIAS}${rest}`;
    }
    return `${prefix}${rest}`;
  }
  return fallbackUrl;
}

/**
 * Хвост пути после /api/remap/1.2 (включая query), для подстановки в /api/moysklad...
 * Учитывает https/http и полный URL, иначе список товаров часто отдаёт ссылки, которые
 * не начинаются ровно с https://api.moysklad.ru/api/remap/1.2 — и картинки шли напрямую без Basic auth.
 */
function extractRemapRest(url: string): string | null {
  const trimmed = url.trim();
  if (!trimmed) return null;

  try {
    const u = new URL(trimmed);
    if (u.hostname === "api.moysklad.ru") {
      const idx = u.pathname.indexOf(REMAP_SEGMENT);
      if (idx >= 0) {
        return u.pathname.slice(idx + REMAP_SEGMENT.length) + u.search;
      }
    }
  } catch {
    /* не абсолютный URL */
  }

  if (trimmed.startsWith(MS_API_PREFIX)) {
    return trimmed.slice(MS_API_PREFIX.length);
  }
  if (trimmed.startsWith(MS_REL_PREFIX)) {
    return trimmed.slice(MS_REL_PREFIX.length);
  }
  return null;
}

/**
 * Превращает URL API МойСклад в путь к dev-прокси (/api/moysklad/...) или к VITE_MOYSKLAD_API_PREFIX.
 * Не-remap URL возвращаются как есть (внешние CDN и т.д.).
 */
export function mediaUrlForApp(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) return trimmed;
  const rest = extractRemapRest(trimmed);
  if (rest != null) {
    return proxyRemapRest(rest, trimmed);
  }
  const storageUuid = extractUuidFromMoyskladStorageUrl(trimmed);
  if (storageUuid) {
    const directApi = `${MS_API_PREFIX}/download/${storageUuid}`;
    return proxyRemapRest(`/download/${storageUuid}`, directApi);
  }
  return trimmed;
}

export function needsMoyskladProxy(url: string): boolean {
  return extractRemapRest(url) != null || extractUuidFromMoyskladStorageUrl(url) != null;
}

const IMAGE_ENTITY_PATH =
  /^(\/api\/remap\/1\.2\/entity\/(?:product|bundle)\/[^/]+\/images\/[^/?#]+)\/?$/i;

/**
 * После правок карточки в МойСклад в списке часто остаётся только `meta.href` на JSON-сущность
 * изображения; в `<img>` нужен путь `.../images/{id}/download`. Иначе браузер получает JSON и картинка «пропадает».
 */
export function normalizeMoyskladImageDownloadUrl(url: string): string {
  const t = url.trim();
  if (!t) return t;
  if (/\/download(?:\?|$|\/)/i.test(t)) return t;

  try {
    const u = new URL(t);
    if (u.hostname === "api.moysklad.ru") {
      const m = u.pathname.match(IMAGE_ENTITY_PATH);
      if (m) {
        u.pathname = `${m[1]}/download`;
        return u.toString();
      }
    }
    return t;
  } catch {
    /* не абсолютный URL */
  }

  const rel = t.startsWith("/") ? t : `/${t}`;
  const m = rel.match(IMAGE_ENTITY_PATH);
  if (m) return `${m[1]}/download`;
  return t;
}

