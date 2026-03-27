import fs from "node:fs";
import path from "node:path";
import mysql from "mysql2/promise";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function getUploadsDir(): string {
  return path.join(__dirname, "data", "uploads", "products");
}

export function ensureUploadsDir(): void {
  const dir = getUploadsDir();
  fs.mkdirSync(dir, { recursive: true });
}

export interface DbProductRow {
  ms_id: string;
  name: string;
  description: string;
  category: string;
  price: number;
  old_price: number | null;
  image_path: string;
  sale_prices_json: unknown;
  code: string | null;
  article: string | null;
  external_code: string | null;
  barcodes: string | null;
  weight_kg: number | null;
  rating: number;
}

function env(name: string, fallback = ""): string {
  return (process.env[name] ?? fallback).trim();
}

export async function createPool(): Promise<mysql.Pool> {
  const host = env("MYSQL_HOST", "127.0.0.1");
  const port = Number(env("MYSQL_PORT", "3306")) || 3306;
  const database = env("MYSQL_DATABASE_BOOMBUKET", "boombuket");
  const user = env("MYSQL_USER", "root");
  const password = env("MYSQL_PASSWORD", "");
  return mysql.createPool({
    host,
    port,
    database,
    user,
    password,
    waitForConnections: true,
    connectionLimit: 10,
  });
}

export async function initSchema(pool: mysql.Pool): Promise<void> {
  await pool.execute(`
CREATE TABLE IF NOT EXISTS products (
  ms_id VARCHAR(64) NOT NULL PRIMARY KEY,
  name VARCHAR(512) NOT NULL,
  description TEXT,
  category VARCHAR(768) DEFAULT '',
  price DECIMAL(14, 4) NOT NULL DEFAULT 0,
  old_price DECIMAL(14, 4) NULL,
  image_path VARCHAR(1024) NOT NULL DEFAULT '',
  sale_prices_json JSON NULL,
  code VARCHAR(128) NULL,
  article VARCHAR(128) NULL,
  external_code VARCHAR(255) NULL,
  barcodes TEXT NULL,
  weight_kg DECIMAL(14, 6) NULL,
  rating DECIMAL(6, 2) NOT NULL DEFAULT 0,
  updated_at_ms BIGINT NULL,
  synced_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_products_category (category(191))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
  await pool.execute(`
CREATE TABLE IF NOT EXISTS catalog_meta (
  k VARCHAR(64) NOT NULL PRIMARY KEY,
  v JSON NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
}
