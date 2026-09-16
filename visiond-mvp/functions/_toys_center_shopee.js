import {galleryUrl,normalizeToySearch} from './_toys_center.js';

export const SHOPEE_HANDOFF_SCHEMA='visiond.shopee-product-handoff';
export const SHOPEE_HANDOFF_VERSION=1;
export const SHOPEE_CATEGORY_PATH=['งานอดิเรกและของสะสม','ของสะสม','อื่นๆ'];

const encodeText=value=>{const bytes=new TextEncoder().encode(value);let binary='';for(const byte of bytes)binary+=String.fromCharCode(byte);return btoa(binary).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'')};
const decodeText=value=>{const encoded=String(value||'').replace(/-/g,'+').replace(/_/g,'/'),binary=atob(encoded+'='.repeat((4-encoded.length%4)%4));return new TextDecoder().decode(Uint8Array.from(binary,char=>char.charCodeAt(0)))};

export const encodeShopeeSearchCursor=row=>encodeText(JSON.stringify([String(row.title),Number(row.id)]));
export function decodeShopeeSearchCursor(value){if(!value)return null;try{const parsed=JSON.parse(decodeText(value));return Array.isArray(parsed)&&parsed.length===2&&typeof parsed[0]==='string'&&parsed[0].length<=200&&Number.isSafeInteger(parsed[1])&&parsed[1]>0?{title:parsed[0],id:parsed[1]}:null}catch{return null}}

export function shopeeSearchPage(url){const params=url.searchParams,query=normalizeToySearch(params.get('q')),requested=params.has('limit')?Number(params.get('limit')):24,limit=Number.isInteger(requested)?Math.min(24,Math.max(1,requested)):24,cursorRaw=params.get('cursor'),cursor=decodeShopeeSearchCursor(cursorRaw);return{query,limit,cursor,invalidCursor:Boolean(cursorRaw&&!cursor)}}
export function shopeePrefixUpperBound(prefix){const points=Array.from(String(prefix));for(let index=points.length-1;index>=0;index--){const value=points[index].codePointAt(0);if(value<0x10ffff)return points.slice(0,index).join('')+String.fromCodePoint(value+1)}return null}

const text=value=>String(value??'').trim();
export function buildShopeeHandoff(product,gallery,origin){
  const ordered=[...gallery].sort((a,b)=>Number(a.position)-Number(b.position));
  const selectedCoverKey=text(product.image_1_key),cover=selectedCoverKey?ordered.find(item=>item.image_key===selectedCoverKey):ordered.find(item=>Number(item.position)===0)||ordered[0];
  const seen=new Set(),media=[];
  for(const item of cover?[cover,...ordered]:ordered){if(!item||seen.has(item.image_key)||media.length>=10)continue;seen.add(item.image_key);media.push({url:galleryUrl(origin,product.id,Number(item.position),item.id),cover:item===cover})}
  const images=product.status==='published'?media:[];
  const missing=[];
  if(!images.length)missing.push('page_1.images.public');
  if(product.status==='published'&&selectedCoverKey&&!cover)missing.push('page_1.images.cover_public');
  if(!text(product.title))missing.push('page_1.name');
  if(!text(product.meta_id))missing.push('page_1.sku');
  if(!text(product.gtin))missing.push('page_1.gtin');
  if(!text(product.brand))missing.push('page_2.brand');
  if(!text(product.description))missing.push('page_2.description');
  if(!text(product.currency))missing.push('page_2.sales.currency');
  if(!Number.isSafeInteger(Number(product.price_cents))||Number(product.price_cents)<=0)missing.push('page_2.sales.price_minor');
  if(!Number.isSafeInteger(Number(product.quantity))||Number(product.quantity)<0)missing.push('page_2.sales.stock');
  if(!Number.isSafeInteger(Number(product.shopee_weight_g))||Number(product.shopee_weight_g)<=0)missing.push('page_2.shipping.weight_g');
  if(!Number.isSafeInteger(Number(product.shopee_package_width_mm))||Number(product.shopee_package_width_mm)<=0)missing.push('page_2.shipping.width_mm');
  if(!Number.isSafeInteger(Number(product.shopee_package_length_mm))||Number(product.shopee_package_length_mm)<=0)missing.push('page_2.shipping.length_mm');
  if(!Number.isSafeInteger(Number(product.shopee_package_height_mm))||Number(product.shopee_package_height_mm)<=0)missing.push('page_2.shipping.height_mm');
  return{
    schema:SHOPEE_HANDOFF_SCHEMA,
    version:SHOPEE_HANDOFF_VERSION,
    product:{
      visiond_product_id:Number(product.id),
      page_1:{images,name:text(product.title),sku:text(product.meta_id),gtin:text(product.gtin)||null},
      page_2:{category_path:[...SHOPEE_CATEGORY_PATH],brand:text(product.brand)||null,description:text(product.description),sales:{currency:text(product.currency)||null,price_minor:Number(product.price_cents),stock:Number(product.quantity)},shipping:{weight_g:product.shopee_weight_g==null?null:Number(product.shopee_weight_g),width_mm:product.shopee_package_width_mm==null?null:Number(product.shopee_package_width_mm),length_mm:product.shopee_package_length_mm==null?null:Number(product.shopee_package_length_mm),height_mm:product.shopee_package_height_mm==null?null:Number(product.shopee_package_height_mm)}}
    },
    validation:{complete:missing.length===0,missing}
  };
}
