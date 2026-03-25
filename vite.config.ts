import path from "path";
import { fileURLToPath } from "url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// GitHub Pages: сайт открывается как https://<user>.github.io/Flowers/
const pagesBase = "/Flowers/";

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const login = env.MOYSKLAD_LOGIN;
  const password = env.MOYSKLAD_PASSWORD;
  const basic =
    login && password
      ? Buffer.from(`${login}:${password}`).toString("base64")
      : "";

  return {
    base: mode === "production" ? pagesBase : "/",
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
                  proxyReq.setHeader("Accept", "application/json;charset=utf-8");
                });
              },
            },
          }
        : {},
    },
  };
});
