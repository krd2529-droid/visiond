# PATCH v0.14.402 — V12 Adaptive Inbox Polling

## Scope

- เปลี่ยนรายการแชต V12 จาก fixed polling ทุก 30 วินาทีเป็น adaptive polling
- ใช้งานหน้าใน 5 นาทีล่าสุด: ทุก 60 วินาที
- Idle เกิน 5 นาที: ทุก 5 นาที
- Hidden tab, กำลังค้นหา หรือ request เดิมยังไม่จบ: ไม่ยิงซ้ำ
- กลับมาเปิดแท็บจะเริ่มรอบเวลาใหม่โดยไม่ยิงซ้อนทันที

## ผลด้าน Query Budget

- เปิดใช้งานต่อเนื่อง: ลด request จาก 120 เหลือ 60 ครั้ง/ชั่วโมง (50%)
- เปิดค้างแบบ idle: ลด request จาก 120 เหลือ 12 ครั้ง/ชั่วโมง (90%)
- Hidden tab: 0 inbox polling request

## ไม่เปลี่ยน

- Webhook, AI reply, message history และ Facebook import
- Handoff รายบทสนทนาและ global bot toggle
- UI และ theme

## Delivery

- Commit เท่านั้น
- ไม่ Push และไม่ Deploy

EVENT CASE: ยังไม่เสร็จ — ต้องแพตต่อ
