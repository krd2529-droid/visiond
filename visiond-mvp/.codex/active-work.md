# Active patch: Hide channel names from commission share cards

- Event: PATCH_READY
- Outcome: รูปค่าคอมสาธารณะไม่แสดงหรือผูกกับชื่อช่องจริง เหลือหมายเลขช่องและยอดเท่านั้น
- Preserve: ปุ่มแสดงเมื่อมีค่าคอมจริงเท่านั้น, ข้อมูลจริงจาก TikTok, แชร์หรือดาวน์โหลดได้, ไม่สร้างตัวเลขทดแทน
- Acceptance: canvas ไม่มีชื่อช่อง; fingerprint ไม่บรรจุชื่อช่อง; ลำดับและยอดคงเดิม; dashboard ส่วนตัวคงชื่อช่อง; cache รูปเก่าที่มีชื่อไม่ถูกนำกลับมาใช้
- Phase: implementation complete; delivery in progress
- Blocker: ไม่มี
- Files: public/tiktok-commission-card.js, public/tiktok-analyzer.js, focused regressions, FEATURE-MAP.md
- Verification: canvas regression confirms real channel names are absent; cache fingerprint uses privacyVersion 2 and amount-only channel data; pagination, library isolation, social workflow, preview, syntax, and diff checks pass
- Next: inspect final diff, commit relevant files, push origin main, verify production assets
