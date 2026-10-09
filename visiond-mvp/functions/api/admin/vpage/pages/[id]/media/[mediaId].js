import {requireBoss} from '../../../../../../_lib.js';
import {ensureDatabase} from '../../../../../../_schema.js';
import {validVpageMediaId} from '../../../../../../_vpage-media.js';

const missing=()=>new Response('Not found',{status:404,headers:{'cache-control':'private, no-store','x-content-type-options':'nosniff'}});
async function serve(ctx,head=false){
  const pageId=String(ctx.params?.id||''),mediaId=String(ctx.params?.mediaId||'');
  if(!/^vpl_[a-f0-9]{32}$/.test(pageId)||!validVpageMediaId(mediaId)||!ctx.env.FILES)return missing();
  await ensureDatabase(ctx.env);
  const auth=await requireBoss(ctx);if(auth.error)return auth.error;
  const row=await ctx.env.DB.prepare("SELECT m.object_key,m.mime_type,m.file_size,m.content_hash FROM vpage_media m JOIN vpage_pages p ON p.id=m.page_id AND p.user_id=m.owner_id JOIN vpage_media_refs r ON r.media_id=m.id AND r.page_id=p.id AND r.owner_id=m.owner_id WHERE m.id=? AND m.page_id=? AND m.state='ready' AND p.domain_id='dom_smartlinkpage' AND p.status='active' AND datetime(p.expires_at)>CURRENT_TIMESTAMP LIMIT 1").bind(mediaId,pageId).first();
  if(!row)return missing();
  const object=head?await ctx.env.FILES.head(row.object_key):await ctx.env.FILES.get(row.object_key);
  if(!object||Number(object.size)!==Number(row.file_size)||object.customMetadata?.sha256!==row.content_hash||object.httpMetadata?.contentType!==row.mime_type)return missing();
  const headers=new Headers({'content-type':row.mime_type,'content-length':String(row.file_size),'cache-control':'private, no-store','x-content-type-options':'nosniff'});
  if(object.httpEtag)headers.set('etag',object.httpEtag);
  return new Response(head?null:object.body,{status:200,headers});
}
export const onRequestGet=ctx=>serve(ctx,false);
export const onRequestHead=ctx=>serve(ctx,true);
