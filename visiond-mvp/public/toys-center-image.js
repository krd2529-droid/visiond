export const TOY_IMAGE_MAX_BYTES=5*1024*1024;
export const TOY_IMAGE_TARGET_BYTES=Math.floor(4.75*1024*1024);
export const TOY_IMAGE_SOURCE_MAX_BYTES=64*1024*1024;
export const TOY_IMAGE_MAX_PIXELS=40_000_000;
export const TOY_IMAGE_MAX_EDGE=2560;
export const TOY_IMAGE_MAX_CONCURRENCY=2;
export const TOY_IMAGE_MAX_ATTEMPTS=8;
export const TOY_IMAGE_FIELDS=['image_1','image_2'];
const heicTypes=new Set(['image/heic','image/heif','image/heic-sequence','image/heif-sequence']);
const heicName=/\.(?:heic|heif)$/i;
const standardTypes=new Set(['image/jpeg','image/png','image/webp']);
const extensionTypes={jpg:'image/jpeg',jpeg:'image/jpeg',png:'image/png',webp:'image/webp'};
const typeExtensions={'image/jpeg':'jpg','image/png':'png','image/webp':'webp'};
const decoderUrl='/vendor/heic-to/heic-to-1.5.2-csp.js?v=1';
const staleJob=Symbol('stale-image-job');

export const isHeicUpload=file=>file instanceof Blob&&(heicTypes.has(String(file.type||'').toLowerCase())||heicName.test(String(file.name||'')));
export const jpegName=name=>(String(name||'image').replace(/\.[^.]*$/,'')||'image')+'.jpg';
const normalizedName=(name,type)=>(String(name||'image').replace(/\.[^.]*$/,'')||'image')+'.'+typeExtensions[type];
const sourceType=file=>{const declared=String(file?.type||'').toLowerCase();if(standardTypes.has(declared))return declared;const extension=/\.([^.]+)$/.exec(String(file?.name||''))?.[1]?.toLowerCase();return extensionTypes[extension]||''};
const slotLabel=slot=>String(slot).startsWith('image_2')||slot==='Meta'?'Meta':'VisionD';
const isVisiondSlot=slot=>String(slot).startsWith('image_1')||String(slot).startsWith('VisionD');
const conversionError=slot=>new Error('แปลงรูป '+slotLabel(slot)+' จาก HEIC/HEIF เป็น JPG ไม่สำเร็จ กรุณาเลือกไฟล์ HEIC/HEIF ที่เปิดได้');
const oversizedError=slot=>new Error('รูป '+slotLabel(slot)+' ที่แปลงแล้วมีขนาดเกิน 5 MB กรุณาเลือกรูปต้นฉบับที่มีรายละเอียดน้อยลง');
const resourceError=(slot,detail)=>new Error('ประมวลผลรูป '+slotLabel(slot)+' ไม่สำเร็จ: '+detail);
const magicMatches=async(blob,type)=>{const bytes=new Uint8Array(await blob.slice(0,12).arrayBuffer());if(type==='image/jpeg')return bytes.length>=3&&bytes[0]===0xff&&bytes[1]===0xd8&&bytes[2]===0xff;if(type==='image/png')return bytes.length>=8&&[0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a].every((byte,index)=>bytes[index]===byte);return type==='image/webp'&&bytes.length>=12&&String.fromCharCode(...bytes.subarray(0,4))==='RIFF'&&String.fromCharCode(...bytes.subarray(8,12))==='WEBP'};
const defaultDecode=async blob=>{const bitmap=await createImageBitmap(blob,{imageOrientation:'from-image'});return{source:bitmap,width:bitmap.width,height:bitmap.height,close:()=>bitmap.close()}};
const defaultEncode=(decoded,width,height,type,quality)=>new Promise(resolve=>{const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;const context=canvas.getContext('2d',{alpha:type!=='image/jpeg'});if(!context){resolve(null);return}if(type==='image/jpeg'){context.fillStyle='#fff';context.fillRect(0,0,width,height)}context.drawImage(decoded.source,0,0,width,height);canvas.toBlob(resolve,type,quality)});

export function createToyImagePipeline(options={}){
  const loadDecoder=options.loadDecoder||(()=>import(decoderUrl));
  const createUrl=options.createObjectURL||((file)=>URL.createObjectURL(file));
  const revokeUrl=options.revokeObjectURL||((url)=>URL.revokeObjectURL(url));
  const decodeImage=options.decodeImage||defaultDecode;
  const encodeImage=options.encodeImage||defaultEncode;
  const slots=new Map(),normalizedFiles=new WeakMap(),normalizationInfo=new WeakMap(),queue=[];
  let decoderPromise=null,activeJobs=0;
  const decoder=()=>decoderPromise||(decoderPromise=Promise.resolve().then(loadDecoder).catch(error=>{decoderPromise=null;throw error}));
  const drain=()=>{while(activeJobs<TOY_IMAGE_MAX_CONCURRENCY&&queue.length){const job=queue.shift();activeJobs+=1;Promise.resolve().then(job.task).then(job.resolve,job.reject).finally(()=>{activeJobs-=1;drain()})}};
  const limited=task=>new Promise((resolve,reject)=>{queue.push({task,resolve,reject});drain()});
  const roleFor=slot=>isVisiondSlot(slot)?'visiond':'meta';
  const selectedForRole=(file,role)=>[...slots.entries()].some(([slot,entry])=>roleFor(slot)===role&&entry.sources.includes(file));
  const convertHeicBlob=async(file,slot)=>{
    try{
      const module=await decoder();
      if(typeof module?.heicTo!=='function'||typeof module?.isHeic!=='function'||!await module.isHeic(file))throw conversionError(slot);
      const blob=await module.heicTo({blob:file,type:'image/jpeg',quality:.88});
      if(Array.isArray(blob)||!(blob instanceof Blob)||blob.type!=='image/jpeg'||!blob.size||!await magicMatches(blob,'image/jpeg'))throw conversionError(slot);
      return blob;
    }catch(error){
      if(error instanceof Error&&/^แปลงรูป /.test(error.message))throw error;
      throw conversionError(slot);
    }
  };
  const remember=(file,role,record)=>{let records=normalizationInfo.get(file);if(!records){records=new Map();normalizationInfo.set(file,records)}records.set(role,record)};
  const unchanged=(file,role,extra={})=>{remember(file,role,{sourceBytes:file.size,outputBytes:file.size,optimized:false,...extra});return file};
  const normalizeVisiondFile=async(file,slot)=>{
    if(file.size>TOY_IMAGE_SOURCE_MAX_BYTES)throw resourceError(slot,'ไฟล์ต้นฉบับต้องไม่เกิน 64 MB');
    const heic=isHeicUpload(file),type=heic?'image/jpeg':sourceType(file);
    if(!heic&&(!type||!await magicMatches(file,type)))throw resourceError(slot,'ไฟล์ไม่ตรงกับชนิด JPG, PNG หรือ WEBP');
    if(!heic&&file.size<=TOY_IMAGE_MAX_BYTES)return unchanged(file,'visiond');
    const sourceBlob=heic?await convertHeicBlob(file,slot):file;
    let decoded;
    try{decoded=await decodeImage(sourceBlob)}catch{throw resourceError(slot,'เบราว์เซอร์เปิดไฟล์นี้ไม่ได้')}
    try{
      const sourceWidth=Number(decoded?.width)||0,sourceHeight=Number(decoded?.height)||0;
      if(!sourceWidth||!sourceHeight||sourceWidth*sourceHeight>TOY_IMAGE_MAX_PIXELS)throw resourceError(slot,'ความละเอียดต้องไม่เกิน 40 ล้านพิกเซล');
      const scale=Math.min(1,TOY_IMAGE_MAX_EDGE/Math.max(sourceWidth,sourceHeight));
      let width=Math.max(1,Math.round(sourceWidth*scale)),height=Math.max(1,Math.round(sourceHeight*scale));
      if(sourceBlob.size<=TOY_IMAGE_TARGET_BYTES&&scale===1){
        const output=heic?new File([sourceBlob],jpegName(file.name),{type:'image/jpeg',lastModified:file.lastModified||Date.now()}):file;
        remember(file,'visiond',{sourceBytes:file.size,outputBytes:output.size,sourceWidth,sourceHeight,outputWidth:sourceWidth,outputHeight:sourceHeight,optimized:output!==file});
        return output;
      }
      const qualities=[.9,.82,.74,.66,.86,.78,.7,.62];
      for(let attempt=0;attempt<TOY_IMAGE_MAX_ATTEMPTS;attempt++){
        const blob=await encodeImage(decoded,width,height,type,qualities[attempt]);
        if(!(blob instanceof Blob)||!blob.size||blob.type!==type||!await magicMatches(blob,type))throw resourceError(slot,'เบราว์เซอร์สร้างไฟล์รูปที่ถูกต้องไม่ได้');
        if(blob.size<=TOY_IMAGE_TARGET_BYTES){
          const output=new File([blob],normalizedName(file.name,type),{type,lastModified:file.lastModified||Date.now()});
          remember(file,'visiond',{sourceBytes:file.size,outputBytes:output.size,sourceWidth,sourceHeight,outputWidth:width,outputHeight:height,optimized:true});
          return output;
        }
        if(attempt===TOY_IMAGE_MAX_ATTEMPTS-1)break;
        if((type==='image/jpeg'||type==='image/webp')&&attempt<3)continue;
        const ratio=Math.min(.9,Math.max(.5,Math.sqrt(TOY_IMAGE_TARGET_BYTES/blob.size)*.94));
        const nextWidth=Math.max(1,Math.floor(width*ratio)),nextHeight=Math.max(1,Math.floor(height*ratio));
        if(nextWidth===width&&nextHeight===height)break;
        width=nextWidth;height=nextHeight;
      }
      throw oversizedError(slot);
    }finally{decoded?.close?.()}
  };
  const convertMetaHeic=async(file,slot)=>{
    const blob=await convertHeicBlob(file,slot);
    if(blob.size>TOY_IMAGE_MAX_BYTES)throw oversizedError(slot);
    const output=new File([blob],jpegName(file.name),{type:'image/jpeg',lastModified:file.lastModified||Date.now()});
    remember(file,'meta',{sourceBytes:file.size,outputBytes:output.size,optimized:true});
    return output;
  };
  const resolveFile=(file,slot,selectedOnly=false)=>{
    const role=roleFor(slot);let cache=normalizedFiles.get(file);if(!cache){cache=new Map();normalizedFiles.set(file,cache)}let promise=cache.get(role);
    if(promise)return promise;
    const visiond=role==='visiond',expensive=isHeicUpload(file)||visiond;
    if(!expensive){promise=Promise.resolve(unchanged(file,role));cache.set(role,promise);return promise}
    promise=limited(async()=>{if(selectedOnly&&!selectedForRole(file,role))throw staleJob;return visiond?normalizeVisiondFile(file,slot):convertMetaHeic(file,slot)}).catch(error=>{if(error===staleJob)cache.delete(role);throw error});
    cache.set(role,promise);
    return promise;
  };
  const revoke=entry=>{for(const url of entry?.urls||[])revokeUrl(url);if(entry)entry.urls=[]};
  const sameFiles=(left,right)=>left.length===right.length&&left.every((file,index)=>file===right[index]);
  const selectFiles=(slot,files)=>{
    files=files.filter(Boolean);const current=slots.get(slot);
    if(current&&sameFiles(current.sources,files))return current.promise;
    revoke(current);
    const entry={sources:files,urls:[],promise:null};slots.set(slot,entry);
    entry.promise=Promise.all(files.map((file,index)=>resolveFile(file,slot+'-'+(index+1),true)));
    return entry.promise;
  };
  const select=(slot,file)=>selectFiles(slot,file?[file]:[]).then(files=>files[0]||null);
  const reset=slot=>{revoke(slots.get(slot));slots.delete(slot)};
  const preview=async(slot,img,file)=>{
    const promise=select(slot,file),entry=slots.get(slot);
    if(!file){img.hidden=true;img.removeAttribute?.('src');return null}
    try{const normalized=await promise;if(slots.get(slot)!==entry)return null;entry.urls=[createUrl(normalized)];img.src=entry.urls[0];img.hidden=false;return normalized}catch(error){if(slots.get(slot)!==entry)return null;img.hidden=true;img.removeAttribute?.('src');throw error}
  };
  const previewMany=async(slot,container,files)=>{
    files=[...files].slice(0,10);const promise=selectFiles(slot,files),entry=slots.get(slot);container.replaceChildren();
    if(!files.length)return[];
    try{const normalized=await promise;if(slots.get(slot)!==entry)return[];const fragment=container.ownerDocument.createDocumentFragment();normalized.forEach((file,index)=>{const img=container.ownerDocument.createElement('img'),url=createUrl(file);entry.urls.push(url);img.src=url;img.alt='ตัวอย่างรูป VisionD '+(index+1);fragment.append(img)});container.replaceChildren(fragment);return normalized}catch(error){if(slots.get(slot)!==entry)return[];container.replaceChildren();throw error}
  };
  const appendSelected=async(form,payload)=>{
    const selected=TOY_IMAGE_FIELDS.map(slot=>{
      const input=form.elements[slot],files=slot==='image_1'?[...(input?.files||[])].slice(0,11):[input?.files?.[0]].filter(Boolean);
      if(slot==='image_1'&&files.length>10)throw new Error('รูปสำหรับ VisionD เลือกได้สูงสุด 10 รูป');
      if(files.length&&!sameFiles(slots.get(slot)?.sources||[],files))selectFiles(slot,files);
      return{slot,input,files,entry:files.length?slots.get(slot):null};
    }),normalized=await Promise.all(selected.map(item=>item.entry?item.entry.promise:[]));
    for(let index=0;index<selected.length;index++){
      const{slot,input,files,entry}=selected[index];payload.delete(slot);
      if(!files.length)continue;
      const current=slot==='image_1'?[...(input.files||[])]:[input.files?.[0]].filter(Boolean);
      if(slots.get(slot)!==entry||!sameFiles(current,files))throw new Error('รูป '+slotLabel(slot)+' ถูกเปลี่ยนระหว่างประมวลผล กรุณาลองอีกครั้ง');
      normalized[index].forEach(file=>payload.append(slot,file,file.name));
    }
    return payload;
  };
  const summarize=files=>{const records=[...files].map(file=>normalizationInfo.get(file)?.get('visiond')).filter(Boolean);return{count:records.length,optimizedCount:records.filter(record=>record.optimized).length,sourceBytes:records.reduce((sum,record)=>sum+record.sourceBytes,0),outputBytes:records.reduce((sum,record)=>sum+record.outputBytes,0),items:records.map(record=>({...record}))}};
  return{appendSelected,isHeicUpload,preview,previewMany,reset,resetAll:()=>TOY_IMAGE_FIELDS.forEach(reset),resolveFile,select,selectFiles,summarize};
}
