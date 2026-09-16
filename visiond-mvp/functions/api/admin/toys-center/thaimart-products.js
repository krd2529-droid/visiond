import {json,requireAdmin} from '../../../_lib.js';
import {encodeThaiMartSearchCursor,thaiMartPrefixUpperBound,thaiMartSearchPage} from '../../../_toys_center_thaimart.js';

const headers={'cache-control':'private, no-store'};

export async function onRequestGet(ctx){
  const auth=await requireAdmin(ctx);if(auth.error)return auth.error;
  const page=thaiMartSearchPage(new URL(ctx.request.url));
  if(!page.query)return json({error:'กรุณาพิมพ์ชื่อสินค้าอย่างน้อย 1 ตัวอักษร'},400,headers);
  if(page.invalidCursor)return json({error:'cursor ไม่ถูกต้อง'},400,headers);
  const upper=thaiMartPrefixUpperBound(page.query),upperSql=upper===null?'':' AND title COLLATE NOCASE<?',cursorSql=page.cursor?' AND (title COLLATE NOCASE>? OR (title COLLATE NOCASE=? AND id>?))':'',bindings=[page.query,...(upper===null?[]:[upper]),...(page.cursor?[page.cursor.title,page.cursor.title,page.cursor.id]:[]),page.limit+1];
  const rows=(await ctx.env.DB.prepare(`SELECT id,title,meta_id,status,updated_at FROM toys_center_products WHERE title COLLATE NOCASE>=?${upperSql}${cursorSql} ORDER BY title COLLATE NOCASE,id LIMIT ?`).bind(...bindings).all()).results||[],hasMore=rows.length>page.limit,items=rows.slice(0,page.limit),last=items.at(-1);
  return json({items,pagination:{limit:page.limit,has_more:hasMore,next_cursor:hasMore&&last?encodeThaiMartSearchCursor(last):null}},200,headers);
}
