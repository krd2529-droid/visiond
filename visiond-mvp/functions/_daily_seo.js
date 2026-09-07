import {autoSeoDraft,ensureSalesPageSchema,salesPageSlug,seoQuality} from './_sales_pages.js';

export const DAILY_SEO_PAGE_LIMIT=5;
export function bangkokDay(now=new Date()){
  return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Bangkok',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
}

export async function createDailySeoPages(env,{now=new Date(),limit=DAILY_SEO_PAGE_LIMIT}={}){
  await ensureSalesPageSchema(env);
  const runDay=bangkokDay(now),safeLimit=Math.min(DAILY_SEO_PAGE_LIMIT,Math.max(1,Number(limit)||DAILY_SEO_PAGE_LIMIT));
  const claim=await env.DB.prepare("INSERT OR IGNORE INTO daily_seo_runs(run_day,requested_limit,status) VALUES(?,?,'running')").bind(runDay,safeLimit).run();
  if(!claim.meta?.changes){
    const previous=await env.DB.prepare('SELECT run_day,created_count,page_ids,status,completed_at FROM daily_seo_runs WHERE run_day=?').bind(runDay).first();
    if(previous?.status!=='failed')return{ok:true,already_ran:true,run_day:runDay,created_count:Number(previous?.created_count)||0,page_ids:JSON.parse(previous?.page_ids||'[]')};
    await env.DB.prepare("UPDATE daily_seo_runs SET status='running',error_code='',started_at=CURRENT_TIMESTAMP,completed_at=NULL WHERE run_day=? AND status='failed'").bind(runDay).run();
  }
  try{
    const actor=await env.DB.prepare("SELECT id FROM users WHERE role IN ('boss','admin') ORDER BY role='boss' DESC,id LIMIT 1").first();
    if(!actor)throw new Error('SEO_AUTOMATION_ACTOR_MISSING');
    const template=await env.DB.prepare("SELECT id FROM sales_page_templates WHERE page_type='seo_automation' AND status='active' ORDER BY id LIMIT 1").first();
    if(!template)throw new Error('SEO_AUTOMATION_TEMPLATE_MISSING');
    const products=(await env.DB.prepare(`SELECT p.id,p.slug,p.title,p.category,c.name category_name
      FROM products p LEFT JOIN categories c ON c.slug=p.category
      WHERE p.status='published' AND p.deleted_at IS NULL AND COALESCE(p.product_kind,'product')='product'
        AND NOT EXISTS(SELECT 1 FROM sales_page_products x JOIN sales_pages s ON s.id=x.page_id WHERE x.product_id=p.id AND s.page_type='seo_automation')
      ORDER BY p.updated_at DESC,p.id DESC LIMIT ?`).bind(safeLimit).all()).results||[];
    const pages=products.map(product=>{
      const draft=autoSeoDraft([product],product.title),slug=salesPageSlug(`แนะนำ-${product.slug||product.title}`);
      if(!seoQuality({title:draft.title,slug,content:draft.content,productCount:1}).ok)throw new Error('SEO_AUTOMATION_QUALITY_FAILED');
      return{id:`sp_${crypto.randomUUID().replaceAll('-','')}`,product,slug,title:draft.title,content:draft.content};
    });
    const statements=[];
    for(const page of pages){
      const contentJson=JSON.stringify(page.content);
      statements.push(
        env.DB.prepare("INSERT INTO sales_pages(id,page_type,template_id,slug,title,status,robots_index,content_json,revision_no,approved_revision_no,approved_by,approved_at,published_at,created_by,updated_by) VALUES(?,'seo_automation',?,?,?,'published',1,?,1,1,?,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,?,?)").bind(page.id,template.id,page.slug,page.title,contentJson,actor.id,actor.id,actor.id),
        env.DB.prepare("INSERT INTO sales_page_revisions(page_id,revision_no,title,slug,template_id,content_json,product_ids,status_before,change_note,changed_by) VALUES(?,1,?,?,?,?,?,'draft','ระบบสร้างและเผยแพร่ SEO รายวัน',?)").bind(page.id,page.title,page.slug,template.id,contentJson,JSON.stringify([page.product.id]),actor.id),
        env.DB.prepare('INSERT INTO sales_page_products(page_id,product_id,sort_order) VALUES(?,?,0)').bind(page.id,page.product.id)
      );
    }
    statements.push(env.DB.prepare("UPDATE daily_seo_runs SET status='completed',created_count=?,page_ids=?,completed_at=CURRENT_TIMESTAMP WHERE run_day=?").bind(pages.length,JSON.stringify(pages.map(page=>page.id)),runDay));
    await env.DB.batch(statements);
    return{ok:true,already_ran:false,run_day:runDay,created_count:pages.length,page_ids:pages.map(page=>page.id),slugs:pages.map(page=>page.slug)};
  }catch(error){
    const code=String(error?.message||'SEO_AUTOMATION_FAILED').slice(0,120);
    await env.DB.prepare("UPDATE daily_seo_runs SET status='failed',error_code=?,completed_at=CURRENT_TIMESTAMP WHERE run_day=?").bind(code,runDay).run().catch(()=>{});
    throw error;
  }
}
