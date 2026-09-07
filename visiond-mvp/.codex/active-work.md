# Active patch: V-Learning Manuals Hub

- Event: PATCH_STARTED
- Outcome: เพิ่มเมนูคู่มือการใช้งานและหน้าคลังคู่มือสำหรับฟีเจอร์ VisionD
- Acceptance: เมนูอยู่ระหว่าง Vtools และบทความ; เปิดหน้าคลังได้ทั้งเดสก์ท็อปและมือถือ; คู่มือ VX และ V-Learning ดาวน์โหลดได้จริง; คู่มือสมัครสมาชิกและซื้อสินค้าดิจิทัลแสดงสถานะกำลังจัดทำ; ไม่กระทบเมนูบัญชีและรถเข็น
- Event: PATCH_READY
- Phase: implementation complete; delivery verification in progress
- Files: public/shared-nav.js, public/index.html, public/guides.html, public/guides.css, public/manuals/*, tests, VERSION.txt, FEATURE-MAP.md
- Verification: focused regression, syntax, desktop UI, mobile frontend audit, download HTTP 200 pass; visible-version gate fixed and pending rerun
- Next: rerun gates, inspect diff, commit selected files, push origin/main, verify production
