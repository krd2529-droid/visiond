import {json,requireBoss} from '../../../_lib.js';
import {ensureDatabase} from '../../../_schema.js';

export async function onRequestGet(ctx){
  await ensureDatabase(ctx.env);const auth=await requireBoss(ctx);if(auth.error)return auth.error;
  const q=String(new URL(ctx.request.url).searchParams.get('q')||'').trim();if(!q||q.length>160)return json({error:'กรอก ID, Username หรืออีเมลของลูกค้า'},400,{'cache-control':'private, no-store'});
  const numeric=/^\d+$/.test(q)&&Number.isSafeInteger(Number(q))?Number(q):null;
  if(numeric){const result=await ctx.env.DB.prepare("SELECT id,name,email,username FROM users WHERE id=? AND role IN ('user','customer') LIMIT 1").bind(numeric).all();return json({items:result.results||[]},200,{'cache-control':'private, no-store'})}
  const usernameResult=await ctx.env.DB.prepare("SELECT id,name,email,username FROM users WHERE username=? COLLATE NOCASE AND role IN ('user','customer') LIMIT 2").bind(q).all();
  const emailResult=await ctx.env.DB.prepare("SELECT id,name,email,username FROM users WHERE email=? COLLATE NOCASE AND role IN ('user','customer') LIMIT 2").bind(q).all(),items=[];
  for(const item of [...(usernameResult.results||[]),...(emailResult.results||[])])if(!items.some(existing=>Number(existing.id)===Number(item.id)))items.push(item);
  return json({items:items.slice(0,4)},200,{'cache-control':'private, no-store'});
}
