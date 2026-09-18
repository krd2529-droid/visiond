import {json,requireAdmin} from '../../../_lib.js';

export async function onRequestGet(ctx){
  const auth=await requireAdmin(ctx);if(auth.error)return auth.error;
  const id=Number(ctx.params.id);if(!Number.isInteger(id)||id<1)return json({error:'รหัสรูปไม่ถูกต้อง'},400,{'cache-control':'private, no-store'});
  const asset=await ctx.env.DB.prepare('SELECT id,object_key,mime_type,file_size FROM vsport_assets WHERE id=? AND owner_id=?').bind(id,auth.user.id).first();if(!asset)return json({error:'ไม่พบรูป vSport'},404,{'cache-control':'private, no-store'});
  const object=await ctx.env.FILES?.get(asset.object_key);if(!object)return json({error:'ไฟล์รูป vSport สูญหาย'},404,{'cache-control':'private, no-store'});
  const headers=new Headers();object.writeHttpMetadata(headers);headers.set('content-type',asset.mime_type);headers.set('content-length',String(asset.file_size));headers.set('cache-control','private, no-store');headers.set('content-disposition',`inline; filename="vsport-${asset.id}"`);headers.set('x-content-type-options','nosniff');return new Response(object.body,{headers});
}
