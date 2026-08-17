# VisionD Roadmap — Living Plan

Updated: 2026-08-16
Current build: v0.14.223

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
