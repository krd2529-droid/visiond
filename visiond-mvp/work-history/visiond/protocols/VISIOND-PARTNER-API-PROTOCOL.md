# VisionD Partner API Protocol

ต้นฉบับใช้งานอยู่ที่ `VISIOND-PARTNER-API-PROTOCOL.md`

- เว็บ 2 แยกฐานสมาชิกและออเดอร์จาก VisionD
- งานเว็บ 2 ทุกระยะรวมอยู่ที่ปุ่ม `ศูนย์ควบคุมเว็บพาร์ทเนอร์` จุดเดียว
- เชื่อมผ่าน Versioned API/Signed Event เท่านั้น
- Credential ต่อเว็บไซต์เข้ารหัส แสดงครั้งเดียว เพิกถอนได้ และใช้ Least Privilege Scope
- Phase 1 เปิดเฉพาะ `products:read` และ Metadata สินค้าที่เผยแพร่แล้ว
