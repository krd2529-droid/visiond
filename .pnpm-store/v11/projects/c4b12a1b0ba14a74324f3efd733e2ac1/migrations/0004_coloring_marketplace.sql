UPDATE products SET price = price * 100 WHERE price > 0 AND price < 1000;
INSERT OR IGNORE INTO products(slug,title,short_description,description,price,cover_url,category,status) VALUES
('coloring-dinosaur-50','ชุดระบายสีไดโนเสาร์ 50 แบบ','ไดโนเสาร์หลากหลายสายพันธุ์ เส้นคมชัด พิมพ์ง่าย ขนาด A4','รวมภาพไดโนเสาร์ 50 แบบ จัดหน้า PDF ขนาด A4 พร้อมพิมพ์',19900,'/assets/coloring-dinosaur.svg','dinosaur','published'),
('coloring-cute-animals-40','ชุดระบายสีสัตว์น่ารัก 40 แบบ','สัตว์ป่าและสัตว์เลี้ยงลายเส้นน่ารัก','ภาพสัตว์น่ารัก 40 แบบ จัดหน้า PDF ขนาด A4 พร้อมพิมพ์',15900,'/assets/coloring-animals.svg','animal','published'),
('coloring-vehicles-35','ชุดระบายสียานพาหนะ 35 แบบ','รถยนต์ รถก่อสร้าง เครื่องบิน และยานพาหนะในฝัน','รวมยานพาหนะ 35 แบบ จัดหน้า PDF ขนาด A4',14900,'/assets/coloring-vehicles.svg','vehicle','published'),
('coloring-princess-30','ชุดระบายสีเจ้าหญิงแฟนตาซี 30 แบบ','ปราสาท ชุดเจ้าหญิง และโลกแฟนตาซี','ภาพเจ้าหญิงแฟนตาซี 30 แบบ จัดหน้า PDF ขนาด A4',14900,'/assets/coloring-princess.svg','fantasy','published'),
('coloring-mandala-60','แมนดาลาผ่อนคลาย 60 แบบ','ลายละเอียดหลายระดับสำหรับผู้ใหญ่','ลายแมนดาลา 60 แบบ สำหรับระบายสี ฝึกสมาธิ และผ่อนคลาย',21900,'/assets/coloring-mandala.svg','mandala','published'),
('coloring-starter-bundle-100','Coloring Starter Bundle 100 แบบ','รวมชุดยอดนิยมในแพ็กเดียว','ไดโนเสาร์ สัตว์ และยานพาหนะรวม 100 แบบ ไฟล์ PDF A4',29900,'/assets/coloring-bundle.svg','coloring','published');
