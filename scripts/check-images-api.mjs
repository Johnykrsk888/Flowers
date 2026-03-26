/**
 * Одноразовая проверка: каталог + загрузка картинок через тот же URL, что и в проде.
 * Запуск: node scripts/check-images-api.mjs
 */
import { readFileSync } from "node:fs";

const env = Object.fromEntries(
  readFileSync(new URL("../.env", import.meta.url), "utf8")
    .split(/\r?\n/)
    .filter((l) => l && !l.startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    })
);

const PREFIX = (env.VITE_MOYSKLAD_API_PREFIX || "https://www.boombuket.ru/api/moysklad").replace(
  /\/$/,
  ""
);
const REMAP = "/api/remap/1.2";

function mediaUrlForApp(url) {
  const trimmed = url.trim();
  let rest = null;
  try {
    const u = new URL(trimmed);
    if (u.hostname === "api.moysklad.ru") {
      const idx = u.pathname.indexOf(REMAP);
      if (idx >= 0) {
        rest = u.pathname.slice(idx + REMAP.length) + u.search;
      }
    }
  } catch {
    /* ignore */
  }
  if (rest != null) return `${PREFIX}${rest}`;
  return trimmed;
}

const listUrl = `${PREFIX}/entity/product?limit=20&expand=productFolder,images&filter=archived%3Dfalse`;
const r = await fetch(listUrl, {
  headers: { Accept: "application/json;charset=utf-8" },
});
console.log("Каталог (product):", r.status, r.statusText);
if (!r.ok) {
  console.log(await r.text());
  process.exit(1);
}
const j = await r.json();
const products = j.rows ?? [];
let shown = 0;
for (const p of products) {
  const first = p.images?.rows?.[0];
  if (!first) continue;
  const raw =
    first.downloadHref ||
    first.meta?.downloadHref ||
    first.tiny?.href ||
    first.medium?.href;
  if (!raw) continue;
  const appUrl = mediaUrlForApp(raw);
  const ir = await fetch(appUrl, { headers: { Accept: "*/*" } });
  const ct = ir.headers.get("content-type") ?? "";
  const buf = await ir.arrayBuffer();
  console.log(
    `- ${(p.name ?? "?").slice(0, 42)} | ${ir.status} | ${ct.split(";")[0]} | ${buf.byteLength} B`
  );
  console.log(`  ${appUrl.slice(0, 100)}${appUrl.length > 100 ? "…" : ""}`);
  if (++shown >= 6) break;
}
if (shown === 0) {
  console.log("В первых 20 товарах нет images.rows с URL.");
}

const bundleUrl = `${PREFIX}/entity/bundle?limit=20&expand=productFolder,images&filter=archived%3Dfalse`;
const br = await fetch(bundleUrl, {
  headers: { Accept: "application/json;charset=utf-8" },
});
console.log("\nКаталог (bundle):", br.status, br.statusText);
if (br.ok) {
  const bj = await br.json();
  let bs = 0;
  for (const p of bj.rows ?? []) {
    const first = p.images?.rows?.[0];
    if (!first) continue;
    const raw =
      first.downloadHref ||
      first.meta?.downloadHref ||
      first.tiny?.href ||
      first.medium?.href;
    if (!raw) continue;
    const appUrl = mediaUrlForApp(raw);
    const ir = await fetch(appUrl, { headers: { Accept: "*/*" } });
    const ct = ir.headers.get("content-type") ?? "";
    const buf = await ir.arrayBuffer();
    console.log(
      `- ${(p.name ?? "?").slice(0, 42)} | ${ir.status} | ${ct.split(";")[0]} | ${buf.byteLength} B`
    );
    if (++bs >= 3) break;
  }
  if (bs === 0) console.log("(нет комплектов с картинкой в первых 20)");
}
