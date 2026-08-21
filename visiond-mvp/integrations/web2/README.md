# Web 2 Integration Starter Kit

ไฟล์ `visiond-partner-client.mjs` ใช้เฉพาะ Backend ของเว็บ 2 ห้าม import เข้า Browser bundle

```js
import {VisionDPartnerClient} from './visiond-partner-client.mjs';

const visiond=new VisionDPartnerClient({
  baseUrl:process.env.VISIOND_BASE_URL,
  clientId:process.env.VISIOND_CLIENT_ID,
  clientSecret:process.env.VISIOND_CLIENT_SECRET
});

const catalog=await visiond.products({limit:50});
const detail=await visiond.product(catalog.items[0].id);
for await (const page of visiond.productPages({limit:100})) {
  // ประมวลผล page.items ทีละหน้า จน pagination.has_more เป็น false
}
await visiond.syncCustomer(customer,{idempotencyKey:`customer-${customer.id}-v1`});
await visiond.syncOrder(order,{idempotencyKey:`order-${order.id}-${order.updated_at}`});
await visiond.signedEvent({type:'order',external_id:order.external_order_id,data:order});
```

- เก็บ `.env` จริงใน Secret Manager และเพิ่มลง `.gitignore` ของเว็บ 2
- ห้าม Log config, Request headers, Signature หรือ Payload ส่วนตัว
- Retry ใช้ Idempotency Key เดิมเมื่อ Payload เดิม และสร้าง Key ใหม่เมื่อข้อมูลเปลี่ยน
- ก่อน Production ให้รัน E2E ในศูนย์ควบคุมเว็บพาร์ทเนอร์และ Security Gate ของ VisionD
