import "dotenv/config";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import { createPool, ensureUploadsDir, initSchema } from "./db.js";
import { syncCatalog } from "./syncCatalog.js";
import type { CatalogProduct } from "../src/moysklad/mapProduct.js";
import { PRODUCT_IMAGE_PLACEHOLDER } from "../src/moysklad/placeholderImage.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function rowToProduct(r: Record<string, unknown>): CatalogProduct {
  const parseImages = (rawImages: unknown): string[] => {
    if (rawImages == null) return [];
    try {
      const parsed =
        typeof rawImages === "string" ? JSON.parse(rawImages) : rawImages;
      if (Array.isArray(parsed)) {
        return parsed.map(String).filter(Boolean);
      }
    } catch {
      /* ignore */
    }
    return [];
  };

  let salePricesLabels: { label: string; rub: number }[] = [];
  const raw = r.sale_prices_json;
  if (raw != null) {
    try {
      const parsed =
        typeof raw === "string" ? JSON.parse(raw) : raw;
      if (Array.isArray(parsed)) salePricesLabels = parsed;
    } catch {
      /* ignore */
    }
  }
  const price = Number(r.price);
  const oldP = r.old_price != null ? Number(r.old_price) : undefined;
  const img = String(r.image_path || "");
  let images = parseImages(r.images_json);

  if (images.length === 0) {
    images = img ? [img] : [PRODUCT_IMAGE_PLACEHOLDER];
  }
  return {
    id: String(r.ms_id),
    name: String(r.name),
    price,
    oldPrice: oldP != null && !Number.isNaN(oldP) ? oldP : undefined,
    image: img,
    images,
    rating: Number(r.rating) || 0,
    category: String(r.category || ""),
    description: String(r.description || ""),
    code: r.code != null ? String(r.code) : undefined,
    article: r.article != null ? String(r.article) : undefined,
    externalCode: r.external_code != null ? String(r.external_code) : undefined,
    salePricesLabels,
    weightKg:
      r.weight_kg != null && Number(r.weight_kg) > 0
        ? Number(r.weight_kg)
        : undefined,
    barcodes: r.barcodes != null ? String(r.barcodes) : undefined,
  };
}

async function resolveProductImages(
  pool: Awaited<ReturnType<typeof createPool>>,
  id: string
): Promise<string[]> {
  const [rows] = await pool.query(
    "SELECT image_path, images_json FROM products WHERE ms_id = ? LIMIT 1",
    [id]
  );
  const row = (rows as Record<string, unknown>[])[0];
  const dbImages = row
    ? rowToProduct({ ...row, ms_id: id, name: "", price: 0 }).images
    : [];
  return dbImages.length ? dbImages : [PRODUCT_IMAGE_PLACEHOLDER];
}

/** По умолчанию 8788: на VPS 8787 занят Python (img-proxy МойСклад). */
const PORT = Number(process.env.CATALOG_SERVER_PORT ?? "8788");

async function main() {
  const pool = await createPool();
  await initSchema(pool);
  ensureUploadsDir();

  const app = express();
  app.use(
    "/uploads",
    express.static(path.join(__dirname, "data", "uploads"))
  );

  app.get("/api/catalog/products", async (req, res) => {
    try {
      const id = String(req.query.id ?? "").trim();
      const wantImages = req.query.images === "1" || req.query.images === "true";
      if (id && wantImages) {
        res.json({ images: await resolveProductImages(pool, id) });
        return;
      }

      const [rows] = await pool.query(
        "SELECT * FROM products ORDER BY name ASC"
      );
      const [metaRows] = await pool.query(
        "SELECT v FROM catalog_meta WHERE k = 'folder_paths' LIMIT 1"
      );
      let folderPaths: string[] = [];
      const m = (metaRows as { v: unknown }[])[0]?.v;
      if (m != null) {
        try {
          const parsed = typeof m === "string" ? JSON.parse(m) : m;
          if (Array.isArray(parsed)) folderPaths = parsed.map(String);
        } catch {
          /* ignore */
        }
      }
      if (folderPaths.length === 0) {
        const [distinct] = await pool.query(
          "SELECT DISTINCT category FROM products WHERE category IS NOT NULL AND category != '' ORDER BY category ASC"
        );
        folderPaths = (distinct as { category: string }[]).map((x) => x.category);
      }
      const products = (rows as Record<string, unknown>[]).map(rowToProduct);
      res.json({ products, folderPaths });
    } catch (e) {
      console.error(e);
      res.status(500).json({
        error: e instanceof Error ? e.message : String(e),
      });
    }
  });

  app.get("/api/catalog/products/:id/images", async (req, res) => {
    try {
      const id = String(req.params.id || "").trim();
      if (!id) {
        res.status(400).json({ error: "Missing product id" });
        return;
      }
      res.json({ images: await resolveProductImages(pool, id) });
    } catch (e) {
      console.error(e);
      res.status(500).json({
        error: e instanceof Error ? e.message : String(e),
      });
    }
  });

  app.get("/api/catalog/product-images", async (req, res) => {
    try {
      const id = String(req.query.id ?? "").trim();
      if (!id) {
        res.status(400).json({ error: "Missing product id" });
        return;
      }
      res.json({ images: await resolveProductImages(pool, id) });
    } catch (e) {
      console.error(e);
      res.status(500).json({
        error: e instanceof Error ? e.message : String(e),
      });
    }
  });

  app.post("/api/catalog/sync", async (_req, res) => {
    try {
      const { count } = await syncCatalog(pool);
      res.json({ ok: true, count });
    } catch (e) {
      console.error(e);
      res.status(500).json({
        ok: false,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  });

  app.listen(PORT, () => {
    console.log(`catalog-server http://127.0.0.1:${PORT}`);
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
