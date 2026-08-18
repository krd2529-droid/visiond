# PATCH v0.14.121 — B1 LINE Official Connection

เชื่อม LINE Official Account ผ่าน Messaging API ทางการ เจ้าของร้านกรอก Channel Secret และ Channel Access Token ใน V Easy แล้วส่งเข้ารหัสเก็บบน VisionD เท่านั้น ไม่มี Secret/Token ฝังหรือบันทึกใน APK

ระบบสร้าง Webhook URL สุ่มเฉพาะร้าน ทดสอบ Token กับ LINE Bot Info ตรวจ `X-Line-Signature` จาก raw request body แบบ constant-time และกัน `webhookEventId` ซ้ำ เหตุการณ์ที่ลายเซ็นผิดถูกปฏิเสธและบันทึกเพียง metadata

ก่อนใช้งาน production ต้องตั้ง Cloudflare Secret `VISIOND_CHANNEL_ENCRYPTION_KEY` อย่างน้อย 32 ตัวอักษร แล้วนำ URL ไปวาง LINE Developers → Messaging API → Webhook URL → Verify → เปิด Use webhook

EVENT CASE: ยังไม่เสร็จ — เหลือรับข้อความเข้า Inbox, queue ตอบกลับ, บอทนักขาย, handoff เจ้าของร้าน และทดสอบบัญชี LINE จริง
