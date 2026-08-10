# Deploy ELON Database Split

1. สร้าง Cloudflare D1 สองฐาน: `visiond-elon-web-db` และ `visiond-elon-v7-db`
2. ใส่ Database ID ลง Binding `ELON_WEB_DB` และ `ELON_V7_DB`
3. Apply `elon-web-migrations/0001_elon_web_isolated.sql` กับฐาน Web
4. Apply `elon-v7-migrations/0001_elon_v7_boundary.sql` กับฐาน V7
5. ดีพลอย v0.14.77 แล้วสร้างแชททดสอบหนึ่งรายการ ต้องได้ ID ขึ้นต้น `ew_`
6. ตรวจว่าฐานหลักไม่มีบทสนทนาใหม่เพิ่มในตาราง `elon_conversations`
7. เก็บตารางเก่าแบบ read-only ห้ามลบก่อน Event Case ย้ายข้อมูลและตรวจจำนวนครบ

หากยังไม่ได้สร้าง Binding ระบบ ELON Web จะหยุดพร้อม configuration error โดยไม่ fallback ไปฐานอื่น เพื่อป้องกันข้อมูลปนกัน
