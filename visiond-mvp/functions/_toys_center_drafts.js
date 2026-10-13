import {cleanupToyImages,putToyImage,putToyImages,readToyImage,resolveToyCoverIndex} from './_toys_center.js';
import {autoToySlug,compactToySlug} from '../public/toys-center-slug.js';

export const draftFields=['meta_id','slug','title','description','availability','condition','price','quantity','brand','product_line','cost','series','status','shopee_weight_kg','shopee_package_width_cm','shopee_package_length_cm','shopee_package_height_cm','google_product_category','fb_product_category','gtin','item_group_id','gender','color','size','age_group','material','pattern','product_tags'];
export const draftValues=form=>{const fields=Object.fromEntries(draftFields.map(name=>[name,String(form.get(name)??'').slice(0,name==='description'?9999:name==='product_tags'?500:200)]));fields.slug=compactToySlug(fields.slug)||autoToySlug(fields.title,fields.meta_id);return fields};
export const draftGallery=row=>{try{const keys=JSON.parse(row.gallery_keys_json);return Array.isArray(keys)?keys.filter(key=>typeof key==='string').slice(0,10):[]}catch{return[]}};
export const draftData=row=>({id:row.id,store_id:row.store_id,fields:JSON.parse(row.fields_json),gallery_count:draftGallery(row).length,cover_index:row.cover_index,has_meta_upload:Boolean(row.meta_key),updated_at:row.updated_at});
export async function draftRow(ctx,id,store){return ctx.env.DB.prepare('SELECT * FROM toys_center_form_drafts WHERE id=? AND store_id=?').bind(id,store).first()}
export async function saveDraft(ctx,form,store,user,old=null){
  if(!ctx.env.FILES)throw new Error('ยังไม่ได้เชื่อมพื้นที่เก็บรูป FILES');
  const files=form.getAll('image_1').filter(file=>file instanceof File&&file.size),metaFiles=form.getAll('image_2').filter(file=>file instanceof File&&file.size);
  if(files.length>10||metaFiles.length>1)throw new Error('เลือกรูป VisionD ไม่เกิน 10 รูป และรูป Meta ไม่เกิน 1 รูป');
  const oldGallery=old?draftGallery(old):[],count=files.length||oldGallery.length;
  const coverIndex=count?resolveToyCoverIndex(form,count,old?.cover_index||0):0;
  const metaSource=form.get('meta_source');
  if(coverIndex<0)throw new Error('ตำแหน่งรูปปก VisionD ไม่ถูกต้อง');
  if(metaSource!==null&&!['cover','upload'].includes(metaSource))throw new Error('วิธีเลือกรูป Meta ไม่ถูกต้อง');
  if(metaSource==='upload'&&!metaFiles.length&&!old?.meta_key)throw new Error('กรุณาอัปโหลดรูป Meta แยก');
  const [gallery,meta]=await Promise.all([Promise.all(files.map((file,index)=>readToyImage(file,`VisionD ${index+1}`))),readToyImage(metaFiles[0],'Meta',{required:false})]);
  let galleryKeys=[],metaKey='';
  try{
    galleryKeys=await putToyImages(ctx,gallery,'draft-visiond');metaKey=await putToyImage(ctx.env,meta,'draft-meta');
    const keys=galleryKeys.length?galleryKeys:oldGallery,selectedMetaKey=metaKey||((metaSource==='upload'||metaSource===null)?old?.meta_key||'':'');
    const values=JSON.stringify(draftValues(form));
    let id=old?.id;
    if(old){await ctx.env.DB.prepare('UPDATE toys_center_form_drafts SET fields_json=?,gallery_keys_json=?,meta_key=?,cover_index=?,meta_zip_index=NULL,updated_at=CURRENT_TIMESTAMP WHERE id=? AND store_id=?').bind(values,JSON.stringify(keys),selectedMetaKey,coverIndex,old.id,store.id).run()}
    else {const result=await ctx.env.DB.prepare('INSERT INTO toys_center_form_drafts(store_id,fields_json,gallery_keys_json,meta_key,cover_index,created_by) VALUES(?,?,?,?,?,?)').bind(store.id,values,JSON.stringify(keys),selectedMetaKey,coverIndex,user.id).run();id=result.meta.last_row_id}
    await cleanupToyImages(ctx,[...(galleryKeys.length?oldGallery.filter(key=>key!==selectedMetaKey):[]),...(old?.meta_key&&old.meta_key!==selectedMetaKey&&!keys.includes(old.meta_key)?[old.meta_key]:[])]);
    return id;
  }catch(error){await cleanupToyImages(ctx,[...galleryKeys,metaKey]);throw error}
}
