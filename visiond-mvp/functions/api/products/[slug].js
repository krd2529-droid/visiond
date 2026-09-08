import {cookie,json} from '../../_lib.js';
import {ensureDatabase} from '../../_schema.js';
import {loadPromotion,promotionPrice} from '../../_promotion.js';
import {basketVisible,loadBasketVisibility,loadDigitalStorefrontPaused} from '../../_basket_visibility.js';

const catalogProducts=[1,2,3,4].map(number=>({
  slug:`dinosaur-coloring-200-set-${number}`,
  title:`ชุดรวมระบายสีไดโนเสาร์ 200 แผ่นชุดที่ ${number}`,
  short_description:'ชุดระบายสีไดโนเสาร์ · 200 แผ่น',
  description:'ไฟล์ PDF ขนาด A4 รวมภาพระบายสีไดโนเสาร์ 200 แผ่น พร้อมพิมพ์ เหมาะสำหรับเด็ก ครอบครัว ห้องเรียน และกิจกรรมสร้างสรรค์',
  price:19900,
  cover_url:`/assets/dinosaur-set-${number}.jpeg`,
  category:'dinosaur',
  pages:200
}));

export async function onRequestGet(ctx){
  await ensureDatabase(ctx.env);
  const storefrontPaused=await loadDigitalStorefrontPaused(ctx.env);
  let item=await ctx.env.DB.prepare("SELECT * FROM products WHERE slug=? COLLATE NOCASE AND status='published' AND deleted_at IS NULL LIMIT 1").bind(ctx.params.slug).first();
  if(!item)item=await ctx.env.DB.prepare("SELECT p.* FROM product_slug_history h JOIN products p ON p.id=h.product_id WHERE h.old_slug=? COLLATE NOCASE AND p.status='published' AND p.deleted_at IS NULL LIMIT 1").bind(ctx.params.slug).first();
  if(item&&storefrontPaused&&String(item.product_kind||'product')==='product'&&item.category!=='resale-rights'&&item.slug!=='course-selling-rights'){
    const sessionId=cookie(ctx.request,'vd_session'),owned=sessionId?await ctx.env.DB.prepare("SELECT 1 FROM sessions s WHERE s.id=? AND s.expires_at>datetime('now') AND (EXISTS(SELECT 1 FROM entitlements e WHERE e.user_id=s.user_id AND e.product_id=? AND e.active=1) OR EXISTS(SELECT 1 FROM category_memberships cm WHERE cm.user_id=s.user_id AND cm.category_slug=? AND cm.active=1 AND cm.expires_at>CURRENT_TIMESTAMP)) LIMIT 1").bind(sessionId,item.id,item.category).first():null;
    if(!owned)return json({error:'หน้าร้านไฟล์ดิจิทัลปิดปรับปรุงชั่วคราว',storefront_closed:true},503,{'cache-control':'private, no-store'});
  }
  if(item&&!basketVisible(item.title,await loadBasketVisibility(ctx.env)))item=null;
  if(!item)return json({error:'ไม่พบสินค้า'},404);
  if(item){const category=await ctx.env.DB.prepare('SELECT c.name,c.file_type,p.name parent_name FROM categories c LEFT JOIN categories p ON p.slug=c.parent_slug WHERE c.slug=?').bind(item.category).first();item.category_label=category?.parent_name?`${category.parent_name} > ${category.name}`:category?.name||item.category;item.file_type=item.file_type||category?.file_type||'ไฟล์ดิจิทัล';try{item.preview_urls=JSON.parse(item.preview_urls||'[]')}catch(error){item.preview_urls=[]}if(!item.preview_urls.length&&item.cover_url)item.preview_urls=[item.cover_url]}
  if(item)item=promotionPrice(item,await loadPromotion(ctx.env));
  return item?json({item}):json({error:'ไม่พบสินค้า'},404);
}
