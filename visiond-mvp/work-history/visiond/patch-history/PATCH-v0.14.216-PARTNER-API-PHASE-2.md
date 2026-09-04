# PATCH v0.14.216 — Partner API Phase 2 Customer and Sales Sync

- API ลูกค้า `POST /api/partner/v1/customers/sync` ใช้ Scope `customers:write`
- API ออเดอร์/ยอดขาย/ชำระเงิน/ยกเลิก/คืนเงิน `POST /api/partner/v1/orders/sync` ใช้ Scope `orders:write`
- External ID แยกต่อเว็บไซต์ และ Idempotency Key ป้องกันการเขียนซ้ำ
- ข้อมูลลูกค้าเข้ารหัส AES-GCM; ปฏิเสธ Password, Token เต็ม, ข้อมูลบัตร และข้อมูลธนาคาร
- หน้าเดียวในศูนย์ควบคุมเว็บพาร์ทเนอร์แสดงลูกค้า ออเดอร์ ยอดสุทธิ และยอดคืนเงิน
- Rollback ปลอดภัยด้วย `git revert` Commit ของแพตนี้
