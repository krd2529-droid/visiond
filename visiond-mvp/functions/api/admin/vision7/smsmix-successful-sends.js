import { json, requireBoss } from '../../../_lib.js';

export async function onRequestGet(ctx) {
  const auth = await requireBoss(ctx);
  if (auth.error) return auth.error;
  const text = new URL(ctx.request.url).searchParams.get('cursor');
  const cursor = text == null ? null : Number(text);
  const headers = { 'cache-control': 'private, no-store' };
  if (text != null && (!Number.isSafeInteger(cursor) || cursor < 1)) return json({ error: 'invalid cursor' }, 400, headers);
  const select = `SELECT s.id,s.recipient_phone,s.sent_at,s.received_at,s.license_id,b.device_name
    FROM vision7_smsmix_successful_sends s
    LEFT JOIN vision7_smsmix_bindings b ON b.license_id=s.license_id AND b.device_hash=s.device_hash
    ${cursor == null ? '' : 'WHERE s.id<?'} ORDER BY s.id DESC LIMIT 25`;
  const query = ctx.env.DB.prepare(select);
  const rows = (await (cursor == null ? query : query.bind(cursor)).all()).results || [];
  const items = rows.slice(0,24);
  return json({ items, next_cursor: rows.length > 24 ? items.at(-1).id : null }, 200, headers);
}
