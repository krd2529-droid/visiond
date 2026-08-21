# PATCH v0.14.405 — V12 Thread Message Pagination

## Scope

- เปิดห้องโหลด 50 ข้อความล่าสุดแทนสูงสุด 300 ข้อความ
- เพิ่มปุ่มโหลดข้อความเก่าทีละ 50
- Cursor ต้องอยู่ใน shop และ conversation เดียวกัน
- ใช้ลำดับ `created_at DESC, id DESC` และดึง 51 แถวเพื่อตรวจ `has_more`
- ป้องกัน response ของห้องเดิมทับห้องใหม่

## Query Budget

- เปิดห้อง: จากสูงสุด 300 rows เหลือสูงสุด 51 rows สำหรับข้อความ
- อ่านเพิ่มเฉพาะเมื่อผู้ใช้กดโหลดข้อความเก่า
- Cursor request เพิ่ม point lookup 1 ครั้งก่อน bounded message range query

## ไม่เปลี่ยน

- Message retention และข้อมูลเดิมทั้งหมด
- Webhook, AI reply, handoff และ global bot toggle
- UI theme

## Delivery

- Commit เท่านั้น
- ไม่ Push และไม่ Deploy

EVENT CASE: ยังไม่เสร็จ — ต้องแพตต่อ
