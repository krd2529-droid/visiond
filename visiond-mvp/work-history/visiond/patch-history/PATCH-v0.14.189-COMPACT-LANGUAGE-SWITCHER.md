# PATCH v0.14.189 — TH/EN แบบกระชับและกฎ Template ถาวร

- แก้ตัวสลับภาษาในเมนูมือถือจากแถวกว้างเต็มพื้นที่เป็น pill กว้างตามเนื้อหา
- ซ่อนเส้นคั่นซ้ำ ใช้ TH/EN เป็นปุ่มแตะที่จัดกึ่งกลางและไม่ล้นจอ
- โหลด canonical CSS รุ่นใหม่ครบ 38 หน้า
- รวมปุ่มรถเข็นใน Header ให้เหลือหนึ่งปุ่ม และใช้ตัวนับกลางที่ dedupe สินค้า คิด quantity สิทธิ์ Vision 5 และจำกัด 30 ชิ้น
- เพิ่มกฎใน Protocol และ Roadmap ว่าทุก Event Case/คิว Roadmap รวมเว็บ 2 ต้องใช้ Template กลางและตรวจ desktop/Android/iPhone
- ไม่มีการ Push หรือ Deploy; ย้อนกลับด้วย `git revert SELF`
