# PATCH v0.14.235 — AD SHORTCUT PUBLIC RENDERER

- เปิด Public Ad Shortcut ที่ `/s/{slug}` เฉพาะหน้าที่ published
- บังคับ noindex/nofollow ผ่าน Meta และ X-Robots-Tag
- แสดงเฉพาะสินค้าที่พร้อมขายและคำนวณโปรโมชั่นสดจากระบบหลัก
- หากสินค้าเชื่อมโยงปิดขาย/เป็นร่างทั้งหมด ตอบ 410 และไม่มีปุ่มซื้อ
- เพิ่มตะกร้าและซื้อทันทีผ่าน vd_cart และ /cart เดิม รองรับมือถือ
- Event Case ยังเหลือ UTM/Conversion/A-B, SEO Automation และ Dashboard
