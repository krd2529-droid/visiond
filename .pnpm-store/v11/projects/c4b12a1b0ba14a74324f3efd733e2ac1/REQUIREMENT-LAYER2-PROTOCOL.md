# ตัวกันงานหลุดชั้นที่ 2 — Cross-Patch Snapshot Recheck

- ชั้นที่ 1 ตรวจความครบของ Ledger ปัจจุบันและหลักฐานในแพต
- ชั้นที่ 2 อ่าน Snapshot ที่ล็อก hash จากแพตก่อน แล้วเปรียบเทียบกับ Ledger ปัจจุบัน
- ตรวจ Requirement ID ที่หาย, Snapshot ที่ถูกแก้ย้อนหลัง, ข้อความ Requirement ที่ถูกเปลี่ยนโดยไม่มีเหตุผล, งานที่เคย DONE แล้วถูกลดสถานะ และไฟล์หลักฐานที่หาย
- ก่อนส่งทุก ZIP ต้องรันทั้ง `requirements:check` และ `requirements:recheck`
- ก่อนปิด Event Case ต้องผ่านสองชั้น และยังต้องผ่าน `requirements:close`
- เมื่อแพตผ่านแล้วจึงสร้าง Snapshot ใหม่สำหรับให้แพตถัดไปย้อนตรวจ ห้ามแก้ Snapshot เก่า
