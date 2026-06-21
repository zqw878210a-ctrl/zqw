INSERT OR IGNORE INTO color_palette
  (color_key, color_name, hex, sort_order)
VALUES
  ('cream', '米白色', '#E9E3D3', 1),
  ('red', '正红色', '#D93A3A', 2),
  ('burgundy', '酒红色', '#A82028', 3),
  ('dark_green', '深绿色', '#214F28', 4),

  ('purple', '紫色', '#5A2C83', 5),
  ('blue', '蓝色', '#3568B7', 6),
  ('olive', '橄榄绿', '#687832', 7),
  ('teal', '青绿色', '#2D7B73', 8),

  ('navy', '藏蓝色', '#1E2A68', 9),
  ('brown', '棕色', '#6A421D', 10),
  ('taupe', '灰棕色', '#8A6F5F', 11),
  ('gray', '灰色', '#8A8D8C', 12);

INSERT OR IGNORE INTO preset_products
  (name, image_url, color_key, price_cents, sort_order)
VALUES
  ('基础白色 T 恤', '/assets/preset/white-tshirt.png', 'cream', 9900, 1),
  ('酒红色针织衫', '/assets/preset/burgundy-knit.png', 'burgundy', 19900, 2),
  ('黑色直筒裤', '/assets/preset/black-trousers.png', 'gray', 19900, 3),
  ('藏蓝牛仔衬衫', '/assets/preset/navy-denim-shirt.png', 'navy', 24900, 4),
  ('米色开衫', '/assets/preset/cream-cardigan.png', 'cream', 29900, 5);