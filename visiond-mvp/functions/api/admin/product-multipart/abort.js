import { json, requireAdmin } from "../../../_lib.js";

export async function onRequestPost(ctx) {
  const auth = await requireAdmin(ctx);
  if (auth.error) return auth.error;
  const body = await ctx.request.json().catch(() => ({})), key = String(body.key || ""), uploadId = String(body.upload_id || "");
  if (!/^product-\d+-[0-9a-f-]+\.(pdf|zip)$/i.test(key) || !uploadId) return json({ error: "ข้อมูลไม่ถูกต้อง" }, 400);
  await ctx.env.FILES.resumeMultipartUpload(key, uploadId).abort();
  return json({ ok: true });
}
