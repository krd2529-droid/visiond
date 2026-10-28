import {cleanupToyImages,putToyImage,readToyImage} from './_toys_center.js';
import {shopeeDerivativeKey} from './_toys_center_shopee_images.js';

const zones=['visiond','meta','group'];
const fail=message=>{throw new Error(message)};
const uploadedFiles=(form,name)=>form.getAll(name).filter(file=>file instanceof File&&file.size);
const draftKeys=value=>{try{const list=JSON.parse(value||'[]');return Array.isArray(list)?list.filter(key=>typeof key==='string').slice(0,10):[]}catch{return[]}};

export async function readProductZoneRows(ctx,productId){
  const [visiond,other]=await Promise.all([
    ctx.env.DB.prepare('SELECT id,position,image_key FROM toys_center_product_images WHERE product_id=? ORDER BY position LIMIT 10').bind(productId).all(),
    ctx.env.DB.prepare('SELECT id,zone,position,image_key FROM toys_center_zone_images WHERE product_id=? ORDER BY zone,position LIMIT 20').bind(productId).all()
  ]);
  return {visiond:visiond.results||[],meta:(other.results||[]).filter(row=>row.zone==='meta'),group:(other.results||[]).filter(row=>row.zone==='group')};
}

export async function prepareZonePlan(ctx,form,oldRows={visiond:[],meta:[],group:[]},draft=null,{allowIncomplete=false}={}){
  const raw=String(form.get('zone_plan')||'');
  if(raw.length>4096)fail('แผนจัดรูปยาวเกินกำหนด');
  let plan;try{plan=JSON.parse(raw)}catch{fail('แผนจัดรูปไม่ถูกต้อง')}
  if(!plan||typeof plan!=='object'||!zones.every(zone=>Array.isArray(plan[zone])))fail('แผนจัดรูปไม่ถูกต้อง');
  if((!allowIncomplete&&plan.visiond.length<1)||plan.visiond.length>10)fail('รูป VisionD ต้องมี 1–10 รูป');
  if((!allowIncomplete&&plan.meta.length!==1)||(allowIncomplete&&plan.meta.length>1))fail('รูป Meta ต้องเหลือ 1 รูปก่อนบันทึก');
  if(plan.group.length>10)fail('รูปลูกค้ากลุ่มมีได้ไม่เกิน 10 รูป');
  const coverIndex=Number(plan.cover);
  if(!Number.isInteger(coverIndex)||coverIndex<0||(plan.visiond.length&&coverIndex>=plan.visiond.length))fail('รูปปก VisionD ไม่ถูกต้อง');
  const files={visiond:uploadedFiles(form,'image_1'),meta:uploadedFiles(form,'image_2'),group:uploadedFiles(form,'image_3')};
  if(files.visiond.length>10||files.meta.length>1||files.group.length>10)fail('จำนวนรูปอัปโหลดเกินกำหนด');
  const old=new Map();
  for(const zone of zones)for(const row of oldRows[zone]||[])old.set(`${zone}:${row.id}`,{zone,id:Number(row.id),key:row.image_key});
  if(draft){draftKeys(draft.gallery_keys_json).forEach((key,index)=>old.set(`draft:visiond:${index}`,{zone:'draft',key}));if(draft.meta_key)old.set('draft:meta:0',{zone:'draft',key:draft.meta_key});draftKeys(draft.group_keys_json).forEach((key,index)=>old.set(`draft:group:${index}`,{zone:'draft',key}))}
  const usedUploads=new Set(),final={visiond:[],meta:[],group:[]};
  for(const zone of zones)for(const ref of plan[zone]){
    if(typeof ref!=='string')fail('รายการรูปไม่ถูกต้อง');
    const match=ref.match(/^(visiond|meta|group):(\d+)$/),draftMatch=ref.match(/^draft:(visiond|meta|group):(\d+)$/),upload=ref.match(/^upload:(visiond|meta|group):(\d+)$/);
    if(match||draftMatch){const source=old.get(match?`${match[1]}:${Number(match[2])}`:`draft:${draftMatch[1]}:${Number(draftMatch[2])}`);if(!source)fail('รูปเดิมไม่อยู่ในสินค้านี้');final[zone].push({...source});continue}
    if(upload){const sourceZone=upload[1],index=Number(upload[2]);if(!Number.isSafeInteger(index)||!files[sourceZone][index])fail('รูปอัปโหลดไม่ถูกต้อง');usedUploads.add(`${sourceZone}:${index}`);final[zone].push({zone:sourceZone,upload:index});continue}
    fail('รายการรูปไม่ถูกต้อง');
  }
  const uploads={visiond:[],meta:[],group:[]},newKeys=[];
  try{
    for(const zone of zones){
      for(let index=0;index<files[zone].length;index++){
        if(!usedUploads.has(`${zone}:${index}`))continue;
        const prepared=await readToyImage(files[zone][index],`${zone} ${index+1}`);
        uploads[zone][index]=await putToyImage(ctx.env,prepared,zone);
        newKeys.push(uploads[zone][index]);
      }
    }
    for(const zone of zones)for(const item of final[zone])if(item.upload!==undefined)item.key=uploads[item.zone][item.upload];
    return {final,coverIndex,newKeys};
  }catch(error){await cleanupToyImages(ctx,newKeys);throw error}
}

export function zoneInsertStatements(ctx,productId,final,revision=null){
  const statements=[];
  for(const [zone,rows] of Object.entries(final)){
    const reused=new Set();
    rows.forEach((item,position)=>{
      const keepId=item.zone===zone&&item.id&&!reused.has(item.id);if(keepId)reused.add(item.id);
      const table=zone==='visiond'?'toys_center_product_images':'toys_center_zone_images';
      const columns=zone==='visiond'?'id,product_id,position,image_key':'id,product_id,zone,position,image_key';
      if(typeof productId==='object'){
        const projection=zone==='visiond'?'?,id,?,?':'?,id,?,?,?';
        const args=zone==='visiond'?[null,position,item.key,productId.store,productId.metaId]:[null,zone,position,item.key,productId.store,productId.metaId];
        statements.push(ctx.env.DB.prepare(`INSERT INTO ${table}(${columns}) SELECT ${projection} FROM toys_center_products WHERE store_id=? AND meta_id=?`).bind(...args));
      }else if(revision!==null){
        const projection=zone==='visiond'?'?,id,?,?':'?,id,?,?,?';
        const args=zone==='visiond'?[keepId?item.id:null,position,item.key,productId,revision]:[keepId?item.id:null,zone,position,item.key,productId,revision];
        statements.push(ctx.env.DB.prepare(`INSERT INTO ${table}(${columns}) SELECT ${projection} FROM toys_center_products WHERE id=? AND image_revision=?`).bind(...args));
      }else{
        const values=zone==='visiond'?'?,?,?,?':'?,?,?,?,?';
        const args=zone==='visiond'?[keepId?item.id:null,productId,position,item.key]:[keepId?item.id:null,productId,zone,position,item.key];
        statements.push(ctx.env.DB.prepare(`INSERT INTO ${table}(${columns}) VALUES(${values})`).bind(...args));
      }
    });
  }
  return statements;
}

export function removedZoneKeys(oldRows,final,oldProduct){
  const keepKeys=new Set([...zones.flatMap(zone=>final[zone].map(item=>item.key)),final.visiond[0]?.key,final.meta[0]?.key]);
  const oldKeys=new Set([...zones.flatMap(zone=>(oldRows[zone]||[]).map(item=>item.image_key)),oldProduct?.image_1_key,oldProduct?.image_2_key].filter(Boolean));
  const keptGalleryIds=new Set(final.visiond.filter(item=>item.zone==='visiond'&&item.id).map(item=>Number(item.id)));
  const derivatives=(oldRows.visiond||[]).filter(item=>!keptGalleryIds.has(Number(item.id))).map(item=>shopeeDerivativeKey(item.id));
  return [...[...oldKeys].filter(key=>!keepKeys.has(key)),...derivatives];
}
