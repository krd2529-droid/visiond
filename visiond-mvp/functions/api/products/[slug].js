import {json} from '../../_lib.js';

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
  let item=await ctx.env.DB.prepare("SELECT * FROM products WHERE slug=? AND status='published'").bind(ctx.params.slug).first();
  if(!item){
    const catalogItem=catalogProducts.find(product=>product.slug===ctx.params.slug);
    if(!catalogItem)return json({error:'ไม่พบสินค้า'},404);
    await ctx.env.DB.prepare(`INSERT OR IGNORE INTO products(slug,title,short_description,description,price,cover_url,category,status,source) VALUES(?,?,?,?,?,?,?,?,?)`)
      .bind(catalogItem.slug,catalogItem.title,catalogItem.short_description,catalogItem.description,catalogItem.price,catalogItem.cover_url,catalogItem.category,'published','catalog').run();
    item=await ctx.env.DB.prepare("SELECT * FROM products WHERE slug=? AND status='published'").bind(ctx.params.slug).first();
    if(item)item.pages=catalogItem.pages;
  }
  return item?json({item}):json({error:'ไม่พบสินค้า'},404);
}
