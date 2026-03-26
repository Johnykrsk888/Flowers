import path from "path";
import { fileURLToPath } from "url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// GitHub Pages: VITE_GITHUB_PAGES=true → base /Flowers/; иначе корень (VPS, nginx).
const pagesBase = "/Flowers/";

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const githubPages =
    env.VITE_GITHUB_PAGES === "true" || env.VITE_GITHUB_PAGES === "1";
  const login = env.MOYSKLAD_LOGIN;
  const password = env.MOYSKLAD_PASSWORD;
  const basic =
    login && password
      ? Buffer.from(`${login}:${password}`).toString("base64")
      : "";

  return {
    base:
      mode === "production" ? (githubPages ? pagesBase : "/") : "/",
    plugins: [react(), tailwindcss(), viteSingleFile()],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "src"),
      },
    },
    server: {
      proxy: basic
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
                  // Картинки /download — не запрашивать как JSON
                  if (p.includes("/download/")) {
                    proxyReq.setHeader("Accept", "*/*");
                  } else {
                    proxyReq.setHeader("Accept", "application/json;charset=utf-8");
                  }
                });
              },
            },
          }
        : {},
    },
  };
});
