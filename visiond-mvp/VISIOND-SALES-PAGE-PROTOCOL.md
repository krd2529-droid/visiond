# VisionD Sales Page Protocol

1. Sales Page Center รองรับ `ad_shortcut` และ `seo_automation` โดยใช้ Template กลางและสินค้าจริงเท่านั้น
2. Ad Shortcut ต้องเป็น `noindex` เสมอและห้ามเข้า Sitemap แม้เผยแพร่แล้ว
3. SEO Automation เริ่มเป็นร่าง `noindex`; ต้องส่งตรวจและให้ Boss อนุมัติ Revision ปัจจุบันก่อนเผยแพร่และเปิด index
4. การแก้ชื่อ Slug Template เนื้อหา หรือสินค้าเชื่อมโยง ต้องสร้าง Revision ใหม่ คืนสถานะเป็น draft และถอน Approval เดิม
5. Slug ต้องไม่ซ้ำทั้งระบบ และระบบต้องไม่เปิดเผยสินค้าร่าง/ปิดขายในหน้าสาธารณะ
6. Admin จัดการร่างและส่งตรวจได้; เฉพาะ Boss อนุมัติ SEO ได้
7. ทุก frontend/action ที่เพิ่มภายหลังต้องอัปเดต Event Coverage, Mobile Preview, Button Standard, Roadmap และ Patch Ledger
