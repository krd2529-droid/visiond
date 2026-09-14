import {json} from '../../../_lib.js';
import {requireVxWorkspaceUser,vxWorkspaceOwnerId} from '../../../_vx_workspace.js';

const privateHeaders={'cache-control':'private, no-store','x-content-type-options':'nosniff'};
const missing=head=>new Response(head?null:JSON.stringify({error:'ไม่พบรูปช่อง'}),{status:404,headers:{...privateHeaders,...(head?{}:{'content-type':'application/json; charset=utf-8'})}});
const privateResponse=response=>{const headers=new Headers(response.headers);for(const [key,value] of Object.entries(privateHeaders))headers.set(key,value);return new Response(response.body,{status:response.status,statusText:response.statusText,headers})};

async function avatar(ctx,head=false){
  const auth=await requireVxWorkspaceUser(ctx,{bootstrap:false});if(auth.error)return privateResponse(auth.error);
  const id=String(ctx.params.id||''),revision=String(new URL(ctx.request.url).searchParams.get('v')||'');
  if(!/^[0-9a-f-]{36}$/i.test(id)||!/^[0-9a-f]{64}$/i.test(revision))return missing(head);
  const ownerId=vxWorkspaceOwnerId(auth),row=await ctx.env.DB.prepare(`SELECT c.avatar_object_key,c.avatar_mime_type,c.avatar_file_size,c.avatar_revision
    FROM tiktok_connections c JOIN tiktok_channels ch ON ch.id=c.channel_id AND ch.created_by=c.user_id AND ch.archived_at IS NULL
    WHERE c.id=? AND c.user_id=? AND c.status='active' AND c.avatar_object_key<>'' AND c.avatar_revision=?`).bind(id,ownerId,revision).first();
  if(!row||!['image/jpeg','image/png','image/webp'].includes(row.avatar_mime_type)||Number(row.avatar_file_size)<1||Number(row.avatar_file_size)>2097152||!ctx.env.FILES)return missing(head);
  const object=await (head?ctx.env.FILES.head(row.avatar_object_key):ctx.env.FILES.get(row.avatar_object_key)).catch(()=>null);if(!object)return missing(head);
  const objectType=String(object.httpMetadata?.contentType||'').toLowerCase(),metadata=object.customMetadata||{};
  if(objectType!==row.avatar_mime_type||Number(object.size)!==Number(row.avatar_file_size)||String(metadata.ownerUserId||'')!==String(ownerId)||String(metadata.connectionId||'')!==id||String(metadata.revision||'')!==revision)return missing(head);
  const headers=new Headers({'content-type':row.avatar_mime_type,'content-length':String(row.avatar_file_size),'cache-control':'private, no-store','x-content-type-options':'nosniff'});
  if(object.httpEtag)headers.set('etag',object.httpEtag);
  return new Response(head?null:object.body,{status:200,headers});
}

export const onRequestGet=ctx=>avatar(ctx,false);
export const onRequestHead=ctx=>avatar(ctx,true);
export {avatar};
