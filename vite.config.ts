import path from "path";
import { fileURLToPath } from "url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const login = env.MOYSKLAD_LOGIN;
  const password = env.MOYSKLAD_PASSWORD;
  const basic =
    login && password
      ? Buffer.from(`${login}:${password}`).toString("base64")
      : "";
  const catalogPort = env.CATALOG_SERVER_PORT || "8788";
  // В dev Vite по умолчанию проксирует каталог на локальный catalog-server (8788).
  // Если MySQL на VPS локально недоступен, можно указать готовый URL (prod),
  // чтобы фронт работал без SSH-туннеля.
  const catalogProxyTarget =
    env.CATALOG_PROXY_TARGET ||
    env.VITE_CATALOG_PROXY_TARGET ||
    "";
  const localCatalogTarget = `http://127.0.0.1:${catalogPort}`;
  const catalogTarget =
    mode === "development"
      ? localCatalogTarget
      : catalogProxyTarget
        ? String(catalogProxyTarget).replace(/\/$/, "")
        : localCatalogTarget;
  const catalogIsHttps = catalogTarget.startsWith("https://");

  return {
    base: "/",
    plugins: [react(), tailwindcss(), viteSingleFile()],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "src"),
      },
    },
    server: {
      proxy: {
        // В dev всегда читаем локальный catalog-server, чтобы синк в локальную БД
        // сразу отражался в витрине. Продовый target остаётся только как fallback вне dev.
        "/api/catalog/products": {
          target: catalogTarget,
          changeOrigin: true,
          secure: catalogIsHttps,
        },
        "/api/catalog/product-images": {
          target: `http://127.0.0.1:${catalogPort}`,
          changeOrigin: true,
        },
        "/api/catalog/sync": {
          target: `http://127.0.0.1:${catalogPort}`,
          changeOrigin: true,
        },
        "/uploads": {
          target: catalogTarget,
          changeOrigin: true,
          secure: catalogIsHttps,
        },
        ...(basic
          ? {
            "/api/moysklad": {
              target: "https://api.moysklad.ru",
              changeOrigin: true,
              secure: true,
              rewrite: (p) => p.replace(/^\/api\/moysklad/, "/api/remap/1.2"),
              configure: (proxy) => {
                proxy.on("proxyReq", (proxyReq) => {
                  proxyReq.setHeader("Authorization", `Basic ${basic}`);
                  const p = proxyReq.path || "";
                  // Бинарные ответы: .../download, .../download/uuid (не только "/download/" — иначе
                  // .../images/{id}/download без хвостового / даёт Accept: json → 1062 от API).
                  const isDownload = /\/download(?:\?|$|\/)/i.test(p);
                  if (isDownload) {
                    proxyReq.setHeader("Accept", "*/*");
                  } else {
                    proxyReq.setHeader("Accept", "application/json;charset=utf-8");
                  }
                });
              },
            },
          }
          : {}),
      },
    },
  };
});
