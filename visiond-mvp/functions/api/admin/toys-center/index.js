import {json,requireAdmin} from '../../../_lib.js';
import {clean,cleanupToyImages,publicProduct,putToyImage,putToyImages,readToyImage,resolveToyCoverIndex,toyProductFields} from '../../../_toys_center.js';
import {draftGallery,draftGroup,draftRow} from '../../../_toys_center_drafts.js';
import {stockStore,storeSettings} from '../../../_stock.js';
import {prepareZonePlan,zoneInsertStatements} from '../../../_toys_center_zones.js';

const headers={'cache-control':'private, no-store'};
const auth=async ctx=>{const result=await requireAdmin(ctx);return result.error?{error:result.error}:result};
const badStore=()=>json({error:'ร้านไม่ถูกต้อง'},400,headers);
const cursorEncode=row=>btoa(JSON.stringify([row.updated_at,row.id]));
function cursorDecode(raw){if(!raw)return null;try{const value=JSON.parse(atob(raw));return typeof value[0]==='string'&&Number.isSafeInteger(value[1])&&value[1]>0?value:false}catch{return false}}

export async function onRequestGet(ctx){
  const a=await auth(ctx);if(a.error)return a.error;
  const u=new URL(ctx.request.url),store=stockStore(ctx.request.url);if(!store)return badStore();
  const q=clean(u.searchParams.get('q'),100),cursor=cursorDecode(u.searchParams.get('cursor'));
  if(cursor===false)return json({error:'cursor ไม่ถูกต้อง'},400,headers);
  const limit=24,cursorSql=cursor?' AND (p.updated_at<? OR (p.updated_at=? AND p.id<?))':'',upper=q+'\uffff';
  const source=q?`(SELECT id FROM toys_center_products INDEXED BY idx_stock_store_title WHERE store_id=? AND title COLLATE NOCASE>=? AND title COLLATE NOCASE<? UNION SELECT id FROM toys_center_products INDEXED BY idx_stock_store_meta_id WHERE store_id=? AND meta_id COLLATE NOCASE>=? AND meta_id COLLATE NOCASE<?) matches JOIN toys_center_products p ON p.id=matches.id`:'toys_center_products p';
  const bindings=q?[store.id,q,upper,store.id,q,upper]:[store.id];
  bindings.push(...(cursor?[cursor[0],cursor[0],cursor[1]]:[]),limit+1);
  const [settings,count,rows]=await Promise.all([
    ctx.env.DB.prepare('SELECT storefront_mode,page_id,page_name,catalog_id,catalog_name FROM stock_store_settings WHERE store_id=?').bind(store.id).first(),
    q?ctx.env.DB.prepare(`SELECT COUNT(*) total FROM (SELECT id FROM toys_center_products INDEXED BY idx_stock_store_title WHERE store_id=? AND title COLLATE NOCASE>=? AND title COLLATE NOCASE<? UNION SELECT id FROM toys_center_products INDEXED BY idx_stock_store_meta_id WHERE store_id=? AND meta_id COLLATE NOCASE>=? AND meta_id COLLATE NOCASE<?)`).bind(store.id,q,upper,store.id,q,upper).first():ctx.env.DB.prepare('SELECT COUNT(*) total FROM toys_center_products WHERE store_id=?').bind(store.id).first(),
    ctx.env.DB.prepare(`SELECT p.*,i.id primary_image_id,i.position primary_image_position FROM ${source} LEFT JOIN toys_center_product_images i ON i.id=COALESCE((SELECT selected.id FROM toys_center_product_images selected WHERE selected.product_id=p.id AND selected.image_key=p.image_1_key ORDER BY selected.position LIMIT 1),(SELECT fallback.id FROM toys_center_product_images fallback WHERE fallback.product_id=p.id AND fallback.position=0 LIMIT 1)) WHERE ${q?'1=1':'p.store_id=?'}${cursorSql} ORDER BY p.updated_at DESC,p.id DESC LIMIT ?`).bind(...bindings).all()
  ]);
  const found=rows.results||[],items=found.slice(0,limit),last=items.at(-1);
  return json({store,settings:storeSettings(settings,store),items:items.map(row=>publicProduct(row,u.origin,{includeMeta:true,admin:true})),pagination:{limit,total:Number(count?.total||0),next_cursor:found.length>limit&&last?cursorEncode(last):null},permissions:{can_manage_orders:a.user.role==='boss'&&store.id==='toys-center'}},200,headers);
}

export async function onRequestPost(ctx){
  const a=await auth(ctx);if(a.error)return a.error;
  if(!ctx.env.FILES)return json({error:'ยังไม่ได้เชื่อมพื้นที่เก็บรูป FILES'},503,headers);
  const form=await ctx.request.formData(),store=stockStore(ctx.request.url,{defaultStore:String(form.get('store_id')||'toys-center')});
  if(!store||String(form.get('store_id')||store.id)!==store.id)return badStore();
  const draftId=String(form.get('draft_id')||''),draft=draftId&&/^\d+$/.test(draftId)?await draftRow(ctx,draftId,store.id):null;
  if(draftId&&!draft)return json({error:'ไม่พบร่างสินค้า'},404,headers);
  const f=toyProductFields(form),files=form.getAll('image_1').filter(file=>file instanceof File&&file.size),metaFiles=form.getAll('image_2').filter(file=>file instanceof File&&file.size),savedGallery=draft?draftGallery(draft):[],count=files.length||savedGallery.length;
  if(!form.has('zone_plan')&&(!count||count>10||files.length>10))return json({error:'รูปสำหรับ VisionD ต้องมี 1–10 รูป'},400,headers);
  if(metaFiles.length>1)return json({error:'รูป Meta เลือกได้เพียง 1 รูป'},400,headers);
  const metaSource=form.get('meta_source');
  if(metaSource!==null&&!['cover','upload'].includes(metaSource))return json({error:'วิธีเลือกรูป Meta ไม่ถูกต้อง'},400,headers);
  if(!form.has('zone_plan')&&!metaFiles.length&&metaSource==='upload'&&!draft?.meta_key)return json({error:'กรุณาอัปโหลดรูป Meta แยก'},400,headers);
  if([f.shopeeWeightG,f.shopeePackageWidthMm,f.shopeePackageLengthMm,f.shopeePackageHeightMm].some(value=>value===-1))return json({error:'น้ำหนักหรือขนาดพัสดุไม่ถูกต้อง'},400,headers);
  if(!f.metaId||!f.title||!f.description||!f.brand||String(form.get('price')??'').trim()===''||f.priceCents<0||f.costCents<0)return json({error:'กรุณากรอก ID ชื่อ รายละเอียด ราคา และแบรนด์ให้ถูกต้อง'},400,headers);
  if(form.has('zone_plan')){
    let prepared,committed=false;
    try{
      prepared=await prepareZonePlan(ctx,form,undefined,draft);
      const {final,coverIndex}=prepared,cover=final.visiond[coverIndex].key,meta=final.meta[0].key;
      const insert=ctx.env.DB.prepare(`INSERT INTO toys_center_products(store_id,meta_id,slug,title,description,availability,condition,price_cents,cost_cents,brand,product_line,series,quantity,image_1_key,image_2_key,google_product_category,fb_product_category,gtin,item_group_id,color,size,material,pattern,age_group,gender,product_tags,shopee_weight_g,shopee_package_width_mm,shopee_package_length_mm,shopee_package_height_mm,status,created_by) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(store.id,f.metaId,f.slug,f.title,f.description,f.availability,f.condition,f.priceCents,f.costCents,f.brand,f.productLine,f.series,f.quantity,cover,meta,f.google,f.facebook,f.gtin,f.group,f.color,f.size,f.material,f.pattern,f.age,f.gender,f.tags,f.shopeeWeightG,f.shopeePackageWidthMm,f.shopeePackageLengthMm,f.shopeePackageHeightMm,f.status,a.user.id);
      const statements=[insert,...zoneInsertStatements(ctx,{store:store.id,metaId:f.metaId},final)];
      if(draft)statements.push(ctx.env.DB.prepare('DELETE FROM toys_center_form_drafts WHERE id=? AND store_id=?').bind(draft.id,store.id));
      const result=await ctx.env.DB.batch(statements);const id=result[0]?.meta?.last_row_id;
      if(!id)throw new Error('สร้างสินค้าไม่สำเร็จ');
      committed=true;
      if(draft){const kept=new Set(Object.values(final).flat().map(item=>item.key));await cleanupToyImages(ctx,[...savedGallery,...draftGroup(draft),draft.meta_key].filter(key=>key&&!kept.has(key)))}
      return json({ok:true,id,message:`เพิ่มสินค้า ${store.name} สำเร็จ`},201,headers);
    }catch(error){if(prepared&&!committed)await cleanupToyImages(ctx,prepared.newKeys);return json({error:/unique/i.test(String(error))?'ID หรือ slug สินค้านี้มีอยู่แล้ว':String(error.message||error)},/unique/i.test(String(error))?409:400,headers)}
  }
  const coverIndex=resolveToyCoverIndex(form,count,draft?.cover_index||0);if(coverIndex<0)return json({error:'รูปปก VisionD ไม่ถูกต้อง'},400,headers);
  let galleryKeys=[],uploadedMetaKey='';
  try{
    const [gallery,meta]=await Promise.all([Promise.all(files.map((file,index)=>readToyImage(file,`VisionD ${index+1}`))),readToyImage(metaFiles[0],'Meta',{required:false})]);
    galleryKeys=gallery.length?await putToyImages(ctx,gallery,'visiond'):savedGallery;
    uploadedMetaKey=meta?await putToyImage(ctx.env,meta,'meta'):'';
    const metaKey=uploadedMetaKey||(metaSource==='upload'||metaSource===null&&draft?.meta_key?draft?.meta_key:'')||galleryKeys[coverIndex];
    const insert=ctx.env.DB.prepare(`INSERT INTO toys_center_products(store_id,meta_id,slug,title,description,availability,condition,price_cents,cost_cents,brand,product_line,series,quantity,image_1_key,image_2_key,google_product_category,fb_product_category,gtin,item_group_id,color,size,material,pattern,age_group,gender,product_tags,shopee_weight_g,shopee_package_width_mm,shopee_package_length_mm,shopee_package_height_mm,status,created_by) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(store.id,f.metaId,f.slug,f.title,f.description,f.availability,f.condition,f.priceCents,f.costCents,f.brand,f.productLine,f.series,f.quantity,galleryKeys[coverIndex],metaKey,f.google,f.facebook,f.gtin,f.group,f.color,f.size,f.material,f.pattern,f.age,f.gender,f.tags,f.shopeeWeightG,f.shopeePackageWidthMm,f.shopeePackageLengthMm,f.shopeePackageHeightMm,f.status,a.user.id);
    const children=galleryKeys.map((key,position)=>ctx.env.DB.prepare('INSERT INTO toys_center_product_images(product_id,position,image_key) SELECT id,?,? FROM toys_center_products WHERE store_id=? AND meta_id=?').bind(position,key,store.id,f.metaId));
    const statements=[insert,...children,ctx.env.DB.prepare("INSERT INTO toys_center_zone_images(product_id,zone,position,image_key) SELECT id,'meta',0,? FROM toys_center_products WHERE store_id=? AND meta_id=?").bind(metaKey,store.id,f.metaId)];if(draft)statements.push(ctx.env.DB.prepare('DELETE FROM toys_center_form_drafts WHERE id=? AND store_id=?').bind(draft.id,store.id));
    const result=await ctx.env.DB.batch(statements);
    if(draft)await cleanupToyImages(ctx,[...savedGallery.filter(key=>!galleryKeys.includes(key)&&key!==metaKey),...(draft.meta_key&&draft.meta_key!==metaKey&&!galleryKeys.includes(draft.meta_key)?[draft.meta_key]:[])]);
    return json({ok:true,id:result[0]?.meta?.last_row_id,message:`เพิ่มสินค้า ${store.name} สำเร็จ`},201,headers);
  }catch(error){await cleanupToyImages(ctx,[...(files.length?galleryKeys:[]),uploadedMetaKey]);return json({error:/unique/i.test(String(error))?'ID หรือ slug สินค้านี้มีอยู่แล้ว':String(error.message||error)},/unique/i.test(String(error))?409:400,headers)}
}

export async function onRequestPatch(ctx){
  const a=await auth(ctx);if(a.error)return a.error;const store=stockStore(ctx.request.url);if(!store)return badStore();
  const body=await ctx.request.json().catch(()=>({})),mode=body.storefront_mode==='public'?'public':body.storefront_mode==='unlisted'?'unlisted':'';
  if(!mode)return json({error:'สถานะหน้าร้านไม่ถูกต้อง'},400,headers);
  await ctx.env.DB.prepare('UPDATE stock_store_settings SET storefront_mode=?,updated_by=?,updated_at=CURRENT_TIMESTAMP WHERE store_id=?').bind(mode,a.user.id,store.id).run();
  if(store.id==='toys-center')await ctx.env.DB.prepare('UPDATE toys_center_settings SET storefront_mode=?,updated_by=?,updated_at=CURRENT_TIMESTAMP WHERE id=1').bind(mode,a.user.id).run();
  return json({ok:true,storefront_mode:mode,message:mode==='public'?'เปิดให้ค้นหาหน้าร้านแล้ว':'ซ่อนจากการค้นหาแล้ว; URL และฟีดยังเปิดอยู่'},200,headers);
}
