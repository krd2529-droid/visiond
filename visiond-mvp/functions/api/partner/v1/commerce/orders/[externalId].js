import {json} from '../../../../../_lib.js';
import {ensureDatabase} from '../../../../../_schema.js';
import {requirePartnerScope} from '../../../../../_partner_api.js';
import {ensurePartnerCommerceSchema} from '../../../../../_partner_commerce.js';
import {cleanId} from '../../../../../_partner_sync.js';

const headers={'cache-control':'private, no-store'};
export async function onRequestGet(ctx){await ensureDatabase(ctx.env);await ensurePartnerCommerceSchema(ctx.env);const auth=await requirePartnerScope(ctx,'commerce:read');if(auth.error)return auth.error;const externalId=cleanId(ctx.params.externalId);if(!externalId)return json({error:'EXTERNAL_ORDER_ID_INVALID',request_id:auth.requestId},400,headers);const order=await ctx.env.DB.prepare('SELECT id,external_order_id,status,currency,subtotal,discount,total,created_at,updated_at FROM partner_commerce_orders WHERE website_id=? AND external_order_id=? LIMIT 1').bind(auth.website.id,externalId).first();if(!order)return json({error:'COMMERCE_ORDER_NOT_FOUND',request_id:auth.requestId},404,headers);const items=(await ctx.env.DB.prepare('SELECT product_id,title,quantity,unit_price,line_total FROM partner_commerce_order_items WHERE order_id=? ORDER BY line_index LIMIT 100').bind(order.id).all()).results||[];return json({order:{...order,item_count:items.length,items,entitlement_ready:order.status==='fulfilled'},request_id:auth.requestId},200,{...headers,'x-request-id':auth.requestId})}
