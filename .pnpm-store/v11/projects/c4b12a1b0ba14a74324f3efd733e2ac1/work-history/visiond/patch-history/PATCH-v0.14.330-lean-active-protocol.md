# PATCH v0.14.330 — Lean Active Patch Protocol

## เป้าหมาย

- เปลี่ยนกติกา Active จากไฟล์รวมกฎทุกระบบเป็นกฎถาวร 10 ข้อและ routing ตามระบบ
- กำหนดลำดับอำนาจเพื่อห้าม Roadmap, Marketing และ History ขยายขอบเขตคำสั่ง Boss
- เก็บ `work-history/visiond/protocols/JARVIS-PATCH-PROTOCOL.md` ฉบับละเอียดเดิมเป็น Reference สำหรับเปิดเฉพาะหัวข้อที่เกี่ยวข้อง

## ไม่รวมในแพตนี้

- ไม่ปรับโครง Roadmap
- ไม่สร้าง Automated Patch Gate
- ไม่แก้โค้ดธุรกิจ API ฐานข้อมูล หรือ Marketing Plan

## Rollback

- Parent/safe rollback: `482f69ecaf34e286f7a127bd681d8fc8744897f3`
- ใช้ `git revert` หลัง Commit และรันทดสอบเอกสาร/Regression ซ้ำ

`EVENT CASE: ยังไม่เสร็จ — ต้องแพตต่อ`

งานค้างตามแผนที่ Boss อนุมัติ: แยก Active Roadmap ออกจากประวัติ และสร้าง Automated Patch Gate เป็นแพตคนละรอบ
