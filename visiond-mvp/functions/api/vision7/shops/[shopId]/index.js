import {json} from '../../../../_lib.js';
import {ensureDatabase} from '../../../../_schema.js';
import {requireVision7User} from '../../../../_vision7_auth.js';
import {cleanCatalogSlug,cleanShopName,ensureVEasyShopSchema} from '../../../../_veasy_shop.js';
const noStore={'cache-control':'no-store'};
const owned=(env,id,userId)=>env.DB.prepare("SELECT id,name,slug,status FROM veasy_shops WHERE id=? AND user_id=?").bind(id,userId).first();
export async function onRequestGet(ctx){await ensureDatabase(ctx.env);await ensureVEasyShopSchema(ctx.env);const auth=await requireVision7User(ctx);if(auth.error)return auth.error;const shop=await owned(ctx.env,ctx.params.shopId,auth.user.id);return shop?json({item:shop},200,noStore):json({error:'ไม่พบร้านที่เป็นเจ้าของ',code:'VEASY_SHOP_NOT_OWNED'},404,noStore)}
export async function onRequestPatch(ctx){
  await ensureDatabase(ctx.env);await ensureVEasyShopSchema(ctx.env);const auth=await requireVision7User(ctx);if(auth.error)return auth.error;
  const current=await owned(ctx.env,ctx.params.shopId,auth.user.id);if(!current)return json({error:'ไม่พบร้านที่เป็นเจ้าของ',code:'VEASY_SHOP_NOT_OWNED'},404,noStore);
  const body=await ctx.request.json().catch(()=>({})),name=cleanShopName(body.name),slug=cleanCatalogSlug(body.slug);
  if(name.length<2||slug.length<2)return json({error:'กรุณากรอกชื่อร้านและ Slug อย่างน้อย 2 ตัวอักษร',code:'VEASY_SHOP_PROFILE_INVALID'},400,noStore);
  try{await ctx.env.DB.prepare('UPDATE veasy_shops SET name=?,slug=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND user_id=?').bind(name,slug,current.id,auth.user.id).run()}catch{return json({error:'Slug ร้านนี้ถูกใช้งานแล้ว กรุณาเลือกชื่ออื่น',code:'VEASY_SHOP_SLUG_CONFLICT'},409,noStore)}
  return json({ok:true,item:{id:current.id,name,slug,status:current.status},storefront_path:`/veasy/${slug}/หมวด/สินค้า`},200,noStore);
}
