import {json,requireAdmin} from '../../_lib.js';

const headers={'cache-control':'private, no-store'},PAGE_SIZE=24,clean=(value,max=80)=>String(value||'').trim().slice(0,max);
const parseCursor=value=>{if(!value)return null;try{const parts=JSON.parse(value);if(!Array.isArray(parts)||parts.length!==3||parts.some(part=>typeof part!=='string'||!part))return null;return{updated_at:parts[0],shop_id:parts[1],id:parts[2]}}catch{return null}};
const nextCursor=row=>row?JSON.stringify([String(row.updated_at),String(row.shop_id),String(row.id)]):null;
const escapeLike=value=>value.replace(/[\\%_]/g,char=>`\\${char}`);

export async function onRequestGet(ctx){
  const auth=await requireAdmin(ctx);if(auth.error)return auth.error;
  const url=new URL(ctx.request.url),value=clean(url.searchParams.get('platform'),20),platform=['line','facebook'].includes(value)?value:'',q=clean(url.searchParams.get('q')),rawCursor=clean(url.searchParams.get('cursor'),400),cursor=parseCursor(rawCursor);
  if(rawCursor&&!cursor)return json({error:'Cursor บทสนทนาไม่ถูกต้อง'},400,headers);
  const where=["c.status='active'"],args=[];
  if(platform){where.push('c.platform=?');args.push(platform)}
  if(q){const like=`%${escapeLike(q)}%`;where.push("(c.display_name LIKE ? ESCAPE '\\' OR c.id LIKE ? ESCAPE '\\' OR s.name LIKE ? ESCAPE '\\' OR COALESCE(lm.content,'') LIKE ? ESCAPE '\\')");args.push(like,like,like,like)}
  if(cursor){where.push('c.updated_at<=? AND (c.updated_at<? OR (c.updated_at=? AND (c.shop_id>? OR (c.shop_id=? AND c.id>?))))');args.push(cursor.updated_at,cursor.updated_at,cursor.updated_at,cursor.shop_id,cursor.shop_id,cursor.id)}
  const rows=(await ctx.env.DB.prepare(`SELECT c.id,c.shop_id,c.display_name,c.profile_url,c.platform,c.updated_at,s.name shop_name,COALESCE(k.mode,'bot') mode,lm.content last_message,lm.message_type last_message_type
    FROM veasy_conversations c JOIN veasy_shops s ON s.id=c.shop_id
    LEFT JOIN veasy_conversation_controls k ON k.shop_id=c.shop_id AND k.conversation_id=c.id
    LEFT JOIN veasy_chat_messages lm ON lm.id=(SELECT m.id FROM veasy_chat_messages m WHERE m.shop_id=c.shop_id AND m.conversation_id=c.id ORDER BY m.created_at DESC,m.id DESC LIMIT 1)
    WHERE ${where.join(' AND ')} ORDER BY c.updated_at DESC,c.shop_id,c.id LIMIT ?`).bind(...args,PAGE_SIZE+1).all()).results||[];
  const hasMore=rows.length>PAGE_SIZE,conversations=rows.slice(0,PAGE_SIZE),last=conversations.at(-1);
  return json({conversations,channels:{line:true,facebook:platform!=='line'||conversations.some(row=>row.platform==='facebook')},pagination:{limit:PAGE_SIZE,has_more:hasMore,next_cursor:hasMore?nextCursor(last):null}},200,headers);
}
// V12-INBOX-001 — indexed active-list keyset page, server search and latest-message probe
