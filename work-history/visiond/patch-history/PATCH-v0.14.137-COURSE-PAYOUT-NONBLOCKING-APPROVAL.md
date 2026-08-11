# PATCH v0.14.137 — Course Payout Nonblocking Approval

## Requirement coverage

- บันทึกบัญชีรับเงินได้ทันที: `payment-profile.js`
- ชื่อไม่ตรงไม่บล็อก: ถอด name equality validation
- Boss อนุมัติคอร์สได้: ถอด payout status gate จาก course review
- บัญชีเก่าไม่ค้าง: migration `0038`
- UI แสดงสถานะจริง: `พร้อมรับเงิน`

## Verification

- `npm run test:v014137`
- `npm run predeploy:check`
