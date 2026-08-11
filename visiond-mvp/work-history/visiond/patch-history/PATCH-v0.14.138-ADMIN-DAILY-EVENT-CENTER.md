# PATCH v0.14.138 — Admin Daily Event Center

วันที่: 2026-08-11

## ผลลัพธ์

- เพิ่มศูนย์ดูเหตุการณ์รายวันในหลังบ้าน พร้อมตัวกรองวันที่ ผู้ใช้ พื้นที่ และประเภท
- เพิ่มการบันทึกการกดปุ่ม/ลิงก์แบบ sanitized จาก analytics กลาง
- Admin/Boss เห็นผู้ใช้ เวลา หน้า และ action; ผู้เยี่ยมชมแสดงโดยไม่เปิดเผย fingerprint
- ไม่บันทึกค่าฟอร์ม รหัสผ่าน Token เลขบัญชี หรือ query string
- หน้าเหตุการณ์บนมือถือแสดงเป็นการ์ด ไม่ต้องใช้ scrollbar แนวนอน

## Acceptance

- `npm run test:v014138`
- `npm run predeploy:check`
- Production Event Case: PENDING จน deploy แล้วทดสอบ Member/Guest และตัวกรองวันจริง
