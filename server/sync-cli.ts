import "dotenv/config";
import { createPool, initSchema } from "./db.js";
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
