# PATCH v0.14.403 — V12 Inbox Latest-Message Read Budget

## Scope

- แยก conversation list เป็น `/api/admin/v12-conversations`
- ใช้ latest-message ID subquery หนึ่งครั้งแล้ว join เพื่อคืน content และ message type
- คง index key `shop_id, conversation_id, created_at DESC`
- จำกัดผลลัพธ์ 200 บทสนทนาเท่าเดิม

## Query Budget

- เดิม: latest-message correlated lookup 2 ครั้งต่อบทสนทนา
- ใหม่: latest-message index probe 1 ครั้งต่อบทสนทนา
- ลด lookup ส่วนนี้ประมาณ 50% โดย response contract เดิม

## ไม่เปลี่ยน

- Thread detail และประวัติสูงสุด 300 ข้อความ
- Webhook, AI reply, handoff และ global bot toggle
- UI และ theme

## Delivery

- Commit เท่านั้น
- ไม่ Push และไม่ Deploy

EVENT CASE: ยังไม่เสร็จ — ต้องแพตต่อ
