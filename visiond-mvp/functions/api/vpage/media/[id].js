import {currentUser} from '../../../_lib.js';
import {committedVpageMedia,ownedVpageMedia,reconcilePendingVpageMedia,reconcileVpageMediaActiveSet,validVpageMediaId} from '../../../_vpage-media.js';

const missing=()=>new Response('Not found',{status:404,headers:{'cache-control':'private, no-store','x-content-type-options':'nosniff'}});
async function serve(ctx,head=false){
  const id=String(ctx.params?.id||'');if(!validVpageMediaId(id)||!ctx.env.FILES)return missing();
  let row=await committedVpageMedia(ctx.env,id);if(!row){const user=await currentUser(ctx,{includeCourseOwner:false});if(user)row=await ownedVpageMedia(ctx.env,id,user.id)}if(!row){await reconcilePendingVpageMedia(ctx.env,id,new URL(ctx.request.url).origin);await reconcileVpageMediaActiveSet(ctx.env,id);row=await committedVpageMedia(ctx.env,id)}if(!row)return missing();
  const object=head?await ctx.env.FILES.head(row.object_key):await ctx.env.FILES.get(row.object_key);if(!object||Number(object.size)!==Number(row.file_size)||object.customMetadata?.sha256!==row.content_hash||object.httpMetadata?.contentType!==row.mime_type)return missing();const headers=new Headers({'content-type':row.mime_type,'content-length':String(row.file_size),'cache-control':'private, no-store','x-content-type-options':'nosniff','cross-origin-resource-policy':'cross-origin'});if(object.httpEtag)headers.set('etag',object.httpEtag);return new Response(head?null:object.body,{status:200,headers});
}
export const onRequestGet=ctx=>serve(ctx,false);
export const onRequestHead=ctx=>serve(ctx,true);
