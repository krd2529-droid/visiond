# Active patch: V-Learning Manuals Hub

- Event: PATCH_DELIVERED
- Outcome: เพิ่มเมนูคู่มือการใช้งานและหน้าคลังคู่มือสำหรับฟีเจอร์ VisionD
- Acceptance: เมนูอยู่ระหว่าง Vtools และบทความ; เปิดหน้าคลังได้ทั้งเดสก์ท็อปและมือถือ; คู่มือ VX และ V-Learning ดาวน์โหลดได้จริง; คู่มือสมัครสมาชิกและซื้อสินค้าดิจิทัลแสดงสถานะกำลังจัดทำ; ไม่กระทบเมนูบัญชีและรถเข็น
- Phase: delivered to production
- Files: public/shared-nav.js, public/index.html, public/guides.html, public/guides.css, public/manuals/*, tests, VERSION.txt, FEATURE-MAP.md
- Verification: focused regression, visible-version parity, syntax, desktop UI, mobile frontend audit, local download HTTP 200, production page and menu v0.20.50 pass
- Delivered: 069fcdf5 on origin/main; `/guides.html` verified on production
- Next: จัดทำคู่มือการสมัครสมาชิกและคู่มือการซื้อสินค้าดิจิทัล แล้วแทนสถานะเร็ว ๆ นี้ด้วยไฟล์ดาวน์โหลด
