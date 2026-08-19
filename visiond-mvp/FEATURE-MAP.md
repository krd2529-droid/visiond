# VisionD Feature Map

เอกสารกลางสำหรับตามเส้นทางฟีเจอร์จากหน้าเว็บไปถึงโค้ด API และข้อมูลจริง ใช้คู่กับ `JARVIS-PATCH-PROTOCOL.md` และต้องอัปเดตในแพตช์เดียวกับการเปลี่ยนสาระสำคัญของฟีเจอร์

## รูปแบบรหัส

`DOMAIN-CAPABILITY-NNN` เช่น `COURSE-EP-001`

## GOV-PATCH-PROTOCOL-001 — กติกา Active และ routing เอกสารต่อแพต

- สถานะ: `IMPLEMENTED` ใน v0.14.330
- ไฟล์: `START-HERE.md`, `JARVIS-PATCH-PROTOCOL.md`, `work-history/visiond/protocols/JARVIS-PATCH-PROTOCOL.md`
- Input: คำสั่ง Boss, Patch Scope, Acceptance Test และระบบที่แตะ
- Output: ลำดับอำนาจ กฎ `ALWAYS` และรายการเอกสาร `WHEN-TOUCHING`/`REFERENCE`
- Reads: เอกสารเฉพาะระบบเท่าที่ routing กำหนด
- Writes: เอกสารหรือโค้ดเฉพาะขอบเขตแพตที่ Boss อนุมัติ
- ห้ามกระทบ: ห้ามให้ Roadmap/Marketing/History ขยายงาน ห้ามลดกฎความปลอดภัย และห้ามลบฉบับละเอียดเดิม
- การทดสอบ: `scripts/test-v014330.mjs`, `scripts/test-document-history.mjs`, `scripts/test-all-regressions.mjs`

## GOV-ROADMAP-QUEUE-001 — Roadmap Active แบบคิว

- สถานะ: `IMPLEMENTED` ใน v0.14.331
- ไฟล์: `VISIOND-ROADMAP.md`, `work-history/visiond/roadmap/VISIOND-ROADMAP.md`, `work-history/visiond/patch-history/`
- Input: Event Case ที่ Boss อนุมัติ, Active Patch, blocker และคิวเสนอ
- Output: Current Event Case, Active Patch, Next Queue, Blocked และ Recently Completed
- Reads: ประวัติย้อนหลังเฉพาะเมื่อค้น regression/root cause/rollback
- Writes: สถานะคิว Active และรายการล่าสุดเท่าที่เกี่ยวข้องกับแพต
- ห้ามกระทบ: ห้าม Roadmap สั่งเริ่ม Next Queue เอง ห้ามลบประวัติ และห้ามรวม Marketing/กฎธุรกิจกลับเข้า Active Roadmap
- การทดสอบ: `scripts/test-v014331.mjs`, `scripts/test-document-history.mjs`, `scripts/test-all-regressions.mjs`

## GOV-PATCH-GATE-001 — Automated Patch Gate

- สถานะ: `IMPLEMENTED` ใน v0.14.334
- หน้า: ไม่มี; ใช้งานจาก CLI ใน `visiond-mvp`
- ไฟล์: `scripts/patch-gate.mjs`, `scripts/test-all-regressions.mjs`, `scripts/visible-version-check.mjs`, `scripts/predeploy-check.mjs`
- ฟังก์ชัน/ตัวควบคุม: `npm run patch:gate`
- Input: ไฟล์ที่ Stage แล้ว, `VERSION.txt` และ focused test ของเวอร์ชันปัจจุบัน
- Output: PASS/FAIL ของ staged files, focused, visible-version, regression และ predeploy
- Reads: Git staged index และไฟล์ source/test; ไม่อ่าน Secret หรือ environment variables
- Writes: ไม่มี
- สิทธิ์: ใช้ก่อน Commit; ไม่ Push และไม่ Deploy
- ห้ามกระทบ: ต้องหยุดเมื่อไม่มี staged files, พบ `.pnpm-store`, ไฟล์ลับ หรือไฟล์นอกขอบเขต repo ที่อนุญาต
- การทดสอบ: `scripts/test-v014334.mjs` และรัน Gate จริงกับ staged patch

## GOV-UI-DESIGN-001 — UI Design Contract Protocol

- สถานะ: `IMPLEMENTED` ใน v0.14.335
- หน้า: ทุกหน้าที่เพิ่มหรือแก้ Frontend/UI
- ไฟล์: `VISIOND-UI-DESIGN-PROTOCOL.md`, `public/visiond-button-system.css`, `public/visiond-button-system.js`, `public/visiond-design-system.css`, `public/visiond-design-system.js`
- Input: Patch Scope ด้าน UI, canonical component และ interaction ที่ต้องเพิ่มหรือแก้
- Output: UI ที่ใช้ theme/component เดิม พร้อมสถานะ interaction และหลักฐาน Desktop/Mobile ตามความเสี่ยง
- Reads: canonical sources และหน้าเดิมของระบบที่แตะ
- Writes: เฉพาะไฟล์ UI ใน Patch Scope; การเพิ่ม token/variant/component ใหม่ต้องแจ้ง Boss ก่อน
- ห้ามกระทบ: ห้ามสร้าง button style/theme ย่อยเฉพาะหน้า ห้ามเปลี่ยน business behavior, API หรือ Database
- การทดสอบ: focused UI contract test และ `npm run patch:gate`; โปรโตคอลตรวจด้วย `scripts/test-v014335.mjs`

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

## COURSE-EP-001 — EP เป็นส่วนหนึ่งของตะกร้าคอร์สพาร์ตเนอร์

- สถานะ: `IMPLEMENTED`; หน้าแก้ไขตะกร้าใช้วิดีโอ Multipart สูงสุด 2 GB ใน v0.14.332
- หน้า: `/course-seller?type=1`, `/course-basket-edit?id=:courseId`
- ไฟล์: `public/course-seller.html`, `public/course-seller.js`, `public/course-basket-edit.html`, `public/course-basket-edit.js`, `functions/api/course-seller/[id]/lessons.js`, `functions/api/course-seller/[id]/lessons/[lessonId].js`, `functions/api/course-seller/[id]/lessons/[lessonId]/files.js`, `functions/api/course-seller/[id]/lesson-video-multipart/*`
- ฟังก์ชัน/ตัวควบคุม: `addCourseEpEditor()`, `sellerLessonForm.onsubmit`, `renderLessons()`, `loadLessons()`
- ปุ่ม/interaction: `addLessonButton` เป็น `type="button"`; เพิ่ม แก้ไข ลบ EP และไฟล์ประกอบภายในตะกร้าเดียวกัน
- API: `GET/POST /api/course-seller/:courseId/lessons`, `PUT/DELETE /api/course-seller/:courseId/lessons/:lessonId`, `DELETE /api/course-seller/:courseId/lessons/:lessonId/files`; วิดีโอใช้ `lesson-video-multipart/init|part|complete|abort`
- ฐานข้อมูล / ตาราง / ฟิลด์: D1/R2; `courses.id`, `courses.expected_episodes`, `courses.total_minutes`, `course_lessons.course_id`, `course_lessons.title`, `course_lessons.description`, `course_lessons.duration_seconds`, `course_lessons.video_key`, `course_lessons.pdf_key`, `course_lesson_files.lesson_id`
- Input: `course_id`, ชื่อ EP, คำอธิบาย, ระยะเวลา, คลิป MP4/WEBM สูงสุด 2 GB ผ่าน R2 Multipart และไฟล์ประกอบสูงสุด 200 MB ต่อไฟล์
- Output: รายการ EP ที่ผูกกับตะกร้าคอร์สเดียวกัน พร้อมสถานะความครบถ้วน
- Reads: คอร์สของผู้ใช้, จำนวน/ลำดับ EP, คลิป และไฟล์ประกอบ
- Writes: เพิ่ม/แก้/ลบ `course_lessons` และ `course_lesson_files`; อัปเดตจำนวน EP/เวลาใน `courses`
- สิทธิ์: สมาชิกเจ้าของคอร์สเท่านั้น; API ตรวจ ownership และสถานะที่แก้ได้
- ห้ามกระทบ: ปุ่มเพิ่ม EP ห้าม submit ฟอร์ม/เปิด file picker; ห้ามแยก EP ออกจาก `course_id`; ห้ามทำลายไฟล์ของ EP อื่น; ห้ามเผยแพร่คอร์สอัตโนมัติ
- การทดสอบ: `scripts/test-v014307.mjs`, `scripts/test-v014308.mjs`, `scripts/test-v014310.mjs`, `scripts/test-v014324.mjs`, `scripts/test-v014332.mjs`

## COURSE-BASKET-001 — สร้างและแก้ตะกร้าคอร์สพาร์ตเนอร์

- สถานะ: `IMPLEMENTED`; แดชบอร์ดรายได้ 50/50 ไม่หักค่า API และแสดงรอบเคลียร์วันที่ 1 ใน v0.14.333
- หน้า: `/course-center`, `/course-seller?type=1`, `/course-basket-edit?id=:courseId`
- ไฟล์: `public/course-center.js`, `public/course-seller.html`, `public/course-seller.js`, `public/course-basket-edit.js`, `functions/api/course-seller/plans.js`, `functions/api/course-seller/index.js`, `functions/api/course-seller/[id].js`
- ฟังก์ชัน/ตัวควบคุม: `openPlan()`, `sellerCourseForm.onsubmit`, `ensureCourseDraft()`, `loadOwnedCourses()`
- ปุ่ม/interaction: เข้าสร้างคอร์สพาร์ตเนอร์ กรอกข้อมูลตะกร้า เพิ่ม EP บันทึกร่าง และเปิดตะกร้าเดิมกลับมาแก้ไข
- API: `GET /api/course-seller/plans`, `GET/POST /api/course-seller`, `GET/PUT /api/course-seller/:courseId`, `GET /api/course-seller/sales`
- ฐานข้อมูล / ตาราง / ฟิลด์: D1; `products.id`, `products.product_kind`, `products.status`, `courses.id`, `courses.product_id`, `courses.owner_user_id`, `courses.plan_type`, `courses.review_status`
- Input: แผนพาร์ตเนอร์ ข้อมูลตะกร้า รูปปก ราคา ช่องทางติดต่อ และจำนวน EP
- Output: `product` สถานะร่างและ `course` ที่สัมพันธ์กันแบบหนึ่งต่อหนึ่ง; ยอดผู้สอน 50% และยอดรอเคลียร์รอบปัจจุบัน
- Reads: แผนที่เปิดใช้ คอร์สของเจ้าของ และข้อมูลตะกร้าเดิม
- Writes: สร้าง/แก้ `products` และ `courses` โดยคงสถานะร่างจนส่งตรวจ
- สิทธิ์: ต้องเข้าสู่ระบบและเป็นเจ้าของคอร์ส; รับเฉพาะแผน `partner`
- ห้ามกระทบ: ห้ามสร้างสินค้าแยกจากคอร์ส; ห้ามเผยแพร่ตะกร้าอัตโนมัติ; ห้ามนำแผนเลิกใช้กลับมาแสดง
- การทดสอบ: `scripts/test-v014310.mjs`, `scripts/test-v014324.mjs`, `scripts/test-v014333.mjs`

## COURSE-REVIEW-001 — ส่งตรวจและอนุมัติคอร์สพาร์ตเนอร์

- สถานะ: `IMPLEMENTED`; ตรวจเส้นทางจริงซ้ำใน v0.14.324
- หน้า: `/course-seller?type=1`, `/course-basket-edit?id=:courseId`, `/admin-courses#sellerReview`
- ไฟล์: `public/course-seller.js`, `public/course-basket-edit.js`, `public/course-review-admin.js`, `functions/api/course-seller/[id]/publish.js`, `functions/api/admin/course-seller-reviews/[id].js`
- ฟังก์ชัน/ตัวควบคุม: ส่งตรวจหลังข้อมูลตะกร้าและ EP ครบ; Boss อนุมัติหรือส่งกลับแก้ไข
- ปุ่ม/interaction: `ส่งตรวจ`, อนุมัติคอร์ส, ส่งกลับแก้ไข
- API: `POST /api/course-seller/:courseId/publish`, `POST /api/admin/course-seller-reviews/:courseId`
- ฐานข้อมูล / ตาราง / ฟิลด์: D1; `courses.review_status`, `courses.active`, `products.status`
- Input: คอร์สที่ข้อมูลตะกร้าและ EP ครบ การยืนยันส่งตรวจ และคำสั่งของ Boss
- Output: ผู้สร้างส่งแล้วเป็น `pending`; Boss อนุมัติแล้วคอร์ส `approved/active` และสินค้า `published`
- Reads: ความครบถ้วนของคอร์ส EP ไฟล์ และสถานะตรวจ
- Writes: สถานะตรวจคอร์ส สถานะเปิดใช้ และสถานะสินค้า
- สิทธิ์: เจ้าของส่งตรวจได้เฉพาะคอร์สตน; เฉพาะ Boss อนุมัติ/ส่งกลับ
- ห้ามกระทบ: ปุ่มส่งตรวจห้ามเผยแพร่เอง; ห้ามอนุมัติเมื่อ EP ไม่ครบ; ห้ามเปิดสินค้าก่อน Boss อนุมัติ
- การทดสอบ: `scripts/test-v014310.mjs`, `scripts/test-v014324.mjs`

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

## PROD-ADMIN-001 — จัดการตะกร้าสินค้าในหลังบ้าน

- สถานะ: `IMPLEMENTED`; ทำแผนที่เส้นทางจริงใน v0.14.325
- หน้า: `/admin` ส่วนจัดการสินค้า ตะกร้าวางจำหน่าย และตะกร้าแบบร่าง
- ไฟล์: `public/admin.html`, `public/admin.js`, `functions/api/admin/products/index.js`, `functions/api/admin/products/[id].js`
- ฟังก์ชัน/ตัวควบคุม: `loadProducts()`, `renderProductAdminList()`, `editProduct()`, `saveProduct()`, `deleteProduct()`, `bulkDeleteSelectedProducts()`
- API: `GET/POST /api/admin/products`, `GET/PUT/DELETE /api/admin/products/:id`
- ฐานข้อมูล / ตาราง / ฟิลด์: D1; `products`, `categories`, `product_slug_history`, `products.status`, `products.deleted_at`, `products.deleted_prev_status`
- Input: ข้อมูลตะกร้า หมวด สถานะ ราคา Slug รายละเอียด และการเลือกหลายตะกร้า
- Output: ตะกร้าวางจำหน่าย/แบบร่างที่แบ่งหน้าได้ การแก้ไข และ soft delete ลงถังขยะ
- Reads: สินค้าปกติที่ยังไม่ถูกลบ หมวด และจำนวนไฟล์; แยกคอร์ส Vision 5 ออกจากตัวแก้ไขสินค้าทั่วไป
- Writes: สร้าง/แก้สินค้า เปลี่ยนสถานะ เก็บประวัติ Slug และตั้ง `deleted_at` แทนการลบถาวร
- สิทธิ์: ผู้ดูแลเท่านั้น; API ทุกจุดตรวจ `requireAdmin`
- ห้ามกระทบ: ห้าม hard delete สินค้าจากปุ่มทั่วไป ห้ามเผยแพร่ draft อัตโนมัติ ห้ามแก้คอร์ส Vision 5 ผ่าน generic product API และห้ามเปลี่ยนเลข product ID
- การทดสอบ: `scripts/test-v014325.mjs`, `scripts/test-all-regressions.mjs`, `scripts/predeploy-check.mjs`

## PROD-FILE-001 — จัดการรูปและไฟล์ของตะกร้าสินค้า

- สถานะ: `IMPLEMENTED`; ทำแผนที่เส้นทางจริงใน v0.14.325
- หน้า: `/admin` ตัวแก้ไขสินค้าและปุ่มอัปโหลดแยก
- ไฟล์: `public/admin.js`, `functions/api/admin/products/index.js`, `functions/api/admin/product-upload/[id].js`, `functions/api/admin/product-images/[id].js`, `functions/api/admin/product-files/[id].js`, `functions/api/admin/product-multipart/init.js`, `functions/api/admin/product-multipart/part.js`, `functions/api/admin/product-multipart/complete.js`
- ฟังก์ชัน/ตัวควบคุม: `uploadSelectedFile()`, `saveProduct()`, `saveUploads()`, `onRequestPost()`, `onRequestPut()`, `onRequestDelete()`
- API: `POST /api/admin/product-upload/:id`, `POST/DELETE /api/admin/product-images/:id`, `GET/DELETE /api/admin/product-files/:id`, `POST /api/admin/product-multipart/init`, `PUT /api/admin/product-multipart/part`, `POST /api/admin/product-multipart/complete`
- ฐานข้อมูล / ที่เก็บ: D1/R2; `product_files`, `downloads`, `products.cover_url`, `products.preview_urls`, bucket `FILES`
- Input: รูป JPG/PNG/WEBP ไฟล์ PDF/ZIP หรือ multipart parts ที่ผูก product ID
- Output: รูปปก รูปตัวอย่าง และไฟล์ดาวน์โหลดที่ผูกกับตะกร้าเดิม
- ข้อจำกัดที่ตรวจพบ: รูป direct upload ไม่เกิน 5 MB; PDF/ZIP direct upload ไม่เกิน 100 MB; multipart upload รวมไม่เกิน 1 GB
- สิทธิ์: ผู้ดูแลเท่านั้น; ตรวจ product และป้องกันการใช้ generic route กับคอร์ส Vision 5
- ห้ามกระทบ: ห้ามคืน R2 object key สู่หน้าเว็บ ห้ามผูกไฟล์ข้าม product ห้ามลบไฟล์ต้นฉบับก่อนการแทนที่สำเร็จ และห้ามใช้เส้นทางนี้แก้คอร์ส Vision 5
- การทดสอบ: `scripts/test-v014325.mjs`, `scripts/test-all-regressions.mjs`, `scripts/predeploy-check.mjs`

## PROD-CATEGORY-MOVE-001 — ย้ายหมวดหลายตะกร้า

- สถานะ: `IMPLEMENTED`; ทำแผนที่เส้นทางจริงใน v0.14.325
- หน้า: `/admin` แถบเลือกหลายตะกร้าและหน้าต่างย้ายหมวด
- ไฟล์: `public/admin.html`, `public/admin.js`, `functions/api/admin/products/bulk-category.js`
- ฟังก์ชัน/ตัวควบคุม: `openBulkMoveCategory()`, `moveSelectedProductsCategory()`, `onRequestPost()`
- API: `POST /api/admin/products/bulk-category`
- ฐานข้อมูล / ตาราง: D1; `products`, `categories`, `product_slug_history`, `product_bundle_items`, `bundle_source_allocations`, `courses`
- Input: product IDs ที่เลือก หมวดปลายทาง และ `confirmed=true`
- Output: ชื่อ คำอธิบาย ประเภทไฟล์ หมวด และ Slug ที่สอดคล้องกับหมวดใหม่ โดยเลข product ID เดิมไม่เปลี่ยน
- Writes: บันทึก Slug เดิมใน `product_slug_history` และเขียนการเปลี่ยนทั้งหมดด้วย `DB.batch`
- สิทธิ์: ผู้ดูแลเท่านั้น; จำกัดครั้งละไม่เกิน 100 product IDs
- ห้ามกระทบ: ห้ามย้ายชุดรวม สินค้าที่ถูกจัดสรรในชุด Vision 4 คอร์ส สิทธิ์ขาย และหมวด `set-*`; ห้ามทำ Slug ซ้ำ; ห้ามเปลี่ยนเลขรหัสสินค้า
- การทดสอบ: `scripts/test-v014208.mjs`, `scripts/test-v014325.mjs`, `scripts/test-all-regressions.mjs`

## กฎบำรุงรักษา

## PROD-SAMPLE-001 — สร้างรูปตัวอย่างทั้งตะกร้าเดี่ยว

- สถานะ: `IMPLEMENTED` ใน v0.14.319 และเพิ่มตัวเลือกแบบการ์ดแคตตาล็อกใน v0.14.320
- หน้า: `/admin` ส่วนการจัดการสินค้า
- ไฟล์: `public/admin.html`, `public/product-sample-archive.js`, `public/product-sample-archive.css`, `functions/api/admin/product-sample-sources/[id].js`
- ปุ่ม/interaction: `#productSampleArchiveButton`, `#productSampleGrid`, `.product-sample-card`, `#productSampleCreate`
- การเลือกตะกร้า: แสดงรูปปก ชื่อ เลขสินค้า Slug และจำนวนไฟล์เป็นการ์ดแบบแคตตาล็อกเท่านั้น ห้ามใช้ Dropdown
- API: `GET /api/admin/product-sample-sources/:id`, `GET /api/admin/product-files/:fileId`
- Reads: ตะกร้าเดี่ยวและ `product_files` ของตะกร้านั้นโดยตรง
- Output: ZIP ชื่อตะกร้า ภายในเป็นโฟลเดอร์ชื่อตะกร้าและ JPEG ที่ประทับ SAMPLE 30 รูปแรก
- ประวัติฝั่งผู้ดูแล: จดจำจำนวนดาวน์โหลดต่อตะกร้าใน browser และแสดง `โหลดแล้ว N ครั้ง` บนการ์ด โดยไม่ห้ามดาวน์โหลดซ้ำ
- สิทธิ์: ผู้ดูแลเท่านั้น; API ตรวจสิทธิ์ซ้ำ
- ห้ามกระทบ: ห้ามเลือกตะกร้าชุดรวม/คอร์ส ห้ามอ่านไฟล์สมาชิกของชุดรวม ห้ามเขียน/ลบ/แทนที่สินค้าและไฟล์ต้นฉบับ และห้ามคืน object key ของ R2
- การทดสอบ: `scripts/test-v014320.mjs`, `scripts/test-all-regressions.mjs`, `scripts/predeploy-check.mjs`

## SHARE-OG-001 — พรีวิวลิงก์สินค้าดิจิทัลและพาร์ทเนอร์คอร์ส

- สถานะ: `IMPLEMENTED` ใน v0.14.318
- หน้า: `/` และพรีวิวเมื่อแชร์ `https://visiondonline.com/`
- ไฟล์: `public/index.html`, `public/assets/visiond-marketplace-partner-og-v014318.png`
- Reads: Open Graph/Twitter Card metadata จาก HTML หน้าแรก
- Output: ภาพพรีวิวที่บอกหมวดใบงาน ระบายสี เกมเสริมพัฒนาการ ตุ๊กตากระดาษ ไฟล์ PDF และการเปิดรับพาร์ทเนอร์ลงคอร์สออนไลน์ 50/50
- ห้ามกระทบ: canonical URL, robots, Facebook domain verification, ระบบสินค้า และระบบคอร์ส
- การทดสอบ: `scripts/test-v014318.mjs`, `scripts/test-all-regressions.mjs`, `scripts/predeploy-check.mjs`

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
- ไม่กำหนดเพดานขนาดไฟล์ต้นทางหรือจำนวนรายการภายใน ZIP ใน Frontend เพราะประมวลผลและแบ่งในเครื่องผู้ใช้ก่อนอัปโหลด; ไฟล์ผลลัพธ์แต่ละตะกร้ายังคงต้องผ่านเพดาน API
- PNG ที่เลือกพร้อมกันรวมเป็นหนึ่งกลุ่ม; PDF และ ZIP แต่ละไฟล์เป็นหนึ่งกลุ่ม
- ZIP หนึ่งไฟล์ต้องมีเฉพาะ PNG หรือเฉพาะ PDF และระบบจะแปลงเป็น PDF กลางก่อนแบ่งหน้า
- Reads: จำนวนหน้าและลำดับหน้าภายใน PDF แต่ละไฟล์ รวมถึง Slug ปัจจุบันและประวัติ Slug
- Writes: สินค้าร่าง ไฟล์ PDF ที่ประกอบใหม่ และรูปปกหน้าแรกของแต่ละชุด
- สิทธิ์: ใช้ได้เฉพาะผู้ดูแล; API ตรวจสิทธิ์ซ้ำฝั่งเซิร์ฟเวอร์
- ห้ามกระทบ: ห้ามรวมทุก PDF เป็นกองเดียว ห้ามทำหน้าซ้ำ/ตกหล่น ห้ามให้ตะกร้าขาด PDF กลุ่มใด ห้ามเผยแพร่อัตโนมัติ และห้ามสร้างใบที่สำเร็จแล้วซ้ำเมื่อทำต่อหลังข้อผิดพลาด
- คิวสร้าง: เรียก `POST /api/admin/products` ทีละตะกร้าตามลำดับ; ความผิดพลาดหนึ่งรายการไม่หยุดรายการถัดไป และ Retry เฉพาะสถานะที่ไม่สำเร็จ
- การทดสอบ: `scripts/test-v014317.mjs`, `scripts/test-all-regressions.mjs`, `scripts/predeploy-check.mjs`

## COURSE-PARTNER-CHECKOUT-001 — อนุมัติ แคตตาล็อก และชำระเงินคอร์สพาร์ตเนอร์

- สถานะ: `IMPLEMENTED`; ตรวจเส้นทางจริงซ้ำใน v0.14.324
- หน้า: `/course-center`, แคตตาล็อกคอร์สหน้าแรก, `/dashboard`, `/admin-courses#sellerReview`, `/admin`
- ไฟล์/API: `functions/api/admin/course-seller-reviews/[id].js`, `functions/api/courses/index.js`, `functions/api/orders/index.js`, `functions/api/orders/[id]/slip.js`, `functions/api/admin/orders.js`, `functions/api/admin/orders/[id]/approve.js`, `functions/api/admin/orders/[id]/reject.js`
- ฐานข้อมูล / ตาราง / ฟิลด์: D1; แผนและ `review_status` ของคอร์ส, `products.status`, `orders.status`, `orders.payment_method`, ส่วนแบ่งรายได้คอร์ส, `order_items`, `verified_slips`, `order_slip_evidence`, `entitlements`
- Input: การอนุมัติคอร์ส การสั่งซื้อ รูปสลิป และการยืนยัน/เหตุผลของ Boss
- Output: คอร์ส `published` ในแคตตาล็อก ออเดอร์พาร์ตเนอร์ บัญชีกลาง VisionD ผลตรวจอัตโนมัติ หรือคิวตรวจแมนนวล
- Reads: คอร์ส ตะกร้าสินค้า ออเดอร์ บัญชีกลาง VisionD ผลตรวจ EasySlip และสิทธิ์ Boss
- Writes: สถานะคอร์ส/สินค้า ออเดอร์ ผลตรวจสลิป และ entitlement เมื่ออนุมัติการชำระ
- สิทธิ์: ผู้ซื้อส่งสลิปได้เฉพาะออเดอร์ตน; เฉพาะ Boss อนุมัติ/ปฏิเสธ fallback ของคอร์สพาร์ตเนอร์
- ห้ามกระทบ: ห้ามเผยแพร่คอร์สที่ยังไม่ผ่าน Boss; ห้ามใช้บัญชีผู้สอนกับพาร์ตเนอร์; ห้ามให้ Boss ตรวจแทนคอร์สประเภทอื่น; ห้ามปลดล็อกก่อนชำระผ่านหรือปลดล็อกซ้ำ
- การทดสอบ: `scripts/test-v014310.mjs`, `scripts/test-v01486-vision5-two-account-e2e.mjs`, `scripts/test-v014324.mjs`

## V12-CHANNEL-001 — ตั้งค่าช่องทาง Facebook และ Signed Webhook

- สถานะ: `IMPLEMENTED`; ตรวจเส้นทางจริงซ้ำใน v0.14.326
- หน้า/ไฟล์: `/v12-settings.html`, `functions/api/admin/v12-channel.js`, `functions/hooks/v12/facebook.js`, `functions/_v12_schema.js`
- ฐานข้อมูล: `v12_channel_credentials`; เก็บ Token, App Secret และ Verify Token แบบเข้ารหัส
- ห้ามกระทบ: ห้ามคืน credential เต็มสู่หน้าเว็บหรือ log และห้ามรับ event ที่ HMAC ไม่ถูกต้อง

## V12-INBOX-001 — กล่องข้อความ LINE/Facebook และข้อมูลลูกค้า

- สถานะ: `IMPLEMENTED`; ตรวจเส้นทางจริงซ้ำใน v0.14.326
- หน้า/ไฟล์: `/v12-connect.html`, `public/v12-connect.js`, `functions/api/admin/v12-connect.js`, `functions/api/admin/v12-profiles.js`, `functions/api/admin/v12-facebook-history.js`
- ฐานข้อมูล: `veasy_conversations`, `veasy_chat_messages`, `veasy_conversation_controls`, `veasy_message_claims`
- ห้ามกระทบ: ห้ามส่งซ้ำ ห้ามเปิดเผย target/credential และห้ามส่งเมื่อไม่ได้อยู่โหมด human

## V12-BROADCAST-001 — Broadcast และคิวส่งหลายช่องทาง

- สถานะ: `IMPLEMENTED`; ตรวจเส้นทางจริงซ้ำใน v0.14.326
- หน้า/ไฟล์: `/v12-connect.html`, `public/v12-connect.js`, `functions/api/admin/v12-broadcast.js`, `functions/_v12_schema.js`
- ฐานข้อมูล: `v12_broadcast_campaigns`, `v12_broadcast_deliveries`
- ห้ามกระทบ: ต้องยืนยันผู้รับก่อนส่งและต้องรักษาข้อจำกัดช่วงเวลาตอบของ Facebook

## V12-SALES-AI-001 — AI ผู้ช่วยวิเคราะห์ Lead และร่างคำตอบ

- สถานะ: `IMPLEMENTED`; ตรวจเส้นทางจริงซ้ำใน v0.14.326
- หน้า/ไฟล์: `/v12-connect.html`, `public/v12-sales-assistant.js`, `functions/api/admin/v12-sales-assistant.js`
- ฐานข้อมูล: `v12_lead_insights`; อ่านข้อความล่าสุดและสินค้าที่เผยแพร่
- ห้ามกระทบ: AI ร่างข้อความเท่านั้น ผู้ดูแลต้องเลือกนำร่างไปใช้และส่งจริง
- การทดสอบ: `scripts/test-v014326.mjs`, `scripts/test-all-regressions.mjs`, `scripts/predeploy-check.mjs`

## V7-PROGRAM-001 — โปรแกรมและแพ็กเกจ Vision 7
- สถานะ: `IMPLEMENTED`; ตรวจเส้นทางจริงซ้ำใน v0.14.327
- หน้า/ไฟล์: `/vision7-admin.html`, `public/vision7-admin.js`, `functions/api/admin/vision7/programs.js`, `functions/_vision7_key_storefront.js`
- API: `GET|POST|PATCH /api/admin/vision7/programs`, `GET /api/vision7/programs`
- ฐานข้อมูล: `vision7_programs`, `vision7_plans`, `products`
- สิทธิ์: Admin สร้าง/แก้ไข; รายการสาธารณะคืนเฉพาะโปรแกรมที่ active
- ห้ามกระทบ: ห้ามสร้างสินค้าคีย์ซ้ำหรือเปิดโปรแกรมร่างขายเอง

## V7-LICENSE-001 — ออกคีย์ ต่ออายุ ระงับ และจัดการอุปกรณ์
- สถานะ: `IMPLEMENTED`; ตรวจเส้นทางจริงซ้ำใน v0.14.327
- หน้า/ไฟล์: `/vision7-admin.html`, `public/vision7-admin.js`, `functions/api/admin/vision7/licenses.js`, `functions/api/admin/vision7/licenses/[id]/history.js`
- ฐานข้อมูล: `vision7_licenses`, `vision7_license_devices`, `vision7_license_events`, `vision7_order_fulfillments`
- สิทธิ์: Admin จัดการคีย์; คีย์จริงเก็บแบบเข้ารหัสและแสดงค่าจริงเฉพาะรอบออกคีย์
- ห้ามกระทบ: ห้ามออกซ้ำจาก order item เดิม ห้ามเกินจำนวนอุปกรณ์ และห้ามคืน key hash/ciphertext

## V7-RELEASE-001 — อัปโหลดและดาวน์โหลดไฟล์ติดตั้ง
- สถานะ: `IMPLEMENTED`; ตรวจเส้นทางจริงซ้ำใน v0.14.327
- หน้า/ไฟล์: `/vision7-admin.html`, `functions/api/admin/vision7/releases.js`, `functions/api/vision7/releases/[id]/download.js`
- ฐานข้อมูล/ไฟล์: `vision7_releases`; R2 object พร้อม SHA-256
- สิทธิ์: Admin อัปโหลด; สมาชิกดาวน์โหลดเมื่อมี license active/trial ของโปรแกรมเดียวกัน
- ห้ามกระทบ: ห้ามคืน R2 object key และห้ามดาวน์โหลดข้ามสิทธิ์

## V7-MEMBER-001 — โปรแกรมของฉันและการปิดอุปกรณ์
- สถานะ: `IMPLEMENTED`; ตรวจเส้นทางจริงซ้ำใน v0.14.327
- หน้า/ไฟล์: `/my-programs.html`, `public/my-programs.js`, `functions/api/vision7/my-programs.js`, `functions/api/vision7/activate.js`
- API: `GET /api/vision7/my-programs`, `DELETE /api/vision7/activate`
- Reads/Writes: อ่าน license/release/device ของสมาชิก; revoke เฉพาะอุปกรณ์ใต้ license ของตน
- ห้ามกระทบ: ห้ามอ่านคีย์หรือปิดอุปกรณ์ข้ามบัญชี และห้าม license หมดอายุดาวน์โหลดไฟล์
- การทดสอบ: `scripts/test-v014327.mjs`, `scripts/test-v014110-veasy-activation-contract.mjs`, `scripts/test-all-regressions.mjs`

## ELON-CHAT-001 — ผู้ช่วยขายและแชทช่วยเหลือบนหน้าเว็บ

- สถานะ: `IMPLEMENTED`; ลงทะเบียนเส้นทางจริงใน v0.14.336
- หน้า: frontend surfaces ที่อนุญาตใน `FRONTEND_SURFACES` เช่น `/`, `/product`, `/courses`, `/cart`, `/dashboard`, `/bots`
- ไฟล์: `public/elon-chat.js`, `public/elon-chat.css`, `functions/_elon.js`, `functions/_elon-provider.js`, `functions/_elon-member-store.js`, `functions/_elon_databases.js`, `functions/api/elon/chat.js`, `functions/api/elon/public-chat.js`, `functions/api/elon/conversations.js`, `functions/api/elon/clear.js`, `functions/api/elon/status.js`
- ฟังก์ชัน/ตัวควบคุม: `mount()`, `frontendSurface()`, `getContext()`, `elonAccessDecision()`, `elonSystemPrompt()`, `requestElonProvider()`
- ปุ่ม/interaction: launcher เปิด/ปิด dialog, แชทใหม่, quick questions, ส่งข้อความ, loading/error และลิงก์สมัคร/เข้าสู่ระบบสำหรับ guest
- API: `GET/POST /api/elon/chat`, `POST /api/elon/public-chat`, `GET /api/elon/conversations`, `POST /api/elon/clear`, `GET /api/elon/status`
- ฐานข้อมูล / ตาราง / ฟิลด์: ELON Web DB; `elon_web_conversations`, `elon_web_messages`, `elon_web_rate_limits`, `elon_web_usage_limits`, `elon_web_settings`
- Input: ข้อความสูงสุดตาม `ELON_MAX_MESSAGE_LENGTH`, conversation ID และ page context ที่ตัด query string/ข้อมูลส่วนตัวออก
- Output: คำตอบภาษาไทยที่กรองข้อมูลภายใน/ลิงก์/ข้อมูลส่วนตัว พร้อม conversation ID และประวัติของเจ้าของเท่านั้น
- Reads: สถานะเปิดใช้ บริบทสมาชิก แคตตาล็อกขายที่เผยแพร่ และประวัติสนทนาของ subject เดียวกัน
- Writes: conversation/message, rate/usage limits และ retention marker; ไม่มีสิทธิ์แก้ข้อมูลธุรกิจแทนผู้ใช้
- สิทธิ์: guest ใช้ public endpoint แบบจำกัด; member endpoint ต้องมี session และตรวจ ownership; Boss/Admin internals ไม่เปิดเผย
- ห้ามกระทบ: fail closed เฉพาะ frontend surface ที่อนุญาต; ห้ามส่ง query string, Secret, PII หรือลิงก์ภายนอก; ห้ามอ้างว่าดำเนินการ/อนุมัติ/ปลดล็อกแทนผู้ใช้; คง retention 60 วันและ rate/global budget gates
- รหัส UI: root widget มี `data-feature="ELON-CHAT-001"`
- การทดสอบ: `scripts/test-elon-access.mjs`, `scripts/test-elon-frontend-only.mjs`, `scripts/test-elon-provider.mjs`, `scripts/test-elon-widget-surfaces.mjs`, `scripts/test-v014336.mjs`

## SALES-PAGE-001 — ศูนย์สร้าง Revision อนุมัติ เผยแพร่ และ A/B หน้าขาย

- สถานะ: `IMPLEMENTED`; ลงทะเบียนเส้นทางจริงใน v0.14.337
- หน้า: `/sales-page-center.html`, `/sales-page-variants.html?id=:pageId`, public `/s/:slug`
- ไฟล์: `public/sales-page-center.js`, `public/sales-page-variants.js`, `public/sales-page-public.js`, `functions/_sales_pages.js`, `functions/_sales_page_variants.js`, `functions/s/[slug].js`, `functions/api/admin/sales-pages/index.js`, `functions/api/admin/sales-pages/[id].js`, `functions/api/admin/sales-pages/[id]/variants.js`, `functions/api/sales-pages/[id]/variants.js`
- ฟังก์ชัน/ตัวควบคุม: สร้าง/แก้ draft, revision history, `submit_review`, `approve`, `publish`, `pause`, `archive`, mobile preview และ Variant A/B
- API: `GET/POST /api/admin/sales-pages`, `GET/PUT/PATCH /api/admin/sales-pages/:id`, `GET/PUT /api/admin/sales-pages/:id/variants`, `GET /api/sales-pages/:id/variants`, `GET /s/:slug`
- ฐานข้อมูล: `sales_page_templates`, `sales_pages`, `sales_page_products`, `sales_page_revisions`, `sales_page_variants`, `customer_events`
- Input/Output: ประเภท `ad_shortcut|seo_automation`, template, slug, content, product IDs, revision/lifecycle และ Variant A/B ที่น้ำหนัก active รวม 100
- สิทธิ์: Admin จัดการ; เฉพาะ Boss อนุมัติ SEO Automation; public อ่านเฉพาะ Ad Shortcut ที่ published และ noindex
- ห้ามกระทบ: SEO revision ปัจจุบันต้องอนุมัติก่อน publish; Ad Shortcut ต้อง `noindex`; public ห้ามแสดงสถานะหรือสินค้าที่ไม่พร้อม; หน้า published/archived ห้ามแก้ตรง; variant ต้อง A/B และน้ำหนัก active รวม 100
- รหัส UI: public renderer มี `data-feature="SALES-PAGE-001"`; หลังบ้านยึด route/ID ที่ระบุข้างต้น
- การทดสอบ: `scripts/test-v014234.mjs`, `scripts/test-v014235.mjs`, `scripts/test-v014236.mjs`, `scripts/test-v014337.mjs`

## V13-INTAKE-001 — ตรวจ Approval Snapshot และผลิต EPUB จาก Vision 14 MIX

- สถานะ: `IMPLEMENTED`; ลงทะเบียนเส้นทางจริงใน v0.14.338
- หน้า/ไฟล์: `/vision13-intake.html`, `public/vision13-intake.js`, `functions/_vision13_epub.js`, `functions/_vision14.js`, `functions/api/admin/vision13-intake/index.js`, `functions/api/admin/vision13-intake/[id].js`, `functions/api/admin/vision13-production/[id].js`
- ฟังก์ชัน: กรองคิว, ตรวจ rights/PDF teaching/fingerprint/citation, `start_review|approve|reject`, Approval Snapshot, ผลิต/ดาวน์โหลด EPUB
- API: `GET /api/admin/vision13-intake`, `GET/PUT /api/admin/vision13-intake/:id`, `GET/POST /api/admin/vision13-production/:id`
- ฐานข้อมูล/ไฟล์: `vision13_intake_queue`, `vision13_intake_reviews`, `vision13_ebook_productions`, Vision 14 mix/source/item tables และ R2 `vision13/ebooks/*`
- Input/Output: MIX ที่ไม่ internal-only พร้อมหลักฐานสิทธิ์และ citation; ได้ snapshot hash, EPUB artifact hash/size และสถานะ `ready|reviewing|approved|rejected|produced`
- สิทธิ์: ทุก endpoint ใช้ `requireBoss`; object key ไม่ถูกส่งออกและดาวน์โหลดผ่าน endpoint ที่ตรวจสิทธิ์
- ห้ามกระทบ: reject ต้องมีเหตุผล; อนุมัติเมื่อ evidence ครบเท่านั้น; ผลิตเฉพาะ approved snapshot ที่ hash ยังตรง; ห้ามผลิตซ้ำ; หาก DB ล้มหลังอัปโหลดต้องลบ R2 object
- รหัส UI: หน้า Intake มี `data-feature="V13-INTAKE-001"`
- การทดสอบ: `scripts/test-v014233.mjs`, `scripts/test-v014338.mjs`

## V14-LIBRARY-001 — คลังต้นฉบับ PDF สิทธิ์ และข้อความรายหน้า

- สถานะ: `IMPLEMENTED`; ลงทะเบียนเส้นทางจริงใน v0.14.339
- หน้า/ไฟล์: `/vision14-library.html`, `public/vision14-library.js`, `functions/_vision14.js`, `functions/api/admin/vision14-sources/index.js`, `functions/api/admin/vision14-sources/[id].js`, `functions/api/admin/vision14-sources/[id]/file.js`, `functions/api/admin/vision14-sources/[id]/extract.js`, `functions/api/admin/vision14-sources/[id]/ocr.js`
- ฟังก์ชัน: รับ PDF เข้าคลัง, แก้สถานะ/หลักฐานสิทธิ์, เปิดไฟล์, extract text layer, OCR หน้าที่ค้าง, ล้างบรรทัดเครดิต และติดตามผลรายหน้า
- API: `GET/POST /api/admin/vision14-sources`, `PUT /api/admin/vision14-sources/:id`, `GET /api/admin/vision14-sources/:id/file`, `GET/POST /api/admin/vision14-sources/:id/extract`, `POST /api/admin/vision14-sources/:id/ocr`
- ฐานข้อมูล/ไฟล์: `vision14_sources`, `vision14_source_pages`; R2 `vision14/source/*`
- Input/Output: PDF ไม่เกิน 100 MB พร้อม title/rights/note; ข้อความรายหน้า 1–500 หน้าและ OCR JPEG data URL ไม่เกินขอบเขต API
- สิทธิ์: ทุก endpoint ใช้ `requireBoss`; สิทธิ์ `owned|plr|public_domain|licensed` ผ่านด่านขายเบื้องต้น ส่วน `reference_only` ล็อกการขาย
- ห้ามกระทบ: licensed ต้องมีหลักฐาน; ห้ามคืน object key; หากบันทึก DB ล้มหลังอัปโหลดต้องลบ R2 object; OCR ต้อง fail closed เมื่อไม่มี provider และห้ามแต่งข้อความเพิ่ม
- รหัส UI: หน้า Library มี `data-feature="V14-LIBRARY-001"`; ใช้ปุ่ม/interaction เดิมของหน้าโดยไม่เพิ่ม theme หรือ component
- การทดสอบ: `scripts/test-v014339.mjs`

## V14-SUMMARY-001 — สรุปรายเล่มและ Teaching Document

- สถานะ: `IMPLEMENTED`; ลงทะเบียนเส้นทางจริงใน v0.14.340
- หน้า/ไฟล์: `/vision14-summary.html`, `public/vision14-summary.js`, `public/vision14-teaching.js`, `functions/api/admin/vision14-summaries/index.js`, `functions/api/admin/vision14-summaries/[id].js`, `functions/api/admin/vision14-teaching/[id].js`
- ฟังก์ชัน: สรุปจาก clean text แบบ extractive พร้อมเลขหน้า/keywords/missing pages, คำนวณ coverage และรับ/ดาวน์โหลด Teaching PDF
- API: `GET /api/admin/vision14-summaries`, `GET/POST /api/admin/vision14-summaries/:id`, `GET/POST /api/admin/vision14-teaching/:id`
- ฐานข้อมูล/ไฟล์: `vision14_book_summaries`, `vision14_teaching_documents`, `vision14_source_pages`; R2 `vision14/teaching/*`
- สิทธิ์: ทุก endpoint ใช้ `requireBoss`; downstream sale ยึด rights ของ source
- ห้ามกระทบ: ต้องมี clean text ก่อนสรุป; Teaching PDF ต้อง coverage อย่างน้อย 80%, เป็น PDF ไม่เกิน 25 MB และ 1–500 หน้า; replace สำเร็จจึงลบ object เก่า และ DB ล้มต้องลบ object ใหม่
- รหัส UI: หน้า Summary มี `data-feature="V14-SUMMARY-001"`; คงปุ่มและ theme เดิม
- การทดสอบ: `scripts/test-v014340.mjs`

## V14-MIX-001 — รวมความรู้ ตัดซ้ำ และส่งคิว Vision 13

- สถานะ: `IMPLEMENTED`; ลงทะเบียนเส้นทางจริงใน v0.14.341
- หน้า/ไฟล์: `/vision14-mix.html`, `public/vision14-mix.js`, `functions/api/admin/vision14-mixes/index.js`, `functions/api/admin/vision14-mixes/[id].js`
- ฟังก์ชัน: เลือก 2–30 ต้นฉบับที่มี Teaching Document, normalize/token similarity, รวม citation, สร้าง SHA-256 fingerprint และแสดง Page Trace
- API: `GET/POST /api/admin/vision14-mixes`, `GET /api/admin/vision14-mixes/:id`
- ฐานข้อมูล: `vision14_mixes`, `vision14_mix_sources`, `vision14_mix_items`, `vision13_intake_queue`
- สิทธิ์: ทุก endpoint ใช้ `requireBoss`; MIX ที่มี source ขายไม่ได้เป็น `internal_only` และไม่สร้างคิว Vision 13
- ห้ามกระทบ: ต้องมีสรุปและ Teaching Document ทุก source; deduplicate เมื่อ normalized text ตรงหรือ Jaccard similarity อย่างน้อย 0.78; ต้องรักษา citation source/page; เฉพาะ MIX ที่สิทธิ์ผ่านทั้งหมดจึงเข้าคิว Vision 13 สถานะ ready
- รหัส UI: หน้า MIX มี `data-feature="V14-MIX-001"`; คงปุ่ม loading/error และ theme เดิม
- การทดสอบ: `scripts/test-v014341.mjs`

## ADS-ANALYTICS-001 — Meta Ads ingestion, attribution และ Ads Center

- สถานะ: `IMPLEMENTED`; ลงทะเบียนเส้นทางจริงใน v0.14.342
- หน้า/ไฟล์: `/ads-center.html`, `public/ads-center.js`, `public/analytics.js`, `functions/_meta_ads.js`, `functions/api/analytics/event.js`, `functions/api/admin/ads-center.js`, `functions/api/admin/meta-ads-sync.js`
- ฟังก์ชัน: เก็บ event/UTM แบบลดข้อมูลส่วนตัว, ซิงก์ Meta Ads Insights รายวัน, รวมค่าใช้จ่ายกับ purchase attribution และคำนวณ CTR/ROAS/profit พร้อมคำแนะนำ
- API: `POST /api/analytics/event`, `GET /api/admin/ads-center`, `GET/POST /api/admin/meta-ads-sync`
- ฐานข้อมูล: `customer_events`, `ad_campaign_costs`, `meta_ads_insights`, `meta_ads_sync_runs`, `orders`
- สิทธิ์: event endpoint มี rate limit และ event allowlist; Ads Center/Sync ใช้ `requireAdmin`; Meta token/account/version อ่านจาก environment เท่านั้น
- ห้ามกระทบ: event ซ้ำคน/ชนิด/path/product ภายใน 10 วินาทีไม่นับซ้ำ; sync ได้ไม่เกิน 93 วันและ upsert ต่อ date/account/ad; spend เก็บเป็นสตางค์; revenue นับเฉพาะ paid order ที่ attribution ตรง; ระบบให้คำแนะนำแต่ไม่แก้โฆษณาอัตโนมัติ
- สูตร: `CTR = clicks / impressions × 100`, `ROAS = revenue / spend`, `profit = revenue - spend`; เมื่อ denominator เป็นศูนย์คืนค่า null ตาม API เดิม
- รหัส UI: หน้า Ads Center มี `data-feature="ADS-ANALYTICS-001"`; คง loading/error และ theme เดิม
- การทดสอบ: `scripts/test-v014342.mjs`

## WEBHOOK-HUB-001 — จัดการ Webhook endpoint และรับ LINE event ของร้าน VEasy

- สถานะ: `IMPLEMENTED`; ลงทะเบียนเส้นทางจริงใน v0.14.343
- หน้า/ไฟล์: `/webhook-hub.html`, `public/webhook-hub.js`, `functions/_webhook_hub.js`, `functions/hooks/v1/[provider]/[publicId].js`, `functions/api/admin/webhook-hub.js`
- ฟังก์ชัน: ออก URL สุ่ม, pause/resume/rotate/revoke, แสดง adapter state/event ล่าสุด, ตรวจ LINE signature และส่ง event ที่ผ่านไปยัง LINE AI processor
- API: `GET/POST/PATCH /api/admin/webhook-hub`, `POST /hooks/v1/:provider/:publicId`
- ฐานข้อมูล: `veasy_webhook_endpoints`, `veasy_webhook_events`, `veasy_channel_credentials`, `veasy_shops`
- สิทธิ์: หน้าจัดการใช้ `requireAdmin`; public ID เป็น `wh_` ตามด้วย random hex 48 ตัว; callback ยอมรับเฉพาะ provider allowlist และ LINE adapter ที่พร้อม
- ห้ามกระทบ: rotate ต้อง revoke URL เดิมแล้วสร้าง URL ใหม่; revoked คืน 404; LINE signature ผิดคืน 401 และบันทึก rejected; verify payload ว่างที่ลายเซ็นผ่านคืน 200; paused/not-ready fail closed; รับสูงสุด 100 events ต่อ payload และ dedup ด้วย endpoint/external event ID
- สถานะ: endpoint `draft|active|paused|revoked`, adapter `pending|ready|error`; รับ event จริงได้เฉพาะ active + ready
- รหัส UI: หน้า Webhook Hub มี `data-feature="WEBHOOK-HUB-001"`; คง confirmation, copy, success/error และ theme เดิม
- การทดสอบ: `scripts/test-v014343.mjs`

## BUNDLE-PREVIEW-001 — ตรวจ แก้ และย้อนรูปพรีวิวตะกร้ารวม

- สถานะ: `IMPLEMENTED`; ลงทะเบียนเส้นทางจริงใน v0.14.344
- หน้า/ไฟล์: `/bundle-preview-audit.html`, `public/bundle-preview-audit.js`, `functions/api/admin/bundle-preview-audit/index.js`, `functions/api/admin/bundle-preview-audit/[id].js`
- ฟังก์ชัน: แสดงตะกร้าสมาชิกและรูป candidate, รับ JPG/PNG ที่ตรวจจาก PDF, เลือกรูป cover/preview, เก็บ revision และ rollback
- API: `GET /api/admin/bundle-preview-audit`, `GET/PUT/POST/PATCH /api/admin/bundle-preview-audit/:id`
- ฐานข้อมูล/ไฟล์: `products`, `product_bundle_items`, `product_files`, `bundle_preview_revisions`; R2 `bundle-preview-*`
- สิทธิ์: ทุก endpoint ใช้ `requireBoss`; ทำงานเฉพาะ product `source='bundle'` ที่ยังไม่ถูกลบ
- ห้ามกระทบ: เลือก 1–30 รูปและรับเฉพาะ URL จากสมาชิกหรือรูปตรวจ PDF ของ bundle เดียวกัน; upload ต้องเป็น JPG/PNG ไม่เกิน 2 MB และ source ต้องเป็นสมาชิก; update แค่ `cover_url`, `preview_urls`, `updated_at`; ต้องเก็บ revision ก่อนแก้และ rollback ก็สร้าง revision ใหม่
- ข้อมูลที่ต้องคงเดิม: `id`, `slug`, `title`, `created_at`, `price`, `category`, `pages`, `bundle_members`
- รหัส UI: หน้า Audit มี `data-feature="BUNDLE-PREVIEW-001"`; คง dialog, selection, status และ theme เดิม
- การทดสอบ: `scripts/test-v014344.mjs`

## ELON-PAGE-001 — นักขาย Facebook Page และ Human Handoff

- สถานะ: `IMPLEMENTED`; ลงทะเบียนเส้นทางจริงใน v0.14.345
- หน้า/ไฟล์: `/elon-page-admin.html`, `public/elon-page-admin.js`, `functions/_meta_messenger.js`, `functions/_meta_sender.js`, `functions/api/meta/messenger.js`, `functions/api/admin/elon-page/index.js`, `functions/api/admin/elon-page/[id]/send.js`
- ฟังก์ชัน: verify Meta callback/signature, ingest/dedup event, เข้ารหัส participant, สร้าง AI job, ดูคิว, เปลี่ยน bot/human state และส่งตอบผ่าน idempotent outbox
- API: `GET/POST /api/meta/messenger`, `GET/PATCH /api/admin/elon-page`, `POST /api/admin/elon-page/:id/send`
- ฐานข้อมูล: `elon_page_conversations`, `elon_page_messages`, `elon_page_webhook_events`, `elon_page_ai_jobs`, `elon_page_outbox`
- สิทธิ์: Meta POST ต้องผ่าน `x-hub-signature-256`; admin endpoints ใช้ `requireAdmin`; participant ID เก็บเป็น hash และ ciphertext
- ห้ามกระทบ: payload ไม่เกิน 1 MB; event เดิมห้ามประมวลผลซ้ำ ยกเว้น failed/stale processing; conversation เก็บ 60 วัน; state เฉพาะ `bot_active|human_required|human_active|closed`; human_active ผูก admin; outbound ใช้ idempotency key และคิว retry เมื่อ provider ยังส่งไม่ได้
- รหัส UI: หน้า ELON Page มี `data-feature="ELON-PAGE-001"`; คงตาราง สถานะ และ theme เดิม
- การทดสอบ: `scripts/test-v014345.mjs`

## V4-REVIEW-001 — คิวตรวจ Draft และ Pending File จาก Vision 4

- สถานะ: `IMPLEMENTED`; ลงทะเบียนเส้นทางจริงใน v0.14.346
- หน้า/ไฟล์: `/vision4-edit.html`, `public/vision4-edit.js`, `functions/api/admin/vision4-review/index.js`, `functions/api/admin/vision4-review/[id].js`, `functions/api/admin/vision4-pending/[id].js`, `functions/api/admin/vision4-pending-file/[id].js`, `functions/api/admin/vision4-pending/consume.js`, `functions/api/admin/product-multipart/{init,part,complete,abort}.js`, `functions/api/admin/products/[id].js`
- ฟังก์ชัน: แสดง draft/pending queue, multipart upload ไฟล์รอรวม, เพิ่ม preview, เปิดไฟล์, แก้ draft, รับ draft เข้า Product Admin และ mark pending files ว่ารวมชุดแล้ว
- API: `GET /api/admin/vision4-review`, `POST /api/admin/vision4-review/:id`, `PUT /api/admin/vision4-pending/:id`, `GET /api/admin/vision4-pending-file/:id`, `POST /api/admin/vision4-pending/consume` และ multipart endpoints
- ฐานข้อมูล/ไฟล์: `products` ที่ `source='vision4'`, `product_files`, `vision4_pending_files`; R2 `vision4-pending-*` และ preview objects
- สิทธิ์: ทุก endpoint ใช้ `requireAdmin`; หน้าแก้ยอมรับเฉพาะ `source='vision4'` + `status='draft'`
- ห้ามกระทบ: multipart รับ PDF/ZIP ไม่เกิน 1 GB; preview รับ JPG/PNG/WEBP ไม่เกิน 5 MB; review เปลี่ยนเฉพาะ source เป็น admin ของ draft ที่ตรงเงื่อนไข; consume ต้องเป็น published product และ pending IDs ทุกตัวต้องยัง `waiting_bundle`; ไฟล์ที่รวมแล้วห้าม consume ซ้ำ
- รหัส UI: หน้าแก้ Vision 4 มี `data-feature="V4-REVIEW-001"`; คง form, preview, loading/error และ theme เดิม
- การทดสอบ: `scripts/test-v014346.mjs`

## VEASY-SHOP-001 — Activation ร้านค้า Bot/Inbox และ Native Runtime ของ VEasy

- สถานะ: `IMPLEMENTED`; ลงทะเบียนเส้นทางจริงใน v0.14.347
- หน้า/ไฟล์: `/veasy/login.html`, `public/veasy/login.js`, `functions/_veasy_shop.js`, `functions/_veasy_runtime.js`, `functions/_veasy_line_ai.js`, `functions/api/vision7/auth/veasy-activate.js`, `functions/api/vision7/auth/veasy-device.js`, `functions/api/vision7/shops/*`, `functions/api/vision7/runtime/*`
- ฟังก์ชัน: activate บัญชี/คีย์/อุปกรณ์/ร้าน, bind หนึ่ง license ต่อหนึ่งร้าน, จัดการ shop/products/channels, bot start-stop-handoff, inbox owner reply และ native runtime lease/conversation/message/order claims
- API: `/api/vision7/auth/veasy-*`, `/api/vision7/shops`, `/api/vision7/shops/:shopId/*`, `/api/vision7/runtime/*`
- ฐานข้อมูล: `veasy_shops`, `veasy_shop_products`, `veasy_channels`, `veasy_bot_state`, `veasy_conversations`, `veasy_chat_messages`, `veasy_conversation_controls`, `veasy_runtime_leases`, `veasy_conversation_leases`, `veasy_audit_log` และ Vision 7 license/device tables
- สิทธิ์: ใช้ Vision 7 auth; ทุก shop endpoint ตรวจ `shop_id + user_id`; activation ต้องเป็นโปรแกรม platform `veasy`, license ใช้งานได้และอยู่ใน device limit
- ห้ามกระทบ: 1 คีย์ = 1 ร้าน; ห้ามอ่าน/แก้ร้านข้ามเจ้าของ; เปิด bot ได้เมื่อร้าน active มี channel connected, webhook ready และ AI configured; stop ต้องล้าง runtime/conversation leases; owner ส่งได้เมื่อ conversation เป็น human และรุ่นนี้ส่งใน inbox เฉพาะ LINE; claim/lease ต้องรักษา ownership, expiry และ idempotency ตาม runtime เดิม
- รหัส UI: หน้า activation มี `data-feature="VEASY-SHOP-001"`; native app รับ handoff `veasy-auth-v1` โดยคง field เดิม
- การทดสอบ: `scripts/test-v014347.mjs`, `scripts/test-v014110-veasy-activation-contract.mjs`

## COURSE-INTEGRITY-001 — ตรวจความสอดคล้องคอร์ส สิทธิ์ และ Event Case

- สถานะ: `IMPLEMENTED`; ลงทะเบียนเส้นทางจริงใน v0.14.348
- หน้า/ไฟล์: `/course-integrity.html`, `public/course-integrity.js`, `functions/api/admin/course-integrity.js`
- ฟังก์ชัน: ตรวจ paid orders/slip evidence/learning rights, credit counts, unlock logs, entitlement ของ order ที่ไม่ paid, orphan orders และ sample Event Case `user1 / Vision 5 test`
- API: `GET /api/admin/course-integrity`, `GET /api/admin/course-integrity?event_case=1`
- Reads: `courses`, `products`, `users`, `orders`, `order_items`, `order_slip_evidence`, `entitlements`, `course_right_credits`, `unlock_logs`
- สิทธิ์: ใช้ `requireAdmin`; endpoint เป็น read-only และตอบ `cache-control: no-store`
- ห้ามกระทบ: ห้ามซ่อมหรือลบข้อมูลจากหน้า integrity; healthy เมื่อ paid=approved slips=learning rights และไม่มี invalid rights; system checks จำกัด 200 รายการต่อชนิด; Event Case จำกัด 20 คอร์สและ timeout 5 วินาที โดย timeout คืน 503 + `EVENT_CASE_QUERY_TIMEOUT`
- รหัส UI: หน้า Course Integrity มี `data-feature="COURSE-INTEGRITY-001"`; คง loading/timeout/error และ theme เดิม
- การทดสอบ: `scripts/test-v014348.mjs`

## CUSTOMER-INTELLIGENCE-001 — Visitor, Event, Funnel, Journey และ Product Demand

- สถานะ: `IMPLEMENTED`; ลงทะเบียนเส้นทางจริงใน v0.14.349
- หน้า/ไฟล์: analytics sections ใน `/admin.html`, `public/admin.js`, `functions/_analytics.js`, `functions/api/analytics/view.js`, `functions/api/analytics/event.js`, `functions/api/admin/visitor-stats.js`, `functions/api/admin/daily-events.js`, `functions/api/admin/customer-analytics.js`
- ฟังก์ชัน: aggregate page views, unique visitor, event explorer รายวัน, guest/member identity, conversion funnel/bottleneck, buyer mix, product performance, customer journey และ product-family demand recommendation
- API: `POST /api/analytics/view`, `POST /api/analytics/event`, `GET /api/admin/visitor-stats`, `GET /api/admin/daily-events`, `GET /api/admin/customer-analytics`
- ฐานข้อมูล: `page_views`, `analytics_daily`, `analytics_visitors`, `customer_events`, `products`, `orders`, `order_items`
- สิทธิ์/ความเป็นส่วนตัว: public ingestion ใช้ hashed visitor key, event allowlist, sanitized path/referrer/metadata และ rate limit; dashboard endpoints ใช้ `requireAdmin`
- ห้ามกระทบ: page view aggregate ตามวันไทย; raw retention 90 วันและประมวลผล batch 5,000; event เดิมภายใน 10 วินาทีไม่นับซ้ำ; daily explorer จำกัด 300 รายการ; customer window 1–90 วัน; conversion หารด้วยจำนวนคนของขั้นก่อนหน้า; recommendation เป็นข้อมูลช่วยตัดสินใจและห้ามผลิต/แก้สินค้าอัตโนมัติ
- รหัส UI: events, visitor stats และ customer-intelligence sections มี `data-feature="CUSTOMER-INTELLIGENCE-001"`; คง filter/loading/error และ theme เดิม
- การทดสอบ: `scripts/test-v014349.mjs`

## BUSINESS-REPORT-001 — รายงานยอดขาย กำไร–ขาดทุน และ CSV Export

- สถานะ: `IMPLEMENTED`; ลงทะเบียนเส้นทางจริงใน v0.14.350
- หน้า/ไฟล์: overview/sales sections ใน `/admin.html`, `public/admin.js`, `functions/api/admin/profit-dashboard.js`, `functions/api/admin/sales-report.js`
- ฟังก์ชัน: สรุปยอดขาย/ค่าแอด/กำไร/ROAS รายวัน, บันทึกค่าแอด Facebook รายวัน, กรองยอดขายตามวัน/ชนิด, product summary, cursor pagination และ CSV export แบบหลาย batch
- API: `GET/PUT /api/admin/profit-dashboard`, `GET /api/admin/sales-report`
- ฐานข้อมูล: `orders`, `order_items`, `products`, `users`, `unlock_logs`, `ad_costs`
- สิทธิ์: ทุก endpoint ใช้ `requireAdmin`; slip URL คืนผ่าน admin endpoint ไม่เปิด object key
- ห้ามกระทบ: profit dashboard นับเฉพาะ paid + `sale_price_recorded=1` + รายได้ VisionD; `profit=sales-facebook_cost`, `ROAS=sales/facebook_cost` และค่าแอดศูนย์คืน null; sales report นับเฉพาะ paid, แยก manual/slip และ VisionD/seller course; cursor ใช้ `paid_at|order_id`, limit สูงสุด 200; CSV client ต้องไล่ทุก cursor และหยุดเมื่อ cursor ซ้ำ
- รหัส UI: overview และ sales sections มี `data-feature="BUSINESS-REPORT-001"`; คง filter/export/loading/error และ theme เดิม
- การทดสอบ: `scripts/test-v014350.mjs`

## PAYMENT-SETTINGS-001 — บัญชีรับโอน QR และสถานะรับคำสั่งซื้อ

- สถานะ: `IMPLEMENTED`; ลงทะเบียนเส้นทางจริงใน v0.14.351
- หน้า/ไฟล์: payment form ใน `/admin.html`, `public/admin.js`, `functions/_payment.js`, `functions/api/admin/payment-settings.js`
- ฟังก์ชัน: ตั้งบัญชีส่วนตัว/บริษัท, เลือก active account, เปิด/ปิดรับ order, ตั้งข้อความหลังส่งสลิป, สลับ Vision 3/Vision 5 EasySlip verification และอัปโหลด QR
- API: `GET/PUT /api/admin/payment-settings`; public checkout อ่านผ่าน `loadPaymentSettings()` + `publicPaymentSettings()`
- ฐานข้อมูล/ไฟล์: `settings`; R2 `payment-qr-*`; activity log เมื่อ Boss เปลี่ยน Vision 5 EasySlip toggle
- สิทธิ์: `requireAdmin` อ่าน/บันทึก; เฉพาะ Boss เปลี่ยน active account และ auto-verification toggles; public projection คืนเฉพาะบัญชี active, QR, accepting-orders และข้อความ
- ห้ามกระทบ: ต้องกรอกทั้งสอง profile ครบ; QR เฉพาะ JPG/PNG/WEBP ไม่เกิน 5 MB; validate request ทั้งหมดก่อนเขียน; อัปโหลด object ใหม่ก่อน commit settings, DB ล้มต้องลบ object ใหม่ และลบ QR เก่าแบบ best effort หลัง commit; ห้ามเปิดเผย profile ที่ inactive ต่อ public
- รหัส UI: payment form มี `data-feature="PAYMENT-SETTINGS-001"`; คง role-disabled, loading/error และ theme เดิม
- การทดสอบ: `scripts/test-v014351.mjs`

## PROMOTION-SETTINGS-001 — ตั้งค่าโปรโมชั่นแคตตาล็อกและสวิตช์ซื้อครั้งแรก

- สถานะ: `IMPLEMENTED`; ลงทะเบียนเส้นทางจริงใน v0.14.352
- หน้า/ไฟล์: promotion forms ใน `/admin.html`, `public/admin.js`, `functions/_promotion.js`, `functions/api/admin/promotion-settings.js`
- ฟังก์ชัน: เปิด/ปิด catalog promotion, เลือกหมวดหลักหลายหมวดหรือ all, ตั้งส่วนลด 1–90%, แสดง first-order stats และเปิด/ปิด first-order promotion
- API: `GET/PUT /api/admin/promotion-settings`
- ฐานข้อมูล: `settings`, `categories`, `products`, `first_order_promo_state`
- สิทธิ์: ใช้ `requireAdmin`; หน้า API คืนเฉพาะหมวด active ระดับบนที่อนุญาต
- ห้ามกระทบ: scope ต้องไม่ว่างและหมวดต้อง active/อยู่ใน allowlist; all ต้องยุบเป็น scope เดียว; resale-rights ไม่ร่วม catalog promotion; course-selling-rights คงราคา 999→499 บาท และ bundle-deals ไม่ลดซ้ำ; ราคาลดต่ำสุด 1 สตางค์; first-order switch เปลี่ยนเฉพาะ enabled และห้ามเปลี่ยนขั้นต่ำ 399 บาท, 50%, cap 200 บาท, 2 ชั่วโมง หรือ eligibility contract เดิม
- รหัส UI: catalog และ first-order forms มี `data-feature="PROMOTION-SETTINGS-001"`; คง validation/stats/loading/error และ theme เดิม
- การทดสอบ: `scripts/test-v014352.mjs`, `scripts/test-first-order-promo.mjs`

1. เริ่มแก้ด้วยการค้นหารหัสฟีเจอร์นี้ใน repository
2. รายงานไฟล์และข้อมูลที่จะเปลี่ยนก่อนแก้เมื่อขอบเขตกว้างหรือเสี่ยง
3. เมื่อเส้นทาง runtime เปลี่ยน ให้แก้ Feature Map และ focused test พร้อมกัน
4. หากหลักฐานจริงไม่ตรงเอกสาร ให้หยุดอ้างเอกสารส่วนนั้น ตรวจโค้ด/schema แล้วแก้เอกสารในแพตช์เดียวกัน
