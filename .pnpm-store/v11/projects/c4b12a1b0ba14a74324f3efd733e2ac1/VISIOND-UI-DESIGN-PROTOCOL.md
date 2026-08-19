# VisionD UI Design Contract Protocol

โปรโตคอลนี้ใช้เฉพาะแพตที่เพิ่มหรือแก้ Frontend/UI เพื่อป้องกันธีม ปุ่ม และ interaction แตกออกจากระบบเดิม โดยไม่ขยายขอบเขตงานธุรกิจ

## Canonical Sources

- ปุ่ม: `public/visiond-button-system.css` และ `public/visiond-button-system.js`
- interaction ของปุ่ม/ลิงก์ disabled: `public/visiond-design-system.js`
- token และพื้นฐาน UI: `public/visiond-design-system.css`
- หน้าและ component เดิมของระบบที่กำลังแตะ เป็นหลักฐาน layout ก่อนแก้

## Button Contract

1. ปุ่มหรือ action ใหม่ต้องใช้ `.vds-btn` และเลือก variant เดิมเพียงชนิดที่ตรงความหมาย: `.vds-btn--primary`, `.vds-btn--secondary`, `.vds-btn--tonal`, `.vds-btn--text`, `.vds-btn--promotion`, `.vds-btn--danger` หรือ `.vds-btn--unstyled`
2. ใช้ size modifier เดิม `small`, `large`, `wide`, `wide-mobile` หรือ `icon` เท่าที่จำเป็น ห้ามสร้างระบบขนาดใหม่เฉพาะหน้า
3. Legacy class เช่น `.primary` และ `.secondary-button` ใช้ได้เฉพาะหน้าที่ canonical adapter รองรับอยู่แล้ว ฟีเจอร์ใหม่ให้ใช้ `vds-btn` โดยตรง
4. ห้ามกำหนดสี พื้นหลัง border radius, shadow, font หรือ animation ของปุ่มใหม่ใน CSS เฉพาะหน้า
5. หาก variant เดิมไม่รองรับความหมาย ต้องหยุดและแจ้ง Boss ก่อนเพิ่ม token, variant หรือ component ใหม่

## Interaction Contract

- ต้องมีสถานะ default, hover, active, `focus-visible`, disabled และ loading ตามบริบท
- ปุ่ม async ต้องป้องกันการกดซ้ำระหว่างทำงาน คืนสถานะเมื่อ error และแสดงผลสำเร็จ/ล้มเหลวที่ผู้ใช้รับรู้ได้
- ปุ่มที่ไม่ submit form ต้องระบุ `type="button"`; ปุ่ม submit ต้องมีเจ้าของ form ชัดเจน
- ลิงก์ที่ทำหน้าที่เป็นปุ่ม disabled ต้องใช้ `aria-disabled="true"` และกลไก canonical ที่บล็อก click/keyboard
- hit target บนมือถือไม่น้อยกว่า 44px และต้องตรวจ keyboard, reduced motion และ forced colors เมื่อเกี่ยวข้อง

## Layout And Theme Contract

- ใช้สี ตัวอักษร spacing, radius และ component จากระบบเดิมก่อน ห้ามสร้าง theme ย่อยเพราะสะดวกเฉพาะฟีเจอร์
- ตรวจ Desktop และ Mobile ของหน้าที่แตะ รวม overflow, wrapping, focus order และข้อความไทยยาว
- ห้ามแก้ global selector เพื่อแก้ปัญหาหน้าเดียว หากจำเป็นต้องแก้ global ต้องประกาศผลกระทบและมี regression ครอบคลุม

## Before Editing

Codex ต้องระบุ canonical source, component/variant ที่จะใช้ และไฟล์ UI ที่คาดว่าจะแก้ หากต้องสร้าง component ใหม่ให้หยุดแจ้ง Boss ก่อน

## Acceptance Evidence

- focused test ยืนยัน class/variant และห้าม style ปุ่มเฉพาะหน้าที่เพิ่มใหม่
- ตรวจ loading, success, error, disabled และ keyboard ตาม interaction ที่มี
- ตรวจ Desktop/Mobile ในสัดส่วนความเสี่ยงของแพต
- รัน `npm run patch:gate` ก่อน Commit

โปรโตคอลนี้รักษารูปลักษณ์และ interaction เท่านั้น ไม่อนุญาตให้เปลี่ยนพฤติกรรมธุรกิจ API หรือ Database
