import { normalizePathFromApi, resolvePathFromFolderLike } from "./categoryPath";
import { folderIdFromHref } from "./folderId";
import type { MsProduct } from "./types";
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

function pickImageUrl(p: MsProduct): string {
  const rows = p.images?.rows;
  if (rows?.length) {
    const first = rows[0];
    /** От крупного к мелкому — иначе tiny/миниатюра растягиваются на h-64 и размываются. */
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
    for (const raw of candidates) {
      if (!raw) continue;
      /** Не добавлять query к URL: у storage подпись (temp_url_sig) ломается. */
      return imageUrlForDisplay(raw);
    }
    for (const raw of collectImageUrlsDeep(first)) {
      return imageUrlForDisplay(raw);
    }
  }
  return PRODUCT_IMAGE_PLACEHOLDER;
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
  image: string;
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

  return {
    id: p.id,
    name: p.name,
    price,
    image: pickImageUrl(p),
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
