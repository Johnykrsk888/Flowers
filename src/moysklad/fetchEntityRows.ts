import { moyskladApiPrefix } from "./apiPrefix";
import { msFetchJson } from "./msFetch";
import type { MsImagesBlock, MsProduct, MsProductListResponse } from "./types";

const PAGE_SIZE = 100;

/** Не 1 (слишком долго) и не N (429): параллельно, но с ограничением. */
const ENRICH_CONCURRENCY = 8;

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

async function fetchEntityWithImagesExpanded(
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

async function fetchImagesSubresource(
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
  if (rows?.length) {
    const first = rows[0];
    /** В rows иногда лежит «пустая» заготовка без URL — догружаем как при пустом списке. */
    if (JSON.stringify(first).includes("http")) return p;
  } else {
    const size = p.images?.meta?.size ?? 0;
    const collectionHref = p.images?.meta?.href;
    const looksLikeImagesCollection =
      typeof collectionHref === "string" && /\/images/i.test(collectionHref);
    if (size === 0 && !looksLikeImagesCollection) return p;
  }

  const full = await fetchEntityWithImagesExpanded(entity, p.id);
  if (full?.images?.rows?.length) return full;

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
  return p;
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

  return mapWithConcurrency(all, ENRICH_CONCURRENCY, (p) =>
    enrichMsProductImagesIfNeeded(entity, p)
  );
}
