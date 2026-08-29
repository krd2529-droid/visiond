export const LIFETIME_MEMBER_SLUG='member-3-categories-lifetime';
export const LIFETIME_MEMBER_CATEGORIES=['development-game','worksheet','coloring'];
export const LIFETIME_MEMBER_PRICE=49900;
const ensuredDatabases=new WeakSet();

export async function ensureLifetimeMemberPlan(env){
  if(ensuredDatabases.has(env.DB))return;
  await env.DB.prepare(`INSERT INTO products(slug,title,short_description,description,price,cover_url,preview_urls,category,file_type,pages,status,source,product_kind,member_category,member_duration_months,updated_at)
    VALUES(?,?,?,?,?,?,'[]','member','Member',0,'published','member','member',?,0,CURRENT_TIMESTAMP)
    ON CONFLICT(slug) DO UPDATE SET title=excluded.title,short_description=excluded.short_description,description=excluded.description,price=excluded.price,cover_url=excluded.cover_url,status='published',product_kind='member',member_category=excluded.member_category,member_duration_months=0,updated_at=CURRENT_TIMESTAMP`)
    .bind(LIFETIME_MEMBER_SLUG,'Member 3 หมวด ตลอดชีพ','ปลดล็อกเกมเสริมพัฒนาการ แบบฝึกหัด และระบายสี ตลอดชีพ','ชำระครั้งเดียว 499 บาท ปลดล็อกสินค้าปัจจุบันและสินค้าใหม่ในหมวดเกมเสริมพัฒนาการ แบบฝึกหัด และระบายสี ตลอดชีพ',LIFETIME_MEMBER_PRICE,'/assets/member-3-categories-lifetime.svg',LIFETIME_MEMBER_CATEGORIES.join(','))
    .run();
  ensuredDatabases.add(env.DB);
}

export function memberCategories(value){return [...new Set(String(value||'').split(',').map(item=>item.trim()).filter(Boolean))]}
