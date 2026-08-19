import fs from "node:fs";

const read = (path) => fs.readFileSync(path, "utf8");
const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const version = read("VERSION.txt").trim();
const indexHtml = read("public/index.html");
const adminHtml = read("public/admin.html");
const adminJs = read("public/admin.js");
const featureMap = read("FEATURE-MAP.md");
const productsIndex = read("functions/api/admin/products/index.js");
const productItem = read("functions/api/admin/products/[id].js");
const bulkCategory = read("functions/api/admin/products/bulk-category.js");
const productUpload = read("functions/api/admin/product-upload/[id].js");
const productImages = read("functions/api/admin/product-images/[id].js");
const productFiles = read("functions/api/admin/product-files/[id].js");
const multipartInit = read("functions/api/admin/product-multipart/init.js");
const multipartPart = read("functions/api/admin/product-multipart/part.js");
const multipartComplete = read("functions/api/admin/product-multipart/complete.js");
const packageJson = JSON.parse(read("package.json"));

assert(version === "v0.14.325", "VERSION.txt ไม่ใช่ v0.14.325");
assert(indexHtml.includes("WEB v0.14.325"), "หน้าเว็บไม่แสดง v0.14.325");
assert(adminHtml.includes("ADMIN v0.14.325"), "หน้าหลังบ้านไม่แสดง v0.14.325");
assert(adminHtml.includes("admin.js?v=014325"), "cache key ของ admin.js ไม่ใช่ 014325");

for (const featureId of ["PROD-ADMIN-001", "PROD-FILE-001", "PROD-CATEGORY-MOVE-001"]) {
  assert(featureMap.includes(featureId), `FEATURE-MAP.md ไม่มี ${featureId}`);
  assert(adminJs.includes(featureId), `public/admin.js ไม่มีจุดอ้างอิง ${featureId}`);
}

for (const route of [
  "/api/admin/products",
  "/api/admin/products/bulk-category",
  "/api/admin/product-upload/",
  "/api/admin/product-images/",
]) {
  assert(adminJs.includes(route), `public/admin.js ไม่มีเส้นทาง ${route}`);
}

assert(productItem.includes("deleted_at"), "Soft Delete ไม่มี deleted_at");
assert(productItem.includes("deleted_prev_status"), "Soft Delete ไม่มี deleted_prev_status");
assert(/100\s*\*\s*1024\s*\*\s*1024/.test(productsIndex), "ขีดจำกัด PDF/ZIP 100 MB หายไป");
assert(/5\s*\*\s*1024\s*\*\s*1024/.test(productsIndex), "ขีดจำกัดรูป 5 MB หายไป");
assert(multipartInit.includes("1024 * 1024 * 1024"), "ขีดจำกัด Multipart 1 GB หายไป");
assert(bulkCategory.includes("product_slug_history"), "ย้ายหมวดไม่บันทึกประวัติ Slug");
assert(bulkCategory.includes("DB.batch"), "ย้ายหมวดไม่ใช้ DB.batch");
assert(bulkCategory.includes("requireAdmin"), "ย้ายหมวดไม่มีการตรวจสิทธิ์ Admin");

for (const [name, source] of [
  ["product-upload", productUpload],
  ["product-images", productImages],
  ["product-files", productFiles],
  ["multipart/init", multipartInit],
  ["multipart/part", multipartPart],
  ["multipart/complete", multipartComplete],
]) {
  assert(source.includes("PROD-FILE-001"), `${name} ไม่มีรหัส PROD-FILE-001`);
}

assert(
  packageJson.scripts?.["test:v014325"] === "node scripts/test-v014325.mjs",
  "package.json ไม่มีคำสั่ง test:v014325 ที่ถูกต้อง",
);

console.log("PASS v0.14.325 Feature Map ระบบจัดการสินค้าหลังบ้าน");
