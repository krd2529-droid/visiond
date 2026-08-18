# VisionD v0.14.199 — Fast Meta Webhook Verification

- ตัด runtime schema migration ออกจาก Facebook webhook hot path เพื่อลดเวลา Meta Callback verification
- ยังอ่านและถอดรหัส Verify Token จากฐานข้อมูลก่อนคืน challenge
- Parent `fb1b3cf8480c27e616e0c1c93a7caf7f73ad83b9`; rollback `git revert SELF`; safe baseline `5ea8741`
