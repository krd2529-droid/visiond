# B1 v0.14.110 / V Easy v1.0.9 — Acceptance Matrix

| Gate | Web v0.14.110 | Source v1.0.9 | APK v1.0.9 | ผ่านเมื่อ |
|---|---|---|---|---|
| Version | `VERSION.txt` | package, Android config, runtime | APK metadata/name | เลขตรงชุดอนุมัติทั้งหมด |
| Form parity | API รับ field ตาม contract | `public/` เป็น source of truth | `android-app/` มี form ID/name/required/options ครบ | ไม่มีช่องหรือปุ่มหลุดหลัง sync |
| Activation | ID/key/account/shop endpoints | Settings เรียก endpointจริง | เปิด Settings และ activate ได้ | 1 key = 1 shop เฉพาะ V Easy |
| Session/security | owner/device/account scope | ไม่ฝัง password/key/token | APK generic และ signed | เปลี่ยนบัญชีไม่เห็นร้านเดิม; logout revoke |
| Mobile behavior | API error ชัด | Back/X/submit ไม่ซ้ำ | install, launch, Back, camera | Redmi Note 14 Pro+ 5G ผ่าน smoke |
| Delivery | Web ZIP เปิดได้ | Source ZIP เปิดได้และ build ซ้ำได้ | APK เป็น ZIP structure และ verify signature | มีครบ 3 artifact ในรอบเดียว |

Source gate: `VEASY_SOURCE_DIR=../V-Easy-v1.0.9-work npm run test:v014110`

Final artifact gate: `VISIOND_WEB_ZIP=... VEASY_SOURCE_ZIP=... VEASY_APK=... npm run test:v014110 -- --artifacts`

ผลเครื่องจริงต้องบันทึกผู้ทดสอบ วันเวลา รุ่น/OS, install, launch, Settings activation, Android Back, กล้อง QR, session หลังอัปเดต และผล pass/fail ห้ามอนุมานจาก emulator หรือ static test
