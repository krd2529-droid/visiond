# VisionD Pre-deploy Check

รัน `npm run predeploy:check` ก่อนนำแต่ละแพตช์ขึ้น Production ผลตรวจแบ่งเป็น `PASS`, `WARN`, `FAIL`; เฉพาะ `FAIL` ทำให้คำสั่งจบด้วย exit code 1

ตัวตรวจครอบคลุม Cloudflare bindings `DB`/`FILES`, D1 ID และ placeholder, ลำดับ migration, relative imports ของ Functions, HTML assets, cache version และ `id` ซ้ำ สคริปต์ไม่อ่าน environment variables หรือ Secret และไม่แสดงค่าจริง

OpenAI/Gemini, Resend, EasySlip และ Turnstile เป็นบริการเสริม จึงไม่ถูกนับเป็น `FAIL` เพียงเพราะยังไม่เปิดใช้ แต่ต้องตั้ง Secret ของฟีเจอร์นั้นก่อนเปิดใช้งานจริง

ก่อน Deploy ให้แทน `REPLACE_WITH_D1_DATABASE_ID` และค่าตัวอย่างทั้งหมด ใช้ Cloudflare Secret สำหรับ API keys เท่านั้น สำรอง D1 ก่อน migration แล้วรัน Pre-deploy Check, Regression Tests และ Wrangler Functions Build ตามลำดับ
