export const TOY_IMAGE_MAX_BYTES=5*1024*1024;
export const TOY_IMAGE_FIELDS=['image_1','image_2'];
const heicTypes=new Set(['image/heic','image/heif','image/heic-sequence','image/heif-sequence']);
const heicName=/\.(?:heic|heif)$/i;
const decoderUrl='/vendor/heic-to/heic-to-1.5.2-csp.js?v=1';

export const isHeicUpload=file=>file instanceof Blob&&(heicTypes.has(String(file.type||'').toLowerCase())||heicName.test(String(file.name||'')));
export const jpegName=name=>`${String(name||'image').replace(/\.[^.]*$/,'')||'image'}.jpg`;
const slotLabel=slot=>String(slot).endsWith('2')?'2':'1';
const conversionError=slot=>new Error(`แปลงรูป ${slotLabel(slot)} จาก HEIC/HEIF เป็น JPG ไม่สำเร็จ กรุณาเลือกไฟล์ HEIC/HEIF ที่เปิดได้`);
const oversizedError=slot=>new Error(`รูป ${slotLabel(slot)} ที่แปลงเป็น JPG มีขนาดเกิน 5 MB กรุณาลดขนาดรูปแล้วลองใหม่`);
const jpegMagic=async blob=>{const bytes=new Uint8Array(await blob.slice(0,3).arrayBuffer());return bytes[0]===0xff&&bytes[1]===0xd8&&bytes[2]===0xff};

export function createToyImagePipeline(options={}){
  const loadDecoder=options.loadDecoder||(()=>import(decoderUrl));
  const createUrl=options.createObjectURL||((file)=>URL.createObjectURL(file));
  const revokeUrl=options.revokeObjectURL||((url)=>URL.revokeObjectURL(url));
  const slots=new Map(),convertedFiles=new WeakMap();
  let decoderPromise=null;
  const decoder=()=>decoderPromise||(decoderPromise=Promise.resolve().then(loadDecoder).catch(error=>{decoderPromise=null;throw error}));
  const convert=async(file,slot)=>{
    try{
      const module=await decoder();
      if(typeof module?.heicTo!=='function'||typeof module?.isHeic!=='function'||!await module.isHeic(file))throw conversionError(slot);
      const blob=await module.heicTo({blob:file,type:'image/jpeg',quality:.88});
      if(Array.isArray(blob)||!(blob instanceof Blob)||blob.type!=='image/jpeg'||!blob.size||!await jpegMagic(blob))throw conversionError(slot);
      if(blob.size>TOY_IMAGE_MAX_BYTES)throw oversizedError(slot);
      return new File([blob],jpegName(file.name),{type:'image/jpeg',lastModified:file.lastModified||Date.now()});
    }catch(error){
      if(error instanceof Error&&/^(?:แปลงรูป|รูป [12] ที่แปลง)/.test(error.message))throw error;
      throw conversionError(slot);
    }
  };
  const resolveFile=(file,slot)=>{
    if(!isHeicUpload(file))return Promise.resolve(file);
    let promise=convertedFiles.get(file);
    if(!promise){promise=convert(file,slot);convertedFiles.set(file,promise)}
    return promise;
  };
  const revoke=entry=>{if(entry?.url){revokeUrl(entry.url);entry.url=''}};
  const select=(slot,file)=>{
    const current=slots.get(slot);
    if(current?.source===file)return current.promise;
    revoke(current);
    const entry={source:file||null,promise:file?resolveFile(file,slot):Promise.resolve(null),url:''};
    slots.set(slot,entry);
    return entry.promise;
  };
  const reset=slot=>{revoke(slots.get(slot));slots.delete(slot)};
  const preview=async(slot,img,file)=>{
    const promise=select(slot,file),entry=slots.get(slot);
    if(!file){img.hidden=true;img.removeAttribute?.('src');return null}
    try{
      const normalized=await promise;
      if(slots.get(slot)!==entry)return null;
      entry.url=createUrl(normalized);img.src=entry.url;img.hidden=false;
      return normalized;
    }catch(error){if(slots.get(slot)===entry){img.hidden=true;img.removeAttribute?.('src')}throw error}
  };
  const appendSelected=async(form,payload)=>{
    const selected=TOY_IMAGE_FIELDS.map(slot=>{
      const input=form.elements[slot],file=input?.files?.[0];
      if(file&&slots.get(slot)?.source!==file)select(slot,file);
      return{slot,input,file,entry:file?slots.get(slot):null};
    }),normalized=await Promise.all(selected.map(item=>item.entry?item.entry.promise:null));
    for(let index=0;index<selected.length;index++){
      const{slot,input,file,entry}=selected[index];
      if(!file){payload.delete(slot);continue}
      if(slots.get(slot)!==entry||input.files[0]!==file)throw new Error(`รูป ${slotLabel(slot)} ถูกเปลี่ยนระหว่างประมวลผล กรุณาลองอีกครั้ง`);
      payload.set(slot,normalized[index],normalized[index].name);
    }
    return payload;
  };
  return{appendSelected,isHeicUpload,preview,reset,resetAll:()=>TOY_IMAGE_FIELDS.forEach(reset),resolveFile,select};
}
