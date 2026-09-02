import {json} from '../../_lib.js';
import {ensureDatabase} from '../../_schema.js';
import {loadPromotion,promotionPrice} from '../../_promotion.js';
import {basketVisible,loadBasketVisibility} from '../../_basket_visibility.js';

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
  let item=await ctx.env.DB.prepare("SELECT p.* FROM products p LEFT JOIN product_slug_history h ON h.product_id=p.id WHERE (p.slug=? OR h.old_slug=?) AND p.status='published' AND p.deleted_at IS NULL ORDER BY CASE WHEN p.slug=? THEN 0 ELSE 1 END LIMIT 1").bind(ctx.params.slug,ctx.params.slug,ctx.params.slug).first();
  if(item&&!basketVisible(item.title,await loadBasketVisibility(ctx.env)))item=null;
  if(!item)return json({error:'ไม่พบสินค้า'},404);
  if(item){const category=await ctx.env.DB.prepare('SELECT c.name,c.file_type,p.name parent_name FROM categories c LEFT JOIN categories p ON p.slug=c.parent_slug WHERE c.slug=?').bind(item.category).first();item.category_label=category?.parent_name?`${category.parent_name} > ${category.name}`:category?.name||item.category;item.file_type=item.file_type||category?.file_type||'ไฟล์ดิจิทัล';try{item.preview_urls=JSON.parse(item.preview_urls||'[]')}catch(error){item.preview_urls=[]}if(!item.preview_urls.length&&item.cover_url)item.preview_urls=[item.cover_url]}
  if(item)item=promotionPrice(item,await loadPromotion(ctx.env));
  return item?json({item}):json({error:'ไม่พบสินค้า'},404);
}
