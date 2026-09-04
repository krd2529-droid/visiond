# Active patch: legacy PowerPoint online preview

- Event: PATCH_READY
- Outcome: เปิด PowerPoint เก่าและใหม่จากคลังในตัวดูออนไลน์ โดยไม่เรียก AI ซ้ำ
- Acceptance: ไฟล์ใหม่ใช้ manifest, ไฟล์เก่า fallback อ่าน PPTX, รูปกดขยายได้, ดาวน์โหลดเดิมอยู่, จำกัดสิทธิ์เจ้าของ
- Phase: delivery
- Likely files: public/powerpoint-viewer.*, public/pptx-preview-parser.js, tests, visible version
- Verification: parser unit PASS; supplied 68-slide PPTX parsed 68/68; regression and predeploy PASS
- Next: inspect diff, commit, push, verify origin/main
