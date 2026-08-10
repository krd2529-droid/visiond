# Meta Ads API Setup

1. ใช้ Meta App/System User ที่เข้าถึงบัญชีโฆษณาของ VisionD และให้สิทธิ์อ่าน `ads_read` เท่าที่จำเป็น
2. ตั้ง Cloudflare Secret `META_ADS_ACCESS_TOKEN` ห้ามบันทึก Token ใน Git, ZIP, D1 หรือหน้าหลังบ้าน
3. ตั้งตัวแปร `META_AD_ACCOUNT_ID` เป็นเลขบัญชีโฆษณา จะมีหรือไม่มี `act_` ก็ได้
4. ตั้ง `META_GRAPH_API_VERSION` เป็น Graph API version ที่ App ใช้อยู่ เช่นรูปแบบ `vNN.N`
5. เปิดหน้า Ads Center เลือกช่วงวันที่ไม่เกิน 93 วัน แล้วกด “ซิงก์ Meta Ads”

ระบบอ่านข้อมูลเท่านั้น ไม่สร้าง แก้ไข เปิด ปิด หรือลบโฆษณา และบันทึกเฉพาะรหัส/ชื่อโครงสร้างกับผลลัพธ์ ไม่เก็บ Access Token
