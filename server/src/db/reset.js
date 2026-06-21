import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.resolve(__dirname, "../../data/wardrobe.sqlite");

if (fs.existsSync(dbPath)) {
  fs.unlinkSync(dbPath);
  console.log("[DB] Old database removed.");
}

const { initDatabase } = await import("./database.js");

initDatabase();

console.log("[DB] Reset completed.");
process.exit(0);