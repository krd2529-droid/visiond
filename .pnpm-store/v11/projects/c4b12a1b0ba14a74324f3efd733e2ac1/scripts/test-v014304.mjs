import fs from "node:fs";

const root = new URL("../", import.meta.url);
const read = (file) => fs.readFileSync(new URL(file, root), "utf8");
const exists = (file) => fs.existsSync(new URL(file, root));
const featureMap = read("FEATURE-MAP.md");

const features = [
  ["AUTH-ACCOUNT-001", ["public/member-auth.js", "functions/api/auth/login.js"], ["users.password_hash", "sessions.expires_at"]],
  ["CATALOG-STOREFRONT-001", ["public/catalog-sync.js", "functions/api/products/index.js"], ["products.preview_urls", "GET /api/products"]],
  ["COMMERCE-ORDER-001", ["public/cart.js", "functions/api/orders/index.js"], ["order_items.product_id", "POST /api/orders/:id/slip"]],
  ["DELIVERY-DOWNLOAD-001", ["public/product.js", "functions/api/downloads/product/[id].js", "functions/api/downloads/file/[id].js"], ["entitlements.active", "product_files.object_key"]],
  ["MEMBER-HUB-001", ["public/member-dashboard.js", "functions/api/notifications.js"], ["notification_reads", "auth.user.id"]],
];

const requiredFields = ["สถานะ", "หน้า", "ไฟล์", "ฟังก์ชัน/ตัวควบคุม", "ปุ่ม/interaction", "API", "ฐานข้อมูล / ตาราง / ฟิลด์", "Input", "Output", "Reads", "Writes", "สิทธิ์", "ห้ามกระทบ", "การทดสอบ"];
const failures = [];

if (read("VERSION.txt").trim() !== "v0.14.304") failures.push("VERSION ต้องเป็น v0.14.304");
for (const [id, files, evidence] of features) {
  const section = featureMap.split(`## ${id}`)[1]?.split("\n## ")[0] || "";
  if (!section) failures.push(`ไม่พบ ${id} ใน Feature Map`);
  for (const field of requiredFields) if (!section.includes(`- ${field}:`)) failures.push(`${id} ขาดฟิลด์ ${field}`);
  for (const file of files) if (!exists(file)) failures.push(`${id} อ้างไฟล์ที่ไม่มีจริง: ${file}`);
  for (const token of evidence) if (!section.includes(token)) failures.push(`${id} ขาดหลักฐาน ${token}`);
  const markerFiles = files.filter((file) => !file.includes("[id]"));
  if (!markerFiles.some((file) => read(file).includes(id))) failures.push(`${id} ไม่มี marker ใน controller/backend หลัก`);
}

if (failures.length) {
  failures.forEach((message) => console.error(`FAIL: ${message}`));
  process.exit(1);
}
console.log("PASS v0.14.304 storefront/member feature-map retrofit");
