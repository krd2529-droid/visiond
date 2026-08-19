# VisionD Active Patch Protocol

ไฟล์นี้เป็นกติกา Active สำหรับทุกแพต อ่านฉบับเดียวก่อนเริ่มงาน แล้วโหลดเอกสารเฉพาะระบบเมื่อจำเป็น ห้ามใช้ Roadmap, Marketing Plan หรือประวัติเก่าเพื่อขยายขอบเขตที่ Boss สั่ง

## ลำดับอำนาจ

เมื่อข้อมูลขัดกัน ให้ยึดตามลำดับนี้:

1. คำสั่ง Boss รอบปัจจุบัน
2. Patch Scope และ Acceptance Test ที่ Boss อนุมัติ
3. กฎถาวรด้านความปลอดภัย ข้อมูล เงิน และสิทธิ์
4. Feature Map และ API/Business Contract ของระบบที่แตะ
5. Active Roadmap ซึ่งเป็นคิวเท่านั้น
6. Patch History, Marketing Plan และเอกสารเก่า ซึ่งใช้เป็นหลักฐานอ้างอิงเท่านั้น

เอกสารลำดับต่ำกว่าห้ามเพิ่มงาน เปลี่ยนเป้าหมาย หรือสั่งเริ่มแพตถัดไปเอง

## ALWAYS — กฎถาวร 10 ข้อ

1. ตรวจโค้ด สถานะ Git และหลักฐานจริงก่อนสรุปหรือแก้ ห้ามเดาสาเหตุ เส้นทางข้อมูล หรือสถานะ Production
2. หนึ่งแพตมีเป้าหมายหลักหนึ่งเรื่องและหนึ่งระบบหลัก ทำเฉพาะขอบเขตที่ Boss อนุมัติ
3. ก่อนแก้ ให้แจ้งไฟล์และส่วนระบบที่คาดว่าจะต้องแตะ หากขอบเขตขยาย ให้หยุดแจ้ง Boss ก่อนเพิ่มงาน
4. รักษาพฤติกรรมเดิม สิทธิ์ ความปลอดภัย ข้อมูล และ API Contract ที่อยู่นอก Acceptance Test
5. งานที่ค้นพบระหว่างทำให้บันทึกเป็น `DISCOVERED` ห้ามดึงเข้าขอบเขตหรือเริ่มแพตถัดไปเอง
6. ใช้ลูป `ตรวจ → แก้ → ทดสอบ → แก้ข้อผิดพลาด → ทดสอบใหม่` โดยคงเลขแพตเดิมจนขอบเขตนั้นผ่าน
7. รัน focused test และ gate ที่เกี่ยวข้อง ตรวจ diff และผลกระทบข้างเคียงก่อน Commit
8. Commit เฉพาะไฟล์งานจริง ห้ามรวม `.pnpm-store`, Secret, Token, ข้อมูลส่วนตัว หรือไฟล์นอกขอบเขต
9. Boss ควบคุม Push และ Deploy เว้นแต่สั่งชัดเจน ใช้ `git revert` สำหรับ rollback และห้ามทำลายประวัติ
10. รายงานตามจริง: สิ่งที่แก้ ไฟล์ ผลทดสอบ Commit สิ่งที่ยังไม่เสร็จ และสถานะ Event Case ห้ามอ้างว่าเสร็จเมื่อหลักฐานไม่ครบ

## WHEN-TOUCHING — โหลดเฉพาะเมื่อแตะระบบ

- ฟีเจอร์เดิมหรือฟีเจอร์ใหม่: อ่านรายการที่เกี่ยวข้องใน `FEATURE-MAP.md`
- Requirement หลายข้อหรือ Event Case ต่อเนื่อง: อ่าน `PATCH-WORK-LEDGER-PROTOCOL.md`, `REQUIREMENT-LEDGER-PROTOCOL.md` และ ledger ปัจจุบันเท่าที่เกี่ยวข้อง
- Frontend/UI: อ่าน `VISIOND-UI-DESIGN-PROTOCOL.md`, ใช้ canonical component และตรวจ interaction, loading, success/error, keyboard, Desktop/Mobile และจอที่เกี่ยวข้อง
- Auth, เงิน, สิทธิ์,ข้อมูลลูกค้า หรือ API ภายนอก: ตรวจทั้งเส้นทางอนุญาตและปฏิเสธ พร้อมใช้ข้อมูลขั้นต่ำ
- กฎธุรกิจ Course, EP และ Paper Doll: อ่านรายการ Feature Map และ Contract/โค้ดปัจจุบันของฟีเจอร์นั้น
- กฎ Guest, First-order Gift, Course Plan และกฎ UI รุ่นเดิม: เปิดเฉพาะหัวข้อที่เกี่ยวข้องจาก `work-history/visiond/protocols/JARVIS-PATCH-PROTOCOL.md` และยืนยันกับ Feature Map/โค้ดปัจจุบันก่อนใช้
- Partner API/Web 2: อ่าน `VISIOND-PARTNER-API-PROTOCOL.md` และคู่มือ integration เฉพาะงานนั้น

การเปิดเอกสารเฉพาะระบบเป็นการรักษา Contract ไม่ใช่อำนาจขยาย Patch Scope

## REFERENCE — ไม่ต้องอ่านทุกแพต

- `VISIOND-ROADMAP.md`: คิวและสถานะ ไม่ใช่คำสั่งทำทั้งหมด
- `VISIOND-MARKETING-PLAN.md` และ Customer Data Analysis: อ่านเฉพาะงาน Marketing/Growth/Data ที่ Boss สั่ง
- `work-history/visiond/patch-history/`: ใช้ค้นต้นเหตุ การย้อนกลับ หรือ regression ที่เกี่ยวข้อง
- `work-history/visiond/protocols/JARVIS-PATCH-PROTOCOL.md`: ฉบับละเอียดเดิมสำหรับกฎเฉพาะระบบ

ห้ามอัปเดต Marketing Plan หรือสร้าง Roadmap ระยะใหม่เป็นงานประกอบอัตโนมัติของแพตโค้ด

## Definition of Done

แพตถือว่าเสร็จเมื่อ Acceptance Test ครบ, focused test และ regression/gate ที่เกี่ยวข้องผ่าน, diff ไม่มีงานนอกขอบเขต, Patch Ledger มีหลักฐาน และ Commit เฉพาะไฟล์งานจริงแล้ว

สถานะ `IMPLEMENTED`, `PUSHED`, `DEPLOYED` และ `PRODUCTION_VALIDATED` ต้องแยกจากกันเสมอ

รายงานต้องลงท้ายด้วยสถานะใดสถานะหนึ่ง:

- `EVENT CASE: เสร็จทั้งหมดแล้ว — พร้อมรับ Event Case ใหม่`
- `EVENT CASE: ยังไม่เสร็จ — ต้องแพตต่อ`

หากยังไม่เสร็จ ให้ระบุรายการค้างและ blocker จริง แต่ห้ามเริ่มงานถัดไปเอง
