/**
 * Начальная / повторная загрузка: МойСклад → MariaDB boombuket + файлы в server/data/uploads/products.
 * CLI: npm run sync:catalog
 */
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import type { Pool } from "mysql2/promise";
import { ensureUploadsDir, getUploadsDir } from "./db.js";
import { fetchAllMsEntityRows } from "../src/moysklad/fetchEntityRows.js";
import { fetchMoyskladFolderMetadata } from "../src/moysklad/fetchFolders.js";
import {
  productCategoryInCatalogScope,
  stripCatalogRootPrefix,
} from "../src/moysklad/catalogScope.js";
import {
  mapMsProduct,
  pickRawMoyskladImageUrl,
  type CatalogProduct,
} from "../src/moysklad/mapProduct.js";
import type { MsProduct } from "../src/moysklad/types.js";

process.env.MOYSKLAD_SERVER_API_PREFIX =
  process.env.MOYSKLAD_SERVER_API_PREFIX ?? "https://api.moysklad.ru/api/remap/1.2";

function extFromContentType(ct: string | null): string {
  if (!ct) return "jpg";
  const m = ct.toLowerCase();
  if (m.includes("png")) return "png";
  if (m.includes("webp")) return "webp";
  if (m.includes("gif")) return "gif";
  return "jpg";
}

function safeFileId(msId: string): string {
  return msId.replace(/[^a-zA-Z0-9-]/g, "_");
}

async function downloadProductImage(
  rawUrl: string,
  safeId: string
): Promise<string | null> {
  const login = process.env.MOYSKLAD_LOGIN;
  const password = process.env.MOYSKLAD_PASSWORD ?? "";
  if (!login) {
    console.warn("MOYSKLAD_LOGIN не задан — картинки не скачиваются.");
    return null;
  }
  const auth = Buffer.from(`${login}:${password}`).toString("base64");
  const res = await fetch(rawUrl, {
    headers: {
      Authorization: `Basic ${auth}`,
      Accept: "*/*",
      "Cache-Control": "no-cache",
    },
    cache: "no-store",
  });
  if (!res.ok) {
    console.warn(`download ${res.status} ${rawUrl.slice(0, 96)}`);
    return null;
  }
  const ext = extFromContentType(res.headers.get("content-type"));
  const fsPath = path.join(getUploadsDir(), `${safeId}.${ext}`);
  fs.writeFileSync(fsPath, Buffer.from(await res.arrayBuffer()));
  return `/uploads/products/${safeId}.${ext}`;
}

function toRow(p: CatalogProduct, imagePublicPath: string): unknown[] {
  return [
    p.id,
    p.name,
    p.description,
    p.category,
    p.price,
    p.oldPrice ?? null,
    imagePublicPath,
    JSON.stringify(p.salePricesLabels),
    p.code ?? null,
    p.article ?? null,
    p.externalCode ?? null,
    p.barcodes ?? null,
    p.weightKg ?? null,
    p.rating,
    Date.now(),
  ];
}

export async function syncCatalog(pool: Pool): Promise<{ count: number }> {
  ensureUploadsDir();
  const folderMeta = await fetchMoyskladFolderMetadata().catch(() => ({
    paths: [] as string[],
    idToPath: new Map<string, string>(),
  }));
  const productRows = await fetchAllMsEntityRows("product");
  const bundleRows = await fetchAllMsEntityRows("bundle").catch(() => [] as MsProduct[]);
  const rows = [...productRows, ...bundleRows];

  let count = 0;

  for (const p of rows) {
    const mapped = mapMsProduct(p, folderMeta.idToPath);
    if (!productCategoryInCatalogScope(mapped.category)) continue;
    mapped.category = stripCatalogRootPrefix(mapped.category);

    const rawUrl = pickRawMoyskladImageUrl(p);
    const sid = safeFileId(p.id);
    let imagePublic = mapped.image;
    if (rawUrl) {
      const local = await downloadProductImage(rawUrl, sid);
      if (local) imagePublic = local;
    }

    await pool.execute(
      `REPLACE INTO products (ms_id, name, description, category, price, old_price, image_path, sale_prices_json, code, article, external_code, barcodes, weight_kg, rating, updated_at_ms)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      toRow({ ...mapped, image: imagePublic }, imagePublic)
    );
    count++;
  }

  const pathsJson = JSON.stringify(
    folderMeta.paths.map(stripCatalogRootPrefix)
  );
  await pool.execute("REPLACE INTO catalog_meta (k, v) VALUES ('folder_paths', ?)", [
    pathsJson,
  ]);

  return { count };
}

