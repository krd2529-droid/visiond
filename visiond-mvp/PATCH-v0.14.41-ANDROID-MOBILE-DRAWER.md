# VisionD v0.14.41 — Android Mobile Drawer

- แก้ฉาก Backdrop อยู่เหนือเมนูเพราะ stacking context ของ Header
- ยก Header/Drawer เหนือ Backdrop เฉพาะตอนเปิดเมนู
- ปิด CSS backdrop blur และ webkit backdrop blur บนมือถือ
- ใช้พื้นหลังโปร่งสีเข้มแทน ลดปัญหา GPU/compositing บน Android
- ป้องกันหน้า Landing จากโฆษณาดูเหมือนเว็บค้างหรืออ่านเมนูไม่ได้
