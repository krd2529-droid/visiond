# Patch v0.14.165 — LINE Status Self-Heal

- ใช้ผล Verify ที่เข้ารหัสและบันทึกบนเซิร์ฟเวอร์เป็นแหล่งจริง
- ซ่อม `veasy_channels.line` เป็น connected อัตโนมัติเมื่อหน้าแชตโหลด
- ไม่ต้องกรอก Channel Secret หรือ Access Token ซ้ำ
- แก้หน้าตั้งค่าขึ้นพร้อมใช้แต่หน้าแชตยังแสดงคำเตือนสีเหลือง

Event Case รอ Deploy และตรวจว่าการ์ด LINE OA เปลี่ยนเป็นเชื่อมต่อแล้ว
