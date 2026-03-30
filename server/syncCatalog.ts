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
  pickRawMoyskladImageUrls,
  type CatalogProduct,
} from "../src/moysklad/mapProduct.js";
import { PRODUCT_IMAGE_PLACEHOLDER } from "../src/moysklad/placeholderImage.js";
import type { MsProduct } from "../src/moysklad/types.js";
import {
  fetchEntityWithImagesExpanded,
  fetchImagesSubresource,
} from "../src/moysklad/fetchEntityRows.js";

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
  safeId: string,
  index: number
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
  const ct = res.headers.get("content-type");
  // Иногда /download может вернуть JSON (например из-за неверного URL/срока),
  // и тогда мы не должны сохранять этот JSON как "jpg".
  if (ct) {
    const c = ct.toLowerCase();
    const looksLikeImage = c.includes("image/") || c.includes("octet-stream");
    if (!looksLikeImage) {
      console.warn(
        `download content-type не image: ${ct} (skip) ${rawUrl.slice(0, 96)}`
      );
      return null;
    }
  }
  const ext = extFromContentType(ct);
  const fsPath = path.join(getUploadsDir(), `${safeId}_${index}.${ext}`);
  fs.writeFileSync(fsPath, Buffer.from(await res.arrayBuffer()));
  return `/uploads/products/${safeId}_${index}.${ext}`;
}

function toRow(
  p: CatalogProduct,
  imagePublicPath: string,
  imagesPublicPaths: string[]
): any[] {
  return [
    p.id,
    p.name,
    p.description,
    p.category,
    p.price,
    p.oldPrice ?? null,
    imagePublicPath,
    JSON.stringify(imagesPublicPaths),
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
  const rows = [
    ...productRows.map((p) => ({ entity: "product" as const, p })),
    ...bundleRows.map((p) => ({ entity: "bundle" as const, p })),
  ];

  let count = 0;
  const importedIds = new Set<string>();

  for (const { entity, p } of rows) {
    const mapped = mapMsProduct(p, folderMeta.idToPath);
    if (!productCategoryInCatalogScope(mapped.category)) continue;
    mapped.category = stripCatalogRootPrefix(mapped.category);
    importedIds.add(p.id);

    const sid = safeFileId(p.id);

    let rawUrls = pickRawMoyskladImageUrls(p);
    if (rawUrls.length <= 1) {
      const full = await fetchEntityWithImagesExpanded(entity, p.id).catch(() => null);
      const expandedUrls = full ? pickRawMoyskladImageUrls(full) : [];
      if (expandedUrls.length > rawUrls.length) {
        rawUrls = expandedUrls;
      }
    }
    if (rawUrls.length <= 1) {
      const sub = await fetchImagesSubresource(entity, p.id).catch(() => null);
      if (sub?.rows?.length) {
        const merged = {
          ...p,
          images: {
            ...(p.images ?? {}),
            meta: sub.meta ?? p.images?.meta,
            rows: sub.rows,
          },
        } as MsProduct;
        const subUrls = pickRawMoyskladImageUrls(merged);
        if (subUrls.length > rawUrls.length) {
          rawUrls = subUrls;
        }
      }
    }
    const imagesPublicPaths: string[] = [];
    for (let i = 0; i < rawUrls.length; i++) {
      const local = await downloadProductImage(rawUrls[i], sid, i);
      if (local) imagesPublicPaths.push(local);
    }

    let imagePublic =
      imagesPublicPaths[0] ?? mapped.image ?? PRODUCT_IMAGE_PLACEHOLDER;

    // Требование: показываем только то, что лежит в публичном /uploads (или заглушку).
    // Иначе на фронте начнут грузиться URL "из моего склада" через /api/moysklad.
    if (
      !imagePublic ||
      (imagePublic !== PRODUCT_IMAGE_PLACEHOLDER &&
        !imagePublic.startsWith("/uploads/"))
    ) {
      imagePublic = PRODUCT_IMAGE_PLACEHOLDER;
    }

    await pool.execute(
      `REPLACE INTO products (ms_id, name, description, category, price, old_price, image_path, images_json, sale_prices_json, code, article, external_code, barcodes, weight_kg, rating, updated_at_ms)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      toRow(
        { ...mapped, image: imagePublic },
        imagePublic,
        imagesPublicPaths
      )
    );
    count++;
  }

  const pathsJson = JSON.stringify(
    folderMeta.paths.map(stripCatalogRootPrefix)
  );
  await pool.execute("REPLACE INTO catalog_meta (k, v) VALUES ('folder_paths', ?)", [
    pathsJson,
  ]);

  if (importedIds.size > 0) {
    const ids = [...importedIds];
    const placeholders = ids.map(() => "?").join(", ");
    await pool.execute(
      `DELETE FROM products WHERE ms_id NOT IN (${placeholders})`,
      ids
    );
  }

  return { count };
}

