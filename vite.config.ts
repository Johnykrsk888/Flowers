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
  const catalogTarget = `http://127.0.0.1:${catalogPort}`;

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
        "/api/catalog": {
          target: catalogTarget,
          changeOrigin: true,
        },
        "/uploads": {
          target: catalogTarget,
          changeOrigin: true,
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
