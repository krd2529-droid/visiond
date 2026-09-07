# Active patch: Online guide reading

- Event: PATCH_DELIVERED
- Outcome: คู่มือ VX และ V-Learning เปิดอ่านเป็น PDF บนเว็บได้ พร้อมเก็บปุ่มดาวน์โหลด Word เดิม
- Acceptance: การ์ดทั้งสองมีปุ่มอ่านออนไลน์; PDF เปิดแท็บใหม่; Word ยังดาวน์โหลดได้; PDF ทั้งสองไม่เสียและเรนเดอร์ครบ; ปุ่มไม่ล้นบนมือถือ
- Preserved: เนื้อหาคู่มือเดิม, ภาพจากระบบจริง, คู่มือที่กำลังจัดทำ และเมนูหน้าเว็บ
- Phase: deployed and production verified
- Files changed: public/guides.html, public/guides.css, public/manuals/*.pdf, version surfaces, focused regression tests
- Verification: PDF VX 12 หน้าและ V-Learning 11 หน้าเรนเดอร์ครบ; visual contact-sheet review PASS; guides, ฐ1 catalog, TikTok login และ D1 efficiency regressions PASS; production `/guides` แสดง WEB v0.20.56 และปุ่มอ่านออนไลน์ 2 ปุ่ม; PDF production ทั้งสองไฟล์ตอบ 200 `application/pdf`
- Deferred gate: การทดสอบ TikTok reviewer ด้วยบัญชีจริงยังรอ D1 reset และแยกจากแพตช์นี้
- Delivery: commit 951e757e pushed to origin/main and deployed to production
- Next action: หลัง D1 reset ค่อยกลับไปตรวจ TikTok reviewer ด้วยบัญชีจริงก่อนส่งตรวจใหม่
