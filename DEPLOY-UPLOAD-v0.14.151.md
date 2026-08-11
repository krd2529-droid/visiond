# วิธีลงแพต v0.14.151

แพตนี้ซิงก์งาน 149 และ 150 เข้า `visiond-mvp` ซึ่งเป็น Root directory ที่ Cloudflare ใช้งานจริง และยังไม่ลบโครงเว็บทั้งชุด

1. แตก ZIP แล้วนำของข้างในไปวางทับที่ Repository `visiond` เดิม
2. เปิด PowerShell ในโฟลเดอร์ Repository แล้วรัน `powershell -ExecutionPolicy Bypass -File .\APPLY-v0.14.151-CLEAN-DUPLICATE.ps1`
3. เปิด GitHub Desktop ตรวจว่ามี `visiond-mvp/VERSION.txt`, `visiond-mvp/public/index.html` เปลี่ยน และ `visiond-mvp/migrations/0029_veasy_conversation_isolation.sql` ถูกลบ
4. Commit ชื่อ `v0.14.151 sync active Cloudflare tree`
5. Push แล้วเปิดลิงก์ Pages ของ Deployment ใหม่ ต้องแสดง `WEB v0.14.151`

สคริปต์ลบเพียงไฟล์ Migration เก่าหนึ่งไฟล์ และจะยอมลบต่อเมื่อ SHA-256 เหมือนกับไฟล์ 0032 ที่เก็บไว้เท่านั้น
