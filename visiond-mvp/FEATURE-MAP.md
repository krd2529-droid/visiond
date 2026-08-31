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

## UI-POINTER-001 — Global Pointer, Press และ Drag Interaction Layer

- สถานะ: `IMPLEMENTED`; ลงทะเบียน runtime จริงใน v0.14.380
- หน้า/ไฟล์: public/admin/member/content surfaces ที่โหลดผ่าน `public/account.js`, `public/admin.js`, `public/catalog-sync.js` หรือ `public/facebook-chat.js`; runtime `public/mouse-ui.js` และ `public/mouse-ui.css`
- Loading: controller ใช้ dynamic import `/mouse-ui.js?v=014304`; ES module cache ป้องกัน execute ซ้ำเมื่อ `catalog-sync.js` และ `facebook-chat.js` import ซ้อน; runtime inject stylesheet เฉพาะเมื่อไม่มี `link[data-visiond-mouse-ui]`
- Pointer presentation: arrow/hand/text SVG cursors, hover/focus/disabled/selection states, checkbox/radio/range accent, pressed transform และ card hover; coarse pointer คืน cursor เป็น auto และปิด card lift
- Navigation interaction: capture-phase `mousedown` ทำงานเฉพาะปุ่มเมาส์ซ้าย; same-window anchor ที่มี href จริงและไม่ใช่ download/target/hash/javascript ถูก `preventDefault`, หยุด listener ที่เหลือ และไปด้วย `location.assign(control.href)`
- Press interaction: control อื่นเพิ่ม `.vd-mouse-pressed` แล้วล้างครั้งเดียวเมื่อ mouseup หรือ window blur; CSS ใช้ state เดียวกับ `:active`
- Drag interaction: ป้องกัน native drag เมื่อ target อยู่ใน image หรือ anchor; CSS ปิด `-webkit-user-drag` บน image/link
- API/ข้อมูล/สิทธิ์: ไม่มี API, database, storage, auth หรือ mutation ธุรกิจ
- ห้ามกระทบ: ลำดับ capture, anchor eligibility, location navigation, pressed cleanup, drag guard, selectors, cursor assets, styles และ coarse-pointer behavior เดิม
- รหัส UI: document root ใช้ `data-ui-pointer-feature="UI-POINTER-001"` เพื่อไม่ทับ `data-feature` ของระบบหน้า; stylesheet dedupe marker เดิมคง `data-visiond-mouse-ui`
- ความสัมพันธ์: `GOV-UI-DESIGN-001` เป็นกติกา/canonical design contract; รหัสนี้เป็น runtime interaction layer ที่ใช้งานจริงและไม่ขยายกติกา UI
- การทดสอบ: `scripts/test-v014380.mjs`

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

## COURSE-REVIEW-001 — ส่งตรวจ อนุมัติ และควบคุมคอร์สพาร์ตเนอร์

- สถานะ: `IMPLEMENTED`; เติม auxiliary routes และ transition guards จากโค้ดจริงใน v0.14.364
- หน้า/ไฟล์: `/course-seller?type=1`, `/course-basket-edit?id=:courseId`, `/admin-course-reviews.html`, `public/course-seller.js`, `public/course-basket-edit.js`, `public/course-review-admin.js`, `functions/api/course-seller/[id]/publish.js`, `functions/api/admin/course-seller-reviews/index.js`, `functions/api/admin/course-seller-reviews/auto.js`, `functions/api/admin/course-seller-reviews/[id].js`, `functions/api/admin/course-seller-reviews/[id]/qr.js`
- ฟังก์ชัน: เจ้าของส่งตรวจ; ผู้ดูแลอ่านคิว; Boss อนุมัติ/ส่งกลับ/ปฏิเสธ/ระงับ/คืนสถานะ และสั่งตรวจ pending สูงสุด 100 คอร์สอัตโนมัติ
- API: `POST /api/course-seller/:courseId/publish`, `GET /api/admin/course-seller-reviews`, `POST /api/admin/course-seller-reviews/auto`, `POST /api/admin/course-seller-reviews/:id`, `GET /api/admin/course-seller-reviews/:id/qr`
- ฐานข้อมูล/ไฟล์: `courses`, `products`, `course_lessons`, `course_lesson_files`, `users`; R2 seller payment QR
- ขอบเขตคอร์ส: เฉพาะ `online_course` ที่ `course_origin='seller_rights'` และ `course_plan='partner'`; คิวรวม `pending|changes_requested|approved|suspended` และเรียง pending ก่อน
- สิทธิ์: เจ้าของส่งตรวจได้เฉพาะคอร์สตน; อ่านคิว/QR ใช้ `requireAdmin`; ทุก action เปลี่ยนสถานะและ auto review ตรวจ `role='boss'`
- ห้ามกระทบ approval: ต้อง submitted + pending และมี EP ที่ชื่อไม่ว่างพร้อม video/PDF/lesson file อย่างน้อย 1 EP; transition update course แบบ conditional แล้วเปลี่ยน product เป็น published/draft ตามสถานะ; concurrent state change คืน 409
- Auto review: ตรวจสูงสุด 100 pending ต่อรอบ; รายการขาดชื่อ/ปก/EP หรือไม่ได้ส่งตรวจต้องเป็น `changes_requested` + product draft; บันทึก security log และสรุป approved/not-approved/skipped/errors/remaining
- Lifecycle: request changes/reject ทำได้จาก pending; suspend จาก approved; restore จาก suspended; ทุก branch ปรับ `courses.active`, `review_status`, `review_note` และ `products.status` คู่กัน
- Auxiliary actions ใน controller เดิม: ตั้ง/ยกเลิก test account, approve/reject/reset seller payment profile; reset ล้างฟิลด์บัญชีและลบ QR เดิม; QR response เป็น `private, no-store`
- ห้ามกระทบ: ปุ่มส่งตรวจห้ามเผยแพร่เอง; ห้ามอนุมัติเมื่อ EP ไม่พร้อม; ห้ามเปิดสินค้าก่อน Boss อนุมัติ; ห้ามนำ company course หรือ non-partner seller course เข้าคิวนี้
- รหัส UI: `#sellerReview` ได้ `data-feature="COURSE-REVIEW-001"` จาก controller; คง confirmation, status, loading/error และ theme เดิม
- การทดสอบ: `scripts/test-v014310.mjs`, `scripts/test-v014324.mjs`, `scripts/test-v014364.mjs`

## AUTH-ACCOUNT-001 — สมัครสมาชิก เข้าสู่ระบบ และจัดการเซสชัน

- สถานะ: `IMPLEMENTED`; ตรวจเส้นทางย้อนหลังใน v0.14.304
- หน้า: `/`, `/login.html`, `/register.html`, `/forgot-password.html`, `/reset-password.html`, `/dashboard.html`
- ไฟล์: `public/app.js`, `public/member-auth.js`, `public/member-dashboard.js`, `public/security.js`, `public/reset-password.js`, `functions/_security.js`, `functions/api/security/config.js`, `functions/api/auth/register.js`, `functions/api/auth/login.js`, `functions/api/auth/logout.js`, `functions/api/auth/me.js`, `functions/api/auth/change-password.js`, `functions/api/auth/forgot-password.js`, `functions/api/auth/reset-password.js`
- ฟังก์ชัน/ตัวควบคุม: `loadHomeAccount()`, `submitAuth()`, `onRequestPost()`, `requireUser()`
- ปุ่ม/interaction: สมัครสมาชิก, เข้าสู่ระบบ, จำการเข้าสู่ระบบ, ลืม/ตั้งรหัสผ่านใหม่, เปลี่ยนรหัสผ่าน, ออกจากระบบ
- API: `GET /api/security/config`, `POST /api/auth/register`, `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me`, `POST /api/auth/change-password`, `POST /api/auth/forgot-password`, `POST /api/auth/reset-password`
- ฐานข้อมูล / ตาราง / ฟิลด์: D1; `users.id`, `users.email`, `users.username`, `users.password_hash`, `users.role`, `sessions.id`, `sessions.user_id`, `sessions.expires_at`, `password_reset_tokens`, `user_terms_acceptances`
- Input: ชื่อ นามสกุล ไอดี อีเมล โทรศัพท์ รหัสผ่าน Turnstile และการยอมรับข้อกำหนด
- Output: เซสชันคุกกี้ `vd_session`, ข้อมูลสมาชิกที่ไม่เปิดเผย hash/token และผลดำเนินการ
- Reads: บัญชีผู้ใช้ เซสชัน การยอมรับข้อกำหนด และ token รีเซ็ตรหัสผ่าน
- Writes: สร้าง/แก้บัญชี สร้าง/ยกเลิกเซสชัน บันทึกการยอมรับและ security log
- สิทธิ์: ผู้เยี่ยมชมทำรายการสมัคร/เข้าสู่ระบบ; ข้อมูลบัญชีและเปลี่ยนรหัสผ่านต้องเป็นเจ้าของเซสชัน
- Turnstile client: login/register/forgot-password โหลด `security.js`; เมื่อพบ form และ public config มี site key จึงโหลด Cloudflare SDK แบบ explicit, แทรก light-theme widget ก่อน submit และ hidden `turnstile_token`; callback ตั้ง token และ expired callback ล้าง token; config/SDK/error อื่น fail-quiet
- Turnstile server: register/login/forgot-password ส่ง token จาก FormData/JSON เข้า `verifyTurnstile()`; เมื่อไม่มี `TURNSTILE_SECRET_KEY` server คืน `{ok:true,disabled:true}`; เมื่อเปิดใช้ต้องมี token, ส่ง secret/response/remote IP ไป Siteverify และปฏิเสธ success false หรือ hostname ไม่ตรง request
- Configuration boundary: client enablement ยึด `TURNSTILE_SITE_KEY` แต่ server enforcement ยึด `TURNSTILE_SECRET_KEY`; ต้องตั้งคู่กัน มิฉะนั้น site-only จะแสดง widgetแต่ server bypass ส่วน secret-only จะไม่มี widget/tokenและ auth request ถูกปฏิเสธ
- รหัส UI: Turnstile slot ที่สร้างแบบ dynamic ใช้ `data-feature="AUTH-ACCOUNT-001"`; คง SDK URL, theme, inline spacing, callbacks และ form/button layout เดิม
- ห้ามกระทบ: ห้ามส่ง `password_hash`, session ID หรือ reset token กลับ frontend; ห้ามข้าม rate limit/Turnstile; ห้ามลดสิทธิ์ตรวจ role
- การทดสอบ: `scripts/test-v01447.mjs`, `scripts/test-v014110-b1.mjs`, `scripts/test-v014304.mjs`, coverage correction `scripts/test-v014384.mjs`

## CATALOG-STOREFRONT-001 — แคตตาล็อกและหน้ารายละเอียดสินค้าดิจิทัล

- สถานะ: `IMPLEMENTED`; ตรวจเส้นทางย้อนหลังใน v0.14.304
- หน้า: `/`, `/digital-products.html`, `/product.html?slug=:slug`
- ไฟล์: `public/catalog-sync.js`, `public/product.js`, `functions/api/products/index.js`, `functions/api/products/[slug].js`, `functions/_catalog.js`, `functions/_promotion.js`, `functions/api/internal/analytics-retention.js`
- ฟังก์ชัน/ตัวควบคุม: `renderProduct()`, `renderProductError()`, `onRequestGet()`
- ปุ่ม/interaction: ตัวกรองหมวด ค้นหา เปิดการ์ดสินค้า เลื่อนภาพตัวอย่าง เพิ่มตะกร้า และซื้อทันที
- API: `GET /api/products`, `GET /api/products/:slug`
- ฐานข้อมูล / ตาราง / ฟิลด์: D1; `products.id`, `products.slug`, `products.title`, `products.price`, `products.cover_url`, `products.preview_urls`, `products.category`, `products.product_kind`, `products.status`, `categories.slug`, `analytics_daily`, `page_views`
- Input: `slug`, หมวด คำค้น และสถานะหน้าแคตตาล็อก
- Output: เฉพาะสินค้าที่ `published`, ไม่ถูกลบ และข้อมูลราคา/โปรโมชันสำหรับแสดงผล
- Reads: สินค้า หมวด โปรโมชัน จำนวนเข้าชม และรายการในชุดรวม; list endpoint รวมยอดด้วย aggregate CTE รอบเดียวและ cache response 60 วินาที
- Writes: endpoint สาธารณะไม่เขียนสินค้าและไม่ purge ถังขยะ; trash purge ทำใน daily maintenance และหน้า Admin trash เท่านั้น; การนับ analytics แยกอยู่ระบบ analytics
- สิทธิ์: เปิดอ่านสาธารณะ; สินค้าร่าง/ลบแล้วต้องไม่ออก API สาธารณะ
- ห้ามกระทบ: ห้ามเปิดเผย object key ของไฟล์จริง; ห้ามนำคอร์สร่างหรือสินค้าหลังบ้านออกหน้าร้าน; ห้ามแก้ราคาเฉพาะ frontend
- การทดสอบ: `scripts/test-commerce-final.mjs`, `scripts/test-v014181.mjs`, `scripts/test-v014304.mjs`, `scripts/test-v014396.mjs`

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
- โปรรถเข็น: สินค้าที่ร่วมรายการครบ 5/10/20/30 ตะกร้า ลด 15/25/50/75% ตามลำดับ; คำนวณจากรายการที่ร่วมโปรเท่านั้น; bundle-deals, resale-rights, Vision 7 key, course และ non-product ไม่ร่วมคำนวณ; first-order discount ชนะโปรรถเข็นและไม่ stack
- Cache contract: หน้าแรกและหน้าสินค้าดิจิทัลต้อง bump query version ของ `catalog-sync.js` เมื่อสูตร/ข้อความรถเข็นเปลี่ยน; หน้ารถเข็นต้อง bump `cart.js` ในแพตเดียวกัน เพื่อไม่ให้ browser ใช้สูตรแสดงผลรุ่นเก่า
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
- ข้อจำกัดที่ตรวจพบ: รูป direct upload ไม่เกิน 5 MB; PDF/ZIP direct upload ไม่เกิน 100 MB; multipart upload รวมไม่เกิน 2 GB
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
- หน้า: `/course-center`, แคตตาล็อกคอร์สหน้าแรก, `/dashboard`, `/admin-course-reviews.html`, `/admin`
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
- หน้า/ไฟล์: `/v12-settings.html`, `public/v12-settings.js`, `functions/api/admin/v12-channel.js`, `functions/api/admin/v12-bot.js`, `functions/hooks/v12/facebook.js`, `functions/_channel_crypto.js`, `functions/_v12_schema.js`
- Controller load: GET เติม Page ID/active shops/callback และสถานะ token/app-secret/webhook/encryption; escape ชื่อร้านก่อนสร้าง option; secret inputs required เฉพาะเมื่อยังไม่มีค่าที่บันทึก
- Save: PUT ส่ง FormData เป็น JSON; สำเร็จแล้วล้าง secret inputs, เปลี่ยน saved/required state และแสดง verify token เฉพาะเมื่อ API คืน token ที่สร้างใหม่ มิฉะนั้นแจ้งว่าใช้ค่าลับเดิม
- Connection test: POST ใช้ credential ที่บันทึกแล้วเรียก Meta `/me/messenger_profile?fields=get_started`; UI แสดงชื่อ/ID เมื่อผ่านหรือ error/HTTP status เมื่อไม่ผ่าน
- API/สิทธิ์: Channel GET/PUT/POST และ Bot GET/PATCH ผ่าน `requireBoss` และตอบ `private, no-store`; GET คืนเฉพาะ flags, IDs, active shops, verified/callback/bot status ไม่คืน token, app secret, verify token หรือ ciphertext
- Bot control: หน้า V12 Connect แสดงปุ่มเปิด/ปิดทั้งร้านจาก `veasy_bot_state`; เปิดได้เมื่อ Facebook webhook, ร้าน และ AI Provider พร้อม; ปิดแล้วยังรับ/บันทึกข้อความแต่ไม่ตอบ AI, ล้าง runtime leases และบันทึก `veasy_audit_log`
- Validation/persistence: PUT ต้องมี encryption key อย่างน้อย 32 ตัว, Page ID 5–30 digits, active shop, token ใหม่อย่างน้อย 40 และ app secret ใหม่อย่างน้อย 20; ช่อง secret ว่างใช้ ciphertext เดิมและ token ใหม่จะ reset `verified_at`
- Encryption/one-time value: AES-GCM ใช้ random IV, derived SHA-256 key, AAD และ prefix `vdch1:`; verify token สร้าง/เข้ารหัสครั้งแรกและคืน plaintext เพียง response ที่สร้างใหม่ หลังจากนั้น GET/PUT ไม่เปิดเผยอีก
- ฐานข้อมูล: `v12_channel_credentials`; เก็บ Token, App Secret และ Verify Token แบบเข้ารหัส
- Schema hot path: `ensureV12Schema` ใช้ `runtime_schema_state` v66 เป็น persistent readiness marker และ memoize ต่อ isolate; Settings/Profile/Broadcast ไม่รัน runtime bootstrap, PRAGMA หรือ DDL เมื่อ migration พร้อม
- Failure: load/save/test แสดง state ที่ผู้ใช้รับรู้; API log เฉพาะ error code ที่ตัดความยาว ไม่ log credential; Meta error projection จำกัด code/subcode/type และข้อความจำแนก token/permission/rate limit
- รหัส UI: settings form ใช้ `data-feature="V12-CHANNEL-001"`; คง field/button/status, responsive layout และ theme เดิม
- ห้ามกระทบ: ห้ามคืน credential/ciphertext เต็มสู่หน้าเว็บหรือ log, ห้ามเปลี่ยน retention/one-time verify token, encryption, Boss guard, Meta test และห้ามรับ event ที่ HMAC ไม่ถูกต้อง
- การทดสอบ: `scripts/test-v014385.mjs`, `scripts/test-v014401.mjs`, `scripts/test-v014404.mjs`; historical `scripts/test-v014241.mjs`, `scripts/test-v014244.mjs`, `scripts/test-v014195.mjs`, `scripts/test-v014198.mjs`

## V12-INBOX-001 — กล่องข้อความ LINE/Facebook และข้อมูลลูกค้า

- สถานะ: `IMPLEMENTED`; ตรวจเส้นทางจริงซ้ำใน v0.14.326
- หน้า/ไฟล์: `/v12-connect.html`, `public/v12-connect.js`, `functions/api/admin/v12-conversations.js`, `functions/api/admin/v12-thread.js`, `functions/api/admin/v12-connect.js`, `functions/api/admin/v12-profiles.js`, `functions/api/admin/v12-facebook-history.js`, `functions/hooks/v12/facebook.js`, `functions/_veasy_line_ai.js`, `functions/api/media/v12-connect/outbound/[[path]].js`
- ฐานข้อมูล: `veasy_conversations`, `veasy_chat_messages`, `veasy_conversation_controls`, `veasy_message_claims`
- Bot reply: LINE และ Facebook text message ตอบด้วย provider ที่ตั้งค่าเมื่อ `veasy_bot_state.state='running'` และ conversation mode เป็น `bot`; แชทใหม่เริ่ม bot แต่ `ON CONFLICT` ต้องรักษา mode เดิมเพื่อไม่แย่งแชทที่คนรับช่วง
- Inbox refresh: หน้า V12 Connect โหลดครั้งแรกทันที; เมื่อเปิดค้างใช้ adaptive polling 60 วินาทีขณะใช้งานและ 5 นาทีเมื่อ idle, ไม่ยิงเมื่อแท็บซ่อน/กำลังค้นหา และกัน request ซ้อน
- List query: `/api/admin/v12-conversations` ใช้ latest-message ID subquery เดียวแล้ว join เพื่อคืนทั้ง content/type แทน correlated lookup ซ้ำสองครั้ง; จำกัด 200 บทสนทนาและคง thread detail แยก endpoint
- Thread query: `/api/admin/v12-thread` คืนข้อความล่าสุดหน้าละ 50 พร้อม bounded `before` cursor ที่ตรวจว่าอยู่ใน shop/conversation เดียวกัน; UI โหลดข้อความเก่าย้อนหลังทีละหน้าและกัน response ห้องเก่าทับห้องใหม่
- Query budget regression: `scripts/test-v12-query-budget.mjs` ล็อก adaptive polling, list ≤200, latest probe 1 ครั้ง/บทสนทนา, thread ≤51 rows/page, AI history ≤10 และ Facebook import แบบ manual 25×100
- Handoff/Error: ข้อความ payment/refund/complaint ส่งข้อความมาตรฐานแล้วเปลี่ยน mode เป็น human; รูปภาพรับเข้า inbox แต่ไม่ส่งเข้า AI; provider/Meta ส่งล้มบันทึก claim failed และ `veasy_bot_state.last_error`
- ห้ามกระทบ: ห้ามส่งซ้ำ ห้ามเปิดเผย target/credential และห้ามส่งเมื่อไม่ได้อยู่โหมด human
- การทดสอบ: `scripts/test-v014402.mjs`, `scripts/test-v014403.mjs`, `scripts/test-v014405.mjs`, `scripts/test-v014406.mjs`, `scripts/test-v12-query-budget.mjs`; historical `scripts/test-v014326.mjs`, `scripts/test-v014390.mjs`, `scripts/test-v014401.mjs`

## V12-BROADCAST-001 — Broadcast และคิวส่งหลายช่องทาง

- สถานะ: `IMPLEMENTED`; ตรวจเส้นทางจริงซ้ำใน v0.14.326
- หน้า/ไฟล์: `/v12-connect.html`, `public/v12-connect.js`, `functions/api/admin/v12-broadcast.js`, `functions/api/media/[key].js`, `functions/api/media/v12-connect/broadcast/[file].js`, `functions/_v12_schema.js`
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
- ไฟล์: `public/elon-chat.js`, `public/elon-chat.css`, `functions/_elon.js`, `functions/_elon-provider.js`, `functions/_elon-member-store.js`, `functions/_elon_databases.js`, `functions/api/elon/chat.js`, `functions/api/elon/public-chat.js`, `functions/api/elon/conversations.js`, `functions/api/elon/clear.js`, `functions/api/elon/status.js`, `functions/api/internal/elon-retention.js`
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
- Auto SEO v0.14.476: สร้างร่างจากสินค้าที่ published แบบ deterministic, ตรวจ title/keyword/meta/body/FAQ/product, ป้องกัน keyword/slug ซ้ำ, Boss approval, public index renderer พร้อม canonical และ Schema.org, dynamic `/sitemap.xml` แสดงเฉพาะ revision ที่อนุมัติและ published
- การทดสอบ Auto SEO: `scripts/test-v014476.mjs`

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
- หน้า/ไฟล์: `/elon-page-admin.html`, `public/elon-page-admin.js`, `functions/_meta_messenger.js`, `functions/_meta_sender.js`, `functions/api/meta/messenger.js`, `functions/api/admin/elon-page/index.js`, `functions/api/admin/elon-page/[id]/send.js`, `functions/api/internal/meta-outbox.js`
- ฟังก์ชัน: verify Meta callback/signature, ingest/dedup event, เข้ารหัส participant, สร้าง AI job, ดูคิว, เปลี่ยน bot/human state และส่งตอบผ่าน idempotent outbox
- API: `GET/POST /api/meta/messenger`, `GET/PATCH /api/admin/elon-page`, `POST /api/admin/elon-page/:id/send`
- ฐานข้อมูล: `elon_page_conversations`, `elon_page_messages`, `elon_page_webhook_events`, `elon_page_ai_jobs`, `elon_page_outbox`
- สิทธิ์: Meta POST ต้องผ่าน `x-hub-signature-256`; admin endpoints ใช้ `requireAdmin`; participant ID เก็บเป็น hash และ ciphertext
- ห้ามกระทบ: payload ไม่เกิน 1 MB; event เดิมห้ามประมวลผลซ้ำ ยกเว้น failed/stale processing; conversation เก็บ 60 วัน; state เฉพาะ `bot_active|human_required|human_active|closed`; human_active ผูก admin; outbound ใช้ idempotency key และคิว retry เมื่อ provider ยังส่งไม่ได้
- รหัส UI: หน้า ELON Page มี `data-feature="ELON-PAGE-001"`; คงตาราง สถานะ และ theme เดิม
- การทดสอบ: `scripts/test-v014345.mjs`

## V4-REVIEW-001 — คิวตรวจ Draft และ Pending File จาก Vision 4

- สถานะ: `IMPLEMENTED`; ลงทะเบียนเส้นทางจริงใน v0.14.346
- หน้า/ไฟล์: V4 draft cards ใน `/admin.html`, `public/vision4-card-actions.js`, `/vision4-edit.html`, `public/vision4-edit.js`, `functions/api/admin/vision4-review/index.js`, `functions/api/admin/vision4-review/[id].js`, `functions/api/admin/vision4-pending/[id].js`, `functions/api/admin/vision4-pending-file/[id].js`, `functions/api/admin/vision4-pending/consume.js`, `functions/api/admin/product-multipart/{init,part,complete,abort}.js`, `functions/api/admin/products/[id].js`
- ฟังก์ชัน: แสดง draft/pending queue, multipart upload ไฟล์รอรวม, เพิ่ม preview, เปิดไฟล์, แก้ draft, รับ draft เข้า Product Admin และ mark pending files ว่ารวมชุดแล้ว
- API: `GET /api/admin/vision4-review`, `POST /api/admin/vision4-review/:id`, `PUT /api/admin/vision4-pending/:id`, `GET /api/admin/vision4-pending-file/:id`, `POST /api/admin/vision4-pending/consume` และ multipart endpoints
- ฐานข้อมูล/ไฟล์: `products` ที่ `source='vision4'`, `product_files`, `vision4_pending_files`; R2 `vision4-pending-*` และ preview objects
- สิทธิ์: ทุก endpoint ใช้ `requireAdmin`; หน้าแก้ยอมรับเฉพาะ `source='vision4'` + `status='draft'`
- ห้ามกระทบ: multipart รับ PDF/ZIP ไม่เกิน 2 GB; preview รับ JPG/PNG/WEBP ไม่เกิน 5 MB; review เปลี่ยนเฉพาะ source เป็น admin ของ draft ที่ตรงเงื่อนไข; consume ต้องเป็น published product และ pending IDs ทุกตัวต้องยัง `waiting_bundle`; ไฟล์ที่รวมแล้วห้าม consume ซ้ำ
- การจัดการการ์ด Draft: decorator ทำงานเฉพาะ `.v3-review-draft` ที่มี `data-v4-detail`, เติมลิงก์แก้ไข `/vision4-edit.html?id=...` และปุ่มลบ; ปุ่มลบต้องยืนยันก่อนเรียก `DELETE /api/admin/products/:id` ซึ่งเป็น soft delete เข้า Trash 30 วันภายใต้ `requireAdmin`
- Known Gap: network rejection ของปุ่มลบยังไม่มี `catch` จึงอาจค้าง disabled โดยไม่แจ้งข้อผิดพลาด; decorator mark `manageReady` ก่อนตรวจ action container จึงไม่ retry การ์ดที่ container มาช้า; style ของสองปุ่มยัง inject แบบ inline legacy แทน canonical component
- รหัส UI: หน้าแก้ Vision 4 และปุ่มแก้ไข/ลบที่ decorator สร้างมี `data-feature="V4-REVIEW-001"`; คง form, preview, loading/error และ theme เดิม
- การทดสอบ: `scripts/test-v014387.mjs`; historical `scripts/test-v014346.mjs`

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
- หน้า/ไฟล์: analytics sections ใน `/admin.html`, `public/admin.js`, `functions/_analytics.js`, `functions/api/analytics/view.js`, `functions/api/analytics/event.js`, `functions/api/admin/visitor-stats.js`, `functions/api/admin/daily-events.js`, `functions/api/admin/customer-analytics.js`, `functions/api/internal/analytics-retention.js`
- ฟังก์ชัน: aggregate page views, unique visitor, event explorer รายวัน, guest/member identity, conversion funnel/bottleneck, buyer mix, product performance, customer journey และ product-family demand recommendation
- API: `POST /api/analytics/view`, `POST /api/analytics/event`, `GET /api/admin/visitor-stats`, `GET /api/admin/daily-events`, `GET /api/admin/customer-analytics`
- ฐานข้อมูล: `page_views` เป็น legacy retention เท่านั้น; View ใหม่เขียน `analytics_daily` + `analytics_visitors`, unique อ่านจาก `analytics_summary`; Event เขียน `customer_events`; duplicate/rate limit ของ public telemetry ใช้ edge cache หรือ memory ต่อ isolate โดยไม่เขียน D1
- สิทธิ์/ความเป็นส่วนตัว: public ingestion ใช้ hashed visitor key, event allowlist, sanitized path/referrer/metadata และ rate limit; dashboard endpoints ใช้ `requireAdmin`
- ห้ามกระทบ: page view aggregate ตามวันไทย; raw legacy retention 90 วันและประมวลผล batch 5,000; View ซ้ำภายใน 30 นาทีและ Event ซ้ำภายใน 10 วินาทีไม่นับซ้ำแบบ best-effort ต่อ edge; daily explorer จำกัด 300 รายการ; customer window 1–90 วัน; conversion หารด้วยจำนวนคนของขั้นก่อนหน้า; recommendation เป็นข้อมูลช่วยตัดสินใจและห้ามผลิต/แก้สินค้าอัตโนมัติ
- รหัส UI: events, visitor stats และ customer-intelligence sections มี `data-feature="CUSTOMER-INTELLIGENCE-001"`; คง filter/loading/error และ theme เดิม
- การทดสอบ: `scripts/test-v014349.mjs`, `scripts/test-v014391.mjs`, `scripts/test-v014392.mjs`, `scripts/test-v014394.mjs`, `scripts/test-v014395.mjs`

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

## SERVICE-RECEIPT-001 — ใบเสร็จรับเงินค่าบริการ VisionD

- ผู้ใช้: Boss และ Admin
- ทางเข้า: เมนูหลังบ้าน “ออกใบเสร็จค่าบริการ” → `/service-receipt.html`
- Input บังคับ: ชื่อลูกค้า/ชื่อผู้เสียภาษี, เลขประจำตัวผู้เสียภาษีตัวเลข 13 หลัก, รายการบริการ และยอดชำระเป็นบาท; ระบบสร้างเลขเอกสารกับวันเวลาให้อัตโนมัติ
- Output: ตัวอย่างใบเสร็จที่แสดงชื่อลูกค้าและเลขประจำตัวผู้เสียภาษี พร้อมคำสั่งพิมพ์/บันทึกเป็น PDF ผ่านเบราว์เซอร์
- Tax boundary: VisionD ยังไม่จด VAT เอกสารต้องใช้คำว่า “ใบเสร็จรับเงิน” เท่านั้น ไม่ใช้คำว่า “ใบกำกับภาษี” ไม่แสดงหรือคำนวณ VAT
- Data boundary: ทำงานฝั่งเบราว์เซอร์ ไม่บันทึกชื่อลูกค้า เลขประจำตัวผู้เสียภาษี รายการบริการ หรือยอดเงินลงฐานข้อมูล และไม่ผูกกับ Order/Payment Contract
- รหัส UI: หน้าและปุ่มทางเข้ามี `data-feature="SERVICE-RECEIPT-001"`; ปุ่มใช้ canonical `.vds-btn` เท่านั้น
- การทดสอบ: `scripts/test-v014413.mjs`

## PROMOTION-SETTINGS-001 — ตั้งค่าโปรโมชั่นแคตตาล็อกและสวิตช์ซื้อครั้งแรก

- สถานะ: `IMPLEMENTED`; ลงทะเบียนเส้นทางจริงใน v0.14.352
- หน้า/ไฟล์: promotion forms ใน `/admin.html`, `public/admin.js`, `functions/_promotion.js`, `functions/api/admin/promotion-settings.js`
- ฟังก์ชัน: เปิด/ปิด catalog promotion, เลือกหมวดหลักหลายหมวดหรือ all, ตั้งส่วนลด 1–90%, แสดง first-order stats และเปิด/ปิด first-order promotion
- API: `GET/PUT /api/admin/promotion-settings`
- ฐานข้อมูล: `settings`, `categories`, `products`, `first_order_promo_state`
- สิทธิ์: ใช้ `requireAdmin`; หน้า API คืนเฉพาะหมวด active ระดับบนที่อนุญาต
- ห้ามกระทบ: scope ต้องไม่ว่างและหมวดต้อง active/อยู่ใน allowlist; all ต้องยุบเป็น scope เดียว; resale-rights ไม่ร่วม catalog promotion; course-selling-rights คงราคา 999→499 บาท; bundle-deals ใช้ catalog promotion ได้เมื่อเลือก scope นี้ แต่ยังถูกตัดออกจากส่วนลดตามจำนวนสินค้าเพื่อไม่ให้ส่วนลดซ้อน; ราคาลดต่ำสุด 1 สตางค์; first-order switch เปลี่ยนเฉพาะ enabled และห้ามเปลี่ยนขั้นต่ำ 399 บาท, 50%, cap 200 บาท, 2 ชั่วโมง หรือ eligibility contract เดิม
- รหัส UI: catalog และ first-order forms มี `data-feature="PROMOTION-SETTINGS-001"`; คง validation/stats/loading/error และ theme เดิม
- การทดสอบ: `scripts/test-v014352.mjs`, `scripts/test-first-order-promo.mjs`

## FIRST-ORDER-INCENTIVE-001 — สิทธิส่วนลดและของขวัญสำหรับคำสั่งซื้อแรก

- สถานะ: `IMPLEMENTED`; ลงทะเบียนเส้นทางจริงใน v0.14.378
- หน้า/ไฟล์: public storefront ที่โหลด `public/first-order-promo.js`, `functions/_first_order_promo.js`, `functions/api/first-order-promotion.js`, `functions/api/auth/login.js`, `functions/api/orders/index.js`, `functions/_orders.js`, `functions/api/notifications.js`
- Customer lifecycle: login สำเร็จครั้งที่ 2 แสดง teaser; ครั้งที่ 3 grant offer อายุ 2 ชั่วโมง; `GET /api/first-order-promotion` คืนสถานะ authoritative แบบ no-store; client แสดง/ปิด/countdown เท่านั้นและไม่คำนวณสิทธิ์
- Discount: order API คำนวณจากสินค้าที่ร่วมรายการเมื่อ subtotal อย่างน้อย 399 บาท ลด 50% สูงสุด 200 บาท; first-order discount ชนะ bundle discount และไม่ stack; เมื่อสร้าง order สำเร็จจึงบันทึก `used_order_id` กับ activity `first_order_promo_applied`
- Gift after payment: เมื่อ `grantOrder()` เปลี่ยนบิลจริงใบแรกเป็น paid ระบบพยายามสร้าง paid gift order มูลค่า 0 หนึ่งใบ, grant entitlement และบันทึก `first_order_gift_granted`; เลือก published digital product ตาม interest ก่อน ราคาไม่เกิน setting/default 199 บาท และตัด resale-rights, online course, สินค้าที่มีสิทธิ์หรือเคยซื้อแล้ว
- API/ฐานข้อมูล: `GET /api/first-order-promotion`; `first_order_promo_state`, `orders`, `order_items`, `entitlements`, `customer_events`, `user_activity_log`, `settings`; unique partial index `idx_orders_first_order_gift` กัน gift ซ้ำต่อสมาชิก
- สิทธิ์: status API และ order flow ใช้ authenticated user; login counter เพิ่มหลังตรวจรหัสผ่านและสร้าง session สำเร็จ; การอนุมัติ paid gift ทำหลัง `grantOrder()` claim order ได้จริง
- ห้ามกระทบ: switch ปิดทำให้ stage finished; ผู้ใช้ที่มี paid order หรือใช้ส่วนลดแล้วไม่ active; offer ที่หมดเวลาไม่ active; excluded discount categories คือ resale-rights, bundle-deals, Vision 7 key และ non-product; gift failure เป็น best effort และไม่ย้อน paid order; notification แยก gift order จาก order ปกติ
- Atomicity boundary: การสร้าง customer order กับการ mark promotion-used เป็นคนละ DB batch; gift order header ถูกสร้างก่อน batch ของ item/entitlement/event ตามโค้ดปัจจุบัน จึงห้ามอ้างว่า lifecycle ทั้งชุด atomic
- รหัส UI: runtime nudge ใช้ `data-feature="FIRST-ORDER-INCENTIVE-001"`; คงข้อความ, countdown, placement, close behavior, styles และ theme เดิม
- ความสัมพันธ์: admin configuration/stats อยู่ใต้ `PROMOTION-SETTINGS-001`; pricing/order creation อยู่ใต้ `COMMERCE-ORDER-001`; ระบบนี้ลงทะเบียน lifecycle ของลูกค้าและ first-paid-order gift โดยไม่เปลี่ยน contract ของสองระบบนั้น
- การทดสอบ: `scripts/test-v014378.mjs`, `scripts/test-first-order-promo.mjs`, `scripts/test-v01448.mjs`

## MEMBER-ADMIN-001 — จัดการบัญชีสมาชิก เครดิตคอร์ส และปลดล็อกแบบ Manual

- สถานะ: `IMPLEMENTED`; ลงทะเบียนเส้นทางจริงใน v0.14.353
- หน้า/ไฟล์: users section ใน `/admin.html`, `public/admin.js`, `functions/api/admin/users.js`, `functions/api/admin/users/[id].js`, `functions/api/admin/users/test-user.js`, `functions/api/admin/users/[id]/course-credits.js`, `functions/api/admin/users/[id]/unlock.js`, `functions/api/admin/unlock-history.js`
- ฟังก์ชัน: ดูรายชื่อ/แก้บัญชี, สร้างยูสทดสอบ, เพิ่มเครดิตสิทธิ์ลงขายคอร์ส, ปลดล็อกสินค้าให้ลูกค้าพร้อมราคาขาย/สลิป และดูประวัติปลดล็อก
- API: `GET /api/admin/users`, `PATCH /api/admin/users/:id`, `POST /api/admin/users/test-user`, `POST /api/admin/users/:id/course-credits`, `POST /api/admin/users/:id/unlock`, `GET /api/admin/unlock-history`
- ฐานข้อมูล/ไฟล์: `users`, `orders`, `order_items`, `entitlements`, `course_right_credits`, `unlock_logs`, `order_slip_evidence`; R2 `slips/manual/*`
- สิทธิ์: รายชื่อ/ปลดล็อก/ประวัติใช้ `requireAdmin`; แก้บัญชี สร้างยูสทดสอบ และเพิ่มเครดิตคอร์สใช้ `requireBoss`; บัญชี Boss แก้จากตารางนี้ไม่ได้
- ห้ามกระทบ: account type จำกัด `user|test|admin`; test user ใช้ชื่อกลางเดิม; เครดิตคอร์ส 1–100 ต่อครั้ง; manual unlock รับเฉพาะ published product, ไม่สร้าง entitlement ซ้ำยกเว้น resale-rights, สลิปต้องเป็นรูปไม่เกิน 10 MB และราคาขายที่เว้นว่างคง `sale_price_recorded=0`
- รหัส UI: users section มี `data-feature="MEMBER-ADMIN-001"`; คง form/table/dialog/loading/error และ theme เดิม
- การทดสอบ: `scripts/test-v014353.mjs`

## CATEGORY-MEMBER-001 — Member 3 หมวดตลอดชีพ

- สถานะ: `IMPLEMENTED`; v0.14.466 ปิดเส้นทางซื้อ–อนุมัติ–ปลดสิทธิ์–ดาวน์โหลดครบ
- หน้า/ไฟล์: `/member`, `public/member.html`, `public/member.js`, `public/member-rights.js`, `public/member.css`, `functions/_member_plan.js`, `functions/_orders.js`, `functions/api/member/plans.js`, `functions/api/admin/member-plans.js`, `functions/api/downloads/product/[id].js`, `functions/api/downloads/file/[id].js`
- ฟังก์ชัน: แพ็กเกจ 299 บาทชำระครั้งเดียว ปลดล็อกเกมเสริมพัฒนาการ แบบฝึกหัด และระบายสีตลอดชีพ; เมื่ออนุมัติสลิปสร้างสิทธิ์ทั้ง 3 หมวดและใช้สิทธิ์ดาวน์โหลดสินค้าเดิม/ใหม่ในหมวด
- API: `GET /api/member/plans`, `GET/POST /api/admin/member-plans`, `POST /api/orders` สำหรับปุ่มซื้อ
- ฐานข้อมูล: `products.product_kind/member_category/member_duration_months`, `categories`, `category_memberships`, `orders`
- สิทธิ์: catalog เปิดอ่านได้; memberships คืนเฉพาะเมื่อ `requireUser` ผ่านและ query ผูก `auth.user.id`; plan configuration ใช้ `requireAdmin`
- ห้ามกระทบ: แพ็กเกจตลอดชีพต้องซื้อแยก 1 รายการ ราคา 29,900 สตางค์; expiry ใช้ `9999-12-31 23:59:59`; สิทธิ์ดาวน์โหลดต้อง active, ไม่หมดอายุ, เป็นของผู้ใช้ และตรงหมวดสินค้า; หมวดรอยสักไม่รวมในแพ็กเกจ
- รหัส UI: document root ของหน้า member มี `data-feature="CATEGORY-MEMBER-001"` จาก `public/member.js`; คง card/button/loading/error และ theme เดิม
- การทดสอบ: `scripts/test-v014466-lifetime-member.mjs`

## ELON-CONTROL-001 — สวิตช์ควบคุม ELON Web และ ELON V7 แยกฐาน

- สถานะ: `IMPLEMENTED`; ลงทะเบียนเส้นทางจริงใน v0.14.355
- หน้า/ไฟล์: ELON Control Center ใน `/admin.html`, `public/admin.js`, `functions/api/admin/elon-controls.js`, `functions/_elon_databases.js`
- ฟังก์ชัน: อ่านสถานะ configured/enabled และเปิด–ปิด ELON Web หรือ ELON V7 อิสระต่อกัน
- API: `GET/PUT /api/admin/elon-controls`
- ฐานข้อมูล: binding `ELON_WEB_DB` → `elon_web_settings`; binding `ELON_V7_DB` → `elon_v7_settings`; key `enabled` เก็บเป็น `1|0`
- สิทธิ์: endpoint เรียก `requireAdmin` และปฏิเสธทุก role ที่ไม่ใช่ `boss`; UI ซ่อน control card เมื่อ viewer ไม่ใช่ Boss
- ห้ามกระทบ: target รับเฉพาะ `web|v7` และ enabled ต้องเป็น boolean; ELON Web ไม่มีแถวตั้งค่าให้เปิดโดยปริยาย, V7 ให้ปิด; binding ขาดต้องแสดง configured=false/disabled และ PUT คืน 503; ห้ามเขียนสถานะข้ามฐาน
- รหัส UI: control card มี `data-feature="ELON-CONTROL-001"`; คง toggle/status/loading/error และ theme เดิม
- การทดสอบ: `scripts/test-v014355.mjs`

## SYSTEM-HEALTH-001 — ตรวจความพร้อมของ Infrastructure และ Service Configuration

- สถานะ: `IMPLEMENTED`; ลงทะเบียนเส้นทางจริงใน v0.14.356
- หน้า/ไฟล์: System Health section ใน `/admin.html`, `public/admin.js`, `functions/api/admin/system-health.js`, `functions/_schema.js`, `functions/_seller_token.js`, `functions/_channel_crypto.js`
- ฟังก์ชัน: ตรวจ required readiness ของ D1, R2, encryption keys, migration tables/indexes; ตรวจ recommended readiness ของ Turnstile, company payment, EasySlip, AI provider, password email, APP_ORIGIN และ retention jobs
- API: `GET /api/admin/system-health`
- ข้อมูล: อ่านเฉพาะว่า binding/config มีค่าหรือไม่, `sqlite_master` และค่าบัญชีบริษัทใน `settings`; runtime ใช้ `runtime_schema_state.schema_key/version` ข้าม legacy initializer หลังฐานพร้อม; response คืน `ready|missing`, action, detail และจำนวนสรุป
- สิทธิ์/ความลับ: ต้องมี DB และผ่าน `requireAdmin`; อนุญาตเฉพาะ role `boss`; response ใช้ `private, no-store` และห้ามคืนค่า Secret/config จริง
- ห้ามกระทบ: endpoint เป็น read-only ห้ามแก้ environment, binding, migration หรือ settings; DB ขาดคืน 503; non-Boss คืน 403; schema query ล้มต้องแสดง missing โดยไม่ทำให้ทั้ง response ล้ม
- รหัส UI: health section มี `data-feature="SYSTEM-HEALTH-001"`; คง refresh/loading/error/readiness cards และ theme เดิม
- การทดสอบ: `scripts/test-v014356.mjs`, `scripts/test-v014393.mjs`

## V2-FACTORY-001 — Digital Product Factory จาก Prompt ถึงไฟล์สินค้า

- สถานะ: `IMPLEMENTED`; ลงทะเบียนเส้นทางจริงใน v0.14.357
- หน้า/ไฟล์: Vision 2 workspace ใน `/admin.html`, `public/vision2.js`, `public/vision2.css`, `public/vision2-font.css`, `public/vision2-character.css`, `functions/api/admin/vision2/generate.js`, `functions/api/admin/vision2/characters.js`, `functions/api/admin/vision2/image.js`, `functions/api/admin/prompt-usage.js`
- ฟังก์ชัน: workflow 7 ขั้นจาก brief, prompt table, image queue, เลือก SAMPLE 3 รูป, รวม PDF, เติม product metadata และ handoff เข้า product editor; รองรับนำเข้ารูป/PDF/ZIP สูงสุด 2 GB โดย ZIP อ่านเฉพาะ central directory และไฟล์ตัวเลือก ไม่อ่าน archive ทั้งก้อน, สร้างรายชื่อตัวละคร, resume/retry queue และรายงาน Prompt usage
- API: `POST /api/admin/vision2/generate`, `POST /api/admin/vision2/characters`, `GET /api/admin/vision2/image`, `GET/POST /api/admin/prompt-usage`; การบันทึกสินค้าส่งต่อไป `PROD-ADMIN-001`
- ฐานข้อมูล/ไฟล์: R2 key `vision2/{user_id}/{project}/...`; D1 `prompt_usage_logs`; browser `localStorage` key `vision2_active_job_v2`; PDF/SAMPLE สร้างใน browser ก่อนส่งต่อ
- สิทธิ์: ทุก API ใช้ `requireAdmin`; image read อนุญาตเฉพาะ key ที่ขึ้นต้นด้วย `vision2/{auth.user.id}/`; R2 response ใช้ private cache
- ห้ามกระทบ: generation backend ปัจจุบันใช้ Gemini เท่านั้น (`gemini-3.1-flash-image`) และ API slot 1/2 ผูก `GEMINI_API_KEY`/`GEMINI_API_KEY_2`; prompt สูงสุด 12,000 ตัวอักษร, aspect ratio อยู่ใน allowlist, timeout 120 วินาที; character request สูงสุด 2,000 ตัวอักษร/200 รายการ; usage image/prompt count แต่ละค่า 1–1,000 และรายงานตามวันไทยสูงสุด 2,000 แถว
- ห้ามกระทบ UI: คงลำดับขั้น, queue delay/retry, resume confirmation, SAMPLE watermark/selection, PDF/ZIP limits, product handoff, loading/error และ theme เดิม
- รหัส UI: workspace มี `data-feature="V2-FACTORY-001"` ผ่าน `workspace.dataset.feature`
- การทดสอบ: `scripts/test-v014357.mjs`

## V4-DRAFT-001 — Auto Multi-Product Draft จาก ZIP/PDF

- สถานะ: `IMPLEMENTED`; ลงทะเบียนเส้นทางจริงใน v0.14.358 (ไฟล์ runtime/API ยังใช้ชื่อ legacy `vision3` แต่ UI/lifecycle เป็น Vision 4)
- หน้า/ไฟล์: Vision 4 panel ใน `/admin.html`, `public/vision3.js`, `public/vision3.css`, `functions/api/admin/vision3/analyze.js`, multipart/product APIs และ V4 Review APIs ที่ handoff
- ฟังก์ชัน: รับ ZIP/PDF แบบ batch, อ่านจำนวนหน้า/รูป, สุ่ม 3 ตัวอย่างและติด SAMPLE, วิเคราะห์ worksheet/game กับ metadata, สร้าง product draft, หรือเก็บไฟล์เนื้อหาน้อยรอรวมชุด
- API: `POST /api/admin/vision3/analyze`, `POST /api/admin/products`, `POST /api/admin/product-multipart/init|complete|abort`, `PUT /api/admin/product-multipart/part`, V4 pending/review APIs สำหรับ handoff
- ฐานข้อมูล/ไฟล์: `products` draft ที่ `source='vision4'`, product files/pending files ใน R2 ผ่าน multipart, preview URLs และ V4 review queue
- สิทธิ์: analysis และปลายทาง admin ใช้ `requireAdmin`; แพตนี้ไม่เปลี่ยนสิทธิ์ของ V4 Review
- ห้ามกระทบ: batch 1–30 ไฟล์, ไฟล์ละไม่เกิน 2 GB, รับเฉพาะ ZIP/PDF; ZIP ต้องไม่เข้ารหัสและใช้ store/deflate; ZIP เกิน 1 GB ข้ามการอ่านทั้งก้อนใน browser และอัปโหลดเข้าคิวรอตรวจเพื่อป้องกันหน่วยความจำเต็ม; ไฟล์ต่ำกว่า 20 หน้าไม่สร้างตะกร้า; classification fallback อิงชื่อไฟล์เมื่อ Gemini ไม่พร้อม/ล้ม; ราคาใช้จำนวนหน้า ยกเว้นไม่เกิน 100 หน้าและลงท้าย 0 ให้ลด 1 บาท; multipart ล้มต้องเรียก abort แบบ best effort
- ห้ามกระทบ lifecycle: ผลลัพธ์จากรอบนี้เป็น draft/pending เท่านั้น; การย้ายเข้าสินค้าปกติต้องผ่าน `V4-REVIEW-001`; คง queue/progress/failure และ theme เดิม
- รหัส UI: Vision 4 panel มี `data-feature="V4-DRAFT-001"`
- การทดสอบ: `scripts/test-v014358.mjs`

## V4-BUNDLE-001 — รวม Pending PDF/ZIP เป็นสินค้า PDF พร้อมขาย

- สถานะ: `IMPLEMENTED` พร้อม Known Gaps; ลงทะเบียน lifecycle จริงใน v0.14.386
- หน้า/ไฟล์: Vision 4 pending queue/workspace ใน `/admin.html`, `public/vision4-bundle.js`; ใช้ V4 Review/pending-file/consume, admin category/product และ product multipart APIs
- Bootstrap/decorate: ต้องมี pending queue, start/workspace/form และ `window.PDFLib`; MutationObserver เติม checkbox ให้ `.v3-review-card` ที่มี pending detail ครั้งเดียว และ count จาก checkbox ที่เลือก
- Source processing: โหลด selected IDs ใหม่จาก `GET /api/admin/vision4-review` เพื่อกันรายการหาย; รองรับ PDF โดย copy ทุกหน้า และ ZIP central-directory entries ชนิด PDF/JPEG/PNG/WEBP ที่ไม่เข้ารหัสและ compression store/deflate; ข้าม directory/`__MACOSX`
- Merge/sample: PDFLib รวมหน้า; PDF.js lazy-load render หน้าแรก/กลาง/สุดท้าย และรูปถูกแปลงเป็น JPEG ตามจำเป็น; SAMPLE watermark หมุนบน canvas; เก็บตัวอย่างสูงสุด 3 ต่อ source และต้องมี candidate อย่างน้อย 3
- Product form: เลือกตัวอย่างต้องครบ 3 และเลือกเกิน 3 ไม่ได้; categories รับเฉพาะ active top-level และตัด legacy `dinosaur|paper-doll|document|set-coloring|set-tattoo`; ตั้ง pages/description และราคาเท่าจำนวนหน้า ยกเว้นไม่เกิน 100 และหาร 10 ลงตัวให้ลด 1 บาท
- Create/upload/publish/consume: POST product เป็น `draft` พร้อม cover + preview 2/3, multipart PDF สูงสุด 2 GB ด้วย chunk 50 MB, PUT product เป็น `published`, แล้ว POST consume selected pending IDs; consume ตรวจ published product และทุก ID ยัง `waiting_bundle` ก่อน UPDATE เป็น `bundled`
- API/ข้อมูล/สิทธิ์: admin APIs ใช้ `requireAdmin`; อ่าน/เขียน `vision4_pending_files`, `products`, `product_files`, categories และ R2 multipart object; multipart product flow ปฏิเสธ Vision 5 products
- Success/failure: สำเร็จเก็บ session notice แล้ว redirect `/admin?preview_tab=vision3&done=...`; error แสดงใน workspace/create state, alert และคืนปุ่ม enabled
- Transaction boundary: product draft creation, multipart parts/complete, publish และ pending consume เป็นคนละ request/transaction; controller ไม่มี compensating delete หรือ multipart abort ใน catch จึงห้ามอ้างว่า flow atomic และความล้มเหลวกลางทางอาจเหลือ draft/product file/object
- Known Gap: object URLs ที่สร้างให้ sample picker ไม่ถูก revoke ใน controller ปัจจุบัน; แพตนี้บันทึก behavior เท่านั้น ไม่เปลี่ยน lifecycle
- ห้ามกระทบ: source selection, ZIP/PDF parsing, page order, SAMPLE generation/limit, category filter, pricing, 2 GB/chunk limits, draft→upload→publish→consume order, errors และ UI/theme
- รหัส UI: start button และ workspace ใช้ `data-feature="V4-BUNDLE-001"`; คง checkbox/form/button/component และ theme เดิม
- ความสัมพันธ์: pending input มาจาก `V4-DRAFT-001`; review/download/consume routes อยู่ใน `V4-REVIEW-001`; multipart file contract อยู่ใน `PROD-FILE-001`; product create/publish อยู่ใน `PROD-ADMIN-001`
- การทดสอบ: `scripts/test-v014386.mjs`; historical `scripts/test-v01471.mjs`, `scripts/test-v01496.mjs`

## TRASH-RECOVERY-001 — ถังขยะ 30 วัน กู้คืน และลบถาวร

- สถานะ: `IMPLEMENTED`; ลงทะเบียนเส้นทางจริงใน v0.14.359
- หน้า/ไฟล์: Trash section ใน `/admin.html`, `public/admin.js`, `functions/_trash.js`, `functions/api/admin/trash/index.js`, `functions/api/admin/trash/restore.js`; soft delete เริ่มจาก product/file/image admin endpoints
- ฟังก์ชัน: แสดงสินค้า รูป และ PDF/ZIP ที่ลบ; กู้สถานะ/ไฟล์/ช่องรูป; purge รายการหมดอายุ; ลบถาวรทันทีโดย Boss
- API: `GET/DELETE /api/admin/trash`, `POST /api/admin/trash/restore`
- ฐานข้อมูล/ไฟล์: `products.deleted_at/deleted_prev_status`, `trash_items`, `product_files`, `downloads`, `entitlements`, `unlock_logs`, `product_bundle_items`, `product_slug_history`; R2 objects ของไฟล์/รูป
- สิทธิ์: `requireAdmin` สำหรับดูและกู้คืน; `requireBoss` สำหรับ DELETE ถาวร; UI แสดงปุ่มลบถาวรเฉพาะ Boss และต้องยืนยันด้วยคำ `DELETE`
- ห้ามกระทบ: retention 30 วัน; purge ต่อรอบจำกัด 20 `trash_items` และ 10 products; product restore คืน `deleted_prev_status` หรือ published; กู้ไฟล์/รูปต้องมี product ก่อนและห้ามทับของปัจจุบัน; อย่าลบ R2 ก่อนยืนยันกู้คืน/ลบถาวร
- การรักษาสิทธิ์ผู้ซื้อ: product ที่มี `order_items` อ้างถึงห้ามลบ record, paid files หรือ bundle links; ให้เก็บเป็น hidden tombstone `status='draft'`, `deleted_at='9999-12-31 23:59:59'` เพื่อให้ผู้ซื้อเก่ายังดาวน์โหลดได้
- รหัส UI: trash section มี `data-feature="TRASH-RECOVERY-001"`; คง confirmation/loading/error/card และ theme เดิม
- การทดสอบ: `scripts/test-v014359.mjs`

## CATEGORY-ADMIN-001 — จัดการหมวดหมู่สินค้าและ Slug Cascade

- สถานะ: `IMPLEMENTED`; ลงทะเบียนเส้นทางจริงใน v0.14.360
- หน้า/ไฟล์: Category section ใน `/admin.html`, `public/admin.js`, `functions/api/admin/categories/index.js`, `functions/api/admin/categories/[id].js`
- ฟังก์ชัน: แสดง product count, สร้าง/แก้ชื่อและ slug, กำหนหมวดแม่, file type เริ่มต้น, active และ sort order; เปลี่ยน slug พร้อมย้าย product references; ลบหมวดที่ว่าง
- API: `GET/POST /api/admin/categories`, `PUT/DELETE /api/admin/categories/:id`
- ฐานข้อมูล: `categories.id/slug/name/parent_slug/file_type/active/sort_order`, `products.category`; product count นับเฉพาะ published, non-deleted, normal product ตาม query เดิม
- สิทธิ์: `requireAdmin` สำหรับอ่าน/สร้าง/แก้; `requireBoss` สำหรับลบ; UI ซ่อนปุ่มลบจาก non-Boss
- ห้ามกระทบ: ชื่อห้ามว่าง/ซ้ำแบบ trim + case-insensitive; slug ต้องเป็น lowercase kebab-case; เว้น slug ตอนสร้างได้และระบบสร้าง `category-NNN` ถัดไป; slug ซ้ำต้อง 400/409; เมื่อแก้ slug ต้อง update `products.category` จากค่าเก่า; หมวดที่มีสินค้าอ้างถึงห้ามลบและคืน 409
- รหัส UI: categories section มี `data-feature="CATEGORY-ADMIN-001"`; คง form/list/confirmation/loading/error และ theme เดิม
- การทดสอบ: `scripts/test-v014360.mjs`

## ORDER-ADMIN-001 — คิวตรวจสลิป อนุมัติ/ปฏิเสธ และล้างออเดอร์เปล่า

- สถานะ: `IMPLEMENTED`; ลงทะเบียนเส้นทางจริงใน v0.14.361
- หน้า/ไฟล์: Orders section ใน `/admin.html`, `public/admin.js`, `functions/api/admin/orders.js`, `functions/api/admin/orders/[id]/approve.js`, `functions/api/admin/orders/[id]/reject.js`, `functions/api/admin/orders/[id]/slip-evidence.js`, `functions/api/admin/orders/clear.js`, `functions/api/admin/slip.js`, `functions/_orders.js`
- ฟังก์ชัน: คิว awaiting payment/pending review/rejected, ดูสลิปและหลักฐาน, อนุมัติแล้วสร้าง entitlement/เครดิตและ log, ปฏิเสธให้ส่งสลิปใหม่, ล้างออเดอร์เปล่าที่ยังไม่มีหลักฐาน
- API: `GET /api/admin/orders`, `POST /api/admin/orders/:id/approve`, `POST /api/admin/orders/:id/reject`, `GET /api/admin/orders/:id/slip-evidence`, `POST /api/admin/orders/clear`, `GET /api/admin/slip`
- ฐานข้อมูล/ไฟล์: `orders`, `order_items`, `order_slip_evidence`, `entitlements`, `course_right_credits`, `unlock_logs`, `customer_events`; R2 slip objects
- สิทธิ์: คิว/ออเดอร์ปกติ/หลักฐานใช้ `requireAdmin`; resale-rights, partner course และ Vision 5 test-account manual review สงวนให้ Boss; seller course ปกติต้องให้เจ้าของคอร์สตรวจใน Vision 5; clear ใช้ `requireBoss`
- ห้ามกระทบ approval: ต้องเป็น `pending_review` และมี slip; branch manual ต้อง `slip_verification_status='manual'` และ `confirmed=true`; reject ของ rights/partner ต้องมีเหตุผล; `grantOrder` claim ด้วย conditional status update และห้ามเพิ่มสิทธิ์/เครดิต/ล็อกซ้ำ; method ต้องสะท้อน branch จริง
- ห้ามกระทบ evidence/clear: slip evidence response ห้ามคืน R2 `object_key` โดยตรง; สลิปต้อง private/no-store; clear รับได้สูงสุด 2,000 IDs และลบเฉพาะ `awaiting_payment|pending_review|rejected` ที่ `slip_key IS NULL`; ห้ามลบออเดอร์ที่เคยแนบสลิป/ชำระแล้ว
- รหัส UI: orders section มี `data-feature="ORDER-ADMIN-001"`; คง confirmations, review warnings, selection, loading/error และ theme เดิม
- การทดสอบ: `scripts/test-v014361.mjs`, `scripts/test-commerce-final.mjs`

## AD-INTELLIGENCE-001 — ค่าแอด Campaign/Creative และ First-party Attribution

- สถานะ: `IMPLEMENTED`; ลงทะเบียนเส้นทางจริงใน v0.14.362
- หน้า/ไฟล์: Ads Intelligence card ใน `/admin.html`, `public/admin.js`, `functions/api/admin/ad-intelligence.js`
- ฟังก์ชัน: เลือกช่วงวันที่, กรอก/แก้ค่าแอดระดับ campaign, ad set และ creative, ลบรายการ และเทียบค่าใช้จ่ายกับ purchase attribution เพื่อสรุป spend/revenue/profit/ROAS/orders/buyers
- API: `GET/PUT/DELETE /api/admin/ad-intelligence`; GET ใช้ช่วง 30 วันล่าสุดเมื่อไม่ระบุวันที่, PUT upsert ค่าใช้จ่าย และ DELETE รับ numeric `id`
- ฐานข้อมูล: `ad_campaign_costs`, `customer_events`, `orders`; revenue นับ distinct paid order จาก event `purchase` และใช้วันที่เขตเวลาไทย `+7 hours`
- สิทธิ์: ทุก method ใช้ `requireAdmin`; ไม่เปิดข้อมูลหรือคำสั่งนี้ต่อ public client
- การจับคู่: normalize Facebook/FB/Meta และ referral aliases เป็น `facebook`, พร้อม TikTok/Google aliases; attribution key คือ source + campaign + creative โดยไม่ใช้ ad set ใน key ตามโค้ดเดิม
- ห้ามกระทบ: วันที่เริ่มต้องไม่เกินวันสิ้นสุด; campaign ต้องมีค่า; cost รับจำนวนบาทไม่ติดลบแล้วเก็บเป็นสตางค์; upsert ตาม `(spend_date, platform, campaign, adset, creative)`; การลบต้องระบุ ID
- สูตร: `profit = revenue - spend`, `ROAS = revenue / spend`; เมื่อ spend เป็นศูนย์คืน `null`; ระบบนี้แสดงผลและจัดการค่าใช้จ่ายเอง ไม่แก้โฆษณาภายนอก
- ความสัมพันธ์: แยกจาก `ADS-ANALYTICS-001` ซึ่งดูแล Meta ingestion และ Ads Center; ระบบนี้คือ manual admin cost + first-party matching
- รหัส UI: Ads Intelligence card มี `data-feature="AD-INTELLIGENCE-001"`; คง form, confirmation, loading/error และ theme เดิม
- การทดสอบ: `scripts/test-v014362.mjs`

## COURSE-ADMIN-001 — สร้างคอร์สบริษัทและจัดการบทเรียน

- สถานะ: `IMPLEMENTED`; ลงทะเบียนเส้นทางจริงใน v0.14.363
- หน้า/ไฟล์: company-course grid และ lesson manager ใน `/admin-courses.html`, `public/admin-courses.js`, `functions/api/admin/courses/index.js`, `functions/api/admin/courses/[id].js`, `functions/api/admin/courses/[id]/lessons.js`, `functions/api/admin/courses/[id]/lessons/[lessonId].js`
- ฟังก์ชัน: แสดง/สร้างคอร์สบริษัทเป็นฉบับร่างพร้อมชื่อคอร์ส ชื่อผู้สอน และเวลาเนื้อหา; เพิ่ม EP พร้อมชื่อ รายละเอียด คลิปหรือเอกสาร; Boss กด “เผยแพร่ตะกร้า” เพื่อบันทึกข้อมูลคอร์ส บัญชี และ EP ที่ค้างทั้งหมดก่อนเปิดขายทันทีโดยไม่เข้าคิว seller review
- บัญชีรับเงิน: เลือกและสลับได้ตลอดต่อคอร์สระหว่างกรุงศรีของ Boss (รัฐสิทธิ ดำรงรถการ · 444-118-1181) หรือบัญชีบริษัท VisionD; ออเดอร์ใหม่ snapshot บัญชีล่าสุด ส่วนออเดอร์เดิมไม่ถูกย้อนแก้ และคอร์สบริษัทไม่เข้า payout พาร์ตเนอร์ 50/50
- API: `GET/POST /api/admin/courses`, `POST/DELETE /api/admin/courses/:id`, `POST /api/admin/courses/:id/payment`, `POST /api/admin/courses/:id/publish`, `GET/POST /api/admin/courses/:id/lessons`, `POST/DELETE /api/admin/courses/:id/lessons/:lessonId`
- ฐานข้อมูล/ไฟล์: `courses`, `products`, `course_lessons`, `entitlements`; R2 course cover, lesson video และ PDF
- สิทธิ์: ทุก endpoint ใช้ `requireAdmin`; route นี้รับเฉพาะคอร์สบริษัทที่ `owner_user_id IS NULL`, `course_origin='company'` และ `course_type='online_course'`
- ห้ามข้ามขอบเขต: explicit publish ใช้เฉพาะ Admin company course ที่ผ่าน `requireAdmin`; คอร์สผู้ขาย/Vision 5, partner, `seller_rights` และ resale-rights เดิมต้องจัดการและตรวจในระบบเฉพาะ; ห้ามสร้างหรือแปลง company course เป็นตะกร้าสิทธิ์ผ่านหน้านี้
- ห้ามกระทบไฟล์: รูปปก JPG/PNG/WEBP สูงสุด 5 MB; บทเรียนรับ MP4/WEBM สูงสุด 2 GB ผ่าน R2 Multipart แบบเดียวกับตะกร้าพาร์ตเนอร์ หรือเอกสาร PDF/JPEG/PNG สูงสุด 100 MB อย่างน้อยหนึ่งไฟล์; การอัปโหลดวิดีโอต้องสร้าง/บันทึก EP ก่อน แบ่งไฟล์ตาม `COURSE_VIDEO_CHUNK_BYTES` และ abort แบบ best effort เมื่อส่วนใดล้ม; เก็บ MIME และชื่อเอกสารจริงเพื่อเปิด PDF/JPEG/PNG แบบ inline; ถ้าบันทึก DB หรือเอกสารล้มต้องล้าง object ที่เพิ่งสร้าง
- ห้ามกระทบข้อมูล: product และ course ต้องสร้างสัมพันธ์กัน; active สะท้อน `products.status` published/draft; ห้ามแสดงช่องกรอกความยาว EP หรือนาทีรวมด้วยมือ โดย browser ต้องอ่านระยะเวลาจริงจาก metadata ของวิดีโอที่เลือกเป็น `course_lessons.duration_seconds`; ถ้า browser อ่าน MP4 metadata ไม่ได้ต้อง fallback อ่าน top-level MP4 box และ `moov/mvhd` ด้วย `File.slice()` โดยไม่อ่านไฟล์ทั้งก้อนหรือบล็อก Multipart จากปัญหา codec; `total_minutes` ต้องคำนวณจากผลรวมวินาทีของทุก EP ปัดขึ้นเป็นนาทีพร้อม sync เมื่อเพิ่ม แก้ หรือลบ EP; การแก้ EP โดยไม่เลือกวิดีโอใหม่ต้องรักษาระยะเวลาเดิม ส่วน EP เอกสารอย่างเดียวนับ 0 วินาที; `course_lessons.episode_label` เป็นข้อความกำหนดเลข EP เช่น 1, 1.1, 1.2 โดยไม่เปลี่ยน `sort_order` และ EP เก่าที่ไม่มีค่าต้อง fallback เป็นลำดับเดิม; บันทึกร่างทั้งตะกร้าต้องยอมรับข้อมูลคอร์สที่ยังกรอกไม่ครบและเก็บ EP ที่กรอกแม้ยังไม่มีไฟล์เพื่อกลับมาแก้ได้; ปุ่มเพิ่ม EP ต้องสร้าง EP ร่างโดยไม่เรียก native required validation และตั้งชื่อชั่วคราวตามลำดับเมื่อเว้นชื่อ; publish ต้องตรวจชื่อคอร์ส ผู้สอน ราคา เวลา จำนวน EP และนับเฉพาะ EP ที่มีคลิปหรือเอกสาร; ลบตะกร้าคอร์สใช้ soft delete ที่ product และปิด active เพื่อรักษาออเดอร์ สิทธิ์เรียน และไฟล์เดิม; ลบบทเรียนเฉพาะ course เดียวกันและลบ DB ก่อน object
- ความสัมพันธ์: ไม่รวม seller review section ในหน้าเดียวกันซึ่งอยู่ใต้ `COURSE-REVIEW-001`; ไม่รวมตะกร้าผู้สอน/EP ซึ่งอยู่ใต้ `COURSE-BASKET-001` และ `COURSE-EP-001`
- รหัส UI: company-course grid และ lesson manager มี `data-feature="COURSE-ADMIN-001"`; lesson manager ต้องฝังอยู่ภายในตะกร้าสร้างคอร์สเดียวกับข้อมูลคอร์ส ไม่แยกเป็น workspace นอกตะกร้าและไม่มีปุ่ม “กลับไปสร้างคอร์สใหม่” ในหัว EP; เมื่อกดเพิ่ม EP รายการที่บันทึกต้องคงเป็นบล็อกเต็มเหนือ editor พร้อมเลข ชื่อ รายละเอียด สื่อ แก้ไข/ลบ และ editor ต้องกลายเป็นบล็อก EP ถัดไปพร้อมเลขอัตโนมัติแทนการทำให้ข้อมูลที่กรอกดูเหมือนหาย; ช่องเลข EP และชื่อ EP ต้องแยกกัน โดยหัวข้อช่องชื่อใช้ข้อความ `ชื่อ EP` เสมอ; ช่องรูปปกต้องพรีวิว JPG/PNG/WEBP ที่เลือกและรูปเดิมของคอร์ส ส่วนช่องเอกสาร EP ต้องพรีวิว JPEG/PNG ที่เลือกหรือบันทึกแล้ว และแสดงชื่อไฟล์แทนภาพสำหรับ PDF พร้อม revoke object URL เมื่อเปลี่ยน/ล้างไฟล์; ฟอร์มตะกร้าไม่แสดงช่องคำอธิบายสั้น แต่ต้องรักษาค่าเดิมของคอร์สเก่าไว้ขณะบันทึก; ปุ่มบันทึกร่างและเผยแพร่ต้องอยู่คู่กันท้ายตะกร้าและเรียงเต็มกว้างบนมือถือ; ตัวเลือกและรายละเอียดบัญชีต้องมีเพียงชุดเดียวในข้อมูลตะกร้า ห้ามแสดงซ้ำในสรุป EP เป็นการ์ดชิดซ้ายที่แสดงสถานะเลือกทั้งใบและรองรับ focus keyboard โดยปุ่มบันทึกร่างบันทึกการสลับบัญชีด้วย; คง form, confirmation, loading/error และ theme เดิม
- การเพิ่มบล็อก EP: หน้าเริ่มด้วย editor EP 1; ทุกครั้งที่กด “เพิ่ม EP” ต้องคงบล็อกเดิมแบบเต็มที่เห็นและแก้เลข ชื่อ รายละเอียด คลิป เอกสาร และรูปตัวอย่างได้โดยตรงบนหน้า ห้ามย่อเป็นการ์ดสรุปและห้ามทิ้งไฟล์เดิมจนกว่าจะเลือกไฟล์แทน พร้อมเปิด editor EP ถัดไปทันทีโดยไม่รอ API หรืออัปโหลด จากนั้นปุ่มบันทึกร่างทั้งตะกร้าจึงส่งบล็อกตามลำดับ โดยบล็อกที่ส่งสำเร็จต้องถูกนำออกจากคิวเพื่อไม่สร้างซ้ำเมื่อ retry
- การจำ EP ในฉบับร่าง: เมื่อ editor อยู่ในโหมดแก้ไข EP เดิม ปุ่มบันทึกร่างทั้งตะกร้าต้อง await การบันทึกข้อมูล คลิป Multipart และเอกสารของ EP นั้นก่อนรีเซ็ต editor; EP ใหม่ที่มีเฉพาะรายละเอียดก็ต้องเข้าคิวบันทึกได้
- สถานะไฟล์ฉบับร่าง: browser จะไม่เติมไฟล์เดิมกลับใน `<input type="file">`; เมื่อแก้ EP ที่บันทึกแล้ว UI ต้องใช้ `has_video`, `video_mime`, `has_pdf`, `document_name` แสดงว่าคลิป/เอกสารเดิมยังอยู่และจะถูกใช้ต่อหากไม่เลือกใหม่ ห้ามแสดงช่องว่างจนทำให้เข้าใจว่าไฟล์หาย
- การยืนยันหลาย EP: การบันทึกคิว EP ต้อง GET ตรวจ `has_video`/`has_pdf` ของ lesson id ที่เพิ่งส่งก่อนนำบล็อกออก แต่ละ EP ต้องลองได้สูงสุดสองครั้งและความล้มเหลวของรายการหนึ่งห้ามหยุดการส่ง EP ถัดไป; เมื่อจบให้คงเฉพาะบล็อกที่ยังล้มพร้อม File object และข้อความแดง โดย retry ต้อง POST ไป lesson id เดิมที่สร้างสำเร็จบางส่วนแล้วเพื่อไม่สร้าง EP ซ้ำ
- ความเข้ากันได้ของ D1: ทุกเส้นทางเพิ่ม โหลด แก้ และลบ EP บริษัทต้องเรียกตัวซ่อม schema แบบเฉพาะจุด ซึ่งตรวจและเพิ่ม `course_lessons.episode_label` กับ `course_lessons.document_name` ได้แม้ `runtime_schema_state` รุ่นเดิมถูกบันทึกว่าพร้อมแล้ว; หน้าแก้ไขต้องแสดง error จาก API และเลื่อนไปต้นฟอร์มตะกร้าแทนการดูเหมือนปุ่มไม่ทำงาน
- จำนวน EP: หลังบ้านตะกร้าคอร์สบริษัทห้ามแสดงช่องกรอกหรือจำนวน EP รวมทั้งในการ์ดรายการและแถบสรุป เพราะรองรับเลข EP ย่อย เช่น 1.1/1.2 และยอดรวมทำให้รก; คงข้อมูลและเลขประจำแต่ละ EP ไว้ตามจริง
- การเผยแพร่: Boss เป็นผู้ตัดสินใจกดเผยแพร่เอง ปุ่มต้องเปิดให้กดเสมอและ API ห้ามบังคับความครบของชื่อ ราคา เวลา จำนวน EP ไฟล์ หรือบัญชีรับเงินก่อนเปลี่ยนสถานะ; คงเฉพาะ `requireAdmin` และการตรวจว่าเป็นตะกร้าบริษัท ไม่ใช่คอร์สพาร์ตเนอร์
- การแยกระบบ: หน้า `/admin-courses.html` ใช้โครงฟอร์มตะกร้าและการ์ด EP แบบเดียวกับ workspace คอร์ส แต่บันทึกผ่าน Admin company API เท่านั้น ไม่มี seller review หรือข้อความ 50/50; ปุ่ม “บันทึกร่าง” สร้าง/อัปเดต draft ได้ก่อนมี EP; ปุ่มเผยแพร่อนุมัติ/เปิดขายตรงโดยไม่ส่งตรวจ ส่วน review พาร์ตเนอร์อยู่ `/admin-course-reviews.html`
- การทดสอบ: `scripts/test-v014363.mjs`, `scripts/test-v014424.mjs`, `scripts/test-company-course-e2e.mjs`

## COURSE-PAYOUT-001 — บัญชีรับเงินผู้สอนและ Secure Payment QR

- สถานะ: `PARTIAL`; ลงทะเบียน API จริงใน v0.14.365 แต่ client ตั้งค่าบัญชีใน `/course-center` ขาดจาก runtime ปัจจุบัน
- หน้า/ไฟล์: ลิงก์ `/course-center#paymentProfilePanel` ใน `/dashboard.html`, publish/order flow, `functions/api/course-seller/payment-profile.js`, `functions/api/course-seller/payment-qr/[entitlementId].js`, `functions/api/course-seller/[id]/publish.js`
- ฟังก์ชัน API: เจ้าของบันทึกธนาคาร/ชื่อบัญชี/เลขบัญชี/QR ของตน; publish ผูกข้อมูลรับเงินกับ seller-course binding; ผู้มีสิทธิ์เปิด QR ผ่าน entitlement binding
- API: `POST /api/course-seller/payment-profile`, `GET /api/course-seller/payment-qr/:entitlementId`
- ฐานข้อมูล/ไฟล์: `users.seller_bank_name/seller_account_name/seller_account_number/seller_payment_qr_url/seller_payment_status`, `courses.license_entitlement_id`, `orders`, `order_items`; R2 `seller-payment-qr-*`
- สิทธิ์: บันทึกและอ่านใช้ `requireUser`; บันทึกได้เฉพาะบัญชีผู้ใช้ปัจจุบัน; QR เปิดได้เฉพาะ staff, เจ้าของคอร์ส หรือผู้ซื้อที่มีออเดอร์ของ course owner/product ใน `awaiting_payment|rejected|pending_review`
- Validation: ธนาคารต้องอยู่ใน allowlist, ชื่อบัญชีต้องไม่ว่าง, เลขบัญชีมีตัวเลขอย่างน้อย 6 หลัก; QR รับ JPG/PNG/WEBP สูงสุด 8 MB
- ห้ามกระทบ object lifecycle: อัปโหลด QR ใหม่ก่อน update DB; DB ไม่เปลี่ยนต้องลบ object ใหม่; update สำเร็จจึงลบ object เก่าแบบ best effort
- ห้ามกระทบ privacy: QR lookup ใช้ entitlement binding ไม่รับ object key ตรง; response เป็น `private, no-store` และ `x-content-type-options: nosniff`; ผู้ไม่มีสิทธิ์คืน 403
- ขอบเขต: แยกจาก `PAYMENT-SETTINGS-001` ซึ่งเป็นบัญชีรับเงินส่วนกลางของ VisionD และจาก review actions ใน `COURSE-REVIEW-001`
- ช่องว่างที่พบ: `/dashboard.html` และ publish error ชี้ไป `#paymentProfilePanel` แต่ `/course-center.html` ไม่มี panel/form และ `public/course-center.js` ไม่เรียก payment-profile API; จึงห้ามรายงานเป็น end-to-end implemented จนมีแพตฟีเจอร์เฉพาะ
- รหัส UI: ยังไม่มีจุด runtime ที่ถูกต้องให้ติด `data-feature`; ห้ามใส่ marker หลอกบนลิงก์ที่ปลายทางไม่มีฟอร์ม
- การทดสอบ: `scripts/test-v014365.mjs`

## SLIP-AUTO-VERIFY-001 — EasySlip Token ส่วนบุคคลและตรวจสลิปอัตโนมัติ

- สถานะ: `PARTIAL`; API/token/verification มีจริง แต่ client ตั้งค่าปัจจุบันยังไม่ครบ contract
- ไฟล์: `public/course-rights-product.js`, `functions/api/course-seller/slip-api.js`, `functions/_seller_token.js`, `functions/api/orders/[id]/slip.js`, `functions/api/course-seller/[id]/publish.js`, `functions/api/vision5/rights-payment-mode.js`
- API: `GET/POST /api/course-seller/slip-api`; GET คืนเฉพาะสถานะ ไม่คืน token; POST เปิด/ปิด auto verify และบันทึก EasySlip token ของผู้ใช้
- ความปลอดภัย: token ยาว 20–500 ตัว, เข้ารหัส AES-GCM ด้วย `VISION5_TOKEN_ENCRYPTION_KEY` + AAD, legacy plaintext ย้ายเป็น ciphertext เมื่อโหลดและมี key พร้อม
- การเลือก token: partner course ใช้ API บริษัท; seller course ใช้ token เจ้าของเมื่อเปิดใช้และไม่ใช่ test account; rights order ใช้ token ผู้ซื้อเมื่อ Boss เปิดโหมด; กรณีอื่นใช้ API บริษัท
- การตรวจ: จำกัดอัตรา, ตรวจชนิด/ขนาดรูป, account name/เลขท้ายอย่างน้อย 6 หลัก, amount, provider duplicate และ local `verified_slips`; ผ่านแล้วจึงเรียก idempotent `grantOrder`
- Fail-safe: token/config/API/match ผิดหรือระบบขัดข้องต้องเปลี่ยนเป็น manual review พร้อม code; ห้าม auto approve จากเลขบัญชีสั้นหรือสลิปซ้ำ
- ช่องว่าง client: endpoint เปิดใช้เฉพาะเมื่อ body มี `enabled:true` แต่ `course-rights-product.js` ส่งเพียง `{api_key}`; ปัจจุบันจึงเข้า branch ปิด auto verify
- ช่องว่างหน้า: `/dashboard.html` ชี้ `/course-center#slipApiPanel` แต่หน้าและ controller ไม่มี panel นี้
- ความสัมพันธ์: การอัปโหลดหลักฐานและ order lifecycle อยู่ใต้ `COMMERCE-ORDER-001`; toggle API บริษัทอยู่ใต้ `PAYMENT-SETTINGS-001`
- รหัส UI: ยังไม่ติด marker บน flow ที่ contract ไม่ครบ; ต้องแก้เป็นแพตฟีเจอร์แยกก่อนเปลี่ยนเป็น `IMPLEMENTED`
- การทดสอบ: `scripts/test-v014366.mjs`

## COURSE-OWNER-REVIEW-001 — เจ้าของคอร์สตรวจสลิปผู้ซื้อ

- สถานะ: `PARTIAL`; API และ controller มีจริง แต่ review panel ขาดจาก HTML runtime
- ไฟล์: `public/course-seller.js`, `functions/api/course-seller/index.js`, `functions/api/course-seller/orders/[id]/slip.js`, `approve.js`, `reject.js`, `functions/_orders.js`
- API: `GET /api/course-seller` คืน manual `slip_issues` สูงสุด 100; `GET .../orders/:id/slip`; `POST .../orders/:id/approve|reject`
- สิทธิ์: `requireUser` และทุก query ผูก `course_owner_user_id` กับผู้ใช้ปัจจุบัน; ต้องเป็น seller course และมีสลิป
- Approval: รับเฉพาะ `pending_review + manual`; ตัด test account ออกจาก owner approval; ใช้ idempotent `grantOrder` ด้วย role/method `course_owner/course_owner_slip_approval`
- Rejection: รับเฉพาะ pending manual ของเจ้าของ, เก็บเหตุผลไม่เกิน 300 ตัว และเปลี่ยนเป็น `rejected` เพื่อให้ผู้ซื้อส่งใหม่
- Evidence: โหลด R2 key จาก order ที่เป็นของเจ้าของเท่านั้น; response เป็น `private, no-store` และ `inline`
- ช่องว่าง UI: controller รองรับ `#pendingSlipPanel`, `#slipIssueRows` และปุ่ม approve/reject แต่ `course-seller.html` ไม่มี element เหล่านี้ จึงไม่มี owner review surface จริง
- ความสัมพันธ์: แยกจาก `ORDER-ADMIN-001`/`COURSE-PARTNER-CHECKOUT-001` ซึ่งเป็น admin/Boss review และใช้ grant contract เดียวกัน
- รหัส UI: ยังไม่ติด marker เพราะ panel ไม่มีใน runtime; ต้องแก้เป็นแพตฟีเจอร์แยกก่อนเปลี่ยนเป็น `IMPLEMENTED`
- การทดสอบ: `scripts/test-v014367.mjs`

## COURSE-SALES-001 — แดชบอร์ดยอดขายและรอบเคลียร์ผู้สอน

- สถานะ: `IMPLEMENTED`; ลงทะเบียนเส้นทางจริงใน v0.14.368
- หน้า/ไฟล์: sales dashboard ใน `/course-center`, `public/course-center.js`, `functions/api/course-seller/sales.js`
- API: `GET /api/course-seller/sales?from=YYYY-MM-DD&to=YYYY-MM-DD`
- สิทธิ์/ข้อมูล: ใช้ `requireUser`; query เฉพาะ `course_owner_user_id` ของผู้ใช้และออเดอร์ `paid`; วันขายใช้เวลาไทย `+7 hours`
- ช่วงเวลา: ค่าเริ่มต้น 30 วัน, เลือกได้สูงสุด 60 วัน, from ต้องไม่เกิน to และ to ห้ามเกินวันนี้; response `no-store`
- สูตร: partner teacher share คือ `CAST(total / 2 AS INTEGER)`; แผนอื่นคือยอดเต็ม; ไม่หักค่า API จากรายได้ผู้สอน
- รอบเคลียร์: เริ่มวันที่ 1 ของเดือน, `pending_total` รวม paid ตั้งแต่ cycle start, `clear_day=1`, next clear คือวันที่ 1 เดือนถัดไป
- Output: orders/buyers/gross/teacher summary และรายการล่าสุดสูงสุด 500; `limited` แจ้งเมื่อแตะเพดาน
- ความสัมพันธ์: แยก reporting จาก create/edit ใน `COURSE-BASKET-001`; ไม่มีคำสั่งเคลียร์เงินจริงใน endpoint นี้
- รหัส UI: sales section มี `data-feature="COURSE-SALES-001"`; คง filter/table/loading/error และ theme เดิม
- การทดสอบ: `scripts/test-v014368.mjs`

## COURSE-LEARNING-001 — ห้องเรียน V-Learning, Progress และ Lesson Media

- สถานะ: `IMPLEMENTED`; ลงทะเบียนเส้นทางจริงใน v0.14.369
- หน้า/ไฟล์: `/my-courses.html`, `/learn.html?course=:id`, `public/my-courses.js`, `public/learn.js`, `functions/_courses.js`, `functions/api/courses/[id].js`, `progress.js`, lesson asset/file routes
- API: `GET /api/courses/:id`, `POST /api/courses/:id/progress`, `GET /api/courses/:id/lesson/:lessonId/:asset`, `GET .../file/:fileId`
- สิทธิ์: ต้อง login และมี active entitlement ของ product; Boss/Admin เข้าได้; unpublish/pause sale ไม่ถอนสิทธิ์ผู้ซื้อเดิม แต่ `review_status='suspended'` บล็อกผู้เรียนด้วย 423
- ห้องเรียน: คืนบทเรียนตาม sort order, progress ต่อผู้ใช้, รายการไฟล์, completed %, resume lesson/position และ last activity; response `no-store`
- Progress: lesson ต้องอยู่ใน course; position จำกัด 0–86,400 วินาที; upsert ใช้ `MAX` ทั้ง position/completed เพื่อห้าม resume ถอยหลังหรือยกเลิก completed
- Video: ตรวจ asset/course ownership, รองรับ single byte range/suffix range, คืน 206 พร้อม Content-Range; range ผิดคืน 416
- เอกสาร: legacy PDF inline/attachment ตาม MIME; additional files เป็น attachment แบบ UTF-8 พร้อม CSP sandbox
- Privacy: lesson media ทุกชนิดผ่าน access guard, `private, no-store`, `nosniff`; ไม่คืน R2 object key ต่อ client
- รหัส UI: `#learningApp` ได้ `data-feature="COURSE-LEARNING-001"` จาก controller; คง sidebar, player, progress save/retry, mobile menu และ theme เดิม
- การทดสอบ: `scripts/test-v014369.mjs`

## COURSE-CATALOG-001 — แคตตาล็อกและหน้ารายละเอียดคอร์สสาธารณะ

- สถานะ: `IMPLEMENTED`; ลงทะเบียนเส้นทางจริงใน v0.14.370
- หน้า/ไฟล์: course section หน้า `/`, `/courses.html`, `/course.html?id=:id|slug=:slug`, `public/home-course-catalog.js`, `public/courses.js`, `public/course-detail.js`, `functions/api/courses/index.js`
- API: `GET /api/courses`; response ใช้ `cache-control: no-store` และ query เดียวรวมรายการ สิทธิ์ progress และ resume
- Public visibility: ผู้เยี่ยมชมเห็นเฉพาะ `course_type='online_course'`, product ไม่ถูกลบ, course active และ product published; หน้าแรกตัด resale-rights ซ้ำก่อน render
- Owner continuity: ผู้มี active entitlement ยังคงเห็นคอร์สที่ซื้อแม้หยุดขาย; Boss/Admin เห็นทุกคอร์สในขอบเขต online course เพื่อ preview และ suspension แสดง `access_blocked`
- Privacy: catalog คืน metadata, ราคา, จำนวน EP และ aggregate progress แต่ไม่คืนชื่อ EP, video/PDF key หรือไฟล์ประกอบ; เนื้อหาใช้เส้นทาง `COURSE-LEARNING-001` หลังผ่าน access guard
- UI: หน้าแรกค้นหาข้อความและแสดง 8 รายการแรก; หน้ารวมกรอง platform tag; หน้ารายละเอียดค้นด้วย id/slug แสดง EP lock ก่อนซื้อ และ owned action เข้าเรียน
- Cart: client แปลง course เป็น product line; seller-rights ต้องชำระแยกและแทนตะกร้าหลังผู้ใช้ยืนยัน; รายการปกติจำกัดรวม 30 ชิ้นตาม contract เดิม
- รหัส UI: `#homeCourseCatalog`, `#courseList` และ `#courseDetail` ได้ `data-feature="COURSE-CATALOG-001"` จาก controller; คง loading/error, cards, buttons, mobile layout และ theme เดิม
- ความสัมพันธ์: checkout/approval อยู่ใต้ `COURSE-PARTNER-CHECKOUT-001`; ห้องเรียนและ private lesson media อยู่ใต้ `COURSE-LEARNING-001`
- การทดสอบ: `scripts/test-v014370.mjs`

## CUSTOMER-RECOMMENDATION-001 — สินค้าแนะนำเฉพาะบุคคลบน Storefront

- สถานะ: `IMPLEMENTED`; ลงทะเบียนเส้นทางจริงใน v0.14.371
- หน้า/ไฟล์: `/digital-products.html`, `/product.html?slug=:slug`, `public/personalized-products.js`, `public/personalized-products.css`, `functions/api/recommendations.js`, `functions/api/analytics/event.js`, `functions/_analytics.js`, `functions/_promotion.js`
- API: `GET /api/recommendations`; ผู้ไม่มีบัญชีใช้ visitor cookie ที่ตรวจ UUID และ hash ก่อน query, สมาชิกใช้ user id; ไม่มี identity หรือไม่มี interest คืน array ว่าง
- Signals: อ่าน `product_view`, `add_to_cart`, `checkout_start` ย้อนหลัง 30 วัน ให้น้ำหนัก 1/4/6 แล้วรวมความสนใจตาม family และ category สูงสุด 5 กลุ่ม
- Ranking: candidate ต้อง published, ไม่ถูกลบ, เป็น product ปกติ และไม่ใช่ resale-rights/online-course; ตัดสินค้าที่เคยมี signal หรือมี active entitlement แล้ว; family เดียวกันมาก่อน category ใกล้เคียง
- Output: จัดอันดับจาก catalog สูงสุด 500 แล้วเลือก 6 รายการ ใช้ promotion จาก server ก่อนคืนราคา; client แสดงสูงสุด 4 การ์ดพร้อมเหตุผล
- Telemetry: `recommendation_view` ส่งสูงสุดหนึ่งรอบต่อ session ผ่าน `vd_recommendation_seen_v1`; click ส่ง `recommendation_click`; analytics endpoint ยังคง dedupe event ซ้ำภายใน 10 วินาที
- Privacy/Failure: ไม่คืน visitor key, user id หรือ raw event history; controller fail-quiet และไม่สร้าง section เมื่อไม่มีรายการหรือ request ล้มเหลว
- รหัส UI: dynamic section ใช้ `data-feature="CUSTOMER-RECOMMENDATION-001"`; คง `.vd-personalized-products`, card link, responsive layout และ theme เดิม
- ความสัมพันธ์: การเก็บ event/retention อยู่ใต้ `CUSTOMER-ANALYTICS-001`; catalog/ราคาอยู่ใต้ `CATALOG-STOREFRONT-001`
- การทดสอบ: `scripts/test-v014371.mjs`

## NAV-SHELL-001 — Header, Account Navigation และ Mobile Navigation ร่วม

- สถานะ: `IMPLEMENTED`; ลงทะเบียนเส้นทางจริงใน v0.14.372
- หน้า/ไฟล์: public pages ที่มี `.topbar`; `public/shared-nav.js`, `public/nav-account.js`, `public/header-shell.js`, `public/mobile-storefront.js`, `public/notification-bell.js`, `public/header-shell.css`, `public/mobile-storefront.css`; legacy `public/home-my-button.js`
- API: `GET /api/auth/me`, `POST /api/auth/logout`, `GET/POST /api/notifications`; navigation ไม่เชื่อข้อมูล role/notification จาก DOM แทน API
- Canonical nav: `shared-nav.js` สร้างลิงก์หลัก, login/register และ cart ชุดเดียว, ระบุ `aria-current` ตาม path, sync ปี footer และ cart จาก `vd_cart`
- Account/role: เมื่อ login ซ่อน login/register, แสดงบัญชี, ศูนย์จัดการคอร์สตาม `is_course_owner`, หลังบ้านเฉพาะ Boss/Admin และ logout ผ่าน POST; auth ล้มเหลวคง guest navigation
- Cart: normalize `/cart`, รวมรายการตาม slug/id, rights quantity ตามข้อมูลเดิม, จำกัด badge สูงสุด 30 และ sync เมื่อ DOM/cart/storage เปลี่ยน
- Header shell: แยก primary/utility actions บน desktop, ย้าย utility เข้า nav บนจอไม่เกิน 800px, ลบ action/cart ซ้ำ และรักษา language/account/admin/notification controls
- Mobile: toggle เชื่อม `aria-controls/expanded/hidden`, ปิดด้วย backdrop/link/Escape, trap Tab ภายในเมนู, คืน focus เมื่อปิด และ sync เมื่อ breakpoint เปลี่ยน
- Notification bell: แสดงเฉพาะสมาชิกที่ API ตอบสำเร็จ, escape ข้อมูลก่อน render, อ่าน notification แบบ account-scoped และปิดด้วยปุ่ม/outside click/Escape; ศูนย์เต็มอยู่ใต้ `MEMBER-HUB-001`
- Legacy label helper: `home-my-button.js` เรียก `fix()` ทันทีและเฝ้าเฉพาะการเปลี่ยน attribute `hidden` ทั่ว document เพื่อเปลี่ยนข้อความ `#navMember` ที่มองเห็นเป็น “ของฉัน”; ไม่อ่าน API และไม่เปลี่ยน href/visibility
- Known Gap: จาก Coverage Audit v0.14.383 ไม่พบ HTML, controller หรือ module ใดโหลด `home-my-button.js`; helper จึง dormant และ canonical label/account rendering ยังคงมาจาก `app.js`/`nav-account.js`; ห้ามอ้างว่า MutationObserver นี้ active
- รหัส UI: `.topbar` ได้ `data-feature="NAV-SHELL-001"` ระหว่าง shell sync; คง canonical styles, breakpoint, focus order และ theme เดิม
- ความสัมพันธ์: auth/session อยู่ใต้ `AUTH-ACCOUNT-001`; notification data/reads อยู่ใต้ `MEMBER-HUB-001`; language content อยู่ใน controller เดิมแต่ไม่เปลี่ยนในแพตนี้
- การทดสอบ: `scripts/test-v014372.mjs`, coverage correction `scripts/test-v014383.mjs`

## META-PIXEL-001 — Meta Pixel และ Storefront Conversion Tracking

- สถานะ: `IMPLEMENTED`; ลงทะเบียนเส้นทางจริงใน v0.14.373
- หน้า/ไฟล์: public storefront/content/account pages ที่โหลด `public/meta-pixel.js`; event callers ใน `public/app.js`, `catalog-sync.js`, `product.js`, `cart.js`, `bots-storefront.js`, `home-course-rights.js`, `sales-page-public.js`, `member-dashboard.js`
- Provider: client โหลด `https://connect.facebook.net/en_US/fbevents.js`, init Pixel ID สาธารณะที่กำหนดใน controller และสร้าง queue-compatible `fbq` เมื่อ SDK ยังไม่พร้อม
- Events: ส่ง `PageView` เมื่อโหลด controller; `ViewContent` เมื่อ render สินค้าจริง; `AddToCart` หลังเพิ่มรายการ; `InitiateCheckout` หลังมีรายละเอียด checkout/order แล้ว
- Purchase: dashboard ส่งเฉพาะ order สถานะ `paid`; payload มี content ids, จำนวนชิ้น, ยอดบาทและ THB; ใช้ `eventID='purchase-'+order_no`
- Client dedupe: `vd_pixel_purchases` เก็บ order key ที่ส่งแล้วใน localStorage และรักษา 200 รายการล่าสุด; event อื่นไม่มี dedupe เพิ่มจาก wrapper
- Payload/privacy: caller ส่ง product/order commerce metadata ที่ระบุไว้ในแต่ละ event; controller นี้ไม่อ่าน password, bank data, session token หรือส่งข้อมูลผู้ซื้อแบบ advanced matching
- Failure boundary: event callers ใช้ optional `window.visiondPixel?.track`; wrapper ไม่ส่งเมื่อ `fbq` ไม่เป็น function; ไม่มี server-side Conversions API ใน flow นี้
- รหัส runtime: `<script>` ที่กำลังรันได้ `data-feature="META-PIXEL-001"`; ไม่เปลี่ยน loader, Pixel ID, trigger, event payload หรือ page UI
- ความสัมพันธ์: first-party events/retention อยู่ใต้ `CUSTOMER-INTELLIGENCE-001`; Meta Ads cost ingestion/attribution อยู่ใต้ `ADS-ANALYTICS-001`
- การทดสอบ: `scripts/test-v014373.mjs`

## CONTACT-DOCK-001 — LINE/Facebook External Contact Dock

- สถานะ: `IMPLEMENTED`; ลงทะเบียนเส้นทางจริงใน v0.14.374
- หน้า/ไฟล์: public pages ที่โหลดหรือ import `public/facebook-chat.js`; controller สร้าง `.vd-contact-dock` และ responsive styles แบบ dynamic
- ช่องทาง: LINE ใช้ `window.VISIOND_LINE_URL` หรือ fallback `https://lin.ee/RJZwr1p`; Facebook ใช้ `window.VISIOND_FACEBOOK_PAGE_URL` หรือ fallback Messenger page URL
- Boundary: เป็น external contact launcher เท่านั้น; ไม่อ่าน/เก็บ/ส่งข้อความลูกค้า, ไม่มี API call, access token, webhook, inbox หรือ AI response ใน controller นี้
- Navigation safety: ลิงก์ภายนอกเปิด `_blank` พร้อม `rel="noopener noreferrer"`; URL ใช้ค่าที่ runtime/config กำหนดหรือ fallback เดิมโดยไม่รับ user input ใน widget
- Interaction: launcher เปิด panel, ปุ่มย่อ/ปิดซ่อน panel, ซ่อน Facebook launcher เมื่อ panel เปิด และจำสถานะด้วย `visiond_facebook_chat_open` ใน localStorage
- Accessibility: aside/nav/panel มี label, ปุ่มเป็น `type="button"`, launcher sync `aria-expanded`, panel ใช้ `hidden`; mobile ไม่เกิน 560px ย่อ launcher เป็น icon และ panel พอดี viewport
- Failure/idempotency: ไม่สร้าง dock ซ้ำเมื่อพบ `[data-visiond-contact-dock]`; localStorage อ่าน/เขียนล้มเหลวแล้วใช้สถานะปิดต่อได้
- รหัส UI: root dock ใช้ `data-feature="CONTACT-DOCK-001"`; คง text, URLs, open/close behavior, responsive styles และ theme เดิม
- ความสัมพันธ์: ELON web assistant อยู่ใต้ `ELON-CHAT-001`; Facebook Page inbox/handoff อยู่ใต้ `ELON-PAGE-001`/`V12-INBOX-001`; webhook ingestion อยู่ใต้ `WEBHOOK-HUB-001`
- การทดสอบ: `scripts/test-v014374.mjs`

## I18N-LANGUAGE-001 — ชั้นภาษาไทย/อังกฤษร่วมของเว็บไซต์

- สถานะ: `IMPLEMENTED`; ลงทะเบียนเส้นทางจริงใน v0.14.375
- หน้า/ไฟล์: public pages/controllers ที่ import `public/i18n.js`; switcher ผูกกับ `.topbar`, learning header หรือ body ตาม surface ที่มี
- Selection: รับเฉพาะ `lang=th|en`; precedence คือ query parameter, `visiond_language` ใน localStorage แล้วจึง auto จาก `vd_country` หรือ `navigator.language`
- One-site boundary: เปลี่ยนเฉพาะภาษา UI บน origin/path เดิม ใช้บัญชี ตะกร้า API และข้อมูลชุดเดียว; switcher บันทึกภาษาแล้ว reload URL เดิมพร้อม `lang`
- Translation: ใช้ exact dictionary, phrase replacement, word pairs และรูปแบบตัวเลข/หน่วย; โหมดไทยคงข้อความต้นฉบับ
- DOM: โหมดอังกฤษแปล text nodes ยกเว้น script/style/noscript/textarea และ attributes `placeholder|title|aria-label|alt|content`; MutationObserver แปล node ที่เพิ่มภายหลัง
- Runtime surfaces: ตั้ง `document.documentElement.lang` และ `data-lang`; แปล `alert`/`confirm` เฉพาะโหมดอังกฤษ; dispatch `visiond:language` เพื่อให้ navigation shell sync
- Idempotency/failure: `window.VisionDI18n` ป้องกัน init ซ้ำ; localStorage อ่านล้มเหลวใช้ automatic language; switcher ไม่สร้างซ้ำเมื่อมี `[data-language-switcher]`
- รหัส UI: `.vd-language-switcher` ใช้ `data-feature="I18N-LANGUAGE-001"`; คง TH/EN buttons, dictionary, selection precedence, observer และ theme เดิม
- ความสัมพันธ์: navigation placement อยู่ใต้ `NAV-SHELL-001`; controller นี้เป็น client translation layer ไม่เปลี่ยน API contract หรือสร้างข้อมูลภาษาแยก
- การทดสอบ: `scripts/test-v014375.mjs`

## BOSS-MOBILE-PREVIEW-001 — เครื่องมือ Boss ตรวจหน้าเว็บในกรอบมือถือ

- สถานะ: `IMPLEMENTED`; ลงทะเบียนเส้นทางจริงใน v0.14.376
- หน้า/ไฟล์: public top-level pages ผ่าน `public/boss-mobile-preview.js`; Control Center ผ่าน `#mobilePreviewShell` ใน `public/admin.html` และ `setupBossMobilePreview()` ใน `public/admin.js`
- สิทธิ์: public helper เรียก `GET /api/auth/me` และสร้าง UI เฉพาะ `user.role='boss'`; admin helper ใช้ viewer ที่ตรวจแล้วและรับเฉพาะ role Boss
- Guard: public ไม่ทำงานใน iframe, `/admin*`, viewport ไม่เกิน 760px หรือ coarse pointer; admin ไม่เปิด launcher เมื่อมี query `mobile_preview` เพื่อป้องกัน preview ซ้อน
- Routes: selector รวมหน้าบ้านและ admin tab routes; admin routes ใช้ `mobile_preview=1&preview_tab=...`; route ปัจจุบัน escape ก่อนใส่ option
- Interaction: เปิด overlay แล้ว lock body scroll, lazy-load iframe เมื่อเปิดครั้งแรก, เปลี่ยน route, reload frame, เปิดแท็บใหม่ `noopener`, ปิดด้วยปุ่ม/backdrop/Escape แล้วคืน scroll
- Frame: public device กว้าง 390px; admin iframe ใช้ shell/device เดิม; เครื่องมือนี้เป็น visual inspection ไม่แก้ข้อมูลหรือเรียก mutation API
- Failure: auth ไม่สำเร็จ/non-Boss ไม่สร้าง public UI; exception fail-quiet พร้อม console warning; iframe page ยังคงบังคับ auth/authorization ของ route ปลายทางเอง
- รหัส UI: public `.boss-mobile-overlay` และ admin `#mobilePreviewShell` ใช้ `data-feature="BOSS-MOBILE-PREVIEW-001"`; คง routes, controls, styles และ theme เดิม
- ความสัมพันธ์: Sales Page preview อยู่ใน `SALES-PAGE-001`; เครื่องมือนี้เป็น site-wide Boss inspection shell ไม่ใช่ publication preview
- การทดสอบ: `scripts/test-v014376.mjs`

## STOREFRONT-PROMO-001 — Bundle Promo Banner และ Visit Statistics Strip

- สถานะ: `IMPLEMENTED`; ลงทะเบียนเส้นทางจริงใน v0.14.377
- หน้า/ไฟล์: public storefront/content pages ที่โหลด `public/promo-banner.js`; GIF `/assets/visiond-bundle-promo.gif`; statistics source `GET /api/analytics/view`
- Promotion surface: สร้าง banner link ไป `/digital-products.html`, แสดง GIF 4 เฟรมระดับ 5/10/20/30 ตะกร้าและส่วนลด 15/25/50/75%; แต่ละเฟรมอ่านสีพื้นของการ์ดก่อนวางเปอร์เซ็นต์เพื่อไม่ให้เกิดแถบสีค้าง; เติม motion timestamp เพื่อเริ่ม GIF ใหม่
- Boundary: controller นี้ไม่คำนวณ eligibility, discount หรือ order total และไม่อ่าน promotion settings; สูตร/ข้อยกเว้นจริงยังบังคับที่ commerce/promotion flow
- Placement: วาง banner หลัง `.topbar` หรือหน้า body เมื่อไม่มี header แล้ววาง visit strip ต่อท้าย; ป้องกัน init ซ้ำด้วย `[data-visiond-promo]`
- Statistics: แสดง today, latest 7 days และ latest 30 days; ใช้ `visiond:analytics-counted` ครั้งเดียวหรือ `window.__visiondAnalytics` เมื่อพร้อมแล้ว
- Fallback: หาก analytics data ยังไม่มีให้เรียก `GET /api/analytics/view` ซึ่งใช้ public cache 5 นาที; response ล้มเหลวแสดง 0 ทั้งสามค่าโดยไม่บล็อกหน้า
- Accessibility/responsive: banner มี aria-label และ image alt บอกเรทครบ; strip มี aria-label; banner breakpoint 600px และ strip 520px ตาม layout เดิม
- รหัส UI: `.visiond-promo-banner` และ `.visiond-visit-strip` ใช้ `data-feature="STOREFRONT-PROMO-001"`; คง URL, styles และ theme เดิม
- ความสัมพันธ์: page-view count/retention อยู่ใต้ `CUSTOMER-INTELLIGENCE-001`; promotion configuration อยู่ใต้ `PROMOTION-SETTINGS-001`; order discount อยู่ใต้ `COMMERCE-ORDER-001`
- การทดสอบ: `scripts/test-v014377.mjs`

## HOMEPAGE-VIDEO-001 — Facebook Video Embed บนหน้าแรก

- สถานะ: `PARTIAL`; ลงทะเบียนเส้นทางที่มีอยู่จริงและ Known Gap ใน v0.14.379
- ไฟล์: `public/homepage-video.js`, `functions/api/site-settings.js`
- API: `GET /api/site-settings` อ่าน `settings.homepage_facebook_video_url`; เมื่อไม่มี row ใช้ Facebook share URL เริ่มต้น; response cache สาธารณะ 60 วินาที ขณะที่ client request ระบุ no-store
- Controller: ต้องพบ `#homepageFacebookVideo`, `#homepageFacebookVideoFrame` และ `#homepageFacebookVideoLink` ครบก่อนเรียก API; URL ต้องเป็น HTTPS และ host `fb.watch`, `facebook.com` หรือ subdomain ของ Facebook
- Embed: path แบบ `/share/p/` หรือ `/posts/` ใช้ Facebook `post.php` พร้อมข้อความ; path อื่นใช้ `video.php`; iframe lazy-load, allow fullscreen, strict-origin-when-cross-origin และแสดง section หลังสร้าง iframe สำเร็จ
- Failure: DOM ไม่ครบ, API ล้ม, URL ว่าง/parse ไม่ได้, protocol หรือ host ไม่ผ่าน allowlist จะ fail-quiet และไม่แสดง section
- Known Gap: จาก Coverage Audit v0.14.379 ไม่พบ public HTML ที่ประกาศสาม DOM IDs และไม่พบ HTML/JS อื่นที่โหลด `homepage-video.js`; controller/API จึงยังไม่มี active page route และห้ามอ้างว่าวิดีโอหน้าแรกเปิดใช้งานแล้ว
- Known Gap: ไม่พบ admin/API write path สำหรับ `homepage_facebook_video_url`; ปัจจุบันพบเฉพาะ public read และ default URL
- รหัส UI: controller กำหนด `data-feature="HOMEPAGE-VIDEO-001"` หลังพบ DOM contract ครบ; ไม่เพิ่ม DOM, loader, button, style หรือ theme ในแพตนี้
- ความสัมพันธ์: การลงทะเบียน Known Gap ไม่อนุญาตให้เปิด surface หรือเพิ่ม setting writer โดยไม่มี Patch Scope แยก
- การทดสอบ: `scripts/test-v014379.mjs`

## PRODUCT-PDF-COVER-001 — เครื่องมือสร้างภาพปกสำหรับสินค้า PDF

- สถานะ: `IMPLEMENTED`; ลงทะเบียนเส้นทางจริงใน v0.14.381
- หน้า/ไฟล์: Products section ใน `/admin.html`, `public/admin-pdf-cover.js`, `public/admin-pdf-cover.css`
- Interaction: ปุ่ม “สร้างปก PDF” เปิด modal dialog, focus ช่องชื่อใน animation frame ถัดไป, render preview ใหม่เมื่อชื่อ/แม่แบบ/รูปเปลี่ยน และ reset input/image/object URL เมื่อ dialog ปิด
- Input: ชื่อสูงสุด 100 ตัวอักษร; รูปเดียวชนิด JPEG/PNG/WEBP ไม่เกิน 8 MB; แม่แบบ `modern`, `kids`, `elegant` โดย default เป็น modern
- Rendering: Canvas 1000×1400 px วาด gradient/frame/title สูงสุด 3 บรรทัด, fit รูปแบบ contain ลงกรอบ และข้อความ `VISIOND • DIGITAL PDF`; download เปิดได้เมื่อมีทั้งชื่อและรูปที่อ่านสำเร็จ
- Output: ใช้ `canvas.toBlob(..., "image/png")` ดาวน์โหลดไฟล์ PNG ชื่อ `ปก-PDF-{ชื่อที่ sanitize และตัดไม่เกิน 60 ตัวอักษร}.png`; ชื่อเครื่องมือสื่อถึงปกสำหรับ PDF แต่ controller นี้ไม่ได้สร้างไฟล์ PDF
- Resource lifecycle: revoke object URL เก่าก่อนเลือกรูปใหม่, revoke download URL หลัง 1 วินาที และ revoke/reset เมื่อปิด dialog; รูป decode ล้มเหลวแสดงข้อความและไม่พร้อม download
- API/ข้อมูล: client-only; ไม่มี API, database, upload หรือ server persistence และไม่ใช้ `pdf-lib` ใน controller นี้
- สิทธิ์: ไม่มี auth check ภายใน controller; surface อาศัย page-level admin bootstrap/access control ของ `/admin.html`
- ห้ามกระทบ: ขนาด canvas, validation, templates, typography/colors/frame geometry, contain scaling, filename sanitation, disabled/message, object URL cleanup และ responsive breakpoint 820px เดิม
- รหัส UI: launcher และ dialog ใช้ `data-feature="PRODUCT-PDF-COVER-001"`; คง legacy classes, button states, modal layout และ theme เดิม
- การทดสอบ: `scripts/test-v014381.mjs`, historical `scripts/test-v014262.mjs`, `scripts/test-v014265.mjs`, `scripts/test-v014267.mjs`

## COURSE-OWNER-ENTRY-001 — ป้ายสถานะและทางเข้าสำหรับเจ้าของคอร์ส

- สถานะ: `PARTIAL`; ลงทะเบียน active homepage badge และ dormant dashboard credit card ตาม source coverage ใน v0.14.382
- หน้า/ไฟล์: `/index.html` โหลด `public/course-owner-badge.js`; `public/course-owner-dashboard.js` รองรับ `#dashIdentity` ใน `/dashboard.html` แต่ไม่มี loader; style badge ใช้ shared `.course-owner-badge`
- Homepage identity: เรียก `GET /api/auth/me` แบบ no-store; ไม่สร้าง UI เมื่อ request ล้มเหลวหรือ `user.is_course_owner` ไม่จริง; เมื่อพบ `#navMember` และยังไม่มี badge ลูก จึง append ป้าย “เจ้าของคอร์ส”
- Alternate badge target: controller รองรับ `#dashIdentity` โดยสร้างลิงก์ `/course-center` หลัง identity หาก parent ยังไม่มี `.member-course-owner-badge`; หน้าแรกที่โหลด controller ไม่มี target นี้
- Dashboard credit CTA: dormant controller เรียก `GET /api/course-seller`, อ่าน `credit_balance`, สร้าง `.owner-credit-card` หลัง `#dashIdentity`; balance มากกว่า 0 ไป `/course-center?create=1`, มิฉะนั้น alert แล้วไปซื้อ `/product.html?slug=course-selling-rights`
- API/ข้อมูล: `GET /api/auth/me`, `GET /api/course-seller`; API หลังใช้ `requireUser` และคำนวณ credit balance จาก active `course_right_credits`; controller ไม่เขียน API/database/storage
- Failure/dedupe: badge helper fail-quiet พร้อม warning เมื่อ exception และกัน badge ซ้ำเฉพาะ target ของตน; credit card reuse element เดิมและคืนเงียบเมื่อ API/identity ไม่พร้อม
- Known Gap: จาก Coverage Audit v0.14.382 ไม่พบ HTML หรือ JS ที่โหลด `course-owner-dashboard.js`; ห้ามอ้างว่า dashboard credit CTA active และห้ามเพิ่ม loader โดยไม่มี Patch Scope แยก
- Overlap: homepage helper กับ `NAV-SHELL-001` ต่างเรียก auth และอาจสร้าง `.course-owner-badge` คนละตำแหน่งตามลำดับ async; แพตนี้บันทึก legacy behavior เท่านั้น ไม่อ้าง global dedupe และไม่เปลี่ยน race/navigation
- รหัส UI: badge/card ที่ controller สร้างใช้ `data-feature="COURSE-OWNER-ENTRY-001"`; คง class, text, route และ theme เดิม
- ความสัมพันธ์: canonical account/course-owner navigation อยู่ใต้ `NAV-SHELL-001`; member dashboard อยู่ใต้ `MEMBER-HUB-001`; create/edit course อยู่ใต้ `COURSE-BASKET-001`
- การทดสอบ: `scripts/test-v014382.mjs`

## DAILY-TASKS-001 — ตารางงานประจำวันส่วนตัว

- ผู้ใช้/ทางเข้า: Boss หรือ Admin ที่ผ่าน `requireAdmin`; เมนู “ตารางงานประจำวัน” ในหลังบ้าน → `/daily-tasks.html`
- งานตั้งต้น: ลง Zippo, ทำแคตตาล็อก, Toyskub, ทำสินค้าดิจิทัล, ยิงแอด, บอท TikTok, ขายของ และกิจกรรมอื่นๆ แสดงทุกวันที่เลือก
- สถานะ: งานที่ยังไม่ทำแสดงพื้นและกรอบสีแดง; กด “ทำแล้ว” เพื่อบันทึกเวลาเสร็จ และกดยกเลิกสถานะได้
- งานเพิ่มเอง: เพิ่มได้ไม่เกิน 100 ตัวอักษร และลบได้เฉพาะรายการ custom ของบัญชีและวันเดียวกัน
- Data boundary: `daily_personal_tasks` unique ด้วย `user_id + task_date + task_key`; API ทุก read/write/delete ผูก `auth.user.id` และวันที่ที่ตรวจรูปแบบแล้ว จึงไม่อ่านหรือแก้งานของบัญชีอื่น
- หน้า/ไฟล์/API: `public/daily-tasks.{html,css,js}`, `functions/api/admin/daily-tasks.js`, `migrations/0069_daily_personal_tasks.sql`
- รหัส UI: `main.daily-shell` และเมนูหลังบ้านใช้ `data-feature="DAILY-TASKS-001"`; ปุ่มใช้ canonical `.vds-btn`
- การทดสอบ: `scripts/test-v014421.mjs`

## PARTNER-API-001 — ศูนย์ควบคุม Partner API และ Web 2 Integration

- สถานะ: `IMPLEMENTED`; ลงทะเบียน end-to-end contract จาก runtime จริงใน v0.14.388
- หน้า/ไฟล์: `/partner-api.html`, `public/partner-api.js`, `public/partner-webhook.js`, `functions/_partner_{api,crypto,sync,sandbox,webhook,health}.js`, `functions/api/admin/partner-websites/**`, `functions/api/partner/v1/{products,customers/sync,orders/sync,webhooks/events}.js`, `integrations/web2/`, `docs/PARTNER-API-WEB2-INTEGRATION.md`
- Control Center: registry/create/update/status/credential rotation, masked customer/order data, isolated Sandbox, signed webhook queue/health/alerts และ E2E อยู่ในศูนย์ควบคุมเดียว; admin endpoints ทุกเส้นทางใช้ `requireBoss`
- Credential/Auth: แยก credential ต่อเว็บไซต์, Client Secret แสดงครั้งเดียวและเก็บ AES-GCM พร้อม hash/last4; Partner API รับ `X-VisionD-Client-ID` + Bearer secret, เว็บไซต์ต้อง `active`, ใช้ least-privilege scopes `products:read`, `customers:write`, `orders:write`
- Catalog: `GET /api/partner/v1/products` คืนเฉพาะ metadata ของ published, non-deleted product/vision7-key ที่ไม่ใช่ resale-rights; pagination ค่าเริ่มต้น 50/สูงสุด 100 พร้อม `has_more` + `next_cursor`; `GET /api/partner/v1/products/{id}` ใช้ boundary เดียวกันและ point query หนึ่งครั้ง; cache private 60 วินาทีและไม่คืนไฟล์ดาวน์โหลด, token, ข้อมูลธนาคารหรือลูกค้า; Starter Kit มี `productPages()` และ `product(id)`
- Customer/Order sync: คำขอเขียนต้องมี External ID และ `Idempotency-Key` 8–100 ตัว; key เดิม payload เดิม replay ผลเดิม แต่ payload ต่างตอบ 409; ห้าม sensitive fields, PII ลูกค้าเข้ารหัส AES-GCM, เงินเป็นจำนวนเต็มสตางค์ THB และตรวจ item/discount/refund totals ก่อน batch write
- Signed Webhook: HMAC-SHA256 แบบ `timestamp.raw_body`, constant-time compare และเวลาไม่เกิน ±5 นาที; signature hash/idempotency unique ต่อเว็บไซต์, payload queue เข้ารหัส, retry exponential backoff และ Dead Letter เมื่อครบ 5 ครั้ง
- Sandbox/E2E: scenarios ลูกค้า ออเดอร์ ชำระเงิน ยกเลิก คืนเงินแยกจาก Production; E2E ต้อง active + scopes ครบ ตรวจ catalog, replay/conflict, signed webhook, retry/dead และ alerts โดยไม่คืน credential/signature/PII
- Health/Privacy: dashboard 24 ชั่วโมงแสดง total/completed/retry/dead/error rate/response time/latest event; audit ใช้ request ID และ hash IP; UI/log ปิดบัง credential, External ID และไม่คืน raw payload, secret, token หรือข้อมูลส่วนตัว
- Starter Kit: `integrations/web2/visiond-partner-client.mjs` ใช้เฉพาะ Backend, HTTPS config และ Secret Manager; ห้าม import เข้า browser bundle หรือ log config/authorization/signature/private payload
- Digital commerce boundary: v0.14.407 ล็อก contract; v0.14.408 เปิด product detail; v0.14.409 เปิด order create/status แยกด้วย `commerce:write|read`, external ID + idempotency, active synced customer, สูงสุด 100 distinct digital products quantity 1 และ authoritative VisionD price; v0.14.410 เปิด Boss-only fulfillment ที่รับเฉพาะ native paid order ซึ่งยอด/สินค้า/จำนวน/line total/entitlement ตรงและห้าม reuse ก่อนออก claim AES-GCM+hash อายุ 24 ชม. ใช้ครั้งเดียวเฉพาะ native user; v0.14.412 เพิ่ม safe delivery metadata สำหรับ single/bundle พร้อม count/pages/size แต่ไม่คืน object key/token/download URL; `/orders/sync` เป็น reconciliation เท่านั้น, API 1 บาทไม่หักลูกค้า
- Commerce query budget: catalog page อ่าน ≤101 rows, product detail point read 1, create ≤100 items และ product query 1 ครั้ง, status/admin/fulfill/claim ≤100 rows ต่อ bounded set; read scope ด้วย Website ID + External ID และห้าม full-table scan; SQLite handler E2E วัด create=13, replay=4, pending=6, fulfill=9, ready=6, wrong-account=2, claim=5, reuse=2 statements
- Known Boundary: Feature Map รอบนี้ยืนยัน contract ใน repository เท่านั้น ไม่ได้พิสูจน์ว่า Web 2 ภายนอกเชื่อม Production แล้ว; Push, Deploy, Production credential, E2E production และ monitoring 24 ชั่วโมงยังต้องทำเป็น Event Case แยก
- รหัส UI: `main.partner-shell` ใช้ `data-feature="PARTNER-API-001"`; คง legacy forms/buttons, canonical button adapter, loading/error, Desktop/Mobile และ theme เดิม
- การทดสอบ: `scripts/test-v014388.mjs`, `scripts/test-v014397.mjs`, `scripts/test-v014398.mjs`, `scripts/test-v014399.mjs`, `scripts/test-v014400.mjs`, `scripts/test-v014407.mjs`–`scripts/test-v014411.mjs`, `scripts/test-partner-commerce-{e2e,query-budget}.mjs`, `scripts/partner-api-security-gate.mjs`; historical Phase tests `scripts/test-v014217.mjs`–`scripts/test-v014223.mjs`

## SITE-FAVICON-001 — ไอคอนแท็บ VisionD

- สถานะ: `IMPLEMENTED`; เพิ่มใน v0.14.428
- หน้า/ไฟล์: `public/favicon.svg` และเอกสาร HTML ใต้ `public/` ทุกหน้า
- ฟังก์ชัน: แสดงตรา V สีขาวบนพื้น Tiffany พร้อมจุดสีทองในแท็บเบราว์เซอร์แทนไอคอนโลกเริ่มต้น; ใช้ SVG เดียวกันทั้งหน้าร้าน หลังบ้าน บทความ และ V Easy
- ขอบเขต: เป็นภาพประจำแท็บเท่านั้น ไม่เปลี่ยนโลโก้ header, theme หรือพฤติกรรมธุรกิจ
- การทดสอบ: `scripts/test-v014428.mjs`

## Coverage Audit v0.14.389

- ผล: `PASS`; ไม่พบ root controller หรือ active business script ที่ยังไม่มี Feature Map ownership
- ขอบเขตตรวจถาวร: root `public/*.js`, script loaders ใน HTML, `data-feature` IDs และ file-bearing `functions/api/*` domains
- ข้อยกเว้น: `vendor/pdf-lib.min.js` เป็น third-party library ที่มี integrity coverage ใน focused tests ของระบบ PDF ไม่ใช่ระบบธุรกิจแยก
- Coverage correction ที่พบ: `public/reset-password.js`; backend support ที่ผูก ownershipเพิ่มคือ analytics/ELON retention, Meta outbox, V12 outbound/broadcast media และ Vision5 rights payment mode
- Verifier: `scripts/feature-map-coverage-audit.mjs`; เมื่อเพิ่ม root controller, active script, marker หรือ API domain ใหม่โดยไม่ลงทะเบียน audit ต้อง FAIL

1. เริ่มแก้ด้วยการค้นหารหัสฟีเจอร์นี้ใน repository
2. รายงานไฟล์และข้อมูลที่จะเปลี่ยนก่อนแก้เมื่อขอบเขตกว้างหรือเสี่ยง
3. เมื่อเส้นทาง runtime เปลี่ยน ให้แก้ Feature Map และ focused test พร้อมกัน
4. หากหลักฐานจริงไม่ตรงเอกสาร ให้หยุดอ้างเอกสารส่วนนั้น ตรวจโค้ด/schema แล้วแก้เอกสารในแพตช์เดียวกัน
## TIKTOK-ANALYZER-001 — วิเคราะห์ช่อง TikTok และสินค้าถัดไป

- หน้าใช้งาน: `public/tiktok-analyzer.html`, `public/tiktok-analyzer.js`, `public/tiktok-analyzer.css`
- API: `functions/api/admin/tiktok-analyzer/index.js`; ผู้ใช้ต้องผ่าน `requireAdmin`
- AI vision: `functions/_tiktok_analyzer.js`; ใช้คีย์เฉพาะระบบก่อนและรองรับ OpenAI/Gemini
- ข้อมูล: `tiktok_channels` เก็บชื่อและลิงก์แยกแต่ละช่อง; `tiktok_analysis_runs` และ `tiktok_analysis_images` เก็บการบ้าน ผลวิเคราะห์ และภาพแยกตามช่อง; `tiktok_channel_products` รวมชื่อสินค้าเต็ม ลิงก์ ประเภท A–F เพศกลุ่มลูกค้า และช่วงอายุลูกค้าโดยไม่สร้างชื่อซ้ำ (F คือไม่ควรยุ่งและต้องมีเหตุผลรองรับ)
- กฎ: แสดงรายการสินค้าเป็นตารางและห้ามย่อชื่อตามหลักฐาน; เพศ/อายุต้องมาจากหลักฐานเท่านั้น หากไม่พอแสดง `ยังระบุไม่ได้`; ห้ามแต่งตัวเลขที่ไม่มีในภาพ, รับสูงสุด 30 รูป/รอบ รูปละ 5 MB รวมไม่เกิน 25 MB และไม่บันทึกผลปลอมเมื่อ AI ไม่พร้อม
- รหัส UI: เมนูหลังบ้านใช้ `data-feature="TIKTOK-ANALYZER-001"`
