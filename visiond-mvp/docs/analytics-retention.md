# Analytics retention

VisionD เก็บยอดสรุปรายวันใน `analytics_daily` และทะเบียนผู้ชมแบบแฮชใน
`analytics_visitors` เพื่อให้ Dashboard แสดงยอดตลอดกาลและยอดรายสินค้าได้ แม้ลบ
`page_views` ซึ่งเป็นข้อมูลดิบหลังครบ 90 วันแล้ว

## การตั้งค่า

1. สร้าง Cloudflare Secret ชื่อ `ANALYTICS_CLEANUP_TOKEN` เป็นค่าสุ่มอย่างน้อย 32 ตัวอักษร
2. ตั้ง Cron ภายนอกหรือ Worker Cron ให้เรียก `POST /api/internal/analytics-retention`
   วันละครั้ง โดยส่ง `Authorization: Bearer <ANALYTICS_CLEANUP_TOKEN>`
3. ห้ามเรียกด้วย GET และห้ามเก็บ Secret ใน repository

แต่ละคำขอจะแปลงข้อมูลเก่าและลบข้อมูลดิบครั้งละไม่เกิน 5,000 แถว จึงเรียกซ้ำได้
โดยไม่ทำ migration หนักใน request ของลูกค้า หากคำตอบมี `more_backfill: true`
ให้ Cron เรียกซ้ำจนเป็น `false` ในช่วงเริ่มใช้งานครั้งแรก

การอ่านสถิติจะรวมยอดสรุปกับแถวเก่าที่ยังไม่ได้แปลงเสมอ ยอดจึงไม่หายระหว่าง
ทยอย backfill และการล้างจะลบเฉพาะแถวที่สรุปสำเร็จแล้วเท่านั้น
