# VisionD Feature Map

เอกสารกลางสำหรับตามเส้นทางฟีเจอร์จากหน้าเว็บไปถึงโค้ด API และข้อมูลจริง ใช้คู่กับ `JARVIS-PATCH-PROTOCOL.md` และต้องอัปเดตในแพตช์เดียวกับการเปลี่ยนสาระสำคัญของฟีเจอร์

## รูปแบบรหัส

`DOMAIN-CAPABILITY-NNN` เช่น `COURSE-EP-001`

- รหัสเดิมห้ามนำกลับไปใช้กับฟีเจอร์อื่น
- หนึ่งฟีเจอร์ใช้รหัสเดียวกันข้าม frontend, backend, test และเอกสาร
- งานย่อยที่มีขอบเขตข้อมูลหรือสิทธิ์ต่างกันให้แยกรหัส

## แบบฟอร์มลงทะเบียนฟีเจอร์

```md
## DOMAIN-CAPABILITY-NNN — ชื่อฟีเจอร์
- สถานะ:
- หน้า:
- ไฟล์:
- ฟังก์ชัน/ตัวควบคุม:
- ปุ่ม/interaction:
- API:
- ฐานข้อมูล / ตาราง / ฟิลด์:
- Input:
- Output:
- Reads:
- Writes:
- สิทธิ์:
- ห้ามกระทบ:
- การทดสอบ:
```

## COURSE-EP-001 — EP เป็นส่วนหนึ่งของตะกร้าคอร์ส

- สถานะ: `IMPLEMENTED`; ใช้เป็นรายการตั้งต้นของมาตรฐาน v0.14.303
- หน้า: `/course-seller?type=1`, `/course-seller?type=2`
- ไฟล์: `public/course-seller.js`, `functions/api/course-seller/index.js`, `functions/api/course-seller/[id]/lessons.js`, `functions/api/course-seller/[id]/lessons/[lessonId].js`
- ฟังก์ชัน/ตัวควบคุม: `addSellerLesson.onclick`, `sellerLessonForm.onsubmit`, `resetLessonEditor()`, `renderLessons()`
- ปุ่ม/interaction: ปุ่ม `เพิ่ม EP`, ฟอร์ม `sellerLessonForm`, แก้ไข/ลบ EP และไฟล์ประกอบ
- API: `GET/POST /api/course-seller`, `GET/POST /api/course-seller/:courseId/lessons`, `POST/DELETE /api/course-seller/:courseId/lessons/:lessonId`
- ฐานข้อมูล / ตาราง / ฟิลด์: D1; `courses.id`, `courses.expected_episodes`, `courses.total_minutes`, `course_lessons.course_id`, `course_lessons.title`, `course_lessons.description`, `course_lessons.duration_seconds`, `course_lessons.video_key`, `course_lessons.pdf_key`, `course_lesson_files.lesson_id`
- Input: `course_id`, ชื่อ EP, คำอธิบาย, ระยะเวลา, คลิป และไฟล์ประกอบ
- Output: รายการ EP ที่ผูกกับตะกร้าคอร์สเดียวกัน พร้อมสถานะความครบถ้วน
- Reads: คอร์สของผู้ใช้, จำนวน/ลำดับ EP และไฟล์ประกอบ
- Writes: เพิ่ม/แก้/ลบ `course_lessons` และ `course_lesson_files`; อัปเดตจำนวน EP/เวลาใน `courses` และจำนวนหน้า/สถานะร่างใน `products`
- สิทธิ์: สมาชิกที่เป็นเจ้าของคอร์สเท่านั้น; API ตรวจ ownership และสถานะที่แก้ได้
- ห้ามกระทบ: ห้ามสร้าง EP เปล่า, ห้ามแยก EP ออกจาก `course_id`, ห้ามทำลายไฟล์ของ EP อื่น, ห้ามเปิดคอร์สโดยข้ามการส่งตรวจ
- การทดสอบ: `scripts/test-v014298.mjs`, `scripts/test-v014300.mjs`, `scripts/test-v014301.mjs`, `scripts/test-v014302.mjs`

## AUTH-ACCOUNT-001 — สมัครสมาชิก เข้าสู่ระบบ และจัดการเซสชัน

- สถานะ: `IMPLEMENTED`; ตรวจเส้นทางย้อนหลังใน v0.14.304
- หน้า: `/`, `/login.html`, `/register.html`, `/forgot-password.html`, `/reset-password.html`, `/dashboard.html`
- ไฟล์: `public/app.js`, `public/member-auth.js`, `public/member-dashboard.js`, `functions/api/auth/register.js`, `functions/api/auth/login.js`, `functions/api/auth/logout.js`, `functions/api/auth/me.js`, `functions/api/auth/change-password.js`, `functions/api/auth/forgot-password.js`, `functions/api/auth/reset-password.js`
- ฟังก์ชัน/ตัวควบคุม: `loadHomeAccount()`, `submitAuth()`, `onRequestPost()`, `requireUser()`
- ปุ่ม/interaction: สมัครสมาชิก, เข้าสู่ระบบ, จำการเข้าสู่ระบบ, ลืม/ตั้งรหัสผ่านใหม่, เปลี่ยนรหัสผ่าน, ออกจากระบบ
- API: `POST /api/auth/register`, `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me`, `POST /api/auth/change-password`, `POST /api/auth/forgot-password`, `POST /api/auth/reset-password`
- ฐานข้อมูล / ตาราง / ฟิลด์: D1; `users.id`, `users.email`, `users.username`, `users.password_hash`, `users.role`, `sessions.id`, `sessions.user_id`, `sessions.expires_at`, `password_reset_tokens`, `user_terms_acceptances`
- Input: ชื่อ นามสกุล ไอดี อีเมล โทรศัพท์ รหัสผ่าน Turnstile และการยอมรับข้อกำหนด
- Output: เซสชันคุกกี้ `vd_session`, ข้อมูลสมาชิกที่ไม่เปิดเผย hash/token และผลดำเนินการ
- Reads: บัญชีผู้ใช้ เซสชัน การยอมรับข้อกำหนด และ token รีเซ็ตรหัสผ่าน
- Writes: สร้าง/แก้บัญชี สร้าง/ยกเลิกเซสชัน บันทึกการยอมรับและ security log
- สิทธิ์: ผู้เยี่ยมชมทำรายการสมัคร/เข้าสู่ระบบ; ข้อมูลบัญชีและเปลี่ยนรหัสผ่านต้องเป็นเจ้าของเซสชัน
- ห้ามกระทบ: ห้ามส่ง `password_hash`, session ID หรือ reset token กลับ frontend; ห้ามข้าม rate limit/Turnstile; ห้ามลดสิทธิ์ตรวจ role
- การทดสอบ: `scripts/test-v01447.mjs`, `scripts/test-v014110-b1.mjs`, `scripts/test-v014304.mjs`

## CATALOG-STOREFRONT-001 — แคตตาล็อกและหน้ารายละเอียดสินค้าดิจิทัล

- สถานะ: `IMPLEMENTED`; ตรวจเส้นทางย้อนหลังใน v0.14.304
- หน้า: `/`, `/digital-products.html`, `/product.html?slug=:slug`
- ไฟล์: `public/catalog-sync.js`, `public/product.js`, `functions/api/products/index.js`, `functions/api/products/[slug].js`, `functions/_catalog.js`, `functions/_promotion.js`
- ฟังก์ชัน/ตัวควบคุม: `renderProduct()`, `renderProductError()`, `onRequestGet()`
- ปุ่ม/interaction: ตัวกรองหมวด ค้นหา เปิดการ์ดสินค้า เลื่อนภาพตัวอย่าง เพิ่มตะกร้า และซื้อทันที
- API: `GET /api/products`, `GET /api/products/:slug`
- ฐานข้อมูล / ตาราง / ฟิลด์: D1; `products.id`, `products.slug`, `products.title`, `products.price`, `products.cover_url`, `products.preview_urls`, `products.category`, `products.product_kind`, `products.status`, `categories.slug`, `analytics_daily`, `page_views`
- Input: `slug`, หมวด คำค้น และสถานะหน้าแคตตาล็อก
- Output: เฉพาะสินค้าที่ `published`, ไม่ถูกลบ และข้อมูลราคา/โปรโมชันสำหรับแสดงผล
- Reads: สินค้า หมวด โปรโมชัน จำนวนเข้าชม และรายการในชุดรวม
- Writes: endpoint สาธารณะไม่เขียนสินค้า; การนับ analytics แยกอยู่ระบบ analytics
- สิทธิ์: เปิดอ่านสาธารณะ; สินค้าร่าง/ลบแล้วต้องไม่ออก API สาธารณะ
- ห้ามกระทบ: ห้ามเปิดเผย object key ของไฟล์จริง; ห้ามนำคอร์สร่างหรือสินค้าหลังบ้านออกหน้าร้าน; ห้ามแก้ราคาเฉพาะ frontend
- การทดสอบ: `scripts/test-commerce-final.mjs`, `scripts/test-v014181.mjs`, `scripts/test-v014304.mjs`

## COMMERCE-ORDER-001 — ตะกร้า ออเดอร์ ชำระเงิน และตรวจสลิป

- สถานะ: `IMPLEMENTED`; ตรวจเส้นทางย้อนหลังใน v0.14.304
- หน้า: `/cart.html`, `/product.html`, `/dashboard.html#orders`
- ไฟล์: `public/cart.js`, `public/product.js`, `public/member-dashboard.js`, `functions/api/orders/index.js`, `functions/api/orders/[id]/slip.js`, `functions/_payment.js`, `functions/_promotion.js`
- ฟังก์ชัน/ตัวควบคุม: `checkout()`, `uploadSlip()`, `onRequestPost()`, `onRequestGet()`, `courseRevenue()`
- ปุ่ม/interaction: เพิ่ม/ลด/ลบสินค้า ชำระเงิน สร้างออเดอร์ อัปโหลดสลิป และดูสถานะ
- API: `GET/POST /api/orders`, `POST /api/orders/:id/slip`
- ฐานข้อมูล / ตาราง / ฟิลด์: D1; `orders.id`, `orders.order_no`, `orders.user_id`, `orders.total`, `orders.status`, `orders.slip_key`, `orders.discount_kind`, `orders.discount_amount`, `order_items.order_id`, `order_items.product_id`, `order_items.price`, `entitlements`
- Input: product slug/quantity, ผู้ใช้จากเซสชัน, รูปสลิป และหมายเหตุโอนเงิน
- Output: ออเดอร์ เลขออเดอร์ ยอด/ส่วนลด บัญชีรับเงิน สถานะตรวจสลิป และสิทธิ์เมื่ออนุมัติ
- Reads: สินค้าที่เผยแพร่ โปรโมชัน ออเดอร์เดิม สิทธิ์เดิม บัญชีรับเงิน และแผนรายได้คอร์ส
- Writes: `orders`, `order_items`, หลักฐานสลิป/ผลตรวจ และ `entitlements` ตามเส้นทางอนุมัติ
- สิทธิ์: ต้องเข้าสู่ระบบ; อ่าน/ส่งสลิปได้เฉพาะออเดอร์ของตน; การอนุมัติอยู่ API ผู้ดูแล/เจ้าของคอร์ส
- ห้ามกระทบ: ห้ามเชื่อราคารวมจาก browser; ห้ามซื้อสินค้าที่ไม่เผยแพร่; ห้ามสร้างสิทธิ์ก่อนชำระผ่าน; ห้ามบันทึกข้อมูลบัตร/ธนาคารของผู้ซื้อ
- การทดสอบ: `scripts/test-commerce-final.mjs`, `scripts/test-first-order-promo.mjs`, `scripts/test-v014304.mjs`

## DELIVERY-DOWNLOAD-001 — สิทธิ์และการดาวน์โหลดไฟล์ที่ซื้อแล้ว

- สถานะ: `IMPLEMENTED`; ตรวจเส้นทางย้อนหลังใน v0.14.304
- หน้า: `/product.html?slug=:slug`, `/dashboard.html#my-products`
- ไฟล์: `public/product.js`, `functions/api/downloads/product/[id].js`, `functions/api/downloads/file/[id].js`
- ฟังก์ชัน/ตัวควบคุม: `loadDownloadAccess()`, `onRequestGet()`
- ปุ่ม/interaction: ตรวจสิทธิ์ ดูตัวอย่าง PDF และดาวน์โหลดไฟล์
- API: `GET /api/downloads/product/:id`, `GET /api/downloads/file/:id`, `GET /api/downloads/file/:id?view=1`
- ฐานข้อมูล / ตาราง / ฟิลด์: D1/R2; `entitlements.user_id`, `entitlements.product_id`, `entitlements.active`, `product_files.id`, `product_files.object_key`, `product_files.mime_type`, `downloads.user_id`, `downloads.product_file_id`
- Input: product/file ID และสมาชิกจากเซสชัน
- Output: รายการไฟล์ที่อนุญาต หรือ stream ไฟล์จาก R2 พร้อม header ที่เหมาะสม
- Reads: สิทธิ์ใช้งาน ไฟล์สินค้า และ object ใน R2
- Writes: ประวัติ `downloads`; ไม่แก้สิทธิ์จาก endpoint ดาวน์โหลด
- สิทธิ์: สมาชิกต้องมี entitlement ที่ active สำหรับ product ของไฟล์
- ห้ามกระทบ: ห้ามคืน R2 object key เป็นลิงก์สาธารณะ; ห้ามใช้ file ID อย่างเดียวโดยไม่ตรวจ entitlement; ห้ามดาวน์โหลดข้ามบัญชี
- การทดสอบ: `scripts/test-commerce-final.mjs`, `scripts/test-v014109-licensed-installer-download.mjs`, `scripts/test-v014304.mjs`

## MEMBER-HUB-001 — ศูนย์สมาชิก ออเดอร์ สินค้า คอร์ส โปรแกรม และการแจ้งเตือน

- สถานะ: `IMPLEMENTED`; ตรวจเส้นทางย้อนหลังใน v0.14.304
- หน้า: `/dashboard.html`, `/my-courses.html`, `/my-programs.html`, `/my-hub.html`
- ไฟล์: `public/member-dashboard.js`, `public/my-hub.js`, `public/my-programs.js`, `functions/api/notifications.js`, `functions/api/member/plans.js`
- ฟังก์ชัน/ตัวควบคุม: `load()`, `loadMyHub()`, `dismissNotice()`, `hubRequest()`, `onRequestGet()`, `onRequestPost()`
- ปุ่ม/interaction: ดูออเดอร์/สิทธิ์/คอร์ส/โปรแกรม อัปโหลดสลิป ปิดแจ้งเตือน ดาวน์โหลดโปรแกรม และปิดสิทธิ์อุปกรณ์
- API: `GET /api/auth/me`, `GET /api/orders`, `GET/POST /api/notifications`, `GET /api/member/plans`, `GET /api/vision7/my-programs`, `DELETE /api/vision7/activate`
- ฐานข้อมูล / ตาราง / ฟิลด์: D1; `users`, `orders`, `order_items`, `entitlements`, `courses`, `notification_reads`, `vision7_licenses`, `vision7_devices`
- Input: สมาชิกจากเซสชัน cursor/limit, notification key และ device ID
- Output: ข้อมูลของสมาชิกปัจจุบัน รายการออเดอร์ สิทธิ์ แจ้งเตือน คอร์ส และโปรแกรม
- Reads: เฉพาะข้อมูลที่ผูก `user_id` หรือ ownership ของสมาชิกปัจจุบัน
- Writes: อ่านแจ้งเตือน ส่งสลิป เปลี่ยนรหัสผ่าน และปิดสิทธิ์อุปกรณ์ตาม interaction
- สิทธิ์: ต้องเข้าสู่ระบบ; ทุก query ต้องผูกกับ `auth.user.id`
- ห้ามกระทบ: ห้ามรวมข้อมูลสมาชิกอื่น; ห้ามแสดงรหัสผ่าน token เต็ม หรือข้อมูลบัญชีธนาคารของผู้ซื้อ; ห้ามใช้ข้อมูลหน้าจอแทน ownership ฝั่ง API
- การทดสอบ: `scripts/test-v01447.mjs`, `scripts/test-v014109-licensed-installer-download.mjs`, `scripts/test-v014304.mjs`

## กฎบำรุงรักษา

## PD-SET-001 — สร้างตะกร้าตุ๊กตากระดาษจาก PDF หลายกลุ่ม

- สถานะ: `IMPLEMENTED` ใน v0.14.312
- หน้า: `/admin` ส่วนการจัดการสินค้า
- ไฟล์: `public/admin.html`, `public/paper-doll-set-builder.js`, `public/paper-doll-set-builder.css`, `functions/api/admin/products/index.js`
- ฟังก์ชัน/ตัวควบคุม: `allocation()`, `analyze()`, `renderPreview()`, `createDrafts()`, `nextProductSlug()`, `onRequestPost()`
- ปุ่ม/interaction: `#paperDollSetBuilderButton`, `#paperDollAnalyzeButton`, `#paperDollCreateButton`
- API: `POST /api/admin/products` โดย `source=paper_doll_set`
- ฐานข้อมูล / ตาราง / ฟิลด์: D1/R2; `products.slug`, `products.category`, `products.status`, `products.source`, `products.pages`, `product_files.object_key`
- Input: PDF หลายไฟล์ จำนวนตะกร้า และราคาเดียวหรือราคาแยกรายตะกร้า
- Output: ตะกร้าร่างหมวด `paper-doll` ชื่อ `ตุ๊กตากระดาษชุดที่ N` และ Slug ปกติของหมวด `paper-doll-NNN`
- ต้นทางรองรับ PNG, PDF, ZIP(PNG) และ ZIP(PDF)
- PNG ที่เลือกพร้อมกันรวมเป็นหนึ่งกลุ่ม; PDF และ ZIP แต่ละไฟล์เป็นหนึ่งกลุ่ม
- ZIP หนึ่งไฟล์ต้องมีเฉพาะ PNG หรือเฉพาะ PDF และระบบจะแปลงเป็น PDF กลางก่อนแบ่งหน้า
- Reads: จำนวนหน้าและลำดับหน้าภายใน PDF แต่ละไฟล์ รวมถึง Slug ปัจจุบันและประวัติ Slug
- Writes: สินค้าร่าง ไฟล์ PDF ที่ประกอบใหม่ และรูปปกหน้าแรกของแต่ละชุด
- สิทธิ์: ใช้ได้เฉพาะผู้ดูแล; API ตรวจสิทธิ์ซ้ำฝั่งเซิร์ฟเวอร์
- ห้ามกระทบ: ห้ามรวมทุก PDF เป็นกองเดียว ห้ามทำหน้าซ้ำ/ตกหล่น ห้ามให้ตะกร้าขาด PDF กลุ่มใด ห้ามเผยแพร่อัตโนมัติ และห้ามสร้างใบที่สำเร็จแล้วซ้ำเมื่อทำต่อหลังข้อผิดพลาด
- การทดสอบ: `scripts/test-v014312.mjs`, `scripts/test-all-regressions.mjs`, `scripts/predeploy-check.mjs`

## COURSE-PARTNER-CHECKOUT-001 — อนุมัติ แคตตาล็อก และชำระเงินคอร์สพาร์ตเนอร์

- หน้า: `/course-center`, แคตตาล็อกคอร์สหน้าแรก, `/dashboard`, `/admin`
- Controller/API: `functions/api/admin/course-seller-reviews/[id].js`, `functions/api/courses/index.js`, `functions/api/orders/index.js`, `functions/api/orders/[id]/slip.js`, `functions/api/admin/orders.js`, `functions/api/admin/orders/[id]/approve.js`, `functions/api/admin/orders/[id]/reject.js`
- Reads: คอร์ส ตะกร้าสินค้า ออเดอร์ บัญชีรับเงินกลาง ผลตรวจ EasySlip และสิทธิ์ Boss
- Writes: สถานะคอร์ส/สินค้า ออเดอร์ ผลตรวจสลิป และ entitlement เมื่ออนุมัติการชำระ
- Input: การอนุมัติคอร์ส การสั่งซื้อ รูปสลิป และการยืนยัน/เหตุผลของ Boss
- Output: คอร์ส published ในแคตตาล็อก ออเดอร์พาร์ตเนอร์ บัญชี VisionD ผลตรวจอัตโนมัติ หรือคิวตรวจแมนนวล
- สิทธิ์: ผู้ซื้อส่งสลิปได้เฉพาะออเดอร์ตน; เฉพาะ Boss อนุมัติ/ปฏิเสธ fallback ของคอร์สพาร์ตเนอร์
- ห้ามกระทบ: ห้ามเผยแพร่คอร์สที่ยังไม่ผ่าน Boss; ห้ามใช้บัญชีผู้สอนกับพาร์ตเนอร์; ห้ามให้ Boss ตรวจแทนคอร์สผู้ขายประเภทอื่น; ห้ามปลดล็อกซ้ำ
- การทดสอบ: `scripts/test-v014310.mjs`, `scripts/test-v01486-vision5-two-account-e2e.mjs`

1. เริ่มแก้ด้วยการค้นหารหัสฟีเจอร์นี้ใน repository
2. รายงานไฟล์และข้อมูลที่จะเปลี่ยนก่อนแก้เมื่อขอบเขตกว้างหรือเสี่ยง
3. เมื่อเส้นทาง runtime เปลี่ยน ให้แก้ Feature Map และ focused test พร้อมกัน
4. หากหลักฐานจริงไม่ตรงเอกสาร ให้หยุดอ้างเอกสารส่วนนั้น ตรวจโค้ด/schema แล้วแก้เอกสารในแพตช์เดียวกัน
