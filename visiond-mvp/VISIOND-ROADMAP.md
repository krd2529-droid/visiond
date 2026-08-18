# VisionD Roadmap — Living Plan

Updated: 2026-08-18
Current build: v0.14.250

## v0.14.250 — V12 Course Offer Attachment (IMPLEMENTED)
- เพิ่มปุ่มแนบรูปเปรียบเทียบแพ็กเกจคอร์สพร้อมบทขายสั้นใน AI ผู้ช่วย โดยใส่ลง Composer ให้คนตรวจก่อนส่ง
- บีบอัดรูปจาก 1.70 MB เหลือประมาณ 192 KB ต่ำกว่าขีดจำกัด V12 1 MB และไม่ส่งอัตโนมัติ

## v0.14.249 — V12 AI Sales Guaranteed Analysis (IMPLEMENTED)
- ถ้า AI Provider ไม่พร้อม โควตาเต็ม ตอบผิดรูปแบบ หรือ timeout ระบบใช้ตัววิเคราะห์สำรองจากประวัติแชตแทนการจบด้วยข้อผิดพลาด
- แสดงแหล่งวิเคราะห์ AI/ระบบสำรองและรหัสสาเหตุจริง พร้อม build 014249 ในแผงเพื่อยืนยัน cache production

## v0.14.248 — V12 AI Sales Assistant Production Recovery (IMPLEMENTED)
- แก้ production วิเคราะห์ไม่สำเร็จจากตาราง Lead Insight ที่ยังไม่ได้ apply โดย API ตรวจและสร้าง schema แบบ idempotent ก่อนใช้งาน
- แสดงรหัส HTTP/Provider/Network ที่เกิดขึ้นจริงแทนข้อความกว้าง เพื่อใช้หลักฐานแก้ครั้งต่อไปโดยไม่เดา

## v0.14.247 — V12 AI Sales Assistant (IMPLEMENTED)

- เพิ่ม AI วิเคราะห์ประวัติแชตรายลูกค้า แบ่งสถานะ ความสนใจ ข้อกังวล ขั้นตอนถัดไป และสร้างร่างข้อความขาย
- ปิดบังอีเมล เบอร์โทร ตัวเลขส่วนตัว รหัสผ่าน API key และ Token ก่อนส่งประวัติให้ AI
- AI ใช้เฉพาะสินค้าเผยแพร่จริงในฐานข้อมูล ห้ามแต่งราคา โปรโมชัน สต็อก ผลลัพธ์ หรือนโยบาย
- ระบบไม่ส่งข้อความอัตโนมัติ เจ้าหน้าที่ต้องกดนำร่างมาใส่ ตรวจข้อความ และกดส่งเอง

## v0.14.246 — Meta Domain Verification (IMPLEMENTED-AWAITING-DEPLOY)

- เพิ่มแท็ก `facebook-domain-verification` ที่ Meta ออกให้โดยตรงใน `<head>` ของหน้าแรก
- ใช้ยืนยันเจ้าของโดเมน `visiondonline.com` เพื่อดำเนินการตรวจสอบธุรกิจและสิทธิ์ Business Asset User Profile Access
- หลัง Push/Deploy ต้องตรวจ Source ของหน้าแรกว่ามีแท็ก แล้วจึงกดตรวจสอบยืนยันโดเมนใน Meta Business Settings

## v0.14.245 — V12 Profile Evidence and Truthful Result (IMPLEMENTED)

- ยืนยันจาก Production ว่า Frontend แสดงรูปได้ แต่ลูกค้า Facebook ส่วนใหญ่มี `profile_url` ว่าง และจำนวนรูปไม่เพิ่มหลังสั่งอัปเดต
- แก้ผลสำเร็จเทียมที่นับการอัปเดตชื่อเป็นการอัปเดตรูป พร้อมแยกจำนวนรูปใหม่ ชื่อใหม่ และรูปที่ดึงไม่ได้
- เก็บเฉพาะ HTTP status, Meta error code/subcode และเหตุผลแบบสรุปรวม โดยไม่ส่ง PSID, Token, App Secret หรือข้อมูลลูกค้ารายบุคคลออกหน้าเว็บ
- ประมวลผลโปรไฟล์เป็นชุดละ 5 รายเพื่อลดเวลาปุ่มค้าง และคืนปุ่มใน `finally` เมื่อ API ล้มเหลว
- หลัง Deploy ต้องกดตรวจอีกครั้งเพื่ออ่านเหตุผลจริงจาก Meta; ห้ามสรุปเรื่องสิทธิ์จนกว่าจะมีรหัสตอบกลับ

## Permanent Governance — Evidence-first / ห้ามเดางาน (ACTIVE)

- ทุก Event Case และ Event Roadmap ต้องตรวจหลักฐานจากโค้ด, Log ที่ปิดบังข้อมูล, API response, ฐานข้อมูลแบบลดข้อมูลส่วนตัว หรือผลทดสอบที่ทำซ้ำได้ก่อนแก้
- รายงานต้องแยกข้อเท็จจริงที่ยืนยันแล้ว สิ่งที่ยังไม่ทราบ และขั้นตอนตรวจถัดไป ห้ามเปลี่ยนสมมติฐานเป็นข้อสรุป
- หากยังพิสูจน์สาเหตุไม่ได้ งานต้องคงสถานะ `INVESTIGATING` หรือ `BLOCKED BY EVIDENCE` และห้าม Commit วิธีแก้เชิงเดา
- Patch Ledger ต้องมี Root-cause evidence, Fix evidence และ Test evidence ก่อนปิดงานเป็น `DONE-VERIFIED`
- Event Case รูปโปรไฟล์ Facebook V12 ยังไม่เสร็จ: รูปไม่แสดงได้รับการยืนยันจากหน้าจอ แต่สาเหตุจาก Meta response/สิทธิ์/การโหลดรูปยังต้องเก็บหลักฐานจริงก่อนแก้ต่อ

## v0.14.244 — V12 Settings Production Render Fix (IMPLEMENTED)

- ยกเลิกการ Fetch `/VERSION.txt` จาก Frontend ซึ่ง Production ตอบหน้า Index กลับมาแทนไฟล์เวอร์ชัน
- ป้องกัน HTML หน้าแรกถูกนำไปแสดงเป็นข้อความภายในหัวหน้าตั้งค่า
- กำหนดเลขแพตจากไฟล์หน้า Settings โดยตรงและคงการโหลด Credential ผ่าน API เดิม

## v0.14.243 — V12 Inbox Button Separation (IMPLEMENTED)

- ป้องกันแถวตัวกรอง แถวปุ่มอัปเดต และปุ่มนำเข้าแชตเก่าถูก Flex ย่อจนซ้อนกัน
- แยกพื้นที่ปุ่มจัดการเป็นแถวเต็มความกว้าง พร้อมระยะห่างมาตรฐาน
- ให้เฉพาะรายการบทสนทนายืดและเลื่อนภายในพื้นที่ที่เหลือ ทั้งคอมพิวเตอร์และมือถือ

## v0.14.242 — Facebook Profile Picture Fallback (IMPLEMENTED)

- ดึงชื่อและรูป Facebook จาก Messenger User Profile API ด้วย PSID
- หาก `profile_pic` ไม่ถูกส่งกลับ ให้ลอง Profile Picture endpoint แบบไม่ Redirect และไม่เก็บภาพ silhouette
- ใช้ตัวดึงรูปมาตรฐานเดียวกันกับแชทเก่า ปุ่มอัปเดตชื่อ/รูป และ Webhook แชทใหม่
- ไม่แก้ ไม่แสดง และไม่บันทึก Page Access Token หรือ App Secret เพิ่มเติม

## v0.14.241 — V12 Channel Settings and Chat Scroll (IMPLEMENTED)

- ย้ายการตั้งค่า Facebook Page/Webhook ไปหน้า `ตั้งค่าช่องทาง V12` แยกจากพื้นที่กล่องข้อความ
- แสดงสถานะ `บันทึกแล้ว` แยก Page Access Token และ Meta App Secret โดยไม่ส่งค่าจริงกลับ Frontend
- เก็บ Credential เดิมเมื่อช่องค่าลับว่าง และบันทึกใหม่เฉพาะค่าที่ผู้ดูแลต้องการเปลี่ยน
- จำกัดความสูงรายการบทสนทนาและข้อความ พร้อมแถบเลื่อนแยกทั้งคอมพิวเตอร์และมือถือ

## v0.14.223 — Web 2 Integration Starter Kit (IMPLEMENTED)

- เพิ่ม Backend Client SDK สำหรับอ่านสินค้า ซิงก์ลูกค้า/ออเดอร์ และส่ง Signed Event
- เพิ่ม Config Validator, Request ID, Idempotency Key และ Sensitive Payload Guard ก่อนส่งข้อมูล
- Credential เก็บใน Private State และ `.env.example` ใช้ Placeholder สำหรับ Secret Manager เท่านั้น
- Security Gate ครอบคลุม SDK, คู่มือ และตัวอย่างทั้งหมด พร้อมกฎห้ามนำ Credential เข้า Frontend

## v0.14.222 — Partner API Guide and Production Security Gate (IMPLEMENTED)

- เพิ่มคู่มือเชื่อมเว็บ 2 พร้อม Endpoint, Authentication, Signed Webhook, Checklist และ Rollback
- เพิ่มตัวอย่าง HTTP ที่ใช้ Placeholder เท่านั้นและเก็บ Credential จริงใน Secret Manager
- เพิ่ม Security Gate ตรวจ Credential รูปแบบจริง, Private Key, เลขบัตร และสัญญาการปิดบังข้อมูล
- แสดง Checklist ฉบับย่อภายในศูนย์ควบคุมเว็บพาร์ทเนอร์ และกำหนดให้ E2E ผ่านก่อน Production

## v0.14.221 — Partner API End-to-End Readiness (IMPLEMENTED)

- เพิ่มปุ่มทดสอบ E2E แยกแต่ละเว็บไซต์ภายในศูนย์ควบคุมเว็บพาร์ทเนอร์
- ตรวจสินค้า Read-only ผ่าน Credential จริง และจำลองวงจรลูกค้า ออเดอร์ ชำระเงิน ยกเลิก คืนเงินใน Sandbox
- ตรวจ Idempotency Replay/Conflict, Signed Webhook, Retry/Dead Letter และ Health Alert ในรายงานเดียว
- ผลทดสอบไม่เขียนลูกค้า/ออเดอร์ลง Production และไม่ส่ง Credential, Signature หรือข้อมูลส่วนตัวกลับ Frontend

## v0.14.220 — Paper Doll Digital Category (IMPLEMENTED)

- เปิดหมวดหลัก `paper-doll` ชื่อ “ตุ๊กตากระดาษ” ในสินค้าดิจิทัลและช่องเลือกหมวดหลังบ้าน
- หน้าร้านมีตัวกรองตุ๊กตากระดาษแยกจากแบบฝึกหัด พร้อมรองรับ URL `?category=paper-doll`
- กำหนดค่ามาตรฐานเป็น PDF, active และ sort order 27 ผ่าน Migration 0051 โดยไม่สร้างหมวดซ้ำ
- เพิ่มคำค้นให้ ELON และตรวจ label หน้ารายละเอียดสินค้าให้ใช้ชื่อเดียวกัน

## v0.14.219 — Partner API Phase 5 Health Dashboard (IMPLEMENTED)

- เพิ่ม Dashboard สุขภาพ API แยกแต่ละเว็บไซต์ในศูนย์ควบคุมเว็บพาร์ทเนอร์
- แสดง Event สำเร็จ Retry Dead Letter Error Rate Response Time เฉลี่ย/สูงสุด และ Event ล่าสุดในช่วง 24 ชั่วโมง
- บันทึกเวลา Process ของแต่ละ Event เป็นมิลลิวินาที และไม่รวม Payload/ข้อมูลส่วนตัวใน Metrics
- แจ้งเตือน Signature ผิด, Timestamp เกิน 5 นาที, Retry ค้างตั้งแต่ 3 Event และ Dead Letter ตั้งแต่ 1 Event
- Security failure ถูกบันทึกเป็น Log แบบปิดบัง โดยไม่เก็บ Signature, Raw Body, Credential หรือข้อมูลส่วนตัว
- Dashboard และ Alert รองรับมือถือและอยู่ในปุ่มศูนย์ควบคุมเว็บพาร์ทเนอร์เดิม

## v0.14.218 — Partner API Phase 4 Signed Webhook (IMPLEMENTED)

- เพิ่ม Signed Webhook รับ Event ลูกค้า ออเดอร์ ชำระเงิน ยกเลิก และคืนเงินจากเว็บ 2
- ตรวจ HMAC-SHA256 จาก Timestamp และ Raw Body แบบ constant-time พร้อมปฏิเสธ Timestamp เกิน 5 นาที
- ป้องกัน Replay ด้วย Signature Hash และ Idempotency Key แยกต่อเว็บไซต์ และใช้ External ID ตรวจทุก Event
- Payload ในคิวเข้ารหัส AES-GCM; ประมวลผลผ่าน API ซิงก์ระยะ 2 เดิมเพื่อใช้กฎข้อมูลชุดเดียว
- ล้มเหลวเข้าคิว Retry แบบ exponential backoff และย้าย Dead Letter เมื่อครบ 5 ครั้ง พร้อมปุ่มลองใหม่/ย้าย Dead Letter
- หน้า Queue และ Log อยู่ภายในศูนย์ควบคุมเว็บพาร์ทเนอร์ รองรับมือถือ และแสดงเฉพาะข้อมูลปิดบัง

## v0.14.217 — Partner API Phase 3 Sandbox (IMPLEMENTED)

- เพิ่ม Sandbox ภายในศูนย์ควบคุมเว็บพาร์ทเนอร์สำหรับจำลองลูกค้า ออเดอร์ ชำระเงิน ยกเลิก และคืนเงิน
- ตรวจ Scope, External ID และ Idempotency Key โดยไม่เขียนข้อมูลลงตารางลูกค้า/ออเดอร์ Production
- เก็บประวัติ Request/Response สูงสุด 50 รายการต่อการแสดงผล โดยปิดบัง Credential, External ID, Idempotency Key และข้อมูลส่วนตัว
- Key เดิมกับเหตุการณ์/External ID เดิมแสดง Idempotent Replay; Key เดิมกับข้อมูลต่างกันตอบ Conflict
- หน้า Sandbox รองรับมือถือและคงอยู่ในปุ่มศูนย์ควบคุมเว็บพาร์ทเนอร์จุดเดียว

## v0.14.216 — Partner API Phase 2 Customer and Sales Sync (IMPLEMENTED)

- เพิ่ม API ซิงก์ลูกค้าและออเดอร์จากเว็บ 2 ด้วย Scope แยก `customers:write` และ `orders:write`
- รองรับยอดขาย สถานะชำระเงิน การยกเลิก คืนเงิน และรายการสินค้า โดยเก็บจำนวนเงินเป็นสตางค์และสกุล THB
- ป้องกันข้อมูลซ้ำด้วย External ID ต่อเว็บไซต์และ `Idempotency-Key`; Key เดิมกับ Payload เดิมคืนผลเดิม ส่วน Payload ต่างกันถูกปฏิเสธ
- เข้ารหัสชื่อ อีเมล และโทรศัพท์แบบ AES-GCM และปฏิเสธ Password, Token เต็ม, ข้อมูลบัตร และข้อมูลธนาคารทุกระดับของ Payload
- แสดงลูกค้า ออเดอร์ ยอดสุทธิ และยอดคืนเงินภายใน `ศูนย์ควบคุมเว็บพาร์ทเนอร์` จุดเดียว

## v0.14.215 — Partner API Phase 1 Foundation (IMPLEMENTED)

- เพิ่ม Website Registry สำหรับเว็บ 2 และเว็บไซต์คู่ค้า โดย VisionD เปิด พัก หรือเพิกถอนการเชื่อมต่อได้
- ออก Client ID/Client Secret แยกต่อเว็บไซต์ Secret แสดงครั้งเดียว เก็บ AES-GCM พร้อม Hash และรองรับการหมุน Credential
- เพิ่ม Least Privilege Scope `products:read`, Request ID และ Audit Log โดยไม่เก็บ Secret/IP จริง
- เพิ่ม `GET /api/partner/v1/products` แบบ Read-only ส่งเฉพาะ Metadata สินค้า/โปรแกรมที่เผยแพร่แล้ว ไม่ส่งไฟล์ดาวน์โหลด ข้อมูลลูกค้า หรือข้อมูลชำระเงิน
- เพิ่มหน้าหลังบ้าน Partner API พร้อมกฎถาวรว่าเว็บ 2 แยกฐานข้อมูลและเชื่อม VisionD ผ่าน Versioned API/Signed Event เท่านั้น
- งานเว็บ 2 ระยะต่อไปทั้งหมดต้องต่อภายในปุ่ม `ศูนย์ควบคุมเว็บพาร์ทเนอร์` จุดเดียว

## v0.14.214 — Bulk Category Move Button Guidance (IMPLEMENTED)

- ปุ่มย้ายหมวดกดได้ตลอด ไม่ถูกปิดจนดูเหมือนเสีย
- ถ้ายังไม่เลือกตะกร้า ระบบเลื่อนไปช่องค้นหา โฟกัสให้ และแจ้งขั้นตอนติ๊กช่องหน้าตะกร้าอย่างชัดเจน
- ช่องติ๊กและแถบจำนวนเปลี่ยนข้อความให้ตรงกับงานย้ายหมวด พร้อมแสดงจำนวนบนปุ่มก่อนเปิด Dialog

## v0.14.213 — Bundle File Type Persistence (IMPLEMENTED)

- ชุดรวมและโปรยกชุดบันทึกประเภทไฟล์ตามที่ผู้ดูแลเลือกจริง ได้แก่ PDF, ZIP, JPG/PNG หรือชุดรวมหลายประเภท
- เมื่อกลับมาแก้ไขแบบร่างหรือสินค้าที่เผยแพร่แล้ว ช่องประเภทไฟล์โหลดค่าจากฐานข้อมูลเดิม ไม่ถูกเขียนทับเป็นค่าที่ไม่มีใน Dropdown
- Backend ตรวจ allowlist ประเภทไฟล์ทั้งการสร้างและแก้ไข ป้องกันค่าที่ไม่ได้รองรับ

## v0.14.212 — Draft Bundle Publish Category Recovery (IMPLEMENTED)

- เมื่อเปิดแก้ไขชุดรวมแบบร่าง ระบบรักษาหมวดชุดรวมเดิมไว้ใน Dropdown เสมอ แม้หมวดต้นทางถูกกรองหรือจำนวนตะกร้าพร้อมรวมเปลี่ยน
- ผู้ดูแลเปลี่ยนสถานะจากแบบร่างเป็นเปิดขายได้โดยไม่ทำหมวดเดิมหาย ส่วน Backend ยังคงตรวจตะกร้าต้นทางก่อนเผยแพร่จริง
- ครอบคลุมทั้งหมวด `set-*` และ `bundle-deals` พร้อมอัปเดต Cache ของหน้าหลังบ้าน

## v0.14.211 — Bundle Deals No Discount Stacking (IMPLEMENTED)

- สินค้าหมวด `bundle-deals` ใช้ราคาพิเศษที่ตั้งไว้เป็นราคาสุทธิของสินค้า ไม่รับโปรโมชั่นกลางซ้ำ
- ไม่นับ `bundle-deals` เป็นจำนวนตะกร้าสำหรับส่วนลด 5/10/20/30 และไม่นำยอดสินค้าไปเป็นฐานส่วนลดหลายตะกร้า
- ไม่นำยอด `bundle-deals` ไปเป็นฐานส่วนลดลูกค้าใหม่หรือส่วนลดอื่น โดย Backend เป็นผู้ยืนยันราคาสุดท้าย
- Frontend แสดงข้อความชัดเจนว่าโปรยกชุดเป็นราคาพิเศษและไม่ร่วมส่วนลดอื่น พร้อมใช้กฎเดียวกันทั้งหน้าเลือกสินค้าและตะกร้า

## v0.14.210 — Home Bundle Deals Catalog (IMPLEMENTED)

- หน้าแรกมีแคตตาล็อก `โปรยกชุด` แยกอยู่เหนือแคตตาล็อกสินค้าดิจิทัลแนะนำ
- แคตตาล็อกใหม่นี้รับเฉพาะสินค้าที่ Backend ส่งมาพร้อม `category = bundle-deals` และซ่อนทั้งส่วนเมื่อยังไม่มีสินค้า
- หน้าแรกตัด `bundle-deals` ออกจากแคตตาล็อกสินค้าดิจิทัลเดิมเพื่อไม่ให้แสดงซ้ำ
- ปุ่มใส่รถเข็น สไลด์รูป สถานะซื้อแล้ว และการบล็อกซื้อซ้ำใช้ handler ชุดเดียวกับสินค้าเดิมทั้ง desktop/mobile

## v0.14.209 — Mixed Promotion Bundle (IMPLEMENTED)

- ตัวสร้างชุดรวมตะกร้ามีตัวเลือก `โปรยกชุด` สำหรับเลือกสินค้าข้ามหมวดแบบฝึกหัด ระบายสี และเกมเสริมพัฒนาการในชุดเดียว
- แสดงตัวเลือกเมื่อหมวด `bundle-deals` เปิดใช้งานและมีตะกร้าพร้อมรวมจากสามหมวดรวมกันอย่างน้อย 2 ใบ
- Frontend และ Backend ใช้ allowlist เดียวกัน ป้องกันสินค้าหมวดอื่น ตะกร้าไม่พร้อมขาย และตะกร้าที่ถูกใช้ในชุดแล้ว
- รองรับทั้งสร้างใหม่และแก้ไขโปรยกชุดเดิม พร้อมคงการคำนวณราคา หน้า รูปตัวอย่าง และไฟล์รวมเดิม

## v0.14.208 — Bulk Product Category Move (IMPLEMENTED)

- เพิ่มปุ่ม `ย้ายหมวดหลายตะกร้า` ต่อจาก `สร้างชุดรวมตะกร้า` ในหน้าจัดการสินค้า ใช้ผลค้นหาและช่องติ๊กเดิม
- Boss/Admin เลือกหลายตะกร้าและหมวดปลายทางครั้งเดียว ระบบเปลี่ยนหมวด Slug ชื่อ คำอธิบาย และชนิดไฟล์ให้สอดคล้อง
- เลขรหัสสินค้าแบบตัวเลขไม่เปลี่ยน จึงรักษาออเดอร์ สิทธิ์ ไฟล์ และสถิติที่ผูกกับ Product ID เดิม
- Backend ปฏิเสธตะกร้าสิทธิ์ ชุดรวม และตะกร้าที่ถูกจัดสรรเข้า bundle พร้อม confirmation และ role guard

## v0.14.207 — Full-stack Button/Event Coverage (IMPLEMENTED)

- Button/Event coverage ต้องตามจาก Frontend handler ไปถึง API, สิทธิ์, validation, duplicate/idempotency guard, ฐานข้อมูลหรือไฟล์ และผล success/error
- Backend test ต้องมีทั้งเส้นทางที่อนุญาตและเส้นทางปฏิเสธ/ข้อมูลผิดที่สำคัญ
- เหตุการณ์ที่เป็น UI-only ต้องบันทึก `UI-ONLY` พร้อมหลักฐานว่าไม่เรียก network และไม่แก้ข้อมูลถาวร
- กฎนี้ใช้กับ Frontend ใหม่หรือที่แก้ทุกแพตและทุกคิว Event Roadmap

## v0.14.206 — Dynamic Bundle Categories (IMPLEMENTED)

- หน้าสร้างชุดรวมตะกร้าแสดงทุกหมวดที่เปิดใช้งานและมีตะกร้าพร้อมรวมอย่างน้อย 2 ใบ ไม่จำกัดเฉพาะ coloring/tattoo
- หมวดชุดรวมใช้ `set-<หมวดต้นทาง>` และสร้างชื่อหมวดให้อัตโนมัติเมื่อบันทึกครั้งแรก
- ตะกร้าต้นทางยังต้องเปิดขาย อยู่หมวดเดียวกัน และยังไม่เคยถูกใช้ในชุดอื่น
- เพิ่ม focused Button/Event coverage สำหรับการเปิดตัวสร้าง เปลี่ยนหมวด และกรองตะกร้าต้นทาง

## v0.14.205 — Continuous Frontend Button/Event Coverage (IMPLEMENTED)

- ทุกแพตที่สร้างหรือแก้ Frontend ต้องเพิ่ม/อัปเดต Button/Event coverage ในแพตเดียวกันให้ครอบคลุมปุ่ม ลิงก์ เมนู แท็บ ฟอร์ม toggle dialog upload retry และ confirm ที่เปลี่ยน
- ต้องตรวจ handler, สถานะ loading/disabled/success/error, keyboard, ปุ่มซ้ำ/ปุ่มลอยที่กดไม่ได้ และพฤติกรรม desktop/Android/iPhone
- ต้องมี focused automated test และหลักฐานใน patch ledger; ห้ามปิดแพต Frontend หาก coverage ยังไม่ครอบคลุม
- กฎนี้เป็นงานถาวรใน Event Roadmap และขยายตาม Frontend ใหม่ทุกครั้ง

## v0.14.204 — Broadcast Image Delivery (IMPLEMENTED)
- Facebook Broadcast อัปโหลดรูปตรง Meta และส่งด้วย attachment_id
- LINE Broadcast ใช้ URL รูปสุ่มที่เปิดชั่วคราวไม่เกิน 2 วัน

## v0.14.203 — Broadcast Recipient Picker (IMPLEMENTED)
- เลือกลูกค้าจากชื่อ/ร้าน/ช่องทางแทนกรอก Conversation ID และแสดงจำนวนที่เลือก
- ซ่อนบัญชี LINE เมื่อใช้ Facebook และบังคับส่งทดสอบข้อมูลชุดเดียวกันก่อนส่งจริง

## v0.14.202 — Facebook Direct Image Upload (IMPLEMENTED)
- เปลี่ยนรูปขาออก Facebook จากการให้ Meta ดาวน์โหลด URL เป็นอัปโหลดไฟล์ตรงไป `message_attachments`
- ส่งต่อด้วย `attachment_id` เพื่อตัดปัญหา Meta เข้าถึง URL รูปไม่ได้

## v0.14.201 — V12 Provider Error Diagnostics (IMPLEMENTED)
- แสดง HTTP/provider error code ที่ปลอดภัยเมื่อส่งรูป LINE/Facebook ไม่สำเร็จ โดยไม่แสดง Token
- ใช้รหัสจริงเพื่อแก้สาเหตุส่งรูปขาออกใน Event Case รอบถัดไปแทนการเดา

## v0.14.200 — V12 Faster Inbox + Outbound Images (IMPLEMENTED)
- ตัด runtime schema checks ออกจาก API กล่องข้อความ และเพิ่มการอัปเดต LINE/Facebook อัตโนมัติทุก 4 วินาที
- เปิด URL รูปขาออกแบบสุ่มเฉพาะไฟล์ V12 ให้ LINE/Meta ดาวน์โหลดได้ โดยไม่เปิดไฟล์ส่วนตัวชนิดอื่น

## v0.14.199 — Fast Meta Webhook Verification (IMPLEMENTED)
- ตัดงานตรวจ/ปรับ schema ออกจาก hot path ของ Facebook Webhook หลัง schema ถูกติดตั้งโดย migration แล้ว
- ลดเวลาตอบ Callback verification ให้ Meta โดยยังตรวจ Verify Token จากค่าที่เข้ารหัสเหมือนเดิม

## v0.14.198 — Facebook Webhook Inbound Adapter (IMPLEMENTED)
- เพิ่ม Callback URL/Verify Token, ตรวจ `X-Hub-Signature-256`, กัน event ซ้ำ และรับข้อความ/รูปเข้า V12
- ดึงชื่อและรูปโปรไฟล์ผู้ส่งด้วย Page Token และผูกเข้าร้านที่ Boss เลือก โดยไม่ส่ง PSID/Token/App Secret ออกหน้าเว็บ
- App Secret, Page Token และ Verify Token เก็บแบบเข้ารหัส; Verify Token แสดงครั้งเดียวหลังสร้าง

## v0.14.197 — Messenger-Scope Connection Test (IMPLEMENTED)
- เปลี่ยนการตรวจ Facebook ไปใช้ Messenger Profile API ซึ่งตรวจ `pages_messaging` โดยตรง แทนการอ่าน Page Object ที่ต้องการสิทธิ์คนละชุด
- รองรับ Page Token เดิมที่ Meta ออกซ้ำและ Token Debugger ยืนยันว่าถูกต้อง

## v0.14.196 — Automatic Customer Profile Recovery (IMPLEMENTED)
- เมื่อเปิด V12 ระบบตรวจลูกค้าที่มี Conversation ID แต่ยังไม่มีชื่อ/รูป และเติมจาก LINE/Facebook อัตโนมัติครั้งละไม่เกิน 40 ราย
- เพิ่มปุ่ม `อัปเดตชื่อและรูปลูกค้า` สำหรับสั่งซ้ำ พร้อมสรุปจำนวนตรวจ/สำเร็จ/ล้มเหลว
- ยืนยันข้อจำกัดว่าไม่สร้างประวัติหรือรายชื่อลูกค้าก่อน Webhook หากแพลตฟอร์มไม่ส่ง Conversation ID

## v0.14.195 — Meta Direct Page Diagnostics (IMPLEMENTED)
- เปลี่ยนการทดสอบ Facebook จาก `/me` เป็น Page ID โดยตรง เพื่อลดความกำกวมของชนิด Token
- แสดงรหัส Meta code/subcode ที่ปลอดภัยและแยกสาเหตุ Token, permission, Page ID และ rate limit โดยไม่เปิดเผย Token
- Event Case ยังรอ Production validation หลัง Boss Push/Deploy แล้วส่งรหัส Meta ที่หน้า V12 แสดง

## v0.14.194 — V12 Customer Identity + Facebook Credential Recovery (IMPLEMENTED)
- ดึงชื่อและรูปโปรไฟล์ LINE จาก Profile API เมื่อรับข้อความใหม่ และรับชื่อ/รูป Facebook จาก Runtime โดยมีอักษรสำรองเมื่อไม่มีรูป
- แสดงชื่อและรูปจริงทั้งรายการสนทนาและหัวแชท โดยไม่ส่ง participant ID หรือ Token ไปหน้าเว็บ
- เพิ่ม Runtime schema guard ให้ตาราง V12 สร้างได้แม้ Production ยังไม่ได้เรียก Migration 0042 จึงแก้ปัญหาปุ่มบันทึก Credential ล้มเหลว
- แยกข้อความผิดพลาด Facebook เป็น Secret เข้ารหัสไม่พร้อม, Token หมดอายุ, สิทธิ์ไม่ครบ และ Page ID ไม่ตรง โดยไม่เปิดเผย Token
- Event Case นี้เสร็จระดับโค้ด/ทดสอบ; Production validation รอ Boss Push/Deploy และทดสอบ Credential จริง

## v0.14.193 — V12 V Connect Broadcast Center (IMPLEMENTED)
- เพิ่ม Broadcast Center สำหรับข้อความ/รูปผ่าน LINE VisionD และ Facebook Page พร้อมเลือกบัญชีและผู้รับจากบทสนทนา
- เพิ่มคิว ประวัติยอดสำเร็จ/ล้มเหลว และปุ่มส่งซ้ำเฉพาะรายการล้มเหลว โดยมีรหัสแคมเปญป้องกันการสร้างรายการซ้ำ
- เพิ่มการตั้งค่า Facebook Page Token แบบเข้ารหัสและทดสอบการเชื่อมต่อ โดยไม่แสดง Token กลับหน้าเว็บ
- ส่ง Facebook เฉพาะบทสนทนาที่อัปเดตภายใน 24 ชั่วโมง และทุกการส่งต้องยืนยันก่อนสร้างคิว
- Event Case V12 V Connect ปิดในระดับโค้ดและการทดสอบ; การทดสอบ Production ต้องทำหลัง Boss Push/Deploy และเชื่อม Credential จริง
- แผนเว็บไซต์ 2 ยังอยู่สถานะ `PAUSED BY BOSS` จนกว่า Boss สั่งกลับมาเริ่ม

## v0.14.192 — V12 V Connect Unified Inbox (IMPLEMENTED)
- เพิ่มปุ่ม `V12 V Connect` ในงานหลักหลังบ้านและหน้า Inbox responsive สำหรับ Boss/Admin
- รวมบทสนทนา LINE VisionD และ Facebook Page VisionD ที่อยู่ในฐานช่องทางเดิม พร้อมกรอง ค้นหา ดูข้อความ/รูป และรับช่วงจากบอท
- LINE รองรับรับรูป ส่งข้อความ/รูป และใช้ Retry Key โดยไม่ส่ง Token หรือ participant ID ออกหน้าเว็บ
- Facebook adapter สำหรับส่งข้อความ และ Broadcast Center ยังเป็นงานต่อ `v0.14.193`; Event Case ยังไม่ปิด
- แผนเว็บไซต์ 2 อยู่สถานะ `PAUSED BY BOSS` จนกว่า V12 V Connect จะเสร็จ

## v0.14.191 — Standard Patch Loop + Basket Bundle Builder (IMPLEMENTED)
- ทุกแพตช์และทุก Event Case ต้องใช้ลูปมาตรฐาน: `ตรวจโค้ด → แก้ → รันทดสอบ → เจอข้อผิดพลาด → แก้อีก → ทดสอบใหม่`
- วนซ้ำในเลขแพตช์เดิมจน focused, regression, security และ predeploy ผ่าน การเจอบั๊กระหว่างลูปไม่ใช่เหตุให้ขึ้นเลขแพตช์ใหม่
- ผ่านแล้วจึง Commit; Boss เป็นผู้ควบคุม Push และ Deploy เว้นแต่สั่งเป็นอย่างอื่นโดยตรง
- เพิ่มปุ่ม `สร้างชุดรวมตะกร้า` ต่อจาก `+ เพิ่มสินค้าเอง` พร้อมสรุปราคาปกติ จำนวนหน้า จำนวนตะกร้า ราคาชุดโปร และส่วนลดแบบทันที
- เลือกตะกร้าตามลำดับการลง ปรับจำนวน 2–30 และจำนวนรูปปกตัวอย่างได้ โดยตะกร้าที่เคยถูกจัดชุดจะไม่ถูกเสนอหรือบันทึกซ้ำ
- บันทึกชุดไว้ในหมวด `คละแบบระบายสี` หรือ `คละแบบรอยสัก` และเชื่อมไฟล์ต้นทางตามลำดับ

## v0.14.186 — One Request = One Event Case Completion Guard (IMPLEMENTED)
- งานที่ Boss สั่งหนึ่งเรื่องเป็น Event Case เดียว และห้ามปิดเคสเพียงเพราะจบหนึ่งแพตช์หรือหนึ่งงานย่อย
- หากยังเหลืองาน ต้องแจ้งรายการที่เหลือและงานถัดไปอย่างเด่นชัดก่อนรับเรื่องใหม่
- Boss สั่งพักหรือเปลี่ยนลำดับได้ แต่ต้องบันทึก `PAUSED BY BOSS` และไม่อ้างว่าเคสเสร็จ

## v0.14.185 — Mandatory Patch Handoff + Safe Rollback (IMPLEMENTED)
- ทุกแพตช์ต้องบันทึกสิ่งที่แก้ ไฟล์ที่แก้ ผลทดสอบ Commit identity และวิธีย้อนกลับ
- แยก parent commit ออกจาก safe rollback commit และเลื่อน Safe Baseline ได้เฉพาะเมื่อ Production validated
- ใช้ `git revert` แบบไม่ทำลายประวัติ ห้ามวางไฟล์เก่าทับทั้งระบบ ห้าม Reset/Push/Deploy อัตโนมัติ

## v0.14.184 — Roadmap Historical Continuity (IMPLEMENTED)
- รวมประวัติ v0.14.163–v0.14.183 จาก Git และ Patch Ledger กลับเข้าสู่ Roadmap กลาง
- ระบุแพตที่ถูกย้อนกลับและงานที่ยังรอตรวจ Production ตามสถานะจริง

## v0.14.183 — Mobile Menu + Product Status Pagination (IMPLEMENTED)
- ย้ายเมนูมือถือเป็นแถบยาวใต้หัวเว็บ ไม่ชนเลขแพตช์
- แยกตะกร้าวางจำหน่ายหน้าละ 10 และแบบร่างหน้าละ 5 พร้อม pagination คนละชุด

## v0.14.182 — Storefront/Admin Category Count Parity (IMPLEMENTED)
- ตัวนับหมวดหลังบ้านใช้เงื่อนไขสินค้าที่เผยแพร่เดียวกับหน้าบ้าน
- ซ่อนหมวดประเภทซ้ำที่มี 0 สินค้าเมื่อมีหมวดประเภทเดียวกันใช้งานจริง

## v0.14.181 — Minimal Production Version Repair (IMPLEMENTED)
- ยืนยัน `visiond-mvp` เป็น Cloudflare Production tree
- เปลี่ยนเฉพาะ VERSION และ badge WEB/ADMIN โดยไม่ซิงก์ Runtime จำนวนมาก

## v0.14.180 — Full-tree Production Sync (REVERTED)
- การซิงก์ไฟล์จำนวนมากทำให้หน้าเว็บเหลือเพียงเลขเวอร์ชันบนหน้าขาว
- ย้อนทั้งชุดด้วย `eddde97`; ห้ามใช้ v0.14.180 เป็นฐาน Production
- บทเรียนถาวร: ใช้ Delta ขนาดเล็กกับ Active tree และตรวจหน้าเว็บก่อนงานถัดไป

## v0.14.179 — Production Tree + QA Hardening (IMPLEMENTED)
- ระบุ Active Production tree, ซ่อม regression บน Windows และ requirement recheck
- บังคับ cache version และเลขแพตช์ที่มองเห็นได้ทุกงาน

## v0.14.178 — Course Partner Share Button (IMPLEMENTED)
- หลังบ้านระบุตะกร้าแผน Partner และดูส่วนแบ่งรายตะกร้า โดยจำกัดสิทธิ์เฉพาะหลังบ้าน
- การทดสอบออเดอร์จริงหลัง Deploy ยังเป็น Production QA

## v0.14.177 — Vision 5 Partner Share Formula (IMPLEMENTED)
- แบ่งยอด VisionD/ผู้สอน 50/50 ก่อน แล้วหัก API 1 บาทจากส่วนผู้สอน
- ตัวอย่างราคา 100 บาทได้ VisionD 51 บาท / ผู้สอน 49 บาท พร้อม ledger และรอบจ่าย

## v0.14.176 — Visible Version Runtime Source (IMPLEMENTED)
- ทำ VERSION เป็นแหล่งเดียวสำหรับเลข Home, Admin และ Dashboard พร้อม cache refresh

## v0.14.175 — Vision 5 Partner Money Flow (IMPLEMENTED)
- Routing เงินเข้าบัญชีกลาง ตรวจสลิปส่วนกลาง และ ledger ส่วนแบ่งแบบ idempotent
- เพิ่มยอดคงเหลือผู้สอนและบันทึกจ่ายหลังบ้าน; Bank/Slip E2E จริงยังรอ Production

## v0.14.174 — Vision 5 Three Seller Plans (FOUNDATION IMPLEMENTED)
- วางโครง 3 แผนผู้ขาย พร้อมกฎฟรี 3 คอร์ส คอร์สละไม่เกิน 5 EP
- ระบบ Partner ledger/การจ่ายถูกทำต่อใน v0.14.175–178

## v0.14.173 — Catalog Performance + Mobile Menu Counts (IMPLEMENTED)
- ลดภาระ API และนับเฉพาะสินค้าที่เผยแพร่ พร้อมซ่อมเมนูมือถือ
- การเทียบ D1 จริงต้องอาศัยสิทธิ์ Production

## v0.14.172 — Bundle Deals Admin Builder (IMPLEMENTED)
- เพิ่มเครื่องมือสร้างชุดสินค้า รวมไฟล์ ปก และคำอธิบายตามจำนวนในชุด
- Catalog count audit ถูกทำต่อใน v0.14.173 และ v0.14.182

## v0.14.171 — Product Form Contract (IMPLEMENTED)
- เพิ่มสัญญาทดสอบฟอร์มสินค้า ป้องกันช่องกรอกและการบันทึกเดิมเสีย

## v0.14.170 — Baseline Consolidation (IMPLEMENTED WITH LARGE LEGACY CLEANUP)
- รวมฐาน LINE/Vision 5 และลด Runtime/CSS เก่าที่ซ้ำจำนวนมาก
- เป็นการเปลี่ยนโครงใหญ่ในประวัติ ไม่ใช่รูปแบบ Delta ที่ใช้ในปัจจุบัน

## v0.14.169 — Grounded Product Knowledge Sales (IMPLEMENTED)
- LINE AI ใช้ข้อมูลสินค้าจริงและราคาเป็นบาท ตอบต่อเนื่องเชิงปรึกษา
- ห้ามอ้างสถานะสั่งซื้อหรือส่งของที่ไม่มีจริง

## v0.14.168 — Internal Mobile LINE Inbox (IMPLEMENTED)
- เพิ่มบทสนทนา LINE, handoff, คนตอบ, push และคืนให้บอท โดยไม่เปิดเผย credentials

## v0.14.167 — LINE Chat Status Refresh (IMPLEMENTED)
- ทำสถานะ connected/running ให้ตรงกันหลังตั้งค่า โดยไม่คืน credentials

## v0.14.166 — Persistent Mobile LINE Settings (IMPLEMENTED)
- มือถือจำสถานะการตั้งค่า ส่วน credentials จริงเข้ารหัสและอยู่ฝั่ง Server

## v0.14.165 — LINE Status Self-Heal (IMPLEMENTED)
- ซ่อมสถานะหน้าแชตจากผล Verify จริงโดยไม่ต้องกรอก Token ใหม่

## v0.14.164 — V Easy LINE Diagnostics (IMPLEMENTED)
- เก็บข้อความก่อนเรียก AI และแสดง last_error/ความพร้อม AI/LINE

## v0.14.163 — V Easy LINE AI Reply (IMPLEMENTED)
- เชื่อม LINE webhook กับ AI/Reply API แยกร้านและกัน redelivery ตอบซ้ำ



## v0.14.165 — LINE Status Self-Heal
- ซ่อมสถานะหน้าแชตจากผล Verify จริงอัตโนมัติ

## v0.14.164 — V Easy LINE Diagnostics
- เก็บข้อความก่อนเรียก AI และบล็อกการเริ่มบอทเมื่อ AI/LINE ยังไม่พร้อม

## v0.14.163 — V Easy LINE AI Reply
- LINE webhook ตอบด้วย AI จากสินค้าเฉพาะร้านและกัน redelivery ตอบซ้ำ
- รอทดสอบข้อความจริงหลัง Deploy ก่อนปิด Event Case
Owner protocol: JARVIS / J

## Patch Capacity / Quality Gate (บังคับตั้งแต่ v0.14.55)

- รับคำสั่งเข้า Event Case และ Requirement Ledger ได้ไม่จำกัด แต่งานผลิตต่อแพตต้องจำกัด
- หนึ่งแพตทำหนึ่งระบบหลัก งานปกติ 3–7 งานย่อยแบบ atomic
- แพตเสี่ยงสูงที่แตะเงิน สิทธิ์ ความปลอดภัย ฐานข้อมูล หรือ API ภายนอก ทำ 1–3 งานย่อย
- งานที่เกินกำลังแพตต้องอยู่เป็นรหัส `PENDING` ห้ามหายหรือรวมเป็นหัวข้อกว้าง
- หลังแพตฟีเจอร์ใหญ่ต้องมีแพต QA-only แยก และห้ามผสม Event Roadmap ฟีเจอร์ใหม่ในแพต QA-only
- ก่อนเริ่มและก่อนส่ง ZIP ต้องรัน Source-to-Ledger Recheck เทียบคำสั่งต้นทางทุกข้อกับ Requirement Ledger

Current QA-only patch: `v0.14.55` — Webhook hardening, Source-to-Ledger coverage และ regression repair โดยไม่เพิ่มฟีเจอร์ใหม่

`v0.14.56 IMPLEMENTED` — Vision 7 Release Delivery: ผู้ดูแลอัปโหลดตัวติดตั้งพร้อมเวอร์ชัน/บังคับอัปเดต/SHA-256 และลูกค้าที่มีสิทธิ์ active หรือ trial ดาวน์โหลดจากบัญชีตนเองได้

`v0.14.57 IMPLEMENTED` — Vision 7 Operator Control: ออกคีย์จากผู้ใช้/โปรแกรม/แพ็กเกจ, ต่ออายุจากวันหมดอายุเดิม, ระงับ/เปิดคืน และดู Audit History กับอุปกรณ์ของคีย์

`v0.14.58 IMPLEMENTED` — PAGE_SALES Grounded AI: รับงานจาก Meta แบบ async, ตอบจากแคตตาล็อก/ราคาโปรโมชันจริง, ตรวจ slug และราคาหลัง AI ตอบ, บล็อกข้อมูลส่วนตัว/Secret/ลิงก์ และส่งผ่าน outbox ที่ retry ได้

`v0.14.59 IMPLEMENTED` — Production Meta Ads API: ซิงก์ Insight รายวันระดับโฆษณาและประกบ Campaign / Ad Set / Ad / Creative, upsert กันข้อมูลซ้ำ, เก็บสถานะรอบซิงก์ และแสดง Spend / Impression / Click / CTR / ROAS ใน Ads Center โดยไม่แก้ไขโฆษณา

## Operating rule
This file is the project handoff source of truth inside every VisionD patch. Before changing code, J must read this roadmap, the marketing plan, the latest patch note, and the available aggregate customer/business data. After each patch, J updates statuses and recommends the next patch from evidence rather than blindly following old sequencing.

Status: `IMPLEMENTED` = code exists, `DEPLOYED` = production deploy confirmed, `VALIDATED` = production data confirms behavior/outcome, `NEXT` = proposed next work, `HOLD` = intentionally deferred.

## North star
Build VisionD into a low-manual-work digital commerce platform where products/courses can be published, sold, paid, delivered, measured, and improved from customer behavior data.

## Phase 1 — Data foundation
- IMPLEMENTED — v0.14.44 Customer Intelligence: first-party events, funnel, journey, authoritative backend purchase.
- IMPLEMENTED — v0.14.45 Ads Intelligence: campaign/creative spend, attribution, revenue/orders/profit/ROAS.
- IMPLEMENTED — v0.14.46 Living Roadmap + Marketing Plan + Customer Data Analysis protocol.
- NEEDS DEPLOY/VALIDATION — verify v0.14.44–46 on production and collect enough real events to establish a baseline.

## Phase 2 — Conversion intelligence
- IMPLEMENTED — v0.14.47: Conversion + Product Demand Intelligence; groups numbered product series into families, distinguishes premade stock from demand-driven production, and recommends PRODUCE / TEST / HOLD from observed views/cart/checkout/paid data.
- NEEDS DEPLOY/VALIDATION — validate family recommendations against production traffic and sales; low exposure must not be treated as low demand.
- IMPLEMENTED — v0.14.50 Commerce/Conversion Intelligence: diagnoses Product View → Add Cart → Checkout → Paid leakage and reports new vs returning buyers without exposing PII.
- NEEDS DEPLOY/VALIDATION — use production traffic to confirm the actual bottleneck; diagnostics refuse to name a bottleneck until a stage has a minimum evidence base.

## Phase 2B — Guest acquisition
- IMPLEMENTED — v0.14.48: unique anonymous visitor identity per browser/device, guest → member history claim, guest signup/first-bill gift notice, and automatic first-paid-order digital gift with no Boss action.
- NEEDS DEPLOY/VALIDATION — verify separate browsers do not collapse into one guest, measure guest notice → signup → paid uplift, and confirm exactly-one gift idempotency.

## Phase 3 — Personalization + retargeting
- IMPLEMENTED — v0.14.49: privacy-minimized 30-day interest profile + related-product engine for anonymous/member visitors, prioritizing unseen products in the same Product Family then adjacent category products.
- NEEDS DEPLOY/VALIDATION — measure recommendation impression → click → cart → paid uplift before enabling more aggressive personalized popups.
- Proposed — smart related-product/promo surfaces with frequency caps; measure recommendation impression → click → cart → purchase.
- Proposed — production queue should extend winning families sequentially (same base title, next set number) and mark those new sets `demand_driven`.

## Phase 3B — Retargeting segments
- Proposed — v0.14.50: privacy-minimized actionable segments: viewed-not-carted, cart-not-checkout, checkout-not-paid, buyer, repeat buyer.
- Proposed — segment counts and campaign-ready criteria; no raw secret/slip/customer contact data in planning files.

## Phase 4 — Growth experiments
- Proposed — v0.14.51: experiment registry for offer/creative/promo/landing tests with baseline, hypothesis, KPI, start/end and result.
- Proposed — prevent declaring a winner without adequate observed data.

## Phase 5 — Growth Command Center
- Proposed — v0.14.52: combine customer funnel, ads, product performance and experiment outcomes into one decision surface.
- Proposed — generate the next prioritized action from measured bottlenecks.

## Decision gates
1. Production data overrides this proposed order when it reveals a materially larger bottleneck.
2. Security/payment/auth regressions override growth work.
3. A feature is not `VALIDATED` merely because tests/build pass.
4. When this roadmap is completed, J drafts the next phase automatically and clearly marks it proposed for Boss review.

## Permanent QA / Security / Bug Audit roadmap
QA is a permanent Event Roadmap track. It does not need a new Event Case unless an urgent defect is found.

### Every patch — mandatory Patch Smoke Check
- Build, imports, changed APIs and changed pages must pass before ZIP delivery.
- Test the roles affected by the patch and the nearest legacy flow that shares its API or database tables.
- Test the affected surface on desktop and mobile; Android/iPhone routes must be included when the change touches customer-facing UI.
- Check that no secret, private customer data or cross-account data is exposed.

### Every 3 delivered patches — Integration Check
- Test the latest three patches together, including navigation, notifications and shared database/API paths.
- Test Guest, User, Admin and Boss permissions where applicable.
- Run the key commerce path: signup/login → cart → order → payment verification → unlock/license → download/use.

### Every 6 delivered patches — Full Regression
- Test all major VisionD surfaces: storefront, member, orders/payment, courses/Vision 5, Vision 1–7, ELON Web, ELON Page and Ads Center.
- Check desktop, Android and iPhone critical paths, database consistency, duplicate records and stuck jobs.

### Every 10 delivered patches — Deep Security & Data Audit
- Audit authorization bypass, cross-account access, prompt injection, license/device spoofing, webhook forgery/deduplication, rate limits, secret leakage, slip replay, audit logs, backup/restore and database performance.

### Immediate escalation to Event Case
Open an urgent Event Case immediately for build/site outage, login/mobile failure, incorrect payment unlock, cross-account data exposure, authorization/license bypass, secret leakage, destructive data mutation or a blocked critical flow. Security/payment/auth regressions always override feature work.

### High-risk patch rule
Any patch touching login, authorization, payments, database schema, ELON, webhooks or licensing receives the relevant elevated checks immediately without waiting for the 3/6/10-patch cadence.

## Permanent Requirement Coverage / Anti-Drop rule
This track detects work that disappeared from planning, not merely work that remains pending.

### Patch Work Ledger — กันงานย่อยหลุดภายในทุกแพต
This applies to every task in the current patch, not only ELON or Event Case. At patch start, register separate task IDs for feature, bug, security, database, UI/mobile, config, QA and documentation work in `patch-ledgers/vX.Y.Z.json`. Each completed task must point to concrete evidence. Run `npm run patch:coverage` before ZIP creation; any MISSING, UNCERTAIN or missing evidence blocks delivery.

1. **Requirement Ledger** — every Boss instruction must receive its own stable ID in `requirements-ledger.json`; do not merge unrelated instructions into a broad item.
2. **Patch Coverage Check** — before every ZIP, compare `original instruction → requirement ID → changed file/evidence → test result`. A requirement without a destination is at risk of being dropped.
3. **Cross-patch audit** — every Integration and Full Regression cycle must reread requirements from prior patches to catch items incorrectly marked complete or removed from the queue.
4. `DONE-VERIFIED` requires existing evidence; `PENDING` stays visible; `BLOCKED` records its blocker; `MISSING` and `UNCERTAIN` fail patch delivery; only Boss can authorize `REMOVED-BY-BOSS`.
5. Run `npm run requirements:check` before every patch. Before closing an Event Case run `npm run requirements:close`.
6. **ห้ามปิด Event Case** unless every requirement is `DONE-VERIFIED` or `REMOVED-BY-BOSS` and the final report states total, verified, pending, missing and uncertain counts.

### ตัวกันงานหลุดชั้นที่ 2 — Patch-wide + Cross-Patch Recheck
Layer 2 first rechecks every task registered for the current patch, then compares the Event Requirement history across prior snapshots. It therefore catches both work dropped inside this patch and work lost between patches.
1. หลังส่งแต่ละแพต ให้เก็บ Ledger Snapshot แบบ append-only และล็อก SHA-256 ใน `requirements-history/index.json`.
2. ก่อนส่งแพตถัดไป ต้องเทียบ Snapshot ทุกชุดกับ Ledger ปัจจุบัน เพื่อตรวจ Requirement ID ที่หายและ Snapshot ที่ถูกแก้ย้อนหลัง.
3. ข้อความ Requirement ที่เปลี่ยนต้องมี `source_change_reason`; งานที่เคย `DONE-VERIFIED` แล้วถูกเปิดใหม่ต้องมี `reopened_reason`.
4. ตรวจซ้ำว่าไฟล์หลักฐานจากแพตก่อนยังมีอยู่จริง ไม่ใช่ตรวจเฉพาะหลักฐานที่เพิ่มในแพตปัจจุบัน.
5. ทุก ZIP ต้องผ่านทั้ง `requirements:check` และ `requirements:recheck`; การปิด Event Case ยังต้องผ่าน `requirements:close` เพิ่มอีกชั้น.

## Event queues
### EVENT CASE
- COMPLETE — establish two-queue patch protocol and rotating roadmap tracks.
- IMPLEMENTED FOUNDATION — v0.14.51 Vision 7 licensing: program/plan/license/device/trial/history schema and APIs; 3 devices per key; account binding; customer device reset; separate member/admin pages.
- IMPLEMENTED FOUNDATION — v0.14.51 ELON Page isolated conversation/handoff storage and separate Ads Center advisory surface. Existing income dashboard remains untouched.
- IMPLEMENTED — v0.14.52 paid Vision 7 order fulfillment: quantity creates separate keys, explicit renewal extends the selected existing key, and order-item idempotency prevents duplicate issuance.
- IMPLEMENTED — v0.14.52 encrypted recoverable license keys using a dedicated production Secret; only the authenticated owner can retrieve the full key.
- IMPLEMENTED — v0.14.53 Requirement Ledger and Patch Coverage Check; delivery fails on MISSING/UNCERTAIN and Event Case closure fails while any requirement is unresolved.
- IMPLEMENTED — v0.14.53 secure inbound Meta Messenger webhook: verification token, HMAC signature, page-recipient guard, idempotent event storage and encrypted participant identity.
- IMPLEMENTED — v0.14.54 anti-drop Layer 2: hash-locked cross-patch snapshots detect removed requirements, history tampering, unexplained status regressions and missing prior evidence.
- IMPLEMENTED — v0.14.54 outbound Page sender: Cloudflare-secret Page token, 24-hour enforcement at queue and delivery, idempotency, retry schedule and protected cron processor.
- CONTINUE NEXT PATCH — PAGE_SALES AI grounded in verified VisionD catalog, pricing and policy data.
- CONTINUE NEXT PATCH — program download/update delivery and full Vision 7 operator forms/history.
- CONTINUE NEXT PATCH — production Ads API ingestion and evidence-calibrated recommendations.

EVENT CASE: ยังไม่เสร็จ — ต้องแพตต่อ

### EVENT ROADMAP rotation
- IMPLEMENTED — Growth/Data: v0.14.49 Personalized Product Engine.
- IMPLEMENTED — Commerce/Conversion: v0.14.50 funnel leakage diagnostics + new/returning buyer mix.
- NEXT — Product/Production: strengthen demand-driven production queue from family exposure and paid evidence.
- WAITING — Course/Creator.
- ACTIVE PERMANENT TRACK — Security/QA cadence: every patch smoke, every 3 integration, every 6 full regression, every 10 deep security/data audit, with immediate high-risk escalation.
- WAITING — Marketing: smart promo/retarget after recommendation baseline.

## Current next decision
Deploy v0.14.48–49 and validate guest acquisition plus recommendation behavior. Analyze `recommendation_view → recommendation_click → add_to_cart → purchase`. Commerce/Conversion diagnostics are now implemented in v0.14.50. Deploy and validate with real traffic. Unless production data or a new Event Case overrides it, rotate next to Product/Production Intelligence: turn family exposure/cart/paid evidence into an ordered production queue, never inventory count alone.
# v0.14.187 — Template และปุ่มมาตรฐาน (2026-08-15)

- Event Case: ทำมาตรฐานปุ่มกลางครบทุกหน้าและมือถือ
- สถานะ: IMPLEMENTED รอผลทดสอบและ commit ในเครื่อง
# v0.14.188 — ยอดสินค้าหน้าบ้าน/หลังบ้านตรงกัน (2026-08-15)

- รวมสิทธิ์ Vision 5 แบบอ่านอย่างเดียวในยอดหลังบ้าน 336+1=337 โดยไม่รวม draft
# v0.14.189 — Compact Language Switcher + Permanent Template Rule (2026-08-15)

- TH/EN บนมือถือเป็น pill กว้างตามเนื้อหา ไม่ยืดเต็มแถบ
- Template กลางและการตรวจ desktop/Android/iPhone เป็นเงื่อนไขบังคับของทุก Event Case และ Event Roadmap รวมเว็บไซต์ 2
- Header กลางต้องมีรถเข็นเพียงหนึ่งปุ่มและ badge ใช้ยอด normalized quantity จาก `vd_cart` เดียวกันทุกหน้า
# v0.14.190 — Mobile Menu Desktop Visibility Guard (2026-08-15)

- ปุ่มเมนูมือถือซ่อนบนจอคอมและแสดงเฉพาะจอไม่เกิน 800px
- ปุ่มควบคุม responsive layout ถูกยกเว้นจาก runtime ปุ่มกลาง และกฎนี้บังคับทุก Event Case/Roadmap รวมเว็บไซต์ 2
- หน้าบัญชีของ Boss/Admin ไม่แสดงเมนูบัญชีสมาชิก ปุ่มเปิดเมนู หรือกล่องข้อความแจ้งเตือนลูกค้า และใช้พื้นที่งาน Control Center แบบคอลัมน์เดียว
# v0.14.224 — Vision 14 Source Library + Rights Gate (IMPLEMENTED · EVENT CASE CONTINUES)
- เพิ่มหน้าหลังบ้าน `Vision 14 คลัง E-book` รับ PDF ต้นฉบับเข้า R2 และเก็บ Metadata ใน D1
- จำกัดการเข้าถึงเฉพาะ Boss, รับเฉพาะ PDF ไม่เกิน 100 MB และลบ R2 คืนเมื่อบันทึกฐานข้อมูลล้มเหลว
- เพิ่มสถานะสิทธิ์ owned / PLR / Public Domain / licensed / reference-only และล็อก reference-only ไม่ให้ผ่านด่านขาย
- งาน Event Case ที่เหลือ: ถอดข้อความผูกเลขหน้า, Credit Cleaner, สรุปเต็ม, PDF สอนของจาวิส, Dedup/MIX และส่งเข้า Vision 13
# v0.14.225 — Vision 14 Page Trace + Credit Cleaner (IMPLEMENTED · EVENT CASE CONTINUES)
- เก็บข้อความดิบและข้อความสะอาดแยกกันตาม Source ID + เลขหน้า โดยไม่แก้ PDF ต้นฉบับ
- เพิ่ม Identity/Credit Cleaner สำหรับชื่อผู้จัดทำ สำนักพิมพ์ เครดิต ISBN URL และอีเมล พร้อมประวัติบรรทัดที่นำออก
- เพิ่มหน้าจอนำเข้าข้อความที่ถอดแล้ว 1–500 หน้าและตรวจย้อนกลับข้อความสะอาด; OCR อัตโนมัติยังเป็นงานแพตถัดไป
- งานที่เหลือ: OCR/Text-layer extraction อัตโนมัติ, สรุปเต็ม, PDF สอนของจาวิส, Dedup/MIX และ Vision 13
# v0.14.226 — Vision 14 Automatic PDF Extraction + OCR Retry (IMPLEMENTED · EVENT CASE CONTINUES)
- PDF.js อ่าน Text Layer อัตโนมัติใน Browser ของ Boss โดยไม่ส่ง PDF ทั้งเล่มออกนอกระบบ
- หน้าที่ไม่มีข้อความถูก Render เป็น JPEG และส่ง Backend OCR ด้วย Secret ฝั่ง Cloudflare; ไม่ฝังคีย์ใน Frontend/Git
- เก็บ method/status/error รายหน้า แสดงหน้าที่ค้างและลองใหม่เฉพาะ failed/ocr-pending ได้
- ถัดไป: สรุปเต็มรายเล่มและ PDF สอนของจาวิส
# v0.14.227 — Existing Bundle Preview Repair Foundation (IMPLEMENTED · URGENT EVENT CASE CONTINUES)
- Vision 14 ถูกพักตามคำสั่ง Boss โดยไม่ปิด Event Case
- เพิ่มปุ่ม `ตรวจรูปตัวอย่างตะกร้ารวม` ในหน้าจัดการสินค้า ติดกับปุ่มสร้างชุดรวม
- ตอนสร้างชุดรวมใหม่ต้องตรวจและเลือกรูปใบงานจากรูปของตะกร้าต้นทางก่อนบันทึก; API ตรวจเจ้าของรูปซ้ำ
- ตรวจตะกร้ารวมเดิม เลือกรูปจากสมาชิกชุด และแก้เฉพาะ cover/preview ของ Product ID เดิม
- เก็บ Snapshot ก่อน–หลัง; ไม่เปลี่ยน Slug, created_at, ราคา, หมวด, หน้า, ลำดับ หรือสมาชิกชุด
- แพตถัดไปเพิ่มตัวจำแนกใบงาน/หน้าปก/ลายเซ็ต/เงื่อนไข และเลือกรูปทดแทนอัตโนมัติ
# v0.14.228 — Bundle Preview Classifier + PDF Replacement (IMPLEMENTED · URGENT EVENT CASE COMPLETE)
- ตรวจรูปอัตโนมัติทั้งตอนสร้างชุดใหม่และชุดเดิม พร้อมคะแนนความเป็นใบงานและให้ Boss ตรวจด้วยตาก่อนบันทึก
- ค้นหน้าที่เหมาะจาก PDF สมาชิกใน Browser อัปโหลดเฉพาะรูปที่เลือก และแก้ Product ID เดิม
- เพิ่มประวัติ Revision และปุ่มย้อนรูป โดยไม่เปลี่ยน Slug ราคา หมวด สมาชิก หรือลำดับ
# v0.14.229 — Vision 14 Full-book Summary + Page Trace (IMPLEMENTED · EVENT CASE CONTINUES)
- กลับมาทำ Vision 14 หลังปิดงานด่วนตรวจรูปตะกร้ารวม
- สรุปจาก clean text เท่านั้น แยก Record จาก PDF/Raw Text และมีเลขหน้าอ้างอิงทุกประเด็น
- แสดงจำนวนหน้าครอบคลุมและหน้าที่ OCR/Extraction ขาดก่อนนำไปสร้าง PDF สอนของจาวิส
- ถัดไปสร้าง Teaching PDF จาก Summary ที่ Boss ตรวจแล้ว
# v0.14.230 — Vision 14 Jarvis Teaching PDF (IMPLEMENTED · EVENT CASE CONTINUES)
- สร้าง PDF ภาษาไทยจาก Summary และ Page Trace ใน Browser แล้วเก็บ R2 พร้อม Metadata
- บล็อกเมื่อ Coverage ต่ำกว่า 80% และเก็บ Rights Gate ว่าส่งต่อเพื่อขายได้หรือใช้สอนภายในเท่านั้น
- ตรวจ Render PDF ตัวอย่างจริงแล้ว ไม่พบอักษรไทยแตก ข้อความชน หรือตัดขอบ
- ถัดไปทำ Dedup/MIX และส่งเข้า Vision 13
# v0.14.231 — Vision 14 Dedup/MIX + Vision 13 Intake Boundary (IMPLEMENTED · EVENT CASE CONTINUES)
- รวมประเด็นจาก PDF สอนหลายเล่ม ตัดข้อความซ้ำด้วย Normalization + Token Similarity และเก็บ SHA-256 Fingerprint
- รายการที่รวมยังเก็บ Source ID, ชื่อต้นฉบับ และเลขหน้าอ้างอิงครบ
- MIX ที่ทุกต้นฉบับผ่าน Rights Gate เท่านั้นจึงสร้างคิว Vision 13 `ready`; รายการสิทธิ์ไม่ผ่านเก็บภายในและไม่ส่งขาย
- ถัดไปสร้างศูนย์รับงาน Vision 13 และตรวจ Intake ก่อนนำไปผลิต E-book
# v0.14.232 — Vision 13 Intake Review + Approval Snapshot (IMPLEMENTED · EVENT CASE CONTINUES)
- เพิ่มศูนย์รับงาน Vision 13 แยกสถานะ ready, reviewing, approved และ rejected
- ตรวจ Rights, PDF สอน, Fingerprint และ Citation ก่อนอนุมัติ พร้อมบังคับเหตุผลเมื่อส่งกลับ
- สร้าง SHA-256 Approval Snapshot และประวัติผู้ตรวจ/เวลา/หมายเหตุ เพื่อกัน MIX เปลี่ยนหลังอนุมัติ
- ถัดไปผลิต E-book เฉพาะ Intake approved ที่ Snapshot ยังตรง
# v0.14.233 — Vision 13 Approved Snapshot → EPUB (IMPLEMENTED · EVENT CASE COMPLETE)
- ผลิต EPUB ภาษาไทยจากคิวที่ `approved` เท่านั้น และคำนวณ Approval Snapshot ซ้ำก่อนเริ่มทุกครั้ง
- ถ้า MIX เปลี่ยนหลังอนุมัติ ระบบหยุดด้วย `APPROVAL_SNAPSHOT_MISMATCH` และไม่สร้างไฟล์
- เก็บ EPUB ใน R2 พร้อม Artifact SHA-256, ขนาด, จำนวนรายการ, ผู้ผลิต และ Audit History ก่อนเปลี่ยนสถานะเป็น `produced`
- ศูนย์ Vision 13 แสดงคิวพร้อมผลิต/ผลิตแล้ว และดาวน์โหลด Artifact ที่ตรวจสอบย้อนกลับได้
# v0.14.234 — Sales Page Center Phase 1 (IMPLEMENTED · EVENT CASE CONTINUES)
- เพิ่มศูนย์หลังบ้านสำหรับ Ad Shortcut และ SEO Automation พร้อม Template กลางและสินค้าเชื่อมโยง
- Slug ไม่ซ้ำ, Revision History, สถานะ draft/reviewing/approved/published/paused/archived และ Preview มือถือ
- Ad Shortcut เป็น noindex เสมอ; SEO ต้องผ่าน Boss Approval ของ Revision ปัจจุบันก่อนเผยแพร่/index
- แก้ข้อมูลหลังอนุมัติแล้วระบบถอน Approval และกลับเป็น draft อัตโนมัติ
- ระยะถัดไปสร้าง Public Renderer และการซื้อจริงสำหรับ Ad Shortcut
# v0.14.235 — Ad Shortcut Public Renderer + Checkout Path (IMPLEMENTED · EVENT CASE CONTINUES)
- เพิ่ม Public URL `/s/{slug}` สำหรับ Ad Shortcut ที่เผยแพร่แล้ว พร้อม `noindex,nofollow` ทั้ง Meta และ HTTP Header
- ดึงเฉพาะสินค้าจริงที่ published/ไม่ถูกลบ พร้อมราคาโปรโมชั่นปัจจุบัน; ถ้าไม่มีสินค้าพร้อมขายตอบ 410
- ปุ่มเพิ่มตะกร้า/ซื้อทันทีใช้ `vd_cart` และ `/cart` เดิม จึงรักษากฎราคา ส่วนลด ชุดรวม และชำระเงินชุดเดียวกัน
- หน้า Mobile-first และมีลิงก์เปิดหน้าจริงจาก Sales Page Center
- ระยะถัดไป UTM, Conversion Event และ A/B Variant
# v0.14.236 — Ad UTM + Conversion + A/B Variants (IMPLEMENTED · EVENT CASE CONTINUES)
- เพิ่ม Variant A/B แบบถ่วงน้ำหนักรวม 100 และจำ Variant เดิมของผู้ชมแต่ละหน้า
- รับ UTM source/medium/campaign และใช้ Variant เป็น content พร้อมเก็บ landing/add-to-cart/checkout ใน Customer Intelligence เดิม
- Session Attribution ไหลต่อถึง `/cart` และ Purchase Attribution เดิมเมื่อออเดอร์ชำระสำเร็จ
- เพิ่มหน้าตั้งค่า A/B และสรุป Event แยก Variant ย้อนหลัง 30 วัน โดยไม่เก็บ PII เพิ่ม
- ระยะถัดไป SEO Automation Draft Engine
# v0.14.237 — V12 Inbox Conversation Recovery (IMPLEMENTED · URGENT EVENT CASE COMPLETE)
- เปิดบทสนทนาแรกอัตโนมัติเมื่อมีลูกค้า ลดหน้าว่างที่ทำให้เข้าใจว่าไม่มีแชต
- ใช้ DOM reference โดยตรงแทน global จาก id พร้อมสถานะโหลด ข้อผิดพลาด และปุ่มลองใหม่ในพื้นที่แชต
- อัปเดต cache stamp ของหน้า V12 เป็นแพตเดียวกัน โดยไม่แตะหรือลบประวัติข้อความลูกค้า

# v0.14.252 — Course Opening Plans 1/2/3 (IMPLEMENTED · EVENT CASE COMPLETE)
- ศูนย์จัดการคอร์สแสดงและบันทึกรูปแบบตามลำดับเดียวกับสื่อประชาสัมพันธ์เสมอ: `1 ซื้อสิทธิ์`, `2 เริ่มขายฟรี`, `3 พาร์ตเนอร์ 50/50` เพื่อไม่ให้ลูกค้าสับสน
- แบบ 1 ใช้ 1 เครดิตต่อหนึ่งตะกร้าคอร์ส รับเงินเข้าผู้สอนและผู้สอนได้ 100%
- แบบ 2 เปิดฟรีได้สูงสุด 3 คอร์ส คอร์สละไม่เกิน 5 EP รับเงินเข้าผู้สอนและผู้สอนได้ 100%
- แบบ 3 ไม่จำกัดคอร์สและ EP รับเงินเข้าบริษัท VisionD ตรวจสลิปด้วยระบบกลาง แบ่ง VisionD/ผู้สอน 50/50 และหักค่าตรวจ API 1 บาทจากส่วนผู้สอน
- ทุกหน้าหรือ API ในอนาคตที่อ้างถึงรูปแบบเปิดคอร์สต้องใช้รหัสแผนกลางและลำดับ 1/2/3 นี้ ห้ามเรียงใหม่เอง

# v0.14.253 — Clickable Course Plan Cards (IMPLEMENTED · BUGFIX COMPLETE)
- กล่องสรุปแบบ 1/2/3 ในศูนย์จัดการคอร์สต้องเป็นปุ่มเลือกจริง กดแล้วเปิดฟอร์มและเลือกแผนนั้นอัตโนมัติ
- ข้อความยืนยันสร้างต้องตรงกับแผนที่เลือก และกล่าวถึงการหักเครดิตเฉพาะแบบ 1

# v0.14.254 — Dedicated Create Button Per Course Plan (IMPLEMENTED · UI COMPLETE)
- แบบ 1, 2 และ 3 ต้องมีปุ่ม `สร้างคอร์สแบบ 1/2/3` ของตัวเองภายในกล่อง
- ซ่อนปุ่มสร้างคอร์สรวมด้านบน เหลือปุ่มเติมเครดิตแยก เพื่อไม่ให้ลูกค้าสับสนว่าจะสร้างด้วยแผนใด

# v0.14.255 — Dedicated Course Creation Page Per Plan (IMPLEMENTED · FLOW COMPLETE)
- ปุ่มสร้างคอร์สแบบ 1, 2 และ 3 ต้องพาเข้าหน้าสร้างเฉพาะของแผนนั้น ไม่เปิดฟอร์มร่วมในหน้าศูนย์
- หน้าสร้างต้องล็อกแผน แสดงชื่อและเงื่อนไขเฉพาะ พร้อมปุ่มย้อนกลับ และเมื่อสร้างสำเร็จให้กลับไปจัดการคอร์สที่สร้าง

# v0.14.256 — Course Plan Specific Step Guides (IMPLEMENTED · FLOW COMPLETE)
- กล่องขั้นตอนเดิมของแบบ 1 ต้องไม่แสดงในหน้าศูนย์รวม และย้ายเข้าไปอยู่ก่อนฟอร์มสร้างแบบ 1
- หน้าสร้างแบบ 2 และ 3 ต้องมีกล่องขั้นตอนของตัวเอง โดยใช้เงื่อนไขและข้อความเฉพาะแผน
- ย้ายบัญชีรับเงินและการตรวจสลิปออกจากหน้าศูนย์รวม: แบบ 1 ตั้งบัญชีและเลือกตรวจเอง/EasySlip, แบบ 2 ตั้งบัญชีและตรวจเอง, แบบ 3 รับเงินและตรวจอัตโนมัติโดย VisionD

# v0.14.257 — Unified Owner Course Catalog (IMPLEMENTED · DATA COMPLETE)
- คอร์สที่สร้างจากแบบ 1, 2 หรือ 3 ต้องรวมแสดงใน `คอร์สของฉัน` โดยไม่กรองตามแผน
- การ์ดคอร์สต้องมีป้ายบอกแบบที่ใช้สร้าง และข้อความกรณีว่างต้องไม่บังคับว่าต้องใช้เครดิต

# v0.14.258 — Plan 1 Actions Inside Its Steps (IMPLEMENTED · UI COMPLETE)
- หน้าแบบ 1 ต้องไม่มีตัวเลือกแบบ 2–3 และต้องล็อกแบบ 1 เป็นค่าเดียว
- ย้ายปุ่มซื้อเครดิตไปขั้นตอน 1 และปุ่มไปกรอก/สร้างคอร์สไปขั้นตอน 3 พร้อมซ่อนปุ่มเดิมในส่วนหัว

# v0.14.259 — Sequential Course Center Parts (IMPLEMENTED · UI COMPLETE)
- ศูนย์จัดการคอร์สต้องให้เลือกแบบ 1–3 ก่อนสร้าง และไม่แสดงปุ่มสร้าง/เติมเครดิตซ้ำเหนือรายการ
- ปุ่มซื้อเครดิตอยู่เฉพาะการ์ดแบบ 1 และ PART ที่มองเห็นต้องเรียง 1–6 โดยไม่ข้ามเลขเพราะส่วนที่ซ่อน
- ขั้นสร้างคอร์สของทุกแบบต้องรองรับเพิ่ม EP พร้อมคำอธิบาย วิดีโอหรือเอกสารแนบ เพิ่ม EP ต่อเนื่อง และจบด้วยปุ่มส่งตรวจ

# v0.14.260 — Plan Actions Below Plan Header (IMPLEMENTED · UI COMPLETE)
- หน้าแบบ 1 ต้องย้ายปุ่ม `สร้างตะกร้าคอร์ส` และ `ซื้อสิทธิ์` จากส่วนหัวศูนย์ มาอยู่ใต้กล่อง `ซื้อสิทธิ์ 499 บาท` โดยตรง
- ปุ่มต้องไม่มีสำเนาซ้ำในช่องขั้นตอน และบนมือถือยังเรียงอ่านและกดได้ชัดเจน

# v0.14.261 — Course Seller Cache Stamp Coverage (IMPLEMENTED · BUGFIX COMPLETE)
- หน้า `course-seller.html` ต้องอยู่ในรายการประทับเลขแพตทุกครั้ง เพื่อให้ไฟล์ JS/CSS ใหม่ถูกโหลดหลัง Deploy
- ห้ามหน้า Course Seller อ้างไฟล์ `course-seller.js` หรือ `course-seller.css` ด้วยเลขแพตเก่า เพราะจะทำให้ UI ย้อนกลับไปใช้โค้ดเดิม

# v0.14.262 — Admin PDF Cover Maker (IMPLEMENTED · URGENT EVENT CASE)
- หน้าจัดการสินค้าหลังบ้านมีปุ่ม `สร้างปก PDF` ต่อจากปุ่มเพิ่มสินค้าเอง
- รับเฉพาะรูปสินค้า JPG/PNG/WEBP 1 รูปไม่เกิน 8 MB พร้อมชื่อปก และมีกรอบมาตรฐานให้เลือก
- ระบบจัดฟอนต์และขนาดชื่อให้สัมพันธ์กับกรอบ แสดงตัวอย่างทันที และดาวน์โหลด PNG 1000 × 1400 px ได้โดยไม่ส่งรูปออกจากเบราว์เซอร์

# v0.14.269 — Course Center Surface Removal (IMPLEMENTED · CLEANUP)

- ถอดชุดกล่องงานคอร์สที่ยังไม่จัดลำดับออกจาก DOM จริง ไม่ใช้การซ่อน เพื่อป้องกันโค้ดส่วนอื่นเปิดกลับโดยไม่ตั้งใจ
- ปรับ JavaScript ให้ไม่เรียกองค์ประกอบที่ถอดออก โดยเก็บ API และข้อมูลเดิมไว้สำหรับออกแบบลำดับงานใหม่
- กฎถาวร: เมื่อสั่งเอาเนื้อหาหรือส่วนประกอบออก ต้องลบออกจริง ห้ามใช้ `hidden`, CSS, เงื่อนไข JavaScript หรือ DOM แฝงเพื่อซ่อน เว้นแต่คำสั่งระบุชัดว่าให้ซ่อน

# v0.14.268 — Course Center Temporary Surface Cleanup (IMPLEMENTED · UI)

- ซ่อนชุดงานที่ยังจัดลำดับไม่ลงตัวออกจากหน้าคอร์สชั่วคราว ได้แก่ สิ่งที่ต้องดำเนินการ ตะกร้าคอร์ส ยอดขาย และออเดอร์สลิปผิดปกติ
- เก็บโครงสร้างและข้อมูลเดิมไว้ ไม่ลบ API หรือข้อมูล เพื่อรอไล่ลำดับงานใหม่

# v0.14.267 — Red Angular PDF Cover (IMPLEMENTED · UI)

- ปรับกรอบโมเดิร์นของเครื่องมือสร้างปก PDF เป็นเรขาคณิตเหลี่ยม เล่นมุม และใช้สีแดง ดำ ขาว
- เพิ่มกรอบรูปเส้นแดง มุมตัด และลายเส้นเฉียง โดยรักษาความชัดเจนของชื่อปกและรูปสินค้า

# v0.14.266 — Course Plan 1 Single-page Workflow (IMPLEMENTED · FEATURE)

- หน้าแบบ 1 แสดงเครดิตและบล็อกการสร้างเมื่อเครดิตไม่พอทั้งหน้าเว็บและ API
- หลังสร้างคอร์สคงอยู่ในเส้นทางแบบ 1 พร้อมตั้งค่ารับเงิน ตัวแก้ไข EP อัปโหลดวิดีโอ/เอกสาร เพิ่ม EP และส่งตรวจ

# v0.14.265 — PDF Cover Visual Refresh (IMPLEMENTED · UI)

- ปรับฟอนต์หัวเรื่องปก PDF ให้มีน้ำหนักและช่องไฟเหมาะกับภาษาไทย
- ออกแบบกรอบ Modern, Kids และ Elegant ใหม่ให้มีองค์ประกอบและมิติแตกต่างกันจริง

# v0.14.264 — Course Plan Payment Rules (IMPLEMENTED · CLARIFICATION)

- รวมหน้าตั้งค่ารับเงินและตรวจสลิปไว้ใน Course Center แต่ไม่รวมกติกาธุรกิจเข้าด้วยกัน
- แบบ 1 และ 2 รับเงินเข้าผู้สอน ผู้สอนได้ 100% และเลือกตรวจเองหรือ EasySlip ของผู้สอน
- แบบ 3 รับเงินเข้า VisionD แบ่ง 50/50 ตรวจโดย VisionD และหักค่าตรวจ 1 บาทจากส่วนผู้สอน

# v0.14.263 — Shared Course Payment and Slip Settings (IMPLEMENTED · FLOW FIX)
- บัญชีรับเงินและโหมดตรวจสลิปต้องตั้งจาก `/course-center` เพียงจุดเดียว และใช้ค่าร่วมกับคอร์สของเจ้าของทุกแบบ
- หน้าสร้างคอร์สแบบ 1, 2 และ 3 ห้ามย้ายหรือแสดงกล่องตั้งค่ารับเงิน/EasySlip ซ้ำ
- หากส่งตรวจแล้วพบว่ายังตั้งค่าไม่ครบ ระบบต้องพากลับไปยังส่วนตั้งค่าที่ถูกต้องในศูนย์จัดการคอร์ส
# v0.14.270 — Course Plan Entry Navigation (IMPLEMENTED · UI)

- หน้าศูนย์จัดการคอร์สใช้การ์ดแบบ 1, 2 และ 3 เป็นทางเข้าเท่านั้น โดยใช้ข้อความ `เข้าแบบ 1/2/3`
- ปุ่มเริ่มสร้างคอร์สอยู่ภายในหน้ารายละเอียดของแต่ละแบบ และระบุเลขแบบให้ชัดเจน
- ปุ่มซื้อเครดิตย้ายอยู่ภายในหน้าแบบ 1 คู่กับขั้นตอนสร้างคอร์ส ไม่แสดงบนหน้าทางเข้า
# v0.14.271 — Course Plan Revenue Labels (IMPLEMENTED · UI)

- ปุ่มทางเข้าแบบ 1 และแบบ 2 ระบุชัดเจนว่าผู้สอนรับรายได้ 100%
- ปุ่มทางเข้าแบบ 3 ระบุชัดเจนว่าผู้สอน 50% และ VisionD 50%
- ข้อมูลส่วนแบ่งแสดงก่อนผู้ใช้เข้าสู่ขั้นตอนสร้างคอร์ส ลดความสับสนในการเลือกแผน
# v0.14.272 — Course Center Single Initial View (IMPLEMENTED · BUGFIX)

- ลบโครงหน้าจัดการคอร์สรุ่นเก่าออกจาก `/course-center` จริง เพื่อไม่ให้แสดงชั่วคราวระหว่างรอ API
- แยก JavaScript ของหน้าทางเข้าออกจากหน้าสร้างคอร์ส ทำให้ URL เดียวไม่สลับระหว่างสองหน้าตามความเร็วเครือข่าย
- หน้าเริ่มต้นมีเฉพาะหัวข้อใหม่ สถานะโหลด และทางเข้าแบบ 1/2/3 ตามที่ตกลง
# v0.14.273 — Free Course Plan Limit Label (IMPLEMENTED · UI)

- กล่องทางเข้าแบบ 2 แสดงข้อจำกัดก่อนกดเข้า: สูงสุด 3 คอร์ส และแต่ละคอร์สไม่เกิน 5 EP
- คงตัวนับจำนวนคอร์สที่ใช้แล้วเทียบกับโควตา 3 คอร์สไว้บนกล่องเดียวกัน
# v0.14.274 — Explicit Course Plan URLs (IMPLEMENTED · UX)

- URL หน้าสร้างคอร์สระบุเลขแบบตรงตัวเป็น `/course-seller?type=1`, `type=2` และ `type=3`
- เลิกส่งผู้ใช้ใหม่ไปยัง query ภายในแบบ `create=rights/free/partner` แต่ยังอ่านลิงก์เก่าได้เพื่อไม่ให้ bookmark เดิมเสีย
- ชื่อแท็บและหัวข้อหน้าเปลี่ยนเป็น `สร้างคอร์สแบบ X` ทันทีก่อนรอ API ทำให้ผู้ใช้รู้ว่าอยู่แบบใดตั้งแต่เปิดหน้า

# v0.14.275 — Course Plan 1 Seven-step Page (IMPLEMENTED · EVENT CASE)

- รื้อหน้าสร้างคอร์สแบบ 1 เดิมและลบตัวเลือกแบบ 2–3 ออกจาก DOM จริง ไม่ใช้ CSS หรือ JavaScript ซ่อนส่วนเก่า
- จัดกระบวนการแบบ 1 เป็น 7 ขั้น: ตรวจเครดิต, ข้อมูลคอร์ส, EP, บัญชีรับเงิน, ตรวจสลิป, ตรวจความพร้อม และส่งตรวจ
- ยืนยันกติกาแบบ 1 บนหน้า: 499 บาทต่อสิทธิ์, 1 เครดิตต่อ 1 คอร์ส, เงินเข้าผู้สอนโดยตรง และผู้สอนรับ 100%
- ตะกร้าคอร์สหน้าบ้าน หน้าแรก และหน้ารายละเอียดต้องมีป้ายเลขแบบพร้อมกติกาส่วนแบ่ง เพื่อแยกแบบ 1, 2 และ 3 ได้ทันที
- กฎ v0.14.263 เรื่องไม่แสดงการตั้งค่าในหน้าสร้างถูกแทนที่เฉพาะแบบ 1 ตามกระบวนการใหม่นี้

# v0.14.276 — Course Plan 1 Immediate Form and Credit Retry (IMPLEMENTED · BUGFIX)

- หน้าสร้างคอร์สแบบ 1 ต้องแสดงฟอร์มข้อมูลคอร์สทันทีโดยไม่รอ API เครดิตตอบกลับ เพื่อไม่ให้หน้าเหลือแต่ข้อความกำลังโหลด
- แสดงปุ่มเริ่มกรอกข้อมูลคอร์สและจำนวนเครดิตในขั้นแรกอย่างชัดเจน โดยยังบล็อกการบันทึกเมื่อเครดิตไม่พอ
- ส่วน EP บัญชีรับเงิน ตรวจสลิป และส่งตรวจจะแสดงตามลำดับหลังสร้างข้อมูลคอร์สแล้ว ไม่แสดงส่วนปลายกระบวนการปะปนตั้งแต่เริ่ม
- การตรวจเครดิตมีเวลารอสูงสุด 12 วินาที และแสดงปุ่มลองตรวจใหม่เมื่อเครือข่ายหรือ API ผิดพลาด ห้ามค้างสถานะกำลังโหลดไม่สิ้นสุด

# v0.14.277 — Two Course Plans Only (IMPLEMENTED · BUSINESS RULE)

- ระบบเปิดคอร์สเหลือ 2 แบบเท่านั้น: `แบบ 1 ซื้อสิทธิ์ 499 บาท` ผู้สอนรับ 100% และ `แบบ 2 พาร์ตเนอร์ 50/50` แบ่งผู้สอน/VisionD ฝ่ายละ 50%
- ลบแบบเริ่มขายฟรีออกจากหน้าเว็บ เส้นทางสร้าง API ข้อความหน้าร้าน และบทตอบของ V12 จริง ไม่ใช้การซ่อนด้วย CSS หรือ JavaScript
- เปลี่ยนเลขพาร์ตเนอร์จากแบบ 3 เป็นแบบ 2 ทุกจุด และ API ปฏิเสธการสร้างคอร์สด้วยค่า `free`
- คอร์สฟรีเก่าที่ยังอยู่ในฐานข้อมูลยังเปิดอ่านและขายต่อได้ด้วยกติกาผู้สอนรับ 100% เพื่อไม่ทำลายข้อมูลเดิม แต่สร้างคอร์สฟรีใหม่ไม่ได้
- กฎสามแบบในแพตช์ก่อนหน้าถูกยกเลิกและแทนที่ด้วยกฎสองแบบนี้

# v0.14.278 — Two-plan Explanatory Copy (IMPLEMENTED · UI)

- เก็บข้อความกำกับเงื่อนไขและส่วนแบ่งรายได้ของแบบ 1 ซื้อสิทธิ์ และแบบ 2 พาร์ตเนอร์ไว้ครบหลังลดจากสามแบบเหลือสองแบบ
- คืนปุ่ม `แก้ไขข้อมูลตะกร้าคอร์สนี้` ในหน้าแบบ 1 โดยผูกกับ Course ID ที่สร้างจริงโดยตรง สาเหตุเดิมคือหน้าเฉพาะแบบ 1 ถอดกล่องรายการคอร์สออกจาก DOM ไม่ใช่ตะกร้าถูกล็อก
- หน้าจัดการตะกร้ายังคงเป็นผู้ตรวจสิทธิ์แก้ไขเนื้อหาจากยอดซื้อและระยะเวลา เพื่อไม่ให้ปุ่มหน้าแบบ 1 เดาสถานะล็อกเอง

- เก็บข้อความกำกับบนการ์ดเลือกแบบคอร์สไว้ครบหลังลดเหลือสองแบบ ห้ามเหลือเฉพาะชื่อหรือปุ่มโดยไม่มีเงื่อนไข
- แบบ 1 ระบุราคา 499 บาท การใช้ 1 เครดิตต่อคอร์ส เงินเข้าผู้สอน และผู้สอนรับ 100%
- แบบ 2 ระบุว่าไม่จำกัดคอร์สและ EP เงินเข้า VisionD ตรวจสลิปอัตโนมัติ และแบ่งผู้สอน/VisionD 50/50
- ข้อความนำและสถานะว่างกล่าวถึงเฉพาะแบบ 1 และแบบ 2 เท่านั้น

# v0.14.279 — Course Type 1 Creation Path Recovery (IMPLEMENTED · BUG)

- แก้เส้นทาง `/course-seller?type=1` ที่ค้างตรง “กำลังโหลดเครดิต” และทำให้ปุ่มเริ่มสร้างไม่ทำงาน
- สาเหตุจริงคือหน้าแบบ 1 ถอด Hero และกล่องสรุปเครดิตออกจาก DOM ก่อน API ตอบ แต่ JavaScript ยังอาศัย Window named property ของ `licenseList` และ `createCourseBasket` จึงเกิด ReferenceError ระหว่าง render
- เก็บ element reference แบบชัดเจนก่อนปรับ DOM และตรวจ null ก่อนเขียนค่า ทำให้ API สามารถเติมเครดิต ตั้งค่าบัญชี และเปิดปุ่มเริ่มกรอกข้อมูลได้ตามยอดเครดิตจริง
- กฎเดิมยังคงอยู่: แบบ 1 ต้องมีเครดิตว่างอย่างน้อย 1 เครดิตจึงสร้างตะกร้าใหม่ได้ ส่วนตะกร้าที่สร้างแล้วต้องเข้าแก้ไขด้วย Course ID เดิม

# v0.14.291 — Course Video 720p Upload Gate (IMPLEMENTED · VALIDATION)

- คลิป EP ต้องมีความละเอียดไม่เกิน 1280×720 สำหรับแนวนอน หรือ 720×1280 สำหรับแนวตั้ง
- ตรวจ metadata ของไฟล์จริงก่อนสร้างร่าง บันทึก EP หรือเริ่ม multipart upload; ช่องเลือกคุณภาพอย่างเดียวไม่ถือเป็นหลักฐาน
- หากสูงกว่า 720p ให้ปฏิเสธและแจ้งผู้สอนแปลงไฟล์ก่อน โดยไม่แอบซ่อนฟังก์ชันเดิมและไม่เพิ่มระบบแปลงไฟล์ที่มีต้นทุน
- คง R2 multipart สูงสุด 2 GB, การสร้างร่าง และไฟล์ประกอบเดิมทั้งหมด

# v0.14.292 — Course Draft and EP Direct Review Submit (IMPLEMENTED · FLOW)

- ปุ่มล่างสุดของหน้าสร้างคอร์สพร้อม EP ใช้ข้อความ `ส่งตรวจ` และทำงานครบเส้นทางเดียว
- ระบบสร้างคอร์สร่าง อัปโหลดรายละเอียดและไฟล์ของทุก EP แล้วเรียก API ส่งตรวจหลังบ้านทันที
- หากสร้างร่างหรืออัปโหลดสำเร็จบางส่วนแต่ส่งตรวจไม่ผ่าน ให้เก็บร่างและข้อมูลในแบบฟอร์มไว้เพื่อกด `ลองส่งตรวจอีกครั้ง`
- ไม่สร้างคอร์สซ้ำเมื่อกดทำต่อ และยังตรวจความพร้อมของทุก EP กับราคาขั้นต่ำผ่าน API เดิม
- เส้นอนุมัติหลังบ้านต้องแยกเงื่อนไขคอร์สซื้อสิทธิ์กับพาร์ตเนอร์ ห้ามนำเงื่อนไขเครดิตเก่ามาขวางพาร์ตเนอร์
- เมื่อ Boss อนุมัติ ต้องเปิดทั้ง `courses.active=1` และ `products.status='published'` เพื่อให้ปรากฏในแคตตาล็อกคอร์ส
# v0.14.293 — Course Center Sales Dashboard

- ศูนย์จัดการคอร์สต้องแสดงตะกร้าคอร์สเก่าและใหม่ของเจ้าของ ห้ามซ่อนงานเดิม
- การ์ดตะกร้าต้องเปิดหน้าแก้ไข EP และรองรับการส่งตรวจใหม่ตามสถานะ
- แดชบอร์ดผู้สอนเลือกดูยอดขายตามช่วงวันได้ครั้งละไม่เกิน 60 วัน
- แสดงยอดรวม รายได้ผู้สอน จำนวนออเดอร์ จำนวนสมาชิก ชื่อสมาชิก คอร์ส และวันเวลา
- ห้ามส่งอีเมล เบอร์โทร ข้อมูลชำระเงิน หรือข้อมูลสมาชิกเกินความจำเป็นในรายงานผู้สอน
# Patch v0.14.294 — รักษาสถานะปุ่มส่งตรวจหลังรีเฟรช

# Patch v0.14.295 — คืนร่างล่าสุดก่อนแสดงปุ่มสร้างคอร์ส

- เมื่อไม่มี `course_id` ใน URL หรือหน่วยความจำ ให้ค้นหาร่างล่าสุดของเจ้าของที่ยังแก้ไขได้
- ร่างเดิมต้องกลับเข้าส่วน EP และปุ่มส่งตรวจ ห้ามย้อนเป็นปุ่มสร้างร่างหลังรีเฟรช
- ห้ามสร้างร่างซ้ำจากสถานะโหลดหรือสถานะจำรหัสไม่ทัน

# Patch v0.14.296 — ลบขั้นตอนรับเงินของผู้สอนแบบเก่า

- หน้าสร้างคอร์สพาร์ตเนอร์ต้องไม่มีฟอร์มบัญชีธนาคารหรือ EasySlip ของผู้สอน
- VisionD เป็นผู้รับเงิน ตรวจสลิป และแบ่งรายได้ในรูปแบบพาร์ตเนอร์
- ปุ่มขั้นแรกใช้คำว่า “บันทึกข้อมูลและไปจัดการ EP” และร่างเดิมต้องไปต่อที่ EP/ส่งตรวจ

- หน้าสร้างคอร์สต้องโหลดและยืนยันตะกร้าร่างเดิมก่อนแสดงปุ่มดำเนินการ
- จำตะกร้าที่กำลังแก้ในแท็บ และคืน `course_id` ลง URL เมื่อรีเฟรช
- ถ้า API โหลดล้มเหลว ห้ามย้อนกลับไปแสดงปุ่มสร้างคอร์สใหม่ และต้องแจ้งว่าร่างเดิมไม่ถูกลบ
# อัปเดต v0.14.297 — Course Seller Single Controller

- หน้าสร้างคอร์สต้องมี JavaScript controller เพียงชุดเดียวตลอดวงจร โหลด/รีเฟรช/คืนร่าง
- ห้ามนำ flow เครดิต, บัญชีผู้สร้างคอร์ส หรือ EP builder รุ่นเก่ากลับมาแนบกับหน้าพาร์ตเนอร์
- ปุ่มท้ายขั้นตอนหลังมีร่างและ EP ต้องมาจาก state ปัจจุบันและนำไปส่งตรวจ ห้ามมีตัวควบคุมอื่นเขียนทับเป็นปุ่มสร้างคอร์ส

# อัปเดต v0.14.298 — EP Workspace รุ่นปัจจุบัน

- ส่วน EP ต้องอยู่ต่อจากข้อมูลตะกร้าคอร์สและมองเห็นเส้นทางงานตลอดเวลา
- ก่อนสร้างร่าง ให้ส่วน EP แจ้งว่าต้องบันทึกตะกร้าก่อน; หลังสร้างร่างให้เปิดการเพิ่ม EP ทันที
- EP เป็นข้อมูลลูกของตะกร้าคอร์ส ต้องมีชื่อ คำอธิบาย ระยะเวลา คลิปไม่เกิน 2 GB/720p หรือเอกสารประกอบ
- ห้ามสร้าง EP เปล่าอัตโนมัติในฐานข้อมูล และห้ามมีปุ่มพับส่วน EP
- ส่งตรวจได้ต่อเมื่อมี EP อย่างน้อยหนึ่งรายการและทุก EP มีชื่อพร้อมสื่อประกอบ
