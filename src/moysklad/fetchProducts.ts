import { moyskladApiPrefix } from "./apiPrefix";
import { fetchAllMsEntityRows } from "./fetchEntityRows";
import { fetchMoyskladFolderMetadata } from "./fetchFolders";
import type { MsProduct } from "./types";
import { mapMsProduct, type CatalogProduct } from "./mapProduct";

/**
 * Загружает все неархивные товары и комплекты (раздел «Товары» в МойСклад включает оба типа).
 */
export async function fetchMoyskladProducts(): Promise<CatalogProduct[]> {
  const { products } = await fetchMoyskladCatalog();
  return products;
}

/** Товары + комплекты + пути групп из МойСклад. */
export async function fetchMoyskladCatalog(): Promise<{
  products: CatalogProduct[];
  folderPaths: string[];
}> {
  const prefix = moyskladApiPrefix();
  if (!prefix) {
    throw new Error(
      "Каталог МойСклад: в production нужен бэкенд-прокси. Укажите VITE_MOYSKLAD_API_PREFIX или запускайте npm run dev с .env (MOYSKLAD_LOGIN, MOYSKLAD_PASSWORD)."
    );
  }

  const [folderMeta, productRows, bundleRows] = await Promise.all([
    fetchMoyskladFolderMetadata().catch(() => ({
      paths: [] as string[],
      idToPath: new Map<string, string>(),
    })),
    fetchAllMsEntityRows("product"),
    fetchAllMsEntityRows("bundle").catch(() => [] as MsProduct[]),
  ]);

  const rows = [...productRows, ...bundleRows];
  const products = rows.map((p) => mapMsProduct(p, folderMeta.idToPath));
  return { products, folderPaths: folderMeta.paths };
}
