import {json,requireAdmin} from '../../../../_lib.js';
import {scopedStockProduct} from '../../../../_stock.js';
import {readProductZoneRows} from '../../../../_toys_center_zones.js';

const headers={'cache-control':'private, no-store'};
export async function onRequestGet(ctx){
  const auth=await requireAdmin(ctx);if(auth.error)return auth.error;
  if(!await scopedStockProduct(ctx))return json({error:'ไม่พบสินค้าในร้านที่เลือก'},404,headers);
  const [rows,product]=await Promise.all([
    readProductZoneRows(ctx,ctx.params.id),
    ctx.env.DB.prepare('SELECT image_1_key,image_2_key FROM toys_center_products WHERE id=?').bind(ctx.params.id).first()
  ]);
  const origin=new URL(ctx.request.url).origin,store=new URL(ctx.request.url).searchParams.get('store')||'toys-center';
  const cover=rows.visiond.find(row=>row.image_key===product.image_1_key)||rows.visiond[0];
  const gallery=rows.visiond.map(row=>({id:row.id,position:row.position,active:row.image_key===product.image_1_key,url:`${origin}/api/admin/toys-center/${encodeURIComponent(ctx.params.id)}/images/${row.position}?v=${row.id}&store=${encodeURIComponent(store)}`}));
  const other=zone=>rows[zone].map(row=>({id:row.id,position:row.position,active:zone==='meta'&&row.image_key===product.image_2_key,url:`${origin}/api/admin/toys-center/${encodeURIComponent(ctx.params.id)}/zone-images/${row.id}?store=${encodeURIComponent(store)}`}));
  return json({cover_position:cover?.position??0,has_separate_meta_upload:!rows.visiond.some(row=>row.image_key===product.image_2_key),items:gallery,zones:{visiond:gallery,meta:other('meta'),group:other('group')}},200,headers);
}
