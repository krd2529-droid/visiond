# Active patch: Online guide reading

- Event: PATCH_READY
- Outcome: คู่มือ VX และ V-Learning เปิดอ่านเป็น PDF บนเว็บได้ พร้อมเก็บปุ่มดาวน์โหลด Word เดิม
- Acceptance: การ์ดทั้งสองมีปุ่มอ่านออนไลน์; PDF เปิดแท็บใหม่; Word ยังดาวน์โหลดได้; PDF ทั้งสองไม่เสียและเรนเดอร์ครบ; ปุ่มไม่ล้นบนมือถือ
- Preserved: เนื้อหาคู่มือเดิม, ภาพจากระบบจริง, คู่มือที่กำลังจัดทำ และเมนูหน้าเว็บ
- Phase: implementation and verification complete; delivery in progress
- Files changed: public/guides.html, public/guides.css, public/manuals/*.pdf, version surfaces, focused regression tests
- Verification: PDF VX 12 หน้าและ V-Learning 11 หน้าเรนเดอร์ครบ; visual contact-sheet review PASS; guides, ฐ1 catalog, TikTok login และ D1 efficiency regressions PASS
- Deferred gate: การทดสอบ TikTok reviewer ด้วยบัญชีจริงยังรอ D1 reset และแยกจากแพตช์นี้
- Next action: inspect diff, commit and push only related files, then verify production URLs
