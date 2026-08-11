# v0.14.110 — B1 Three-output Delivery

ชุดอนุมัติประกอบด้วย VisionD Web v0.14.110, V Easy Source v1.0.9 และ signed APK v1.0.9 เท่านั้น ทั้งสามต้องผ่าน source cross-contract และ artifact gate ใน acceptance matrix ก่อนส่ง

กฎถาวร: งาน บ1 ห้ามส่งเฉพาะเว็บหรือเฉพาะ APK, APK ต้อง build ซ้ำได้จาก Source ZIP เดียวกัน, package ID คง `com.visiondonline.veasy`, APK เป็น generic buildไม่มี credential ลูกค้าฝัง และผลเครื่องจริงห้ามแทนด้วย static test

## ผลการพัฒนา

- มือถือ v1.0.9 รับคีย์จาก Settings, กันกดซ้ำ, แสดง/ซ่อนคีย์ และแปล error ตาม API
- Session token เข้ารหัส AES-GCM ด้วยกุญแจ non-extractable ใน IndexedDB; ไม่เก็บ password หรือคีย์เต็ม
- คีย์ V Easy ที่ยังไม่ผูกให้บัญชีคนถือคีย์ claim ตอนเปิดใช้ครั้งแรก จากนั้นล็อกบัญชีและร้านเดียว; ใส่ผิดให้ติดต่อ Boss รีคีย์
- API คงกฎเฉพาะ V Easy 1 คีย์ = 1 ร้าน พร้อม expiry/status/device/rate-limit และ audit
- สร้าง Web ZIP, Source ZIP และ APK signed v1/v2/v3 ครบ; static/regression 80/80 ผ่าน
- งานที่เหลือเพียง smoke test APK บน Redmi Note 14 Pro+ 5G จริงก่อนปิด Event Case
