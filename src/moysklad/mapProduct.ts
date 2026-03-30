import { normalizePathFromApi, resolvePathFromFolderLike } from "./categoryPath";
import { folderIdFromHref } from "./folderId";
import type { MsImageRow, MsProduct } from "./types";
import { mediaUrlForApp, normalizeMoyskladImageDownloadUrl } from "./mediaUrl";
import { PRODUCT_IMAGE_PLACEHOLDER } from "./placeholderImage";

/** Цены в МойСклад — в копейках (документация API Remap 1.2) */
export function kopecksToRubles(value: number): number {
  return Math.round(value) / 100;
}

function scoreImageUrlCandidate(url: string): number {
  const u = url.toLowerCase();
  if (u.includes("storage.files.") || u.includes("storage.moysklad.ru")) return -1;
  if (u.includes("/download")) return 0;
  if (u.includes("api.moysklad.ru") && u.includes("/images/")) return 2;
  if (u.includes("api.moysklad.ru")) return 3;
  return 4;
}

/** Любые вложенные строки-URL в ответе API (формат полей после правок карточки плавает). */
function collectImageUrlsDeep(row: MsImageRow): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  const walk = (v: unknown): void => {
    if (typeof v === "string") {
      const t = v.trim();
      if (
        /^https?:\/\//i.test(t) &&
        (/\bmoysklad\b/i.test(t) ||
          /\/images\//i.test(t) ||
          /\/download/i.test(t) ||
          /storage\.(moysklad|files)/i.test(t) ||
          /temp_url_sig=/i.test(t)) &&
        !seen.has(t)
      ) {
        seen.add(t);
        out.push(t);
      }
      return;
    }
    if (!v || typeof v !== "object") return;
    for (const x of Object.values(v)) walk(x);
  };
  walk(row);
  return out.sort((a, b) => scoreImageUrlCandidate(a) - scoreImageUrlCandidate(b));
}

/** Всегда через прокси /api/moysklad — подписанные URL из JSON быстро дают 401 в <img>; редирект с прокси выдаёт свежую ссылку. */
function imageUrlForDisplay(raw: string): string {
  return mediaUrlForApp(normalizeMoyskladImageDownloadUrl(raw));
}

/** Одна строка images.rows — тот же приоритет URL, что и раньше в pickImageUrl. */
function pickImageUrlForRow(row: MsImageRow): string | null {
  const candidates = [
    row.downloadHref,
    row.meta?.downloadHref,
    row.medium?.downloadHref,
    row.medium?.href,
    row.miniature?.downloadHref,
    row.miniature?.href,
    row.tiny?.downloadHref,
    row.tiny?.href,
    row.meta?.href,
  ];
  for (const raw of candidates) {
    if (!raw) continue;
    return imageUrlForDisplay(raw);
  }
  for (const raw of collectImageUrlsDeep(row)) {
    return imageUrlForDisplay(raw);
  }
  return null;
}

function pickAllImageUrls(p: MsProduct): string[] {
  const rows = p.images?.rows;
  if (!rows?.length) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const row of rows) {
    const u = pickImageUrlForRow(row);
    if (u && !seen.has(u)) {
      seen.add(u);
      out.push(u);
    }
  }
  return out;
}

function pickImageUrl(p: MsProduct): string {
  const rows = p.images?.rows;
  if (rows?.length) {
    const u = pickImageUrlForRow(rows[0]);
    if (u) return u;
  }
  return PRODUCT_IMAGE_PLACEHOLDER;
}

const MS_API_ORIGIN = "https://api.moysklad.ru/api/remap/1.2";

/** Сырой HTTPS-URL для скачивания на сервере (без прокси фронта). */
export function pickRawMoyskladImageUrl(p: MsProduct): string | null {
  const rows = p.images?.rows;
  if (!rows?.length) return null;
  const first = rows[0];
  const candidates = [
    first.downloadHref,
    first.meta?.downloadHref,
    first.medium?.downloadHref,
    first.medium?.href,
    first.miniature?.downloadHref,
    first.miniature?.href,
    first.tiny?.downloadHref,
    first.tiny?.href,
    first.meta?.href,
  ];
  const toAbsolute = (u: string): string => {
    const n = normalizeMoyskladImageDownloadUrl(u.trim());
    if (n.startsWith("http")) return n;
    if (n.startsWith("/")) return `${MS_API_ORIGIN}${n}`;
    return n;
  };
  for (const raw of candidates) {
    if (!raw) continue;
    return toAbsolute(raw);
  }
  for (const raw of collectImageUrlsDeep(first)) {
    return toAbsolute(raw);
  }
  return null;
}

/**
 * Все URL для скачивания картинок (сырой URL для бэкенда).
 * Возвращаем уникальные значения в порядке, близком к карточке.
 */
export function pickRawMoyskladImageUrls(p: MsProduct): string[] {
  const rows = p.images?.rows;
  if (!rows?.length) return [];

  const candidatesToRaw = (row: MsImageRow): string[] => {
    const rawCandidates = [
      row.downloadHref,
      row.meta?.downloadHref,
      row.medium?.downloadHref,
      row.medium?.href,
      row.miniature?.downloadHref,
      row.miniature?.href,
      row.tiny?.downloadHref,
      row.tiny?.href,
      row.meta?.href,
    ].filter(Boolean) as string[];

    if (rawCandidates.length) return rawCandidates;
    return collectImageUrlsDeep(row);
  };

  const toAbsolute = (u: string): string => {
    const n = normalizeMoyskladImageDownloadUrl(u.trim());
    if (n.startsWith("http")) return n;
    if (n.startsWith("/")) return `${MS_API_ORIGIN}${n}`;
    return n;
  };

  const out: string[] = [];
  const seen = new Set<string>();

  for (const row of rows) {
    for (const raw of candidatesToRaw(row)) {
      if (!raw) continue;
      const abs = toAbsolute(raw);
      if (!abs) continue;
      if (seen.has(abs)) continue;
      seen.add(abs);
      out.push(abs);
      break; // на одну строку изображения берём первый подходящий raw
    }
  }

  return out;
}

function mainPriceRub(p: MsProduct): number {
  const sp = p.salePrices?.filter((x) => x.value > 0);
  if (sp?.length) {
    return kopecksToRubles(sp[0].value);
  }
  if (p.minPrice && p.minPrice.value > 0) {
    return kopecksToRubles(p.minPrice.value);
  }
  return 0;
}

function formatBarcodes(p: MsProduct): string | undefined {
  if (!p.barcodes?.length) return undefined;
  const parts: string[] = [];
  for (const b of p.barcodes) {
    const v = Object.values(b)[0];
    if (v) parts.push(String(v));
  }
  return parts.length ? parts.join(", ") : undefined;
}

export interface CatalogProduct {
  id: string;
  name: string;
  price: number;
  oldPrice?: number;
  /** Главное фото (первое из галереи или заглушка). */
  image: string;
  /** Все фото товара из МойСклад (порядок как в карточке). */
  images: string[];
  rating: number;
  category: string;
  description: string;
  code?: string;
  article?: string;
  externalCode?: string;
  salePricesLabels: { label: string; rub: number }[];
  weightKg?: number;
  barcodes?: string;
}

function categoryFromProduct(
  p: MsProduct,
  folderIdToPath?: Map<string, string>
): string {
  const fromProductPath = normalizePathFromApi(p.pathName);
  if (fromProductPath) return fromProductPath;
  const folderId =
    p.productFolder?.id ?? folderIdFromHref(p.productFolder?.meta?.href);
  if (folderId && folderIdToPath?.has(folderId)) {
    return folderIdToPath.get(folderId)!;
  }
  const fromFolder = resolvePathFromFolderLike(p.productFolder);
  if (fromFolder) return fromFolder;
  return "Каталог";
}

export function mapMsProduct(
  p: MsProduct,
  folderIdToPath?: Map<string, string>
): CatalogProduct {
  const category = categoryFromProduct(p, folderIdToPath);

  const salePricesLabels =
    p.salePrices?.map((x) => ({
      label: x.priceType?.name || "Цена",
      rub: kopecksToRubles(x.value),
    })) ?? [];

  const price = mainPriceRub(p);
  const fromRows = pickAllImageUrls(p);
  const image = fromRows[0] ?? pickImageUrl(p);
  const images = fromRows.length > 0 ? fromRows : [image];

  return {
    id: p.id,
    name: p.name,
    price,
    image,
    images,
    rating: 0,
    category,
    description: (p.description || "").trim() || "Товар из каталога МойСклад",
    code: p.code,
    article: p.article,
    externalCode: p.externalCode,
    salePricesLabels,
    weightKg: p.weight != null && p.weight > 0 ? p.weight / 1000 : undefined,
    barcodes: formatBarcodes(p),
  };
}
