# VisionD Repository Instructions

## Single Live Workboard

- The current task must have one source of truth at `.agents/WORKBOARD.md`. Jarvis keeps the latest request, acceptance criteria, status, evidence, blockers, and next action synchronized with the user's instructions.
- Jarvis, Elon, and Mark must read the same workboard and operate on the same shared worktree. Do not distribute copied requirement documents or create parallel briefs that can drift apart.
- Each agent must re-read `WORKBOARD.md` before starting, before editing, and before a final verdict so that live user updates replace stale instructions.
- Use the permanent team first: Elon owns implementation and Mark owns reproduction and verification. Do not create temporary agents or separate investigation lanes automatically. Another agent is allowed only when the user explicitly requests one for the current task.
- When the user explicitly permits another agent, never send the full conversation with `fork_turns: all`. Send no inherited turns or at most three recent turns, plus the workboard path and shared evidence paths.
- Store large images, videos, logs, reports, and artifacts as shared files and pass their paths. Do not embed or duplicate large payloads in agent messages.
- Elon is the only code writer during an implementation phase. Mark reports independent findings to the workboard. If Mark is authorized to make a narrow UI correction, record the file boundary on the workboard first to avoid overlapping edits.
- Work is not complete until the workboard status and evidence match the latest real result.

## การส่งงาน

- ทุกงานเมื่อแก้เสร็จ ต้องทดสอบในสัดส่วนที่เหมาะสมกับความเสี่ยงของงาน
- เมื่อการทดสอบผ่าน ให้ commit เฉพาะไฟล์ที่เกี่ยวข้องกับงานปัจจุบัน แล้ว push ไปที่ `origin main` อัตโนมัติ
- ห้ามนำไฟล์หรือการเปลี่ยนแปลงของงานอื่นติดเข้า commit
- ก่อน push ให้ตรวจว่า branch ปัจจุบันและปลายทางถูกต้อง และต้องไม่เขียนทับประวัติด้วย force push
- หาก commit หรือ push ไม่สำเร็จ ให้แจ้งสาเหตุและสถานะไฟล์ที่ยังค้างอย่างชัดเจน ห้ามรายงานว่างานเสร็จหรือปล่อยให้ผู้ใช้เข้าใจว่างานขึ้น GitHub แล้ว
- ห้ามทิ้งงานที่เสร็จแล้วไว้เฉพาะในเครื่อง เว้นแต่ผู้ใช้สั่งชัดเจนว่าไม่ให้ commit หรือไม่ให้ push

## กฎ ฐ1 — D1 Smart Catalog

- ทุกงานที่แตะฐานข้อมูล, API, รายการข้อมูล, รูป หรือไฟล์ ต้องออกแบบให้เหมาะกับ `ฐ1` ตั้งแต่ต้น โดยลดจำนวน query และ rows read ไม่รอให้เกิดปัญหาโควตาก่อน
- ห้ามโหลดทั้งตารางเพื่อแสดงรายการ ให้กรองและแบ่งหน้าที่ SQL/API ด้วย keyset cursor; ค่าเริ่มต้นไม่เกิน 24 รายการต่อคำขอ เว้นแต่มีเหตุผลและชุดทดสอบรองรับ
- การค้นหา การกรอง และการเรียงข้อมูลจำนวนมากต้องทำฝั่ง server และมี index รองรับเงื่อนไขที่ใช้จริง ห้ามแก้ด้วยการโหลดทั้งหมดไปกรองใน browser
- โหลดรายละเอียดและข้อมูลหนักเมื่อผู้ใช้เปิดใช้งานเท่านั้น; งานที่ต้องใช้ข้อมูลครบให้มี endpoint/purpose เฉพาะและเรียกแบบ lazy load
- คำขอชนิดเดียวกันที่กำลังทำงานต้องรวมเป็นคำขอเดียว และข้อมูลเดิมควรมี TTL cache; กลับหน้าเดิมหรือสลับแท็บต้องไม่ดึงซ้ำโดยไม่มีเหตุผล
- หลังเพิ่ม แก้ ลบ ย้าย หรือกู้คืนข้อมูล ให้ invalidate เฉพาะ cache ที่เกี่ยวข้อง ห้ามล้างทุกอย่างโดยไม่จำเป็น
- งาน background/import/sync ต้องมี cursor, checkpoint หรือ idempotency key เพื่อจำว่างานใดทำแล้ว และห้ามประมวลผลข้อมูลเดิมซ้ำ
- รูปและไฟล์ต้องตรวจสิทธิ์หรือการอ้างอิงผ่านคอลัมน์/index ที่ค้นได้ ห้าม scan JSON หรือ scan ทั้งตารางต่อรูป
- response ของข้อมูลหลังบ้านต้องไม่ใช้ public cache และ cache ต้องแยกตามผู้ใช้ สิทธิ์ ตัวกรอง คำค้น และ cursor
- ก่อนส่งงานต้องทดสอบ pagination ว่าไม่ซ้ำ/ไม่ตกหล่น, request deduplication, cache invalidation และใช้ `EXPLAIN QUERY PLAN` หรือหลักฐานเทียบเท่าเพื่อยืนยันว่า query สำคัญใช้ index
- เมื่อผู้ใช้สั่งว่า `ใช้ ฐ1` ให้ถือว่ากฎทั้งหมดในหัวข้อนี้เป็น acceptance criteria ของงานนั้นทันที
