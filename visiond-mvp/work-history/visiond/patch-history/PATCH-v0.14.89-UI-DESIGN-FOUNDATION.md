# VisionD v0.14.89 — Modern AI Commerce Design Foundation

## Event Roadmap

- เพิ่ม Design Tokens สำหรับสี ตัวอักษร ระยะห่าง มุมโค้ง เงา การเคลื่อนไหว และ Focus
- เพิ่มปุ่ม semantic 6 แบบ: Primary, Secondary, Tonal, Text, Promotion และ Danger
- เพิ่มขนาดปุ่ม Large, Standard และ Small โดย Standard สูงอย่างน้อย 44px
- เพิ่มกล่อง semantic 5 แบบ: AI Hero, Feature, Product, Information และ Status
- รองรับ Hover, Active, Focus, Disabled, Reduced Motion และหน้าจอมือถือ
- เชื่อมฐานแบบ opt-in กับหน้าเดิม 25 หน้า โดยใช้ namespace `vds-*` เพื่อไม่ชน `vd-card` และ `vd-grid` รุ่นเก่า
- ปรับ Primary/Hero ให้ผ่านการอ่านบนพื้นเข้ม, ปุ่ม Small บนมือถือสูง 44px และเพิ่ม Forced Colors
- ปิดการกดลิงก์ที่เป็น `aria-disabled` ทั้งเมาส์และคีย์บอร์ดด้วย behavior กลางแบบ opt-in
- ยังไม่รื้อหน้าแรกในแพตฐาน; หน้าแรกเป็น UI Roadmap แพตถัดไป

## Team J review tracks

- Design-system completeness and visual-role review
- Legacy CSS collision and mobile-accessibility review
- Roadmap, Requirement Ledger and anti-drop review

## Verification

- `npm run test:regression-all`
- `npm run test:v01489`
- `npm run requirements:check`
- `npm run requirements:recheck`
- `npm run patch:coverage`
