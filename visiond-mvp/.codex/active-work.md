# Active patch: Authoritative Showcase matching

- Event: PATCH_STARTED
- Event: PATCH_STARTED
- Outcome: จับคู่สินค้าวิเคราะห์กับ Showcase จาก Product ID ก่อนและชื่อแบบยืดหยุ่น; รายการที่ยังยืนยันคู่ไม่ได้ห้ามปนในตารางหรือจำนวน Showcase
- Preserve: เกรด/คะแนนของสินค้าที่จับคู่ได้; รายการวิเคราะห์เดิมในคลัง; โหลด Showcase ตามจำนวนที่ผู้ใช้กำหนด
- Acceptance: Product ID exact match ชนะชื่อ; ชื่อที่ต่างเพียงช่องว่างหรือส่วนต่อท้ายจับคู่ได้; ตัวเลขรุ่นขัดกันไม่จับคู่; จำนวนบนตารางเท่ากับสินค้า Showcase จริง; unmatched inventory ไม่แสดงในตาราง Showcase
- Event: PATCH_READY
- Phase: matching and authoritative Showcase display implemented; focused and predeploy tests passed; pending commit, push, and production verification of asset 02092
- Files: public/tiktok-analyzer.js, public/tiktok-analyzer.html, scripts/test-v014600.mjs
