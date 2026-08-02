import {json,requireAdmin} from '../../_lib.js';
export async function onRequestGet(ctx){
  const a=await requireAdmin(ctx); if(a.error)return a.error;
  const {results}=await ctx.env.DB.prepare(`SELECT id,email,username,name,role,created_at FROM users ORDER BY CASE role WHEN 'boss' THEN 1 WHEN 'admin' THEN 2 ELSE 3 END,id DESC`).all();
  return json({viewer:a.user,items:results});
}
