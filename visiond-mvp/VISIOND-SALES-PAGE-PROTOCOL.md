# VisionD Sales Page Protocol

1. Sales Page Center รองรับ `ad_shortcut` และ `seo_automation` โดยใช้ Template กลางและสินค้าจริงเท่านั้น
2. Ad Shortcut ต้องเป็น `noindex` เสมอและห้ามเข้า Sitemap แม้เผยแพร่แล้ว
3. SEO Automation เริ่มเป็นร่าง `noindex`; ต้องส่งตรวจและให้ Boss อนุมัติ Revision ปัจจุบันก่อนเผยแพร่และเปิด index
4. การแก้ชื่อ Slug Template เนื้อหา หรือสินค้าเชื่อมโยง ต้องสร้าง Revision ใหม่ คืนสถานะเป็น draft และถอน Approval เดิม
5. Slug ต้องไม่ซ้ำทั้งระบบ และระบบต้องไม่เปิดเผยสินค้าร่าง/ปิดขายในหน้าสาธารณะ
6. Admin จัดการร่างและส่งตรวจได้; เฉพาะ Boss อนุมัติ SEO ได้
7. ทุก frontend/action ที่เพิ่มภายหลังต้องอัปเดต Event Coverage, Mobile Preview, Button Standard, Roadmap และ Patch Ledger
8. Public Ad Shortcut เปิดได้เฉพาะหน้า `published` และต้องอ่านเฉพาะสินค้าที่ `published` ไม่ถูกลบ และเป็นสินค้าขายจริง
9. ราคาและโปรโมชั่นใน Public Renderer ต้องคำนวณจากระบบสินค้าปัจจุบัน ห้ามเก็บราคาซ้ำในเซลเพจ
10. ปุ่มซื้อของ Ad Shortcut ต้องใช้ตะกร้าและ Checkout กลางของ VisionD ห้ามสร้างออเดอร์คู่ขนาน
11. A/B Variant ที่เปิดใช้ต้องมีน้ำหนักรวม 100 และผู้ชมเดิมต้องได้ Variant เดิมต่อเนื่อง
12. UTM/Variant ต้องส่งเข้า Customer Intelligence เดิมและผูกถึง Purchase โดยไม่เก็บชื่อ อีเมล โทรศัพท์ หรือ IP ดิบเพิ่ม
