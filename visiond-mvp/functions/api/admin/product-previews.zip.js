import {json,requireAdmin} from '../../_lib.js';
import {ensureDatabase} from '../../_schema.js';

const encoder=new TextEncoder();
const u16=n=>new Uint8Array([n&255,(n>>>8)&255]);
const u32=n=>new Uint8Array([n&255,(n>>>8)&255,(n>>>16)&255,(n>>>24)&255]);
const join=parts=>{const out=new Uint8Array(parts.reduce((n,p)=>n+p.length,0));let at=0;for(const p of parts){out.set(p,at);at+=p.length}return out};
const crcTable=(()=>{const t=new Uint32Array(256);for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=(c&1)?0xedb88320^(c>>>1):c>>>1;t[n]=c>>>0}return t})();
const crc32=bytes=>{let c=0xffffffff;for(const b of bytes)c=crcTable[(c^b)&255]^(c>>>8);return(c^0xffffffff)>>>0};
const safe=s=>String(s||'สินค้า').normalize('NFKC').replace(/[\\/:*?"<>|\x00-\x1f]/g,'-').replace(/\s+/g,' ').trim().slice(0,90)||'สินค้า';
const ext=(type,url)=>type?.includes('png')?'png':type?.includes('webp')?'webp':type?.includes('gif')?'gif':String(url).toLowerCase().match(/\.(png|webp|gif|jpe?g)(?:\?|$)/)?.[1]?.replace('jpeg','jpg')||'jpg';

async function imageBytes(ctx,url){
  if(url.startsWith('/api/media/')){const key=decodeURIComponent(url.slice('/api/media/'.length).split('?')[0]),obj=await ctx.env.FILES.get(key);if(!obj)return null;return{bytes:new Uint8Array(await obj.arrayBuffer()),type:obj.httpMetadata?.contentType||''}}
  const response=await ctx.env.ASSETS?.fetch(new URL(url,ctx.request.url))||await fetch(new URL(url,ctx.request.url));if(!response.ok)return null;return{bytes:new Uint8Array(await response.arrayBuffer()),type:response.headers.get('content-type')||''};
}

export function makeZip(files){
  const locals=[],centrals=[];let offset=0;
  for(const file of files){const name=encoder.encode(file.name),crc=crc32(file.bytes),size=file.bytes.length,local=join([u32(0x04034b50),u16(20),u16(0x0800),u16(0),u16(0),u16(0),u32(crc),u32(size),u32(size),u16(name.length),u16(0),name,file.bytes]);locals.push(local);centrals.push(join([u32(0x02014b50),u16(20),u16(20),u16(0x0800),u16(0),u16(0),u16(0),u32(crc),u32(size),u32(size),u16(name.length),u16(0),u16(0),u16(0),u16(0),u32(0),u32(offset),name]));offset+=local.length}
  const central=join(centrals),end=join([u32(0x06054b50),u16(0),u16(0),u16(files.length),u16(files.length),u32(central.length),u32(offset),u16(0)]);return join([...locals,central,end]);
}

export async function onRequestGet(ctx){
  await ensureDatabase(ctx.env);const auth=await requireAdmin(ctx);if(auth.error)return auth.error;
  const category=new URL(ctx.request.url).searchParams.get('category')?.trim()||'',query=category?'SELECT id,slug,title,cover_url,preview_urls FROM products WHERE deleted_at IS NULL AND category=? ORDER BY id':'SELECT id,slug,title,cover_url,preview_urls FROM products WHERE deleted_at IS NULL ORDER BY category,id',rows=category?(await ctx.env.DB.prepare(query).bind(category).all()).results:(await ctx.env.DB.prepare(query).all()).results;
  if(!rows.length)return json({error:'หมวดนี้ยังไม่มีสินค้า'},404);
  const files=[];let total=0,missing=0;
  for(const product of rows){let saved=[];try{saved=JSON.parse(product.preview_urls||'[]')}catch{}const urls=[...new Set([product.cover_url,...saved].filter(url=>url&&!url.includes('product-placeholder')))];for(let i=0;i<urls.length;i++){const image=await imageBytes(ctx,urls[i]);if(!image){missing++;continue}total+=image.bytes.length;if(total>80*1024*1024)return json({error:'รูปในหมวดนี้รวมเกิน 80 MB กรุณาแบ่งดาวน์โหลดเป็นหมวดย่อย'},413);files.push({name:`${safe(product.slug)}-${safe(product.title)}/${String(i+1).padStart(2,'0')}-${i===0?'ปก':'ตัวอย่าง'}.${ext(image.type,urls[i])}`,bytes:image.bytes})}}
  if(!files.length)return json({error:'ไม่พบรูปตัวอย่างที่ดาวน์โหลดได้'},404);
  const zip=makeZip(files),label=safe(category||'ทุกหมวด'),filename=`visiond-previews-${label}.zip`;
  return new Response(zip,{headers:{'content-type':'application/zip','content-disposition':`attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,'cache-control':'no-store','x-visiond-files':String(files.length),'x-visiond-missing':String(missing)}});
}
