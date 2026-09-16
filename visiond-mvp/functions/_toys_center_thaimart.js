import {galleryUrl,normalizeToySearch} from './_toys_center.js';

export const THAIMART_HANDOFF_SCHEMA='visiond.thaimart-product-handoff';
export const THAIMART_HANDOFF_VERSION=1;
export const THAIMART_PLATFORM='thaimart';
export const THAIMART_CATEGORY_PATH=['งานอดิเรกและของสะสม','โมเดลและของสะสม','โมเดล / บอร์ดเกม / การ์ดเกม'];
export const THAIMART_MAX_IMAGES=9;
export const THAIMART_MAX_IMAGE_BYTES=10*1024*1024;
export const THAIMART_IMAGE_TYPES=new Set(['image/jpeg','image/png']);

const encodeText=value=>{const bytes=new TextEncoder().encode(value);let binary='';for(const byte of bytes)binary+=String.fromCharCode(byte);return btoa(binary).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'')};
const decodeText=value=>{const encoded=String(value||'').replace(/-/g,'+').replace(/_/g,'/'),binary=atob(encoded+'='.repeat((4-encoded.length%4)%4));return new TextDecoder().decode(Uint8Array.from(binary,char=>char.charCodeAt(0)))};

export const encodeThaiMartSearchCursor=row=>encodeText(JSON.stringify([String(row.title),Number(row.id)]));
export function decodeThaiMartSearchCursor(value){if(!value)return null;try{const parsed=JSON.parse(decodeText(value));return Array.isArray(parsed)&&parsed.length===2&&typeof parsed[0]==='string'&&parsed[0].length<=200&&Number.isSafeInteger(parsed[1])&&parsed[1]>0?{title:parsed[0],id:parsed[1]}:null}catch{return null}}
export function thaiMartSearchPage(url){const params=url.searchParams,query=normalizeToySearch(params.get('q')),requested=params.has('limit')?Number(params.get('limit')):24,limit=Number.isInteger(requested)?Math.min(24,Math.max(1,requested)):24,cursorRaw=params.get('cursor'),cursor=decodeThaiMartSearchCursor(cursorRaw);return{query,limit,cursor,invalidCursor:Boolean(cursorRaw&&!cursor)}}
export function thaiMartPrefixUpperBound(prefix){const points=Array.from(String(prefix));for(let index=points.length-1;index>=0;index--){const value=points[index].codePointAt(0);if(value<0x10ffff)return points.slice(0,index).join('')+String.fromCodePoint(value+1)}return null}

const text=value=>String(value??'').trim();
const safeInteger=(value,min=0,max=Number.MAX_SAFE_INTEGER)=>Number.isSafeInteger(Number(value))&&Number(value)>=min&&Number(value)<=max;
const pushMissing=(missing,code)=>{if(!missing.includes(code))missing.push(code)};

export function buildThaiMartHandoff(product,gallery,origin,{sourceImageCount=gallery.length,invalidImageCount=0}={}){
  const ordered=[...gallery].sort((a,b)=>Number(a.position)-Number(b.position));
  const selectedCoverKey=text(product.image_1_key),cover=selectedCoverKey?ordered.find(item=>item.image_key===selectedCoverKey):null;
  const seenKeys=new Set(),media=[];
  for(const item of cover?[cover,...ordered]:ordered){
    if(!item||seenKeys.has(item.image_key))continue;
    seenKeys.add(item.image_key);
    media.push({url:galleryUrl(origin,product.id,Number(item.position),item.id),cover:item===cover});
  }
  const images=product.status==='published'?media:[];
  const name=text(product.title),description=text(product.description),sku=text(product.meta_id),currency=text(product.currency)||null;
  const priceCents=Number(product.price_cents),stock=Number(product.quantity),weightG=product.shopee_weight_g==null?null:Number(product.shopee_weight_g);
  const storedDimensions=[product.shopee_package_width_mm,product.shopee_package_length_mm,product.shopee_package_height_mm];
  const dimensionsAbsent=storedDimensions.every(value=>value==null),dimensionsConvertible=!dimensionsAbsent&&storedDimensions.every(value=>safeInteger(value,10)&&Number(value)%10===0);
  const dimensionsCm=dimensionsConvertible?{width_cm:Number(storedDimensions[0])/10,length_cm:Number(storedDimensions[1])/10,height_cm:Number(storedDimensions[2])/10}:null;
  const missing=[];
  if(product.status!=='published'||!images.length)pushMissing(missing,'product.images.public');
  if(sourceImageCount>THAIMART_MAX_IMAGES)pushMissing(missing,'product.images.max_9');
  if(invalidImageCount>0)pushMissing(missing,'product.images.jpeg_png_max_10mb');
  if(ordered.length!==seenKeys.size)pushMissing(missing,'product.images.unique');
  if(selectedCoverKey&&!cover)pushMissing(missing,'product.images.cover_public');
  if(!selectedCoverKey)pushMissing(missing,'product.images.cover');
  if(images.length<1||images.length>THAIMART_MAX_IMAGES)pushMissing(missing,'product.images.count_1_9');
  if(name.length<15||name.length>255)pushMissing(missing,'product.name.length_15_255');
  if(!description||description.length>10000)pushMissing(missing,'product.description.length_1_10000');
  if(currency!=='THB')pushMissing(missing,'product.sales.currency_thb');
  if(!safeInteger(priceCents,100,10000000)||priceCents%100!==0)pushMissing(missing,'product.sales.price_thb_integer_1_100000');
  if(!safeInteger(stock,0,999999))pushMissing(missing,'product.sales.stock_integer_0_999999');
  if(!safeInteger(weightG,1,50000))pushMissing(missing,'product.shipping.weight_g_integer_1_50000');
  if(!dimensionsAbsent){
    const values=dimensionsCm?Object.values(dimensionsCm):[];
    if(!dimensionsConvertible||values.length!==3||values.some(value=>!safeInteger(value,1,150)))pushMissing(missing,'product.shipping.dimensions_cm_integer_1_150');
    else if(values.reduce((sum,value)=>sum+value,0)>280)pushMissing(missing,'product.shipping.dimensions_cm_sum_max_280');
  }
  return{
    schema:THAIMART_HANDOFF_SCHEMA,
    version:THAIMART_HANDOFF_VERSION,
    platform:THAIMART_PLATFORM,
    product:{
      visiond_product_id:Number(product.id),
      category_path:[...THAIMART_CATEGORY_PATH],
      images,
      name,
      description,
      sku,
      sales:{currency,price_thb:safeInteger(priceCents,0)&&priceCents%100===0?priceCents/100:null,stock:safeInteger(stock,0)?stock:null},
      shipping:{weight_g:safeInteger(weightG,1)?weightG:null,dimensions_cm:dimensionsCm}
    },
    validation:{complete:missing.length===0,missing}
  };
}
