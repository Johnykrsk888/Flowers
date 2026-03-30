import { moyskladApiPrefix } from "./apiPrefix";
import { msFetchJson } from "./msFetch";
import type { MsImagesBlock, MsProduct, MsProductListResponse } from "./types";

const PAGE_SIZE = 100;

/** Не 1 (слишком долго) и не N (429): параллельно, но с ограничением. */
const ENRICH_CONCURRENCY = 8;

/**
 * Догрузка картинок по одному товару — сотни товаров × ретраи 429 = минуты и «вечная загрузка».
 * Обогащаем только первые N карточек, у остальных — что пришло в списке (часто уже с URL).
 */
/** После приоритета «неполная галерея» (size > rows) — хватает для типичной витрины. */
const MAX_PRODUCTS_TO_IMAGE_ENRICH = 200;

/** В списке товаров часто приходит только часть images.rows при meta.size > rows.length — без догрузки галерея в карточке неполная. */
function imagesListIncomplete(p: MsProduct): boolean {
  const rowCount = p.images?.rows?.length ?? 0;
  const metaSize = p.images?.meta?.size;
  return typeof metaSize === "number" && metaSize > rowCount;
}

function productNeedsImageEnrich(p: MsProduct): boolean {
  if (imagesListIncomplete(p)) return true;
  const rows = p.images?.rows;
  if (rows?.length) {
    // Если вернулся только один row — это часто означает «неполную галерею»:
    // даже если в первой записи уже есть `http`, реальных дополнительных rows
    // может не быть в исходном списке.
    if (rows.length === 1) return true;

    const first = rows[0];
    if (JSON.stringify(first).includes("http")) return false;
    return true;
  }
  const size = p.images?.meta?.size ?? 0;
  const collectionHref = p.images?.meta?.href;
  const looksLikeImagesCollection =
    typeof collectionHref === "string" && /\/images/i.test(collectionHref);
  if (size === 0 && !looksLikeImagesCollection) return false;
  return true;
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  async function worker(): Promise<void> {
    for (;;) {
      const i = next++;
      if (i >= items.length) return;
      out[i] = await fn(items[i]!);
    }
  }
  const n = Math.min(Math.max(1, concurrency), Math.max(1, items.length));
  await Promise.all(Array.from({ length: n }, () => worker()));
  return out;
}

/** Для догрузки полной галереи по id (карточка товара, список дал не все rows). */
export async function fetchEntityWithImagesExpanded(
  entity: "product" | "bundle",
  id: string
): Promise<MsProduct | null> {
  const prefix = moyskladApiPrefix();
  if (!prefix) return null;
  const qs = new URLSearchParams({ expand: "productFolder,images" });
  const url = `${prefix}/entity/${entity}/${id}?${qs.toString()}`;
  const res = await msFetchJson(url);
  if (!res.ok) return null;
  return (await res.json()) as MsProduct;
}

export async function fetchImagesSubresource(
  entity: "product" | "bundle",
  id: string
): Promise<MsImagesBlock | null> {
  const prefix = moyskladApiPrefix();
  if (!prefix) return null;
  const url = `${prefix}/entity/${entity}/${id}/images`;
  const res = await msFetchJson(url);
  if (!res.ok) return null;
  return (await res.json()) as MsImagesBlock;
}

/**
 * В списке /entity/product иногда приходит images.meta.size > 0, но rows пустой —
 * без отдельного GET картинки в каталоге не появляются.
 */
async function enrichMsProductImagesIfNeeded(
  entity: "product" | "bundle",
  p: MsProduct
): Promise<MsProduct> {
  const rows = p.images?.rows;
  const rowCount = rows?.length ?? 0;
  const incomplete = imagesListIncomplete(p);

  if (!incomplete && rowCount > 0) {
    const first = rows![0];
    /**
     * Если пришла только одна строка, это часто урезанная галерея из списка,
     * даже когда в ней уже есть URL. В таком случае всё равно пробуем догрузить.
     */
    if (rowCount > 1 && JSON.stringify(first).includes("http")) return p;
  } else if (!incomplete && rowCount === 0) {
    const size = p.images?.meta?.size ?? 0;
    const collectionHref = p.images?.meta?.href;
    const looksLikeImagesCollection =
      typeof collectionHref === "string" && /\/images/i.test(collectionHref);
    if (size === 0 && !looksLikeImagesCollection) return p;
  }

  const full = await fetchEntityWithImagesExpanded(entity, p.id);
  if (full?.images?.rows?.length) {
    // `expand=images` у МойСклад иногда отдаёт только первую строку галереи.
    // Если видим больше одной картинки и коллекция не выглядит урезанной,
    // принимаем ответ как полный. Иначе идём в /images за фактическим списком.
    const fullRows = full.images.rows.length;
    const fullLooksComplete = fullRows > 1 && !imagesListIncomplete(full);
    if (fullLooksComplete) return full;
  }

  const sub = await fetchImagesSubresource(entity, p.id);
  if (sub?.rows?.length) {
    return {
      ...p,
      images: {
        ...p.images,
        meta: sub.meta ?? p.images?.meta,
        rows: sub.rows,
      },
    };
  }
  return full ?? p;
}

/**
 * Пагинация по product | bundle.
 * expand без вложенности — стабильнее приходят id группы и pathName.
 */
export async function fetchAllMsEntityRows(
  entity: "product" | "bundle"
): Promise<MsProduct[]> {
  const prefix = moyskladApiPrefix();
  if (!prefix) {
    throw new Error(
      "Каталог МойСклад: в production нужен бэкенд-прокси. Укажите VITE_MOYSKLAD_API_PREFIX или запускайте npm run dev с .env (MOYSKLAD_LOGIN, MOYSKLAD_PASSWORD)."
    );
  }

  const all: MsProduct[] = [];
  let offset = 0;

  for (;;) {
    const qs = new URLSearchParams({
      limit: String(PAGE_SIZE),
      offset: String(offset),
      expand: "productFolder,images",
      filter: "archived=false",
    });

    const url = `${prefix}/entity/${entity}?${qs.toString()}`;
    const res = await msFetchJson(url);

    if (!res.ok) {
      const t = await res.text();
      throw new Error(`МойСклад ${res.status} (${entity}): ${t.slice(0, 200)}`);
    }

    const data = (await res.json()) as MsProductListResponse;
    const rows = data.rows ?? [];
    all.push(...rows);

    if (rows.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }

  const needEnrich = all.filter(productNeedsImageEnrich);
  needEnrich.sort((a, b) => {
    const pa = imagesListIncomplete(a) ? 0 : 1;
    const pb = imagesListIncomplete(b) ? 0 : 1;
    return pa - pb;
  });
  const enrichIds = new Set(
    needEnrich.slice(0, MAX_PRODUCTS_TO_IMAGE_ENRICH).map((p) => p.id)
  );

  return mapWithConcurrency(all, ENRICH_CONCURRENCY, (p) =>
    enrichIds.has(p.id)
      ? enrichMsProductImagesIfNeeded(entity, p)
      : Promise.resolve(p)
  );
}
