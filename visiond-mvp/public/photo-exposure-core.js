// Local tone adjustment only: lift darker luminance while preserving hue and highlights.
export const PHOTO_LIMITS=Object.freeze({count:24,fileBytes:20_000_000,totalBytes:120_000_000,outputBytes:160*1024*1024,maxSide:2400,maxPixels:40_000_000});
const clamp=(value,low,high)=>Math.min(high,Math.max(low,value));
const luminance=(r,g,b)=>.2126*r+.7152*g+.0722*b;

export function validatePhotoFiles(files){
  const list=Array.from(files||[]);
  if(!list.length)throw new Error('กรุณาเลือกรูปอย่างน้อย 1 รูป');
  if(list.length>PHOTO_LIMITS.count)throw new Error('เลือกได้ไม่เกิน 24 รูปต่อรอบ');
  let total=0;
  for(const file of list){
    if(!/^image\/(?:jpeg|png|webp)$/.test(file.type)||!/\.(?:jpe?g|png|webp)$/i.test(file.name))throw new Error(`ชนิดไฟล์ไม่รองรับ: ${file.name}`);
    if(!file.size||file.size>PHOTO_LIMITS.fileBytes)throw new Error(`รูปต้องมีข้อมูลและไม่เกิน 20 MB: ${file.name}`);
    total+=file.size;
  }
  if(total>PHOTO_LIMITS.totalBytes)throw new Error('ขนาดรูปต้นฉบับรวมเกิน 120 MB กรุณาแบ่งรอบ');
  return list;
}

export function estimateAutoStrength(data,width,height){
  const values=[];
  const step=Math.max(1,Math.ceil(Math.sqrt(width*height/12000)));
  const x0=Math.floor(width*.15),x1=Math.ceil(width*.85),y0=Math.floor(height*.12),y1=Math.ceil(height*.88);
  for(let y=y0;y<y1;y+=step)for(let x=x0;x<x1;x+=step){
    const offset=(y*width+x)*4;
    if(data[offset+3]<128)continue;
    const light=luminance(data[offset],data[offset+1],data[offset+2]);
    if(light>=12)values.push(light);
  }
  if(values.length<20)return 0;
  values.sort((a,b)=>a-b);
  const mid=values[Math.floor(values.length*.4)],upper=values[Math.floor(values.length*.75)];
  // Bright images stay unchanged; a few dark pixels alone should not drive the whole photo.
  if(mid>=153||upper>=225&&mid>=130)return 0;
  return Math.round(clamp((153-mid)/105,.08,.85)*100);
}

export function liftShadows(data,strength){
  const amount=clamp(Number(strength)||0,0,100)/100;
  if(!amount)return data;
  for(let offset=0;offset<data.length;offset+=4){
    if(data[offset+3]===0)continue;
    const r=data[offset],g=data[offset+1],b=data[offset+2],light=luminance(r,g,b);
    if(light>=210)continue;
    const shadow=Math.pow((210-light)/210,1.8);
    const noiseGuard=clamp(light/45,0,1);
    const gain=amount*72*shadow*noiseGuard;
    const ratio=Math.min(1.65,(light+gain)/Math.max(light,1));
    data[offset]=clamp(Math.round(r*ratio),0,255);
    data[offset+1]=clamp(Math.round(g*ratio),0,255);
    data[offset+2]=clamp(Math.round(b*ratio),0,255);
  }
  return data;
}

export function outputDimensions(width,height){
  if(!Number.isInteger(width)||!Number.isInteger(height)||width<1||height<1||width*height>PHOTO_LIMITS.maxPixels)throw new Error('ขนาดภาพที่ถอดรหัสใหญ่เกิน 40 ล้านพิกเซล');
  const scale=Math.min(1,PHOTO_LIMITS.maxSide/Math.max(width,height));
  return {width:Math.max(1,Math.round(width*scale)),height:Math.max(1,Math.round(height*scale))};
}

export function outputName(filename,index){
  const prefix=`${String(index+1).padStart(3,'0')}-`,suffix='-brightened.png';
  const original=String(filename).replace(/\.[^.]+$/,'').normalize('NFC').replace(/[\\/<>:"|?*\u0000-\u001f\u007f]/g,'_').replace(/[. ]+$/,'')||'image';
  const encoder=new TextEncoder(),maxStemBytes=240-encoder.encode(prefix+suffix).length;
  let stem='',bytes=0;
  for(const character of original){const size=encoder.encode(character).length;if(bytes+size>maxStemBytes)break;stem+=character;bytes+=size}
  return `${prefix}${stem.replace(/[. ]+$/,'')||'image'}${suffix}`;
}

export function withinOutputBudget(total,next){return Number.isFinite(total)&&Number.isFinite(next)&&total>=0&&next>0&&total+next<=PHOTO_LIMITS.outputBytes}
