import {json} from '../../../../_lib.js';
import {ensureDatabase} from '../../../../_schema.js';
import {requireVision7User} from '../../../../_vision7_auth.js';
import {ensureVEasyRuntimeSchema} from '../../../../_veasy_runtime.js';

const headers={'cache-control':'no-store'};
const clean=(v,n=1000)=>String(v||'').trim().replace(/[\u0000-\u001f\u007f]/g,' ').replace(/\s+/g,' ').slice(0,n);

async function owner(ctx){
  await ensureDatabase(ctx.env);await ensureVEasyRuntimeSchema(ctx.env);
  const auth=await requireVision7User(ctx);if(auth.error)return{error:auth.error};
  const shop=await ctx.env.DB.prepare("SELECT id FROM veasy_shops WHERE id=? AND user_id=? AND status='active'").bind(ctx.params.shopId,auth.user.id).first();
  return shop?{auth,shop}:{error:json({error:'ไม่พบร้านที่เป็นเจ้าของ'},404,headers)};
}

async function audit(env,{shopId,contextId=null,reviewId=null,action,userId,detail=''}){
  await env.DB.prepare('INSERT INTO veasy_context_audit(id,shop_id,context_id,review_id,action,actor_user_id,detail) VALUES(?,?,?,?,?,?,?)').bind(crypto.randomUUID(),shopId,contextId,reviewId,action,userId,clean(detail,500)).run();
}

export async function onRequestGet(ctx){
  const v=await owner(ctx);if(v.error)return v.error;
  const [contexts,reviews,audits]=await Promise.all([
    ctx.env.DB.prepare("SELECT id,category,title,content,source,status,risk_flag riskFlag,created_at createdAt,updated_at updatedAt FROM veasy_sales_contexts WHERE shop_id=? ORDER BY CASE status WHEN 'review' THEN 0 WHEN 'active' THEN 1 ELSE 2 END,updated_at DESC LIMIT 300").bind(v.shop.id).all(),
    ctx.env.DB.prepare("SELECT id,question,bot_answer botAnswer,reason,risk_flag riskFlag,status,occurrences,context_id contextId,created_at createdAt,updated_at updatedAt,reviewed_at reviewedAt FROM veasy_context_reviews WHERE shop_id=? ORDER BY CASE status WHEN 'review' THEN 0 ELSE 1 END,updated_at DESC LIMIT 200").bind(v.shop.id).all(),
    ctx.env.DB.prepare("SELECT action,actor_user_id actorUserId,detail,created_at createdAt FROM veasy_context_audit WHERE shop_id=? ORDER BY created_at DESC LIMIT 50").bind(v.shop.id).all()
  ]);
  const items=contexts.results||[],reviewItems=reviews.results||[];
  return json({items,reviews:reviewItems,audit:audits.results||[],summary:{total:items.length,active:items.filter(x=>x.status==='active').length,review:reviewItems.filter(x=>x.status==='review').length}},200,headers);
}

export async function onRequestPost(ctx){
  const v=await owner(ctx);if(v.error)return v.error;
  const b=await ctx.request.json().catch(()=>({})),category=clean(b.category,80)||'ทั่วไป',title=clean(b.title,120),content=clean(b.content,1200);
  if(!title||content.length<10)return json({error:'กรอกชื่อและเนื้อหาบริบทอย่างน้อย 10 ตัวอักษร'},400,headers);
  const id=crypto.randomUUID();
  await ctx.env.DB.prepare("INSERT INTO veasy_sales_contexts(id,shop_id,category,title,content,source,status) VALUES(?,?,?,?,?,'shop','active')").bind(id,v.shop.id,category,title,content).run();
  await audit(ctx.env,{shopId:v.shop.id,contextId:id,action:'create',userId:v.auth.user.id,detail:title});
  return json({ok:true,id},201,headers);
}

export async function onRequestPatch(ctx){
  const v=await owner(ctx);if(v.error)return v.error;
  const b=await ctx.request.json().catch(()=>({}));
  if(b.action==='edit_context'){
    const id=clean(b.id,180),category=clean(b.category,80)||'ทั่วไป',title=clean(b.title,120),content=clean(b.content,1200);
    if(!id||!title||content.length<10)return json({error:'กรอกชื่อและแนวทางอย่างน้อย 10 ตัวอักษร'},400,headers);
    const result=await ctx.env.DB.prepare("UPDATE veasy_sales_contexts SET category=?,title=?,content=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND shop_id=?").bind(category,title,content,id,v.shop.id).run();
    if(!result.meta?.changes)return json({error:'ไม่พบบริบท'},404,headers);
    await audit(ctx.env,{shopId:v.shop.id,contextId:id,action:'edit_context',userId:v.auth.user.id,detail:title});
    return json({ok:true,status:'updated'},200,headers);
  }
  if(b.action==='approve_review'){
    const reviewId=clean(b.reviewId,180),category=clean(b.category,80)||'ทั่วไป',title=clean(b.title,120),content=clean(b.content,1200);
    if(!reviewId||!title||content.length<10)return json({error:'ต้องเขียนชื่อและแนวทางตอบอย่างน้อย 10 ตัวอักษรก่อนอนุมัติ'},400,headers);
    const review=await ctx.env.DB.prepare("SELECT id,status,risk_flag FROM veasy_context_reviews WHERE id=? AND shop_id=?").bind(reviewId,v.shop.id).first();
    if(!review||review.status!=='review')return json({error:'รายการนี้ไม่ได้อยู่ในคิวรอตรวจ'},409,headers);
    if(review.risk_flag)return json({error:'รายการนี้มีความเสี่ยง ต้องทิ้งและเขียนบริบทใหม่เอง'},409,headers);
    const contextId=crypto.randomUUID();
    await ctx.env.DB.batch([
      ctx.env.DB.prepare("INSERT INTO veasy_sales_contexts(id,shop_id,category,title,content,source,status) VALUES(?,?,?,?,?,'chat_review','active')").bind(contextId,v.shop.id,category,title,content),
      ctx.env.DB.prepare("UPDATE veasy_context_reviews SET status='approved',context_id=?,reviewed_by=?,reviewed_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=? AND shop_id=? AND status='review'").bind(contextId,v.auth.user.id,reviewId,v.shop.id)
    ]);
    await audit(ctx.env,{shopId:v.shop.id,contextId,reviewId,action:'approve_review',userId:v.auth.user.id,detail:title});
    return json({ok:true,contextId,status:'active'},200,headers);
  }
  if(b.action==='dismiss_review'){
    const reviewId=clean(b.reviewId,180);
    const result=await ctx.env.DB.prepare("UPDATE veasy_context_reviews SET status='dismissed',reviewed_by=?,reviewed_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=? AND shop_id=? AND status='review'").bind(v.auth.user.id,reviewId,v.shop.id).run();
    if(!result.meta?.changes)return json({error:'ไม่พบรายการรอตรวจ'},404,headers);
    await audit(ctx.env,{shopId:v.shop.id,reviewId,action:'dismiss_review',userId:v.auth.user.id});
    return json({ok:true,status:'dismissed'},200,headers);
  }
  const id=clean(b.id,180),status=['active','disabled'].includes(b.status)?b.status:null;
  if(!id||!status)return json({error:'คำสั่งไม่ถูกต้อง'},400,headers);
  const result=await ctx.env.DB.prepare("UPDATE veasy_sales_contexts SET status=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND shop_id=?").bind(status,id,v.shop.id).run();
  if(!result.meta?.changes)return json({error:'ไม่พบบริบท'},404,headers);
  await audit(ctx.env,{shopId:v.shop.id,contextId:id,action:status,userId:v.auth.user.id});
  return json({ok:true,status},200,headers);
}

export async function onRequestDelete(ctx){
  const v=await owner(ctx);if(v.error)return v.error;
  const id=clean(new URL(ctx.request.url).searchParams.get('id'),180),row=await ctx.env.DB.prepare("SELECT source,title FROM veasy_sales_contexts WHERE id=? AND shop_id=?").bind(id,v.shop.id).first();
  if(!row)return json({error:'ไม่พบบริบท'},404,headers);
  if(row.source==='system')return json({error:'บริบทระบบลบไม่ได้ แต่ปิดใช้ได้'},409,headers);
  await ctx.env.DB.prepare("DELETE FROM veasy_sales_contexts WHERE id=? AND shop_id=?").bind(id,v.shop.id).run();
  await audit(ctx.env,{shopId:v.shop.id,contextId:id,action:'delete',userId:v.auth.user.id,detail:row.title});
  return json({ok:true},200,headers);
}
