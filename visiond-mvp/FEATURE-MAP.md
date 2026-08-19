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

## กฎบำรุงรักษา

1. เริ่มแก้ด้วยการค้นหารหัสฟีเจอร์นี้ใน repository
2. รายงานไฟล์และข้อมูลที่จะเปลี่ยนก่อนแก้เมื่อขอบเขตกว้างหรือเสี่ยง
3. เมื่อเส้นทาง runtime เปลี่ยน ให้แก้ Feature Map และ focused test พร้อมกัน
4. หากหลักฐานจริงไม่ตรงเอกสาร ให้หยุดอ้างเอกสารส่วนนั้น ตรวจโค้ด/schema แล้วแก้เอกสารในแพตช์เดียวกัน
