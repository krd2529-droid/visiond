import {json} from '../../../_lib.js';
import {requireVxWorkspaceUser,vxWorkspaceOwnerId,isVxWorkspaceDelegate,vxWorkspaceAccessStillCurrent} from '../../../_vx_workspace.js';
import { ensureDatabase } from "../../../_schema.js";
import { ensureTikTokAnalyzerSchema } from "../../../_tiktok_analyzer.js";
import { revokeTikTokToken, syncTikTokConnection, tikTokCapabilities, tikTokVisibleProfile } from "../../../_tiktok_oauth.js";
import { decryptChannelValue } from "../../../_channel_crypto.js";
import { addTikTokShopShowcaseProducts, normalizeTikTokOrderProducts, removeTikTokShopShowcaseProducts, syncTikTokShopCreator } from "../../../_tiktok_shop_api.js";
import { tikTokShopCreatorCapabilities } from "../../../_tiktok_shop_oauth.js";
import { commissionAvailability } from "../../../_tiktok_commission.js";
import { requireD1DataFetchAvailable } from "../../../_d1_quota_breaker.js";
import {orderCoverage,syncOrderPage,canReadOrders} from '../../../_tiktok_order_sync.js';
const headers = { "cache-control": "private, no-store" }, clean = (v, n = 80) => String(v || "").trim().slice(0, n);
const CONNECTION_PAGE_SIZE=24,pageCursor=value=>{const raw=String(value||''),split=raw.lastIndexOf('|'),at=raw.slice(0,split),id=raw.slice(split+1);return split>0&&/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}/.test(at)&&/^[0-9a-f-]{36}$/i.test(id)?{at,id}:null},pageResult=rows=>{const hasMore=rows.length>CONNECTION_PAGE_SIZE,items=rows.slice(0,CONNECTION_PAGE_SIZE),last=items.at(-1);return{items,pagination:{limit:CONNECTION_PAGE_SIZE,has_more:hasMore,next_cursor:hasMore&&last?`${last.updated_at}|${last.id}`:null}}};
const parsed = (value) => {
  try {
    return JSON.parse(value || "null");
  } catch {
    return null;
  }
}, rawImage = (raw) => {
  const visit = (value, imageContext = false) => {
    if (typeof value === "string") return imageContext && /^https?:\/\//i.test(value) ? value.slice(0, 1500) : "";
    if (!value || typeof value !== "object") return "";
    for (const [key, child] of Object.entries(value)) {
      const found = visit(child, imageContext || /image|cover|thumbnail/i.test(key));
      if (found) return found;
    }
    return "";
  };
  return visit(parsed(raw));
}, commissionDashboard = (rows) => {
  const currencies = {};
  for (const row of rows) {
    const value = parsed(row.commission_json), amount = Number(value?.amount);
    if (!Number.isFinite(amount) || !value?.currency) continue;
    const currency = clean(value.currency, 20), day = new Date((Number(row.create_time) + 25200) * 1e3).toISOString().slice(0, 10), channelId = clean(row.channel_id || row.connection_id, 120) || "unknown", channelLabel = clean(row.channel_name || row.creator_username || row.channel_id, 120) || "\u0E44\u0E21\u0E48\u0E23\u0E30\u0E1A\u0E38\u0E0A\u0E48\u0E2D\u0E07";
    currencies[currency] ??= { total30: 0, byDay: {}, channels: {} };
    currencies[currency].total30 += amount;
    currencies[currency].byDay[day] = (currencies[currency].byDay[day] || 0) + amount;
    currencies[currency].channels[channelId] ??= { channel: channelLabel, amount: 0 };
    currencies[currency].channels[channelId].amount += amount;
  }
  return Object.entries(currencies).map(([currency, value]) => ({ currency, total_30: Number(value.total30.toFixed(2)), daily: Object.entries(value.byDay).sort(([a], [b]) => b.localeCompare(a)).map(([date, amount]) => ({ date, amount: Number(amount.toFixed(2)) })), channels: Object.entries(value.channels).sort(([,a], [,b]) => b.amount-a.amount).map(([channel_id, item]) => ({ channel_id, channel: item.channel, amount: Number(item.amount.toFixed(2)) })) }));
};
export { commissionDashboard };
const publicConnection = (row) => tikTokVisibleProfile({ id: row.id, channel_id: row.channel_id, display_name: row.display_name, avatar_revision: row.avatar_revision, profile_url: row.profile_url, bio: row.bio, is_verified: Boolean(row.is_verified), follower_count: Number(row.follower_count) || 0, following_count: Number(row.following_count) || 0, likes_count: Number(row.likes_count) || 0, video_count: Number(row.video_count) || 0, scopes: row.scopes, status: row.status, last_synced_at: row.last_synced_at });
const shiftDate = (date, days) => {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d) + days * 864e5).toISOString().slice(0, 10);
}, dateRange = (url, now = Date.now()) => {
  const pattern = /^\d{4}-\d{2}-\d{2}$/, availability = commissionAvailability(now), fallbackTo = availability.latestDate, fallbackFrom = shiftDate(fallbackTo, -29);
  let from = clean(url.searchParams.get("date_from"), 10), to = clean(url.searchParams.get("date_to"), 10);
  if (!pattern.test(from)) from = fallbackFrom;
  if (!pattern.test(to) || to > availability.latestDate) to = availability.latestDate;
  let fromEpoch = Math.floor(Date.parse(`${from}T00:00:00+07:00`) / 1e3), toExclusive = Math.floor(Date.parse(`${to}T00:00:00+07:00`) / 1e3) + 86400;
  if (!Number.isFinite(fromEpoch) || !Number.isFinite(toExclusive) || fromEpoch >= toExclusive) {
    from = fallbackFrom;
    to = fallbackTo;
    fromEpoch = Math.floor(Date.parse(`${from}T00:00:00+07:00`) / 1e3);
    toExclusive = Math.floor(Date.parse(`${to}T00:00:00+07:00`) / 1e3) + 86400;
  }
  return { from, to, fromEpoch, toExclusive, availability };
};
async function onRequestGet(ctx) {
  await ensureDatabase(ctx.env);
  const auth = await requireVxWorkspaceUser(ctx);
  if (auth.error) return auth.error;
  const ownerId=vxWorkspaceOwnerId(auth),delegated=isVxWorkspaceDelegate(auth);
  const url = new URL(ctx.request.url), channelId = clean(url.searchParams.get("channel_id")), range = dateRange(url),connectionCursor=pageCursor(url.searchParams.get('connection_cursor')),shopCursor=pageCursor(url.searchParams.get('shop_cursor'));
  if(delegated&&!channelId)return json({error:'บัญชีผู้ปฏิบัติงาน VX ต้องเลือกช่องก่อนโหลดข้อมูล'},400,headers);
  const connectionRows = (await ctx.env.DB.prepare(`SELECT id,channel_id,display_name,avatar_revision,profile_url,bio,is_verified,follower_count,following_count,likes_count,video_count,scopes,status,last_synced_at,updated_at FROM tiktok_connections WHERE user_id=? AND status='active' AND (?='' OR channel_id=?) ${connectionCursor?'AND (updated_at<? OR (updated_at=? AND id<?))':''} ORDER BY updated_at DESC,id DESC LIMIT ?`).bind(ownerId, channelId, channelId,...(connectionCursor?[connectionCursor.at,connectionCursor.at,connectionCursor.id]:[]),CONNECTION_PAGE_SIZE+1).all()).results || [],connectionPage=pageResult(connectionRows),connections=connectionPage.items;
  let videos = [];
  if (channelId && connections[0] && tikTokCapabilities(connections[0].scopes).basic && tikTokCapabilities(connections[0].scopes).videos) videos = (await ctx.env.DB.prepare("SELECT video_id,title,description,create_time,duration,cover_url,embed_link,view_count,like_count,comment_count,share_count,synced_at FROM tiktok_connection_videos WHERE connection_id=? ORDER BY create_time DESC LIMIT 100").bind(connections[0].id).all()).results || [];
  const shopRows = (await ctx.env.DB.prepare(`SELECT id,channel_id,scopes,status,creator_username,selection_region,last_synced_at,last_sync_error,created_at,updated_at FROM tiktok_shop_creator_connections WHERE user_id=? AND status='active' AND (?='' OR channel_id=?) ${shopCursor?'AND (updated_at<? OR (updated_at=? AND id<?))':''} ORDER BY updated_at DESC,id DESC LIMIT ?`).bind(ownerId, channelId, channelId,...(shopCursor?[shopCursor.at,shopCursor.at,shopCursor.id]:[]),CONNECTION_PAGE_SIZE+1).all()).results || [],shopPage=pageResult(shopRows),shopConnections=shopPage.items;
  let shopProducts = [], shopOrders = [], shopGrowthOrders = [];
  const orderState=delegated?{status:'restricted'}:await orderCoverage(ctx.env,channelId?shopConnections[0]:null,range);
  if (channelId && shopConnections[0]) {
    if(delegated){
      shopProducts=(await ctx.env.DB.prepare(`SELECT product_id,name,image_url,product_url,origin,price_json,product_grade,synced_at FROM tiktok_shop_showcase_products WHERE connection_id=? ORDER BY product_grade,sort_order LIMIT 2000`).bind(shopConnections[0].id).all()).results||[];
    }else{
      const shopProductRows = (await ctx.env.DB.prepare(`SELECT product_id,name,image_url,product_url,origin,price_json,commission_json,product_grade,raw_json,synced_at FROM tiktok_shop_showcase_products WHERE connection_id=? ORDER BY product_grade,sort_order LIMIT 2000`).bind(shopConnections[0].id).all()).results || [];
      shopProducts = shopProductRows.map(({ raw_json: rawJson, ...product }) => ({ ...product, raw_image_url: rawImage(rawJson) }));
    }
    if(!delegated){
      const orderRows = (await ctx.env.DB.prepare(`SELECT order_id,create_time,product_ids,status,gmv_json,commission_json,raw_json,synced_at FROM tiktok_shop_affiliate_orders WHERE connection_id=? AND create_time>=? AND create_time<? ORDER BY create_time DESC LIMIT 5000`).bind(shopConnections[0].id, range.fromEpoch, range.toExclusive).all()).results || [];
      shopOrders = orderRows.map(({ raw_json: rawJson, ...order }) => ({ ...order, product_details: normalizeTikTokOrderProducts(rawJson) }));
      const growthRows = (await ctx.env.DB.prepare(`SELECT order_id,create_time,product_ids,status,gmv_json,commission_json,raw_json,synced_at FROM tiktok_shop_affiliate_orders WHERE connection_id=? AND create_time>=? AND create_time<? ORDER BY create_time DESC LIMIT 5000`).bind(shopConnections[0].id, range.toExclusive - 14 * 86400, range.toExclusive).all()).results || [];
      shopGrowthOrders = growthRows.map(({ raw_json: rawJson, ...order }) => ({ ...order, product_details: normalizeTikTokOrderProducts(rawJson) }));
    }
  }
  let portfolioProducts=[],portfolioOrders=[];if(!delegated){portfolioProducts = (await ctx.env.DB.prepare(`SELECT p.connection_id,p.product_id,p.name,p.image_url,p.product_url,p.commission_json,p.product_grade,c.channel_id,c.creator_username,ch.name channel_name FROM tiktok_shop_showcase_products p JOIN tiktok_shop_creator_connections c ON c.id=p.connection_id LEFT JOIN tiktok_channels ch ON ch.id=c.channel_id WHERE c.user_id=? AND c.status='active' AND (?='' OR c.channel_id=?) ORDER BY p.product_grade,p.name LIMIT 2000`).bind(ownerId, channelId, channelId).all()).results || [];portfolioOrders = (await ctx.env.DB.prepare(`SELECT o.connection_id,o.order_id,o.create_time,o.product_ids,o.commission_json,c.channel_id,c.creator_username,ch.name channel_name FROM tiktok_shop_affiliate_orders o JOIN tiktok_shop_creator_connections c ON c.id=o.connection_id LEFT JOIN tiktok_channels ch ON ch.id=c.channel_id WHERE c.user_id=? AND c.status='active' AND (?='' OR c.channel_id=?) AND o.create_time>=? AND o.create_time<? ORDER BY o.create_time DESC LIMIT 5000`).bind(ownerId, channelId, channelId, range.fromEpoch, range.toExclusive).all()).results || []}
  const response={ configured: Boolean(ctx.env.TIKTOK_CLIENT_KEY && ctx.env.TIKTOK_CLIENT_SECRET), shop_configured: Boolean(ctx.env.TIKTOK_SHOP_APP_KEY && ctx.env.TIKTOK_SHOP_APP_SECRET), connections: connections.map(publicConnection), shop_connections: shopConnections.map(row => delegated?({ ...row,capabilities:tikTokShopCreatorCapabilities(row.scopes) }):({ ...row,can_read_orders:canReadOrders(row),capabilities:tikTokShopCreatorCapabilities(row.scopes) })), connection_pagination:connectionPage.pagination,shop_connection_pagination:shopPage.pagination, shop_products: shopProducts, videos };
  if(!delegated){response.order_sync={...orderState,truncated:shopOrders.length>=5000};response.shop_orders=shopOrders;response.shop_growth_orders=shopGrowthOrders;response.date_range={from:range.from,to:range.to};response.commission_availability={ ready: range.availability.ready, latest_date: range.availability.latestDate, next_ready_at: range.availability.nextReadyAt };response.shop_portfolio={ products: portfolioProducts, orders: portfolioOrders, commission: commissionDashboard(portfolioOrders) }}
  return json(response,200,headers);
}
async function onRequestPost(ctx) {
  await ensureDatabase(ctx.env);
  const body = await ctx.request.clone().json().catch(() => ({})), id = clean(body.id), action = clean(body.action, 30), guarded=action==='sync'||action==='shop_sync'||action==='shop_orders';
  const auth = await requireVxWorkspaceUser(ctx,{bootstrap:!guarded});
  if (auth.error) return auth.error;
  const ownerId=vxWorkspaceOwnerId(auth),delegated=isVxWorkspaceDelegate(auth);
  const stillAuthorized=()=>vxWorkspaceAccessStillCurrent(ctx,auth),workspaceDenied=()=>json({error:'สิทธิ์ใช้งานพื้นที่ช่อง VX สิ้นสุดแล้ว กรุณาเข้าสู่ระบบใหม่'},403,headers);
  if(guarded){const blocked=await requireD1DataFetchAvailable(ctx,action==='sync'?'tiktok_profile_sync':'tiktok_shop_sync');if(blocked)return blocked}
  await ensureTikTokAnalyzerSchema(ctx.env);
  if (action.startsWith("shop_")) {
    const requestedChannelId=clean(body.channel_id),shop = await ctx.env.DB.prepare("SELECT * FROM tiktok_shop_creator_connections WHERE id=? AND user_id=? AND channel_id=? AND status='active'").bind(id, ownerId, requestedChannelId).first();
    if (!shop) return json({ error: "\u0E44\u0E21\u0E48\u0E1E\u0E1A\u0E1A\u0E31\u0E0D\u0E0A\u0E35 TikTok Shop Creator \u0E17\u0E35\u0E48\u0E40\u0E0A\u0E37\u0E48\u0E2D\u0E21\u0E2D\u0E22\u0E39\u0E48" }, 404, headers);
    if(action==='shop_orders'){
      if(delegated)return json({error:'บัญชีผู้ปฏิบัติงาน VX ไม่มีสิทธิ์อ่านหรือซิงก์ข้อมูลค่าคอมมิชชัน'},403,headers);
      const rangeUrl=new URL(ctx.request.url);rangeUrl.search=new URLSearchParams({date_from:body.date_from||'',date_to:body.date_to||''}).toString();
      const range=dateRange(rangeUrl);
      if(range.from!==body.date_from||range.to!==body.date_to)return json({error:'กรุณาเลือกช่วงวันที่ที่ผ่านมาไม่เกิน 90 วัน',order_sync:{status:'invalid_range'}},400,headers);
      let result;try{result=await syncOrderPage(ctx.env,shop,range,body.request_id,{expectedRevision:body.revision,stillAuthorized:()=>vxWorkspaceAccessStillCurrent(ctx,auth)})}catch{return json({error:'ระบบข้อมูลออเดอร์ยังไม่พร้อม กรุณาลองใหม่ภายหลัง'},503,headers)}
      return json({ok:['complete','partial','running'].includes(result.status),order_sync:result},200,headers);
    }
    if (action === "shop_sync") {
      try {
        const maxShowcase = Math.min(2000, Math.max(1, Math.floor(Number(body.max_showcase) || 100)));
        const mode=delegated?'showcase':['showcase','orders'].includes(body.mode)?body.mode:'all';
        const synced=await syncTikTokShopCreator(ctx.env, shop, { days: Number(body.days) || 30, maxShowcase, syncShowcase:mode!=='orders', syncOrders:mode!=='showcase',stillAuthorized });
        if(!await stillAuthorized())return workspaceDenied();
        if(delegated)delete synced.orderCount;
        return json({ ok: true, ...synced }, 200, headers);
      } catch (error) {
        if(!await stillAuthorized())return workspaceDenied();
        await ctx.env.DB.prepare("UPDATE tiktok_shop_creator_connections SET last_sync_error=?,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(clean(error.message, 300), id).run();
        return json({ error: "TikTok Shop \u0E22\u0E31\u0E07\u0E44\u0E21\u0E48\u0E2D\u0E19\u0E38\u0E0D\u0E32\u0E15\u0E43\u0E2B\u0E49\u0E14\u0E36\u0E07\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25 \u0E2B\u0E23\u0E37\u0E2D\u0E42\u0E17\u0E40\u0E04\u0E19\u0E2B\u0E21\u0E14\u0E2D\u0E32\u0E22\u0E38", detail: clean(error.message, 240) }, 502, headers);
      }
    }
    if (action === "shop_add") {
      const productIds = Array.isArray(body.product_ids) ? body.product_ids.map((x) => clean(x, 100)).filter(Boolean).slice(0, 200) : [];
      if (!productIds.length) return json({ error: "\u0E01\u0E23\u0E38\u0E13\u0E32\u0E43\u0E2A\u0E48\u0E23\u0E2B\u0E31\u0E2A\u0E2A\u0E34\u0E19\u0E04\u0E49\u0E32" }, 400, headers);
      try {
        const result = await addTikTokShopShowcaseProducts(ctx.env, shop, productIds,undefined,{stillAuthorized});
        if(!await stillAuthorized())return workspaceDenied();
        if (result.errors?.length && !result.added) return json({ error: "TikTok ปฏิเสธสินค้าทุกรายการ", detail: result.errors, ...result }, 422, headers);
        const blocked=await requireD1DataFetchAvailable(ctx,'tiktok_shop_post_add_refresh');if(blocked)return json({ok:true,...result,synced:false,sync_deferred:'d1_quota_breaker',warning:'เพิ่มสินค้าเข้า Showcase แล้ว แต่ระบบพักการดึงรายการล่าสุดตามโควตา D1'},200,headers);
        try {
          await syncTikTokShopCreator(ctx.env, shop, { days: 30, syncOrders:!delegated,stillAuthorized });
          if(!await stillAuthorized())return workspaceDenied();
          return json({ ok: true, ...result, synced: true, warning: result.errors?.length ? `เพิ่มสำเร็จ ${result.added} จาก ${result.requested} รายการ กรุณาตรวจรายการที่ TikTok ปฏิเสธ` : "" }, 200, headers);
        } catch (syncError) {
          if(!await stillAuthorized())return workspaceDenied();
          await ctx.env.DB.prepare("UPDATE tiktok_shop_creator_connections SET last_sync_error=?,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(clean(syncError.message, 300), id).run();
          return json({ ok: true, ...result, synced: false, warning: "เพิ่มสินค้าเข้า Showcase แล้ว แต่ดึงรายการล่าสุดกลับมาแสดงยังไม่สำเร็จ กรุณากดซิงก์ใหม่" }, 200, headers);
        }
      } catch (error) {
        if(!await stillAuthorized())return workspaceDenied();
        const missingScope = String(error.message).includes("SCOPE_CREATOR_SHOWCASE_WRITE");
        return json({ error: missingScope ? "แอป TikTok Shop ยังไม่มีสิทธิ์เขียน Showcase กรุณาเปิด creator.showcase.write (หรือ creator.video.write) ใน Partner Center แล้วกดยกเลิกการเชื่อมต่อและเชื่อมใหม่" : "เพิ่มสินค้าใน Showcase ไม่สำเร็จ", detail: clean(error.message, 240), reconnect_required: missingScope }, missingScope ? 403 : 502, headers);
      }
    }
    if (action === "shop_remove") {
      const requested = Array.isArray(body.product_ids) ? body.product_ids.map((x) => clean(x, 100)).filter(Boolean).slice(0, 200) : [], rows = (await ctx.env.DB.prepare("SELECT product_id FROM tiktok_shop_showcase_products WHERE connection_id=?").bind(id).all()).results || [], allowed = new Set(rows.map((x) => String(x.product_id))), productIds = requested.filter((x) => allowed.has(x));
      if (productIds.length !== requested.length || !productIds.length) return json({ error: "\u0E01\u0E23\u0E38\u0E13\u0E32\u0E40\u0E25\u0E37\u0E2D\u0E01\u0E2A\u0E34\u0E19\u0E04\u0E49\u0E32\u0E17\u0E35\u0E48\u0E2D\u0E22\u0E39\u0E48\u0E43\u0E19 Showcase" }, 400, headers);
      try {
        const result=await removeTikTokShopShowcaseProducts(ctx.env, shop, productIds,undefined,{stillAuthorized});
        if(!await stillAuthorized())return workspaceDenied();
        return json({ ok: true, ...result }, 200, headers);
      } catch (error) {
        if(!await stillAuthorized())return workspaceDenied();
        const missingScope = String(error.message).includes("SCOPE_CREATOR_SHOWCASE_WRITE");
        return json({ error: missingScope ? "\u0E15\u0E49\u0E2D\u0E07\u0E40\u0E1B\u0E34\u0E14\u0E2A\u0E34\u0E17\u0E18\u0E34\u0E4C creator.showcase.write \u0E41\u0E25\u0E49\u0E27\u0E40\u0E0A\u0E37\u0E48\u0E2D\u0E21 TikTok Shop \u0E43\u0E2B\u0E21\u0E48" : "\u0E25\u0E1A\u0E2A\u0E34\u0E19\u0E04\u0E49\u0E32 Showcase \u0E44\u0E21\u0E48\u0E2A\u0E33\u0E40\u0E23\u0E47\u0E08", detail: clean(error.message, 240) }, missingScope ? 403 : 502, headers);
      }
    }
    if (action === "shop_disconnect") {
      if(!await stillAuthorized())return workspaceDenied();
      await ctx.env.DB.batch([ctx.env.DB.prepare("DELETE FROM tiktok_shop_order_coverage WHERE connection_id=?").bind(id), ctx.env.DB.prepare("DELETE FROM tiktok_shop_marketplace_snapshots WHERE connection_id=?").bind(id), ctx.env.DB.prepare("DELETE FROM tiktok_shop_showcase_products WHERE connection_id=?").bind(id), ctx.env.DB.prepare("DELETE FROM tiktok_shop_affiliate_orders WHERE connection_id=?").bind(id), ctx.env.DB.prepare("DELETE FROM tiktok_shop_creator_connections WHERE id=? AND user_id=?").bind(id, ownerId)]);
      return json({ ok: true }, 200, headers);
    }
    return json({ error: "\u0E04\u0E33\u0E2A\u0E31\u0E48\u0E07 TikTok Shop \u0E44\u0E21\u0E48\u0E16\u0E39\u0E01\u0E15\u0E49\u0E2D\u0E07" }, 400, headers);
  }
  const connection = await ctx.env.DB.prepare("SELECT * FROM tiktok_connections WHERE id=? AND user_id=? AND status='active'").bind(id, ownerId).first();
  if (!connection) return json({ error: "\u0E44\u0E21\u0E48\u0E1E\u0E1A\u0E1A\u0E31\u0E0D\u0E0A\u0E35 TikTok \u0E17\u0E35\u0E48\u0E40\u0E0A\u0E37\u0E48\u0E2D\u0E21\u0E2D\u0E22\u0E39\u0E48" }, 404, headers);
  if (action === "sync") {
    let result;try{result=await syncTikTokConnection(ctx.env, connection,undefined,{stillAuthorized})}catch(error){if(!await stillAuthorized())return workspaceDenied();if(error?.message==='TIKTOK_SYNC_SUPERSEDED')return json({error:'มีการอัปเดตข้อมูลช่องครั้งใหม่กว่าแล้ว กรุณาลองอีกครั้ง'},409,headers);throw error}
    if(!await stillAuthorized())return workspaceDenied();
    const refreshed=await ctx.env.DB.prepare("SELECT * FROM tiktok_connections WHERE id=? AND user_id=? AND status='active'").bind(id,ownerId).first();if(!refreshed)return workspaceDenied();
    return json({ ok: true, connection: publicConnection(refreshed), video_count: result.videos.length, avatar_update:{mirrored:Boolean(result.avatar?.mirrored),preserved:Boolean(result.avatar?.preserved),reason:result.avatar?.reason||''} }, 200, headers);
  }
  if (action === "disconnect") {
    const token = await decryptChannelValue(ctx.env, connection.access_token_ciphertext).catch(() => "");
    if (token) await revokeTikTokToken(token);
    if(!await stillAuthorized())return workspaceDenied();
    await ctx.env.DB.batch([ctx.env.DB.prepare("DELETE FROM tiktok_connection_videos WHERE connection_id=?").bind(id), ctx.env.DB.prepare("DELETE FROM tiktok_connections WHERE id=? AND user_id=?").bind(id, ownerId)]);
    return json({ ok: true }, 200, headers);
  }
  if (action === "bind") {
    const channelId = clean(body.channel_id);
    if (channelId && !await ctx.env.DB.prepare("SELECT id FROM tiktok_channels WHERE id=? AND created_by=? AND archived_at IS NULL").bind(channelId,ownerId).first()) return json({ error: "\u0E44\u0E21\u0E48\u0E1E\u0E1A\u0E0A\u0E48\u0E2D\u0E07" }, 404, headers);
    const profileBinding=await ctx.env.DB.prepare('SELECT channel_id,provider_open_id FROM tiktok_browser_profile_bindings WHERE user_id=? AND (channel_id=? OR provider_open_id=?) LIMIT 1').bind(ownerId,channelId,connection.open_id).first();
    if(profileBinding&&(profileBinding.channel_id!==channelId||profileBinding.provider_open_id!==connection.open_id))return json({error:'บัญชีหรือช่องนี้ผูกกับ Chrome โปรไฟล์อื่นอยู่แล้ว',code:'TIKTOK_PROFILE_BINDING_CONFLICT'},409,headers);
    if(!await stillAuthorized())return workspaceDenied();
    try{await ctx.env.DB.prepare("UPDATE tiktok_connections SET channel_id=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND user_id=?").bind(channelId, id, ownerId).run()}catch(error){if(String(error?.message||error).includes('TIKTOK_PROFILE_BINDING'))return json({error:'บัญชีหรือช่องนี้ผูกกับ Chrome โปรไฟล์อื่นอยู่แล้ว',code:'TIKTOK_PROFILE_BINDING_CONFLICT'},409,headers);throw error}
    return json({ ok: true }, 200, headers);
  }
  return json({ error: "\u0E04\u0E33\u0E2A\u0E31\u0E48\u0E07\u0E44\u0E21\u0E48\u0E16\u0E39\u0E01\u0E15\u0E49\u0E2D\u0E07" }, 400, headers);
}
export {
  onRequestGet,
  onRequestPost,
  commissionAvailability,
  dateRange
};
