# VisionD v0.14.160 — LINE Webhook Verify Timeout

- Removes repeated schema provisioning from the public webhook request path.
- Returns HTTP 200 immediately for valid LINE verification payloads with `events: []`.
- Keeps raw-body HMAC-SHA256 signature verification before accepting the request.
- Does not change the webhook URL, Channel Secret, Channel Access Token, or Android APK.

## Deploy

Extract this overlay into the current VisionD project root and deploy once. Then press Verify in LINE Developers and enable Use webhook only after Verify succeeds.

## Event status

EVENT CASE: เสร็จทั้งหมดแล้ว — พร้อมทดสอบ LINE Verify หลัง Deploy
