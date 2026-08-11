import {json} from '../../../../../../_lib.js';
import {ensureDatabase} from '../../../../../../_schema.js';
import {requireVision7User} from '../../../../../../_vision7_auth.js';
import {ensureVEasyShopSchema} from '../../../../../../_veasy_shop.js';
const noStore={'cache-control':'no-store'};
export async function onRequestDelete(ctx){await ensureDatabase(ctx.env);await ensureVEasyShopSchema(ctx.env);const auth=await requireVision7User(ctx);if(auth.error)return auth.error;const row=await ctx.env.DB.prepare("SELECT p.id FROM veasy_products p JOIN veasy_shops s ON s.id=p.shop_id WHERE p.id=? AND p.shop_id=? AND s.user_id=?").bind(ctx.params.productId,ctx.params.shopId,auth.user.id).first();if(!row)return json({error:'ไม่พบสินค้าที่เป็นเจ้าของ',code:'VEASY_PRODUCT_NOT_OWNED'},404,noStore);await ctx.env.DB.prepare("UPDATE veasy_products SET status='hidden',updated_at=CURRENT_TIMESTAMP WHERE id=? AND shop_id=?").bind(row.id,ctx.params.shopId).run();return json({ok:true,id:row.id},200,noStore)}
