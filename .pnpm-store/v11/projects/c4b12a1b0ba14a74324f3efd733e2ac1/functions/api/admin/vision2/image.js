import {requireAdmin} from '../../../_lib.js';

export async function onRequestGet(ctx){
  const auth=await requireAdmin(ctx);if(auth.error)return auth.error;
  const key=new URL(ctx.request.url).searchParams.get('key')||'';
  if(!key.startsWith(`vision2/${auth.user.id}/`))return new Response('Not found',{status:404});
  const object=await ctx.env.FILES.get(key);if(!object)return new Response('Not found',{status:404});
  const headers=new Headers();object.writeHttpMetadata(headers);headers.set('cache-control','private, max-age=3600');headers.set('etag',object.httpEtag);
  return new Response(object.body,{headers});
}
