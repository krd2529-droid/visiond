# Active patch: PowerPoint legacy image-number parity

- Event: PATCH_DELIVERED
- Outcome: เลขใต้ภาพในตัวดู PowerPoint ต้องตรงกับเลข [รูป N] ในบรรทัดต้นฉบับ แม้เป็นไฟล์เก่าที่ไม่มี preview manifest
- Acceptance: สไลด์ที่อ้างรูป 15/16 แสดงป้ายรูป 15/16 ไม่ใช่ 1/2, ตัดข้อความ caption ซ้ำออกจากเนื้อหา, รูปยังคลิกขยายได้, manifest ใหม่ไม่ถอยหลัง
- Phase: complete
- Likely files: public/pptx-preview-parser.js, public/powerpoint-viewer.js/html, tests, visible version
- Verification: supplied 68-slide PPTX parsed slide 15 as image numbers 15/16 and detail slides 49/50 as 15/16; focused parser, viewer, authoritative mapping, visible version, predeploy PASS
- Delivery: v0.20.29, commit da62e059, pushed to origin main
- Next: verify production viewer asset and reported slide after auto-deploy
