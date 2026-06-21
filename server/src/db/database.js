import Database from "better-sqlite3";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const serverRoot = path.resolve(__dirname, "../../");
const configuredDbPath = process.env.DATABASE_PATH?.trim();
const dbPath = configuredDbPath
  ? path.resolve(serverRoot, configuredDbPath)
  : path.join(serverRoot, "data", "wardrobe.sqlite");
const dataDir = path.dirname(dbPath);

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = new Database(dbPath);

db.pragma("foreign_keys = ON");

function runSqlFile(filePath) {
  const sql = fs.readFileSync(filePath, "utf-8");
  db.exec(sql);
}

export function initDatabase() {
  const schemaPath = path.join(__dirname, "schema.sql");
  const seedPath = path.join(__dirname, "seed.sql");

  runSqlFile(schemaPath);
  runSqlFile(seedPath);

  console.log("[DB] SQLite initialized:", dbPath);
}

export function getDb() {
  return db;
}
