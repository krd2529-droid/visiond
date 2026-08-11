import {json,requireAdmin} from '../../../_lib.js';
import {ensureDatabase} from '../../../_schema.js';
import {securityLog} from '../../../_security.js';

const MAX_BATCH=100;
const autoNote=reasons=>`ตรวจอัตโนมัติไม่ผ่าน: ${reasons.join(' · ')}`.slice(0,500);

async function markChanges(env,course,note){
  const results=await env.DB.batch([
    env.DB.prepare("UPDATE courses SET review_status='changes_requested',review_note=?,active=0,updated_at=CURRENT_TIMESTAMP WHERE id=? AND product_id=? AND course_origin='seller_rights' AND review_status='pending'").bind(note,course.id,course.product_id),
    env.DB.prepare("UPDATE products SET status='draft',updated_at=CURRENT_TIMESTAMP WHERE id=? AND EXISTS(SELECT 1 FROM courses c WHERE c.id=? AND c.product_id=products.id AND c.review_status='changes_requested')").bind(course.product_id,course.id)
  ]);
  return Number(results?.[0]?.meta?.changes||0)===1;
}

async function approve(env,course,actorId){
  const results=await env.DB.batch([
    env.DB.prepare("UPDATE courses SET review_status='approved',review_note='',approved_at=CURRENT_TIMESTAMP,approved_by=?,active=1,updated_at=CURRENT_TIMESTAMP WHERE id=? AND product_id=? AND course_origin='seller_rights' AND review_status='pending'").bind(actorId,course.id,course.product_id),
    env.DB.prepare("UPDATE products SET status='published',updated_at=CURRENT_TIMESTAMP WHERE id=? AND deleted_at IS NULL AND EXISTS(SELECT 1 FROM courses c WHERE c.id=? AND c.product_id=products.id AND c.review_status='approved')").bind(course.product_id,course.id)
  ]);
  return Number(results?.[0]?.meta?.changes||0)===1&&Number(results?.[1]?.meta?.changes||0)===1;
}

export async function onRequestPost(ctx){
  await ensureDatabase(ctx.env);
  const auth=await requireAdmin(ctx);if(auth.error)return auth.error;
  if(auth.user.role!=='boss')return json({error:'เฉพาะ Boss ใช้การอนุมัติคอร์สอัตโนมัติได้'},403);
  const rows=await ctx.env.DB.prepare(`SELECT c.id,c.product_id,c.owner_user_id,c.license_entitlement_id,c.basket_binding_locked,c.submitted_at,c.expected_episodes,p.title,p.cover_url,p.deleted_at,
    (SELECT COUNT(*) FROM course_lessons l WHERE l.course_id=c.id) lesson_count,
    (SELECT COUNT(*) FROM course_lessons l WHERE l.course_id=c.id AND (TRIM(COALESCE(l.title,''))='' OR (l.video_key IS NULL AND l.pdf_key IS NULL AND NOT EXISTS(SELECT 1 FROM course_lesson_files f WHERE f.lesson_id=l.id)))) incomplete_lesson_count
    FROM courses c JOIN products p ON p.id=c.product_id
    WHERE c.course_type='online_course' AND c.course_origin='seller_rights' AND c.review_status='pending'
    ORDER BY c.submitted_at,c.id LIMIT ?`).bind(MAX_BATCH).all();
  const summary={checked:0,approved:0,not_approved:0,skipped:0,errors:0,items:[]};
  for(const course of rows.results||[]){
    summary.checked++;
    const required=Math.max(1,Number(course.expected_episodes)||1),actual=Number(course.lesson_count)||0,incomplete=Number(course.incomplete_lesson_count)||0,reasons=[];
    if(course.license_entitlement_id===null||!Number(course.basket_binding_locked)||!course.submitted_at)reasons.push('ยังไม่ได้ผูกสิทธิ์และส่งเผยแพร่ครบขั้นตอน');
    if(course.deleted_at)reasons.push('ตะกร้าถูกลบแล้ว');
    if(!String(course.title||'').trim())reasons.push('ไม่มีชื่อคอร์ส');
    if(!String(course.cover_url||'').trim())reasons.push('ไม่มีรูปปก');
    if(actual!==required)reasons.push(`จำนวน EP ไม่ครบ ${actual}/${required}`);
    if(incomplete)reasons.push(`มี ${incomplete} EP ที่ขาดชื่อหรือไฟล์เรียน`);
    try{
      if(reasons.length){
        const changed=await markChanges(ctx.env,course,autoNote(reasons));
        if(changed){summary.not_approved++;summary.items.push({id:course.id,result:'not_approved',reasons})}
        else{summary.skipped++;summary.items.push({id:course.id,result:'skipped',reasons:['สถานะถูกเปลี่ยนโดยผู้ตรวจคนอื่น']})}
        continue;
      }
      if(await approve(ctx.env,course,auth.user.id)){summary.approved++;summary.items.push({id:course.id,result:'approved'})}
      else{
        const current=await ctx.env.DB.prepare('SELECT review_status FROM courses WHERE id=?').bind(course.id).first();
        if(current?.review_status==='pending'&&await markChanges(ctx.env,course,autoNote(['ระบบไม่สามารถยืนยันการเปิดขายได้ กรุณาตรวจและส่งใหม่']))){summary.not_approved++;summary.items.push({id:course.id,result:'not_approved',reasons:['เปิดขายไม่สำเร็จ']})}
        else{summary.skipped++;summary.items.push({id:course.id,result:'skipped',reasons:['สถานะถูกเปลี่ยนแล้ว']})}
      }
    }catch(error){
      summary.errors++;summary.items.push({id:course.id,result:'error',reasons:['ระบบฐานข้อมูลขัดข้อง']});
    }
  }
  const remaining=await ctx.env.DB.prepare("SELECT COUNT(*) count FROM courses WHERE course_type='online_course' AND course_origin='seller_rights' AND review_status='pending'").first();
  summary.remaining_pending=Number(remaining?.count)||0;
  await securityLog(ctx.env,ctx.request,'seller_course_auto_review','info',`checked=${summary.checked};approved=${summary.approved};not_approved=${summary.not_approved};skipped=${summary.skipped};errors=${summary.errors}`,auth.user.id);
  return json({ok:true,summary,message:`ตรวจ ${summary.checked} ตะกร้า · อนุมัติ ${summary.approved} · ไม่อนุมัติ ${summary.not_approved} · ข้าม ${summary.skipped} · ผิดพลาด ${summary.errors}`});
}
