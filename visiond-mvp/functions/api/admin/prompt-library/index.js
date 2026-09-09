import {json,requireAdmin} from '../../../_lib.js';
import {assertPromptLibraryViewer,encodePromptLibraryCursor,promptLibraryAuthResponse,promptLibraryErrorResponse,promptLibraryHeaders,promptLibraryPageParams,promptSha256,samePromptLibraryMetadata,validatePromptLibraryPayload} from '../../../_prompt_library.js';

const summaryColumns="id,title,title_key,model_label,source_platform,prompt_chars,CASE WHEN example_url<>'' THEN 1 ELSE 0 END has_example,created_at,updated_at";
const existingColumns='id,title,model_label,source_platform,source_note,notes,example_url,example_note';
const ownerId=auth=>Number(auth.user.id);
async function authorize(ctx){return requireAdmin(ctx,{includeCourseOwner:false})}
const listItems=rows=>(rows||[]).map(({title_key,...row})=>({...row,has_example:Boolean(row.has_example)}));

async function listRecent(ctx,userId,page){
  const args=[userId];let where='created_by=?';
  if(page.after){where+=' AND (updated_at,id)<(?,?)';args.push(page.after.at,page.after.id)}
  return(await ctx.env.DB.prepare(`SELECT ${summaryColumns} FROM admin_prompt_library WHERE ${where} ORDER BY updated_at DESC,id DESC LIMIT ?`).bind(...args,page.limit+1).all()).results||[]
}
async function listTitle(ctx,userId,page){
  if(!page.after)return(await ctx.env.DB.prepare(`SELECT ${summaryColumns} FROM admin_prompt_library WHERE created_by=? AND title_key>=? AND title_key<? ORDER BY title_key ASC,id DESC LIMIT ?`).bind(userId,page.titleKey,page.upper,page.limit+1).all()).results||[];
  const same=(await ctx.env.DB.prepare(`SELECT ${summaryColumns} FROM admin_prompt_library WHERE created_by=? AND title_key=? AND id<? ORDER BY id DESC LIMIT ?`).bind(userId,page.after.key,page.after.id,page.limit+1).all()).results||[];
  if(same.length>=page.limit+1)return same;
  const remaining=page.limit+1-same.length,next=(await ctx.env.DB.prepare(`SELECT ${summaryColumns} FROM admin_prompt_library WHERE created_by=? AND title_key>? AND title_key<? ORDER BY title_key ASC,id DESC LIMIT ?`).bind(userId,page.after.key,page.upper,remaining).all()).results||[];
  return[...same,...next]
}
async function list(ctx,userId,page=promptLibraryPageParams(ctx.request.url)){
  const rows=page.mode==='title'?await listTitle(ctx,userId,page):await listRecent(ctx,userId,page),pageRows=rows.slice(0,page.limit),items=listItems(pageRows),last=pageRows.at(-1),hasMore=rows.length>page.limit;
  const nextCursor=hasMore&&last?encodePromptLibraryCursor(page.mode==='title'?{v:1,m:'title',q:page.titleKey,key:String(last.title_key??''),id:Number(last.id)}:{v:1,m:'recent',at:last.updated_at,id:Number(last.id)}):null;
  return{viewer_id:userId,items,pagination:{limit:page.limit,has_more:hasMore,next_cursor:nextCursor},query:page.query}
}

export async function onRequestGet(ctx){try{const auth=await authorize(ctx);if(auth.error)return promptLibraryAuthResponse(auth.error);const userId=ownerId(auth),page=promptLibraryPageParams(ctx.request.url);return json(await list(ctx,userId,page),200,promptLibraryHeaders)}catch(error){return promptLibraryErrorResponse(error)}}

export async function onRequestPost(ctx){
  try{
    const auth=await authorize(ctx);if(auth.error)return promptLibraryAuthResponse(auth.error);const userId=ownerId(auth),body=await ctx.request.json().catch(()=>null);assertPromptLibraryViewer(body,userId);const payload=validatePromptLibraryPayload(body),promptHash=await promptSha256(payload.prompt_text);
    const inserted=await ctx.env.DB.prepare(`INSERT OR IGNORE INTO admin_prompt_library(title,title_key,model_label,source_platform,source_note,notes,prompt_text,prompt_sha256,prompt_chars,example_url,example_note,created_by) VALUES(?,?,?,?,?,?,?,?,?,?,?,?) RETURNING id`).bind(payload.title,payload.title_key,payload.model_label,payload.source_platform,payload.source_note,payload.notes,payload.prompt_text,promptHash,payload.prompt_chars,payload.example_url,payload.example_note,userId).first();
    if(inserted?.id)return json({ok:true,id:Number(inserted.id),viewer_id:userId,deduplicated:false,prompt_sha256:promptHash},201,promptLibraryHeaders);
    const existing=await ctx.env.DB.prepare(`SELECT ${existingColumns} FROM admin_prompt_library WHERE created_by=? AND prompt_sha256=?`).bind(userId,promptHash).first();
    if(existing&&samePromptLibraryMetadata(existing,payload))return json({ok:true,id:Number(existing.id),viewer_id:userId,deduplicated:true,prompt_sha256:promptHash},200,promptLibraryHeaders);
    return json({error:'มี Prompt เนื้อหานี้อยู่แล้ว แต่ข้อมูลกำกับต่างกัน กรุณาเปิดรายการเดิมเพื่อแก้ไข',code:'PROMPT_LIBRARY_DUPLICATE_METADATA'},409,promptLibraryHeaders);
  }catch(error){return promptLibraryErrorResponse(error)}
}
