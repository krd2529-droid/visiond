import {json,requireAdmin} from '../../../_lib.js';
import {assertPromptLibraryViewer,promptLibraryAuthResponse,promptLibraryErrorResponse,promptLibraryHeaders,promptSha256,validatePromptLibraryPayload} from '../../../_prompt_library.js';

async function authorize(ctx){return requireAdmin(ctx,{includeCourseOwner:false})}
function recordId(ctx){const raw=String(ctx.params.id??'');if(!/^[1-9]\d*$/.test(raw))return 0;const id=Number(raw);return Number.isSafeInteger(id)?id:0}

export async function onRequestGet(ctx){
  try{const auth=await authorize(ctx);if(auth.error)return promptLibraryAuthResponse(auth.error);const id=recordId(ctx);if(!id)return json({error:'รหัส Prompt ไม่ถูกต้อง'},400,promptLibraryHeaders);const item=await ctx.env.DB.prepare(`SELECT id,title,model_label,source_platform,source_note,notes,prompt_text,prompt_sha256,prompt_chars,example_url,example_note,created_at,updated_at FROM admin_prompt_library WHERE id=? AND created_by=?`).bind(id,auth.user.id).first();if(!item)return json({error:'ไม่พบ Prompt นี้'},404,promptLibraryHeaders);return json({viewer_id:Number(auth.user.id),item},200,promptLibraryHeaders)}catch(error){return promptLibraryErrorResponse(error)}
}

export async function onRequestPatch(ctx){
  try{
    const auth=await authorize(ctx);if(auth.error)return promptLibraryAuthResponse(auth.error);const id=recordId(ctx);if(!id)return json({error:'รหัส Prompt ไม่ถูกต้อง'},400,promptLibraryHeaders);const body=await ctx.request.json().catch(()=>null);assertPromptLibraryViewer(body,auth.user.id);const payload=validatePromptLibraryPayload(body),promptHash=await promptSha256(payload.prompt_text);
    const updated=await ctx.env.DB.prepare(`UPDATE admin_prompt_library SET title=?,title_key=?,model_label=?,source_platform=?,source_note=?,notes=?,prompt_text=?,prompt_sha256=?,prompt_chars=?,example_url=?,example_note=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND created_by=? RETURNING id`).bind(payload.title,payload.title_key,payload.model_label,payload.source_platform,payload.source_note,payload.notes,payload.prompt_text,promptHash,payload.prompt_chars,payload.example_url,payload.example_note,id,auth.user.id).first();
    if(!updated)return json({error:'ไม่พบ Prompt นี้'},404,promptLibraryHeaders);return json({ok:true,id,viewer_id:Number(auth.user.id),prompt_sha256:promptHash},200,promptLibraryHeaders)
  }catch(error){return promptLibraryErrorResponse(error)}
}

export async function onRequestDelete(ctx){
  try{const auth=await authorize(ctx);if(auth.error)return promptLibraryAuthResponse(auth.error);const id=recordId(ctx);if(!id)return json({error:'รหัส Prompt ไม่ถูกต้อง'},400,promptLibraryHeaders);const body=await ctx.request.json().catch(()=>null);assertPromptLibraryViewer(body,auth.user.id);const deleted=await ctx.env.DB.prepare('DELETE FROM admin_prompt_library WHERE id=? AND created_by=? RETURNING id').bind(id,auth.user.id).first();if(!deleted)return json({error:'ไม่พบ Prompt นี้'},404,promptLibraryHeaders);return json({ok:true,id,viewer_id:Number(auth.user.id)},200,promptLibraryHeaders)}catch(error){return promptLibraryErrorResponse(error)}
}
