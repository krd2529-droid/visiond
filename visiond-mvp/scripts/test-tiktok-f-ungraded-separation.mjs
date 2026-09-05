import assert from "node:assert/strict";
import fs from "node:fs";

const read = (file) => fs.readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
const provider = read("functions/_tiktok_analyzer.js"), endpoint = read("functions/api/admin/tiktok-analyzer/index.js"), client = read("public/tiktok-analyzer.js"), html = read("public/tiktok-analyzer.html");

assert.match(provider, /F หมายถึงสินค้าที่ผู้ใช้กดคัดออกหรือกดไม่ผ่านจากลิสต์เท่านั้น/);
assert.match(provider, /ยอดขาย 0 ในช่วงที่ตรวจให้ product_type เป็นสตริงว่างและเรียกว่า "ไม่มีเกรด"/);
assert.match(provider, /grade=orders=>period===3\?\(orders>0\?'C':''\):period===7\?\(orders>=7\?'A':orders>=4\?'B':orders>=1\?'C':''\):\(orders>=30\?'A':orders>=16\?'B':orders>=1\?'C':''\)/);
assert.doesNotMatch(endpoint, /score<40\?'F'/);
assert.match(endpoint, /rawType==='F'\|\|rawType===''\?'':productType/);
assert.match(endpoint, /product_type=CASE WHEN tiktok_channel_products\.inventory_status='discarded' THEN 'F' ELSE excluded\.product_type END/);
assert.match(endpoint, /SET product_type='F',inventory_status='discarded'/);
assert.match(client, /sold >= 30 \? "A" : sold >= 16 \? "B" : sold >= 1 \? "C" : ""/);
assert.match(client, /gradeLabel = \/\^\[A-F\]\$\/\.test\(grade\) \? grade : "ไม่มีเกรด"/);
assert.match(client, /F = สินค้าที่กดคัดออกหรือกดไม่ผ่านแล้ว · ไม่มีเกรด = ยอดขาย 0 หรือข้อมูลยังไม่พอ/);
assert.match(client, /badge\.textContent = grade2 \|\| "ไม่มีเกรด"/);
assert.match(html, /tiktok-analyzer\.js\?v=02081/);

console.log("TikTok F versus ungraded separation regression: PASS");
