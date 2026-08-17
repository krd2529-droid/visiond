# VisionD Sales Page Protocol

- Ad Shortcut: noindex ถาวร ไม่เข้า Sitemap ใช้ยิงแอดและวัด Conversion
- SEO Automation: สร้างได้เฉพาะร่าง ต้องผ่าน Boss Approval ของ Revision ปัจจุบันก่อน index/publish
- ทุกการแก้เนื้อหา/Slug/สินค้า/Template ต้องสร้าง Revision และถอน Approval
- ใช้สินค้าจริงและสิทธิ์ Admin/Boss ตามหน้าที่ พร้อม Preview มือถือและ Event Coverage ทุกระยะ
- Public Ad เปิดเฉพาะ published + noindex และกรองสินค้าร่าง/ปิดขาย/ถูกลบออกเสมอ
- ราคา โปรโมชั่น ตะกร้า และ Checkout ต้องใช้ระบบกลาง VisionD ห้ามสำเนาราคาและห้ามสร้าง checkout แยก
# กฎ UTM, Conversion และ A/B

- หน้า Ad Shortcut ต้องรักษา UTM ตลอดเส้นทางตั้งแต่ Landing, Add to cart, Checkout จนถึง Purchase
- A/B ต้องแบ่งแบบคงที่ต่ออุปกรณ์ รองรับเฉพาะ Variant A/B และน้ำหนักที่เปิดใช้รวมกัน 100
- รายงานต้องผูก Conversion กลับมายัง Slug และ Variant เดิม แม้ผู้ใช้งานกำหนด `utm_campaign` เอง
- Event analytics ต้องไม่เพิ่มการเก็บ IP ดิบ Credential หรือข้อมูลส่วนตัวที่ไม่จำเป็น
