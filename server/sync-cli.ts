import { config as loadEnv } from "dotenv";
import { createPool, initSchema } from "./db.js";

const envFile =
  process.env.DOTENV_CONFIG_PATH?.trim() ||
  process.env.CATALOG_ENV_PATH?.trim() ||
  "";
if (process.env.MYSQL_HOST && process.env.MYSQL_USER) {
  // systemd EnvironmentFile=/etc/flowers/catalog.env уже задал переменные
} else if (envFile) {
  loadEnv({ path: envFile });
} else {
  loadEnv();
}
import { syncCatalog } from "./syncCatalog.js";

async function main() {
  const pool = await createPool();
  await initSchema(pool);
  const { count } = await syncCatalog(pool);
  await pool.end();
  console.log(`OK: синхронизировано товаров: ${count}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
