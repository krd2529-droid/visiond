# PATCH v0.14.135 — Header Duplicate Actions Hotfix

## Event Case

ปุ่ม Login, Create Account, Cart และ account actions แสดงซ้ำ เพราะ `header-shell` ย้ายชุดเดิมไป `.header-utility` ก่อนที่ `shared-nav` จะสร้างชุดใหม่ใน `<nav>`.

## Fix

- ลบ stale `.header-utility` ก่อนสร้าง canonical navigation
- cleanup auth/account actions ใช้ขอบเขตทั้ง `.topbar`
- deduplicate member, owner, admin และ logout ก่อน append
- bump asset cache key เป็น `014135`

## Verification

- `npm run test:v014135`
- `npm run predeploy:check`
