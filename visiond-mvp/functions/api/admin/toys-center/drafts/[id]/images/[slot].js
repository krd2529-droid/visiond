import {json,requireAdmin} from '../../../../../../_lib.js';
import {stockStore} from '../../../../../../_stock.js';
import {draftGallery,draftGroup,draftRow} from '../../../../../../_toys_center_drafts.js';

export async function onRequestGet(ctx){
  const auth=await requireAdmin(ctx);if(auth.error)return auth.error;
  const store=stockStore(ctx.request.url);if(!store)return json({error:'ร้านไม่ถูกต้อง'},400,{'cache-control':'private, no-store'});
  const row=await draftRow(ctx,ctx.params.id,store.id);if(!row)return json({error:'ไม่พบร่างสินค้า'},404,{'cache-control':'private, no-store'});
  const gallery=draftGallery(row),slot=String(ctx.params.slot),group=slot.match(/^group-(?:0|[1-9]\d*)$/),key=slot==='meta'?row.meta_key:group?draftGroup(row)[Number(slot.slice(6))]:/^(?:0|[1-9]\d*)$/.test(slot)?gallery[Number(slot)]:'';
  if(!key)return json({error:'ไม่พบรูป'},404,{'cache-control':'private, no-store'});
  const object=await ctx.env.FILES.get(key);if(!object)return json({error:'ไม่พบรูป'},404,{'cache-control':'private, no-store'});
  return new Response(object.body,{headers:{'content-type':object.httpMetadata?.contentType||'application/octet-stream','cache-control':'private, no-store','x-content-type-options':'nosniff'}});
}
