# VisionD v0.14.113 / V Easy v1.0.12 — Activation Error Lock

- Mobile API health ผ่านบน Redmi แล้ว แต่ Activation POST ยังล้มเหลว
- Vision7 middleware ครอบ exception และคืน JSON ที่มี `VISION7_MOBILE_API_INTERNAL_ERROR` กับ `request_id` โดยคง CORS
- V Easy แสดง error code สำคัญแยกกัน และไม่ล้างรหัสผ่านหรือคีย์เมื่อเปิดใช้ไม่สำเร็จ
- ข้อมูลลับอยู่ในช่องกรอก/หน่วยความจำชั่วคราวเท่านั้น ไม่เขียนลง localStorage หรือ log
- Boss receives only Web ZIP + APK; Private Source remains internal.

Deploy Web v0.14.113 before installing V Easy v1.0.12.

EVENT CASE: ยังไม่เสร็จ — ต้องยืนยัน activation สำเร็จจริงบน Redmi
