# v0.14.59 Meta Ads API — Event Case Complete

Base: v0.14.58. แพตเสี่ยงสูงจำกัดหนึ่งระบบหลัก สามงานย่อย

- ดึง Insight รายวันแบบ read-only ที่ระดับ Ad พร้อม Campaign, Ad Set, Ad และ Creative
- ใช้ Bearer Secret จาก Cloudflare เท่านั้น จำกัดช่วง 93 วันและ pagination 20 หน้า
- upsert รายวันเพื่อให้ซิงก์ซ้ำไม่เพิ่มยอดซ้ำ และเก็บประวัติรอบซิงก์/ข้อผิดพลาด
- Ads Center รวมข้อมูล API กับข้อมูลกรอกมือเฉพาะรายการที่ API ยังไม่มี พร้อม CTR และ ROAS

Requirement Ledger ทั้ง Event Case `ELON Page + Vision 7` เป็น DONE-VERIFIED ครบ 20/20
