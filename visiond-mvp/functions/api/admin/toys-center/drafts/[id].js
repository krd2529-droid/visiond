import {json,requireAdmin} from '../../../../_lib.js';
import {stockStore} from '../../../../_stock.js';
import {cleanupToyImages} from '../../../../_toys_center.js';
import {draftData,draftGallery,draftGroup,draftRow,saveDraft} from '../../../../_toys_center_drafts.js';

const headers={'cache-control':'private, no-store'};
async function authorized(ctx){const auth=await requireAdmin(ctx);if(auth.error)return{error:auth.error};const store=stockStore(ctx.request.url);if(!store)return{error:json({error:'ร้านไม่ถูกต้อง'},400,headers)};const row=await draftRow(ctx,ctx.params.id,store.id);return row?{auth,store,row}:{error:json({error:'ไม่พบร่างสินค้า'},404,headers)}}
export async function onRequestGet(ctx){const result=await authorized(ctx);if(result.error)return result.error;return json(draftData(result.row),200,headers)}
export async function onRequestPut(ctx){const result=await authorized(ctx);if(result.error)return result.error;const form=await ctx.request.formData();if(String(form.get('store_id')||result.store.id)!==result.store.id)return json({error:'ร้านไม่ถูกต้อง'},400,headers);try{await saveDraft(ctx,form,result.store,result.auth.user,result.row);return json({ok:true,id:result.row.id,message:'บันทึกร่างแล้ว'},200,headers)}catch(error){return json({error:String(error.message||error)},400,headers)}}
export async function onRequestDelete(ctx){const result=await authorized(ctx);if(result.error)return result.error;await ctx.env.DB.prepare('DELETE FROM toys_center_form_drafts WHERE id=? AND store_id=?').bind(result.row.id,result.store.id).run();await cleanupToyImages(ctx,[...draftGallery(result.row),...draftGroup(result.row),result.row.meta_key]);return json({ok:true,message:'ลบร่างแล้ว'},200,headers)}
