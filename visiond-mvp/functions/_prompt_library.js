import {json} from './_lib.js';

export const promptLibraryHeaders={'cache-control':'private, no-store'};
const cursorTimePattern=/^\d{4}-\d{2}-\d{2} (?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d+)?$/;
const metadataFields=['title','model_label','source_platform','source_note','notes','example_url','example_note'];

export class PromptLibraryError extends Error{
  constructor(message,code,status=400){super(message);this.code=code;this.status=status}
}

const stringValue=(value,label,{optional=false}={})=>{if((value===null||value===undefined)&&optional)return'';if(typeof value!=='string')throw new PromptLibraryError(`${label}ไม่ถูกต้อง`,'PROMPT_LIBRARY_INPUT_INVALID');return value};
const malformedSurrogate=value=>{for(let index=0;index<value.length;index++){const code=value.charCodeAt(index);if(code>=0xd800&&code<=0xdbff){const next=value.charCodeAt(index+1);if(!(next>=0xdc00&&next<=0xdfff))return true;index++}else if(code>=0xdc00&&code<=0xdfff)return true}return false};
const trim=(value,max,label)=>{
  const text=stringValue(value,label).trim();
  if(text.length>max)throw new PromptLibraryError(`${label}ยาวเกินกำหนด`,'PROMPT_LIBRARY_INPUT_TOO_LONG');
  return text
};
const noControls=(value,label)=>{if(/[\u0000-\u001f\u007f]/.test(value)||malformedSurrogate(value))throw new PromptLibraryError(`${label}มีอักขระที่ไม่รองรับ`,'PROMPT_LIBRARY_INPUT_INVALID');return value};
const note=(value,max,label)=>{const text=stringValue(value,label,{optional:true});if(text.length>max)throw new PromptLibraryError(`${label}ยาวเกินกำหนด`,'PROMPT_LIBRARY_INPUT_TOO_LONG');if(text.includes('\0')||malformedSurrogate(text))throw new PromptLibraryError(`${label}มีอักขระที่ไม่รองรับ`,'PROMPT_LIBRARY_INPUT_INVALID');return text};

export function promptTitleKey(value){return String(value??'').normalize('NFKC').toLocaleLowerCase('th-TH').trim().replace(/\s+/gu,' ')}

export function validatePromptLibraryPayload(body){
  if(!body||typeof body!=='object'||Array.isArray(body))throw new PromptLibraryError('ข้อมูล Prompt ไม่ถูกต้อง','PROMPT_LIBRARY_INPUT_INVALID');
  const title=noControls(trim(body.title,160,'ชื่อ'),'ชื่อ'),model_label=noControls(trim(body.model_label,80,'ชื่อโมเดล'),'ชื่อโมเดล'),source_platform=noControls(trim(body.source_platform,80,'แหล่งที่มา'),'แหล่งที่มา');
  const source_note=note(body.source_note,1000,'รายละเอียดแหล่งที่มา'),notes=note(body.notes,2000,'หมายเหตุ'),example_note=note(body.example_note,1000,'หมายเหตุตัวอย่าง');
  if(!title||!model_label||!source_platform)throw new PromptLibraryError('กรุณากรอกชื่อ โมเดล และแหล่งที่มา','PROMPT_LIBRARY_REQUIRED');
  const title_key=promptTitleKey(title);if(title_key.length>320)throw new PromptLibraryError('ชื่อหลังปรับรูปแบบยาวเกินกำหนด','PROMPT_LIBRARY_INPUT_TOO_LONG');
  if(typeof body.prompt_text!=='string'||!body.prompt_text.trim())throw new PromptLibraryError('กรุณากรอก Prompt','PROMPT_LIBRARY_PROMPT_REQUIRED');
  const prompt_text=body.prompt_text,promptBytes=new TextEncoder().encode(prompt_text).byteLength;
  if(malformedSurrogate(prompt_text))throw new PromptLibraryError('Prompt มีอักขระที่ไม่รองรับ','PROMPT_LIBRARY_INPUT_INVALID');
  if(prompt_text.length>60000||promptBytes>65536)throw new PromptLibraryError('Prompt ต้องไม่เกิน 60,000 ตัวอักษรและ 64 KiB','PROMPT_LIBRARY_PROMPT_TOO_LARGE',413);
  let example_url=stringValue(body.example_url,'ลิงก์ตัวอย่าง',{optional:true}).trim();
  if(example_url.length>2048)throw new PromptLibraryError('ลิงก์ตัวอย่างยาวเกินกำหนด','PROMPT_LIBRARY_EXAMPLE_URL_INVALID');
  if(example_url){
    let parsed;try{parsed=new URL(example_url)}catch{throw new PromptLibraryError('ลิงก์ตัวอย่างต้องเป็น HTTPS','PROMPT_LIBRARY_EXAMPLE_URL_INVALID')}
    if(parsed.protocol!=='https:'||parsed.username||parsed.password)throw new PromptLibraryError('ลิงก์ตัวอย่างต้องเป็น HTTPS และไม่มีรหัสผ่านในลิงก์','PROMPT_LIBRARY_EXAMPLE_URL_INVALID');
  }
  return{title,title_key,model_label,source_platform,source_note,notes,prompt_text,prompt_chars:prompt_text.length,example_url,example_note}
}

export async function promptSha256(text){
  const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text));
  return[...new Uint8Array(bytes)].map(value=>value.toString(16).padStart(2,'0')).join('')
}

function encodeText(value){const bytes=new TextEncoder().encode(value);let binary='';for(const byte of bytes)binary+=String.fromCharCode(byte);return btoa(binary).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'')}
function decodeText(value){const padded=value.replace(/-/g,'+').replace(/_/g,'/')+'='.repeat((4-value.length%4)%4),binary=atob(padded),bytes=Uint8Array.from(binary,char=>char.charCodeAt(0));return new TextDecoder().decode(bytes)}
export function encodePromptLibraryCursor(value){return encodeText(JSON.stringify(value))}
function decodeCursor(value){
  try{if(!value||value.length>4096||!/^[A-Za-z0-9_-]+$/.test(value))throw new Error();const parsed=JSON.parse(decodeText(value));if(!parsed||typeof parsed!=='object'||Array.isArray(parsed))throw new Error();return parsed}catch{throw new PromptLibraryError('ตัวชี้หน้ารายการไม่ถูกต้อง','PROMPT_LIBRARY_CURSOR_INVALID')}
}
function validCursorTime(value){if(!cursorTimePattern.test(value))return false;const parsed=new Date(`${value.replace(' ','T')}Z`);return Number.isFinite(parsed.getTime())&&parsed.toISOString().slice(0,19).replace('T',' ')===value.slice(0,19)}
export function promptPrefixUpperBound(prefix){const points=Array.from(prefix);for(let index=points.length-1;index>=0;index--){const code=points[index].codePointAt(0);if(code===0xd7ff)return points.slice(0,index).join('')+'\ue000';if(code<0x10ffff)return points.slice(0,index).join('')+String.fromCodePoint(code+1)}return null}

export function promptLibraryPageParams(requestUrl){
  const params=new URL(requestUrl).searchParams,limitValue=params.get('limit');
  if(limitValue!==null&&!/^(?:[1-9]|1\d|2[0-4])$/.test(limitValue))throw new PromptLibraryError('จำนวนรายการต่อหน้าไม่ถูกต้อง','PROMPT_LIBRARY_LIMIT_INVALID');
  const limit=limitValue===null?24:Number(limitValue),query=String(params.get('q')??'').trim();
  if(query.length>160)throw new PromptLibraryError('คำค้นยาวเกินกำหนด','PROMPT_LIBRARY_QUERY_INVALID');
  const titleKey=query?promptTitleKey(noControls(query,'คำค้น')):'',mode=titleKey?'title':'recent',upper=titleKey?promptPrefixUpperBound(titleKey):null,rawCursor=params.get('cursor');
  if(titleKey&&(!upper||titleKey.length>320))throw new PromptLibraryError('คำค้นไม่ถูกต้อง','PROMPT_LIBRARY_QUERY_INVALID');
  if(!rawCursor)return{limit,query,titleKey,upper,mode,after:null};
  const after=decodeCursor(rawCursor);
  if(after.v!==1||after.m!==mode||!Number.isSafeInteger(after.id)||after.id<1)throw new PromptLibraryError('ตัวชี้หน้ารายการไม่ถูกต้อง','PROMPT_LIBRARY_CURSOR_INVALID');
  if(mode==='recent'&&!validCursorTime(after.at))throw new PromptLibraryError('ตัวชี้หน้ารายการไม่ถูกต้อง','PROMPT_LIBRARY_CURSOR_INVALID');
  if(mode==='title'&&(after.q!==titleKey||typeof after.key!=='string'||after.key.length>320||after.key<titleKey||after.key>=upper))throw new PromptLibraryError('ตัวชี้หน้ารายการไม่ถูกต้อง','PROMPT_LIBRARY_CURSOR_INVALID');
  return{limit,query,titleKey,upper,mode,after}
}

export function samePromptLibraryMetadata(row,payload){return metadataFields.every(field=>String(row?.[field]??'')===String(payload[field]??''))}
export function assertPromptLibraryViewer(body,userId){if(!Number.isSafeInteger(body?.expected_viewer_id)||body.expected_viewer_id!==Number(userId))throw new PromptLibraryError('บัญชีผู้ใช้เปลี่ยนแล้ว กรุณาโหลดคลังใหม่ก่อนบันทึก','PROMPT_LIBRARY_IDENTITY_CHANGED',409)}
export function promptLibraryAuthResponse(response){const next=new Response(response.body,response);next.headers.set('cache-control','private, no-store');return next}
export function promptLibraryErrorResponse(error){
  if(error instanceof PromptLibraryError)return json({error:error.message,code:error.code},error.status,promptLibraryHeaders);
  const message=String(error?.message||error);
  if(/no such table:\s*(?:main\.)?admin_prompt_library\b|no such column:\s*(?:admin_prompt_library\.)?(?:title_key|model_label|source_platform|source_note|notes|prompt_text|prompt_sha256|prompt_chars|example_url|example_note|created_by|created_at|updated_at)\b/i.test(message))return json({error:'คลัง Prompt ยังไม่พร้อม กรุณาติดตั้ง migration แล้วลองใหม่',code:'PROMPT_LIBRARY_SCHEMA_REQUIRED'},503,promptLibraryHeaders);
  if(/UNIQUE constraint failed:\s*admin_prompt_library\.created_by,\s*admin_prompt_library\.prompt_sha256/i.test(message))return json({error:'มี Prompt เนื้อหานี้อยู่แล้วในคลัง',code:'PROMPT_LIBRARY_DUPLICATE'},409,promptLibraryHeaders);
  return json({error:'ไม่สามารถทำรายการคลัง Prompt ได้ กรุณาลองใหม่',code:'PROMPT_LIBRARY_FAILED'},500,promptLibraryHeaders)
}
