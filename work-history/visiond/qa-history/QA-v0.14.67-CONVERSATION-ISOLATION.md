# QA v0.14.67 — Conversation Isolation

- ตรวจ Shop/Conversation composite ownership
- ตรวจ Participant unique ภายในร้าน ไม่ unique ข้ามร้าน
- ตรวจ Participant identifier เก็บเป็น hash และไม่คืนจาก API
- ตรวจ Register Conversation ต้องถือ Runtime Lease
- ตรวจ Conversation identity conflict
- ตรวจ Acquire Conversation Lease ต้องพบ Conversation ในร้านก่อน
- ตรวจ Message/Order Claim ยังต้องผ่าน Conversation Lease
- ตรวจ Requirement เดิมยังเป็น DONE-VERIFIED ทั้งหมด

## ผลตรวจจริงก่อนแพ็ก

- Patch Test v0.14.67: ผ่าน `11/11`
- Regression: ผ่าน `32/32`
- Patch Coverage: `6/6`, pending `0`, missing `0`, uncertain `0`
- Source-to-Ledger: `27/27`, missing `0`
- Requirement Coverage: verified `27/27`, pending `0`, missing `0`, uncertain `0`
- Requirement Layer 2: snapshots `9`, verified `27/27`, missing `0`, uncertain `0`
- JavaScript Syntax: ผ่านทั้งหมด
- Predeploy: PASS `8`, WARN `8`, FAIL `0`
