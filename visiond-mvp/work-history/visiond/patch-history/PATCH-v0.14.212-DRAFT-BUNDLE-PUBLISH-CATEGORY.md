# PATCH v0.14.212 — Draft Bundle Publish Category Recovery

- รักษาหมวดชุดรวมเดิมใน Editor เมื่อเปิดตะกร้าแบบร่างกลับมาแก้ไข
- รองรับหมวดชุดรวม `set-*` และโปรยกชุด `bundle-deals`
- Backend ยังตรวจรายการต้นทางและสถานะก่อนอนุญาตให้เผยแพร่
- Rollback ด้วย `git revert` Commit ของแพตนี้ โดย Boss เป็นผู้ Push/Deploy เท่านั้น
