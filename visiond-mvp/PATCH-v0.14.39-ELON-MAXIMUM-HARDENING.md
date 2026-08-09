# VisionD v0.14.39 — ELON Maximum Hardening

- Guest ไม่สามารถถาม ELON ได้และไม่เรียก AI provider
- Guest ไม่แตะฐานข้อมูล session หรือประวัติสนทนา
- Guest ได้รับข้อความตายตัวให้สมัครสมาชิกหรือเข้าสู่ระบบก่อน
- เพิ่มโควตา member รายวันและเพดาน provider รวมรายวัน
- เพิ่ม circuit breaker ก่อนเรียก AI provider
- ไม่เชื่อถือชื่อหน้าจาก client; map ชื่อจาก allowlist ฝั่ง server
- ใช้ API key เฉพาะ ELON และปิด shared-key fallback โดยค่าเริ่มต้น
- คง ownership guard, output filter, secret/PII/link blacklist และ retention 60 วัน
- เพิ่ม regression tests สำหรับ dedicated credential, guest gate และ page-title injection

หลัง deploy ต้องตั้ง `ELON_OPENAI_API_KEY` หรือ `ELON_GEMINI_API_KEY` ใหม่ มิฉะนั้น ELON จะ fail closed และไม่เรียก AI
