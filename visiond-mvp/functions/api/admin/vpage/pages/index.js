import {json,requireBoss} from '../../../../_lib.js';
import {ensureDatabase} from '../../../../_schema.js';
import {validVpageSlug} from '../../../../_vpage-provisioning.js';

const headers={'cache-control':'private, no-store'};
export function savedPublicUrl(value){
  const raw=String(value||'');if(!raw||raw!==raw.trim())return null;
  try{const url=new URL(raw),slug=url.pathname.startsWith('/')?url.pathname.slice(1):'';return raw===`https://smartlinkpage.com/${slug}`&&validVpageSlug(slug)?raw:null}catch{return null}
}
export async function onRequestGet(ctx){
  await ensureDatabase(ctx.env);const auth=await requireBoss(ctx);if(auth.error)return auth.error;
  const url=new URL(ctx.request.url),rawCursor=url.searchParams.get('cursor'),limit=Math.min(24,Math.max(1,Number.parseInt(url.searchParams.get('limit'),10)||24));if(rawCursor!==null&&!/^vpl_[a-f0-9]{32}$/.test(rawCursor))return json({error:'เคอร์เซอร์ไม่ถูกต้อง'},400,headers);
  const result=rawCursor===null
    ?await ctx.env.DB.prepare("SELECT p.id,p.vpage_id,p.user_id,p.slug,p.display_name,p.public_url,p.status,u.name customer_name,u.email customer_email FROM vpage_pages p JOIN users u ON u.id=p.user_id WHERE p.domain_id='dom_smartlinkpage' AND p.status='active' AND datetime(p.expires_at)>CURRENT_TIMESTAMP ORDER BY p.id DESC LIMIT ?").bind(limit+1).all()
    :await ctx.env.DB.prepare("SELECT p.id,p.vpage_id,p.user_id,p.slug,p.display_name,p.public_url,p.status,u.name customer_name,u.email customer_email FROM vpage_pages p JOIN users u ON u.id=p.user_id WHERE p.domain_id='dom_smartlinkpage' AND p.status='active' AND datetime(p.expires_at)>CURRENT_TIMESTAMP AND p.id<? ORDER BY p.id DESC LIMIT ?").bind(rawCursor,limit+1).all();
  const rows=result.results||[],hasMore=rows.length>limit;if(hasMore)rows.pop();const items=rows.map(row=>{const saved_public_url=savedPublicUrl(row.public_url);return{...row,public_url:saved_public_url,saved_public_url}});return json({items,pagination:{limit,has_more:hasMore,next_cursor:hasMore&&items.length?items.at(-1).id:null}},200,headers);
}
