# PATCH v0.14.120 — Webhook Hub Foundation

สร้างศูนย์ออกลิงก์ Webhook กลางสำหรับ LINE, Facebook, EasySlip และ Provider ในอนาคต ลิงก์ใช้ public ID สุ่ม 192 บิต ไม่ใช้ชื่อหรือ slug ร้าน และแยกสิทธิ์ตามร้าน/ผู้ดูแล

ความสามารถรอบนี้: สร้าง คัดลอก พัก เปิดใหม่ หมุน URL ยกเลิก และดู metadata เหตุการณ์ หน้า UI รองรับมือถือและมีลิงก์กฎทางการ

ขอบเขตความจริง: รอบนี้ยังไม่รับหรือประมวลผลข้อความจริง และไม่รับ Secret/Token ลิงก์จะตอบ `WEBHOOK_PROVIDER_NOT_CONNECTED` จนกว่า Provider Adapter ที่ตรวจลายเซ็นจะติดตั้งในแพตถัดไป จึงไม่เสี่ยงรับ webhook ปลอมหรืออ้างว่าเชื่อมสำเร็จ

EVENT CASE: ยังไม่เสร็จ — เหลือ LINE Official Adapter, การเข้ารหัส Secret/Token, signature verification, queue/idempotency และการทดสอบรับ-ตอบข้อความจริง
