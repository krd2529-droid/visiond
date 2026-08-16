# PATCH v0.14.205 — Continuous Frontend Button/Event Coverage

## เปลี่ยนอะไร

- เพิ่มกฎถาวรใน Protocol และ Roadmap ว่างาน Frontend ใหม่หรือที่แก้ทุกครั้งต้องขยาย Button/Event coverage ในแพตเดียวกัน
- บังคับตรวจ handler, state, keyboard, responsive และปุ่มซ้ำ/กดไม่ได้ พร้อม focused automated test
- ถ้า coverage ไม่ครบ ห้ามปิดแพตหรือ Event Case และต้องวนลูปมาตรฐานต่อ

## Rollback

ใช้ `git revert SELF` หลังแทน SELF ด้วย Commit ID ของแพตนี้ ห้าม Push/Deploy อัตโนมัติ
