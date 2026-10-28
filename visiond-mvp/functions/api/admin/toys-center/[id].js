import {json,requireAdmin} from '../../../_lib.js';
import {cleanupToyImages,putToyImage,putToyImages,readToyImage,resolveToyCoverIndex,toyProductFields} from '../../../_toys_center.js';
import {stockStore} from '../../../_stock.js';
import {shopeeDerivativeKey} from '../../../_toys_center_shopee_images.js';
import {prepareZonePlan,readProductZoneRows,removedZoneKeys,zoneInsertStatements} from '../../../_toys_center_zones.js';

const headers={'cache-control':'private, no-store'};
const missing=()=>json({error:'ไม่พบสินค้าในร้านที่เลือก'},404,headers);
async function scopedProduct(ctx){const store=stockStore(ctx.request.url);if(!store)return null;return ctx.env.DB.prepare('SELECT * FROM toys_center_products WHERE id=? AND store_id=?').bind(ctx.params.id,store.id).first()}

export async function onRequestDelete(ctx){
  const auth=await requireAdmin(ctx);if(auth.error)return auth.error;
  const row=await scopedProduct(ctx);if(!row)return missing();
  const gallery=(await ctx.env.DB.prepare('SELECT id,image_key FROM toys_center_product_images WHERE product_id=? ORDER BY position LIMIT 10').bind(row.id).all()).results||[];
  const zoneImages=(await ctx.env.DB.prepare('SELECT image_key FROM toys_center_zone_images WHERE product_id=? ORDER BY zone,position LIMIT 20').bind(row.id).all()).results||[];
  const removed=await ctx.env.DB.prepare("DELETE FROM toys_center_products WHERE id=? AND store_id=? AND NOT EXISTS(SELECT 1 FROM toys_center_orders WHERE product_id=? AND status='awaiting_payment')").bind(row.id,row.store_id,row.id).run();
  if(!Number(removed.meta?.changes))return json({error:'ยังลบสินค้านี้ไม่ได้ เพราะมีออเดอร์รอยืนยันการชำระเงิน'},409,headers);
  await cleanupToyImages(ctx,[...gallery.flatMap(item=>[item.image_key,shopeeDerivativeKey(item.id)]),...zoneImages.map(item=>item.image_key),row.image_1_key,row.image_2_key]);
  return json({ok:true,message:'ลบสินค้าแล้ว'},200,headers);
}

export async function onRequestPatch(ctx){
  const auth=await requireAdmin(ctx);if(auth.error)return auth.error;
  const row=await scopedProduct(ctx);if(!row)return missing();
  const body=await ctx.request.json().catch(()=>({})),status=body.status==='published'?'published':body.status==='draft'?'draft':'';
  if(!status)return json({error:'สถานะไม่ถูกต้อง'},400,headers);
  await ctx.env.DB.prepare('UPDATE toys_center_products SET status=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND store_id=?').bind(status,row.id,row.store_id).run();
  return json({ok:true,status,message:status==='published'?'เผยแพร่สินค้าแล้ว':'เก็บสินค้าเป็นฉบับร่างแล้ว'},200,headers);
}

export async function onRequestPut(ctx){
  const auth=await requireAdmin(ctx);if(auth.error)return auth.error;
  if(!ctx.env.FILES)return json({error:'ยังไม่ได้เชื่อมพื้นที่เก็บรูป FILES'},503,headers);
  const old=await scopedProduct(ctx);if(!old)return missing();
  const oldRows=(await ctx.env.DB.prepare('SELECT id,position,image_key FROM toys_center_product_images WHERE product_id=? ORDER BY position LIMIT 10').bind(old.id).all()).results||[];
  const oldGallery=oldRows.length?oldRows:(old.image_1_key?[{position:0,image_key:old.image_1_key}]:[]);
  const form=await ctx.request.formData();if(String(form.get('store_id')||old.store_id)!==old.store_id)return missing();
  const f=toyProductFields(form),files=form.getAll('image_1').filter(file=>file instanceof File&&file.size),metaFiles=form.getAll('image_2').filter(file=>file instanceof File&&file.size);
  if(form.get('slug')===old.slug)f.slug=old.slug;
  if(files.length>10)return json({error:'รูปสำหรับ VisionD เลือกได้สูงสุด 10 รูป'},400,headers);
  if(metaFiles.length>1)return json({error:'รูปสำหรับ Meta Catalog เลือกได้ 1 รูป'},400,headers);
  const metaSource=form.get('meta_source'),hasSeparateMeta=!oldGallery.some(item=>item.image_key===old.image_2_key);
  if(metaSource!==null&&!['cover','upload'].includes(metaSource))return json({error:'วิธีเลือกรูป Meta ไม่ถูกต้อง'},400,headers);
  if(!form.has('zone_plan')&&!metaFiles.length&&metaSource==='upload'&&!hasSeparateMeta)return json({error:'กรุณาอัปโหลดรูป Meta แยก'},400,headers);
  if([f.shopeeWeightG,f.shopeePackageWidthMm,f.shopeePackageLengthMm,f.shopeePackageHeightMm].some(value=>value===-1))return json({error:'น้ำหนักหรือขนาดพัสดุไม่ถูกต้อง'},400,headers);
  if(!f.metaId||!f.title||!f.description||!f.brand||String(form.get('price')??'').trim()===''||f.priceCents<0||f.costCents<0)return json({error:'กรุณากรอก ID ชื่อ รายละเอียด ราคา และแบรนด์ให้ถูกต้อง'},400,headers);
  if(form.has('zone_plan')){
    let prepared,committed=false;
    try{
      const previous=await readProductZoneRows(ctx,old.id);
      prepared=await prepareZonePlan(ctx,form,previous);
      const {final,coverIndex}=prepared,cover=final.visiond[coverIndex].key,meta=final.meta[0].key;
      const expected=String(form.get('image_revision')??'');if(expected!==old.image_revision)throw new Error('สินค้านี้ถูกแก้ไขจากที่อื่น กรุณาเปิดใหม่ก่อนบันทึก');
      const nextRevision=crypto.randomUUID();
      const update=ctx.env.DB.prepare(`UPDATE toys_center_products SET meta_id=?,slug=?,title=?,description=?,availability=?,condition=?,price_cents=?,cost_cents=?,brand=?,product_line=?,series=?,quantity=?,image_1_key=?,image_2_key=?,google_product_category=?,fb_product_category=?,gtin=?,item_group_id=?,color=?,size=?,material=?,pattern=?,age_group=?,gender=?,product_tags=?,shopee_weight_g=?,shopee_package_width_mm=?,shopee_package_length_mm=?,shopee_package_height_mm=?,status=?,image_revision=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND store_id=? AND image_revision=?`).bind(f.metaId,f.slug,f.title,f.description,f.availability,f.condition,f.priceCents,f.costCents,f.brand,f.productLine,f.series,f.quantity,cover,meta,f.google,f.facebook,f.gtin,f.group,f.color,f.size,f.material,f.pattern,f.age,f.gender,f.tags,f.shopeeWeightG,f.shopeePackageWidthMm,f.shopeePackageLengthMm,f.shopeePackageHeightMm,f.status,nextRevision,old.id,old.store_id,expected);
      const results=await ctx.env.DB.batch([update,ctx.env.DB.prepare('DELETE FROM toys_center_product_images WHERE product_id=? AND EXISTS(SELECT 1 FROM toys_center_products WHERE id=? AND image_revision=?)').bind(old.id,old.id,nextRevision),ctx.env.DB.prepare('DELETE FROM toys_center_zone_images WHERE product_id=? AND EXISTS(SELECT 1 FROM toys_center_products WHERE id=? AND image_revision=?)').bind(old.id,old.id,nextRevision),...zoneInsertStatements(ctx,old.id,final,nextRevision)]);
      if(!Number(results[0]?.meta?.changes))throw new Error('สินค้านี้ถูกแก้ไขจากที่อื่น กรุณาเปิดใหม่ก่อนบันทึก');
      committed=true;
      await cleanupToyImages(ctx,removedZoneKeys(previous,final,old));
      return json({ok:true,id:old.id,message:`แก้ไขสินค้า ${old.store_id==='zippo'?'Zippo':'Toys Center'} สำเร็จ`},200,headers);
    }catch(error){if(prepared&&!committed)await cleanupToyImages(ctx,prepared.newKeys);const conflict=/unique|ถูกแก้ไขจากที่อื่น/i.test(String(error));return json({error:/unique/i.test(String(error))?'ID หรือ slug สินค้านี้มีอยู่แล้ว':String(error.message||error)},conflict?409:400,headers)}
  }
  const currentIndex=Math.max(0,oldGallery.findIndex(item=>item.image_key===old.image_1_key)),coverIndex=resolveToyCoverIndex(form,files.length||oldGallery.length,files.length?0:currentIndex);
  if(coverIndex<0)return json({error:'รูปปก VisionD ไม่ถูกต้อง'},400,headers);
  let galleryKeys=[],uploadedMetaKey='';
  try{
    const [gallery,meta]=await Promise.all([Promise.all(files.map((file,index)=>readToyImage(file,`VisionD ${index+1}`))),readToyImage(metaFiles[0],'Meta',{required:false})]);
    galleryKeys=await putToyImages(ctx,gallery,'visiond');uploadedMetaKey=await putToyImage(ctx.env,meta,'meta');
    const primary=galleryKeys.length?galleryKeys[coverIndex]:oldGallery[coverIndex]?.image_key||oldGallery[0]?.image_key||old.image_1_key;
    const effectiveMetaKey=uploadedMetaKey||((metaSource==='upload'||metaSource===null&&hasSeparateMeta)?old.image_2_key:primary);
    const update=ctx.env.DB.prepare(`UPDATE toys_center_products SET meta_id=?,slug=?,title=?,description=?,availability=?,condition=?,price_cents=?,cost_cents=?,brand=?,product_line=?,series=?,quantity=?,image_1_key=?,image_2_key=?,google_product_category=?,fb_product_category=?,gtin=?,item_group_id=?,color=?,size=?,material=?,pattern=?,age_group=?,gender=?,product_tags=?,shopee_weight_g=?,shopee_package_width_mm=?,shopee_package_length_mm=?,shopee_package_height_mm=?,status=?,image_revision=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND store_id=?`).bind(f.metaId,f.slug,f.title,f.description,f.availability,f.condition,f.priceCents,f.costCents,f.brand,f.productLine,f.series,f.quantity,primary,effectiveMetaKey,f.google,f.facebook,f.gtin,f.group,f.color,f.size,f.material,f.pattern,f.age,f.gender,f.tags,f.shopeeWeightG,f.shopeePackageWidthMm,f.shopeePackageLengthMm,f.shopeePackageHeightMm,f.status,crypto.randomUUID(),old.id,old.store_id);
    const statements=[update];
    if(galleryKeys.length)statements.push(ctx.env.DB.prepare('DELETE FROM toys_center_product_images WHERE product_id=?').bind(old.id),...galleryKeys.map((key,position)=>ctx.env.DB.prepare('INSERT INTO toys_center_product_images(product_id,position,image_key) VALUES(?,?,?)').bind(old.id,position,key)));
    if(effectiveMetaKey!==old.image_2_key)statements.push(ctx.env.DB.prepare("DELETE FROM toys_center_zone_images WHERE product_id=? AND zone='meta'").bind(old.id),ctx.env.DB.prepare("INSERT INTO toys_center_zone_images(product_id,zone,position,image_key) VALUES(?,'meta',0,?)").bind(old.id,effectiveMetaKey));
    await ctx.env.DB.batch(statements);
    const retainedGallery=galleryKeys.length?galleryKeys:oldGallery.map(item=>item.image_key);
    const retainedGroup=(await ctx.env.DB.prepare("SELECT image_key FROM toys_center_zone_images WHERE product_id=? AND zone='group' ORDER BY position LIMIT 10").bind(old.id).all()).results||[];
    const groupKeys=new Set(retainedGroup.map(item=>item.image_key));
    const stale=[...(galleryKeys.length?(oldRows.length?oldRows.flatMap(item=>[item.image_key,shopeeDerivativeKey(item.id)]):[old.image_1_key]):[]),old.image_2_key].filter(key=>key!==effectiveMetaKey&&!retainedGallery.includes(key)&&!groupKeys.has(key));
    await cleanupToyImages(ctx,stale);
    return json({ok:true,id:old.id,message:`แก้ไขสินค้า ${old.store_id==='zippo'?'Zippo':'Toys Center'} สำเร็จ`},200,headers);
  }catch(error){await cleanupToyImages(ctx,[...galleryKeys,uploadedMetaKey]);return json({error:/unique/i.test(String(error))?'ID หรือ slug สินค้านี้มีอยู่แล้ว':String(error.message||error)},/unique/i.test(String(error))?409:400,headers)}
}
