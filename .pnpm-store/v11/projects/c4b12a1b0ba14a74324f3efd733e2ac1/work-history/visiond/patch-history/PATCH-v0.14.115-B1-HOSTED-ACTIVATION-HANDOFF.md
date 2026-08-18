# v0.14.115 — B1 Hosted Activation Handoff

- หน้า APK ไม่ยิง Activation POST ข้าม origin จาก `file://` อีกต่อไป
- ข้อมูลที่ผู้ใช้กรอกถูกส่งชั่วคราวใน WebView memory ไปหน้า VisionD โดยไม่อยู่ใน URL หรือ persistent storage
- หน้า VisionD ตรวจบัญชี คีย์ ร้าน และอุปกรณ์ด้วย same-origin API แล้วส่ง Session กลับ APK
- คำขอและคำตอบผูกด้วย state สุ่ม; ข้อมูล handoff ถูกล้างทันทีหลังรับ
- ต้อง Deploy Web ZIP ก่อนติดตั้ง APK v1.0.14 และปิด Event Case หลังทดสอบ Redmi จริง
