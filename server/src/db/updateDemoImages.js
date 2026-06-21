import { getDb, initDatabase } from "./database.js";

const demoImages = [
  ["blue shirt", "/assets/items/blue-shirt.png"],
  ["burgundy knit", "/assets/items/burgundy-knit.png"],
  ["navy jacket", "/assets/items/navy-jacket.png"],
  ["wool coat", "/assets/items/wool-coat.png"],
  ["olive sweater", "/assets/items/olive-sweater.png"]
];

initDatabase();

const db = getDb();
const updateImage = db.prepare(
  `
  UPDATE wardrobe_items
  SET image_url = ?
  WHERE name = ?
    AND deleted_at IS NULL
  `
);

let totalUpdated = 0;

for (const [name, imageUrl] of demoImages) {
  const result = updateImage.run(imageUrl, name);
  totalUpdated += result.changes;
  console.log(`${name}: updated ${result.changes}`);
}

console.log(`Total updated: ${totalUpdated}`);
