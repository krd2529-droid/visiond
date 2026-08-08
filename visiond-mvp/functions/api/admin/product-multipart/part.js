import { json, requireAdmin } from "../../../_lib.js";

export async function onRequestPut(ctx) {
  const auth = await requireAdmin(ctx);
  if (auth.error) return auth.error;
  const url = new URL(ctx.request.url), key = url.searchParams.get("key") || "", uploadId = url.searchParams.get("upload_id") || "", partNumber = Number(url.searchParams.get("part_number"));
  if (!/^(?:product-\d+|vision4-pending)-[0-9a-f-]+\.(pdf|zip)$/i.test(key) || !uploadId || !Number.isInteger(partNumber) || partNumber < 1 || partNumber > 10000 || !ctx.request.body) return json({ error: "ข้อมูลชิ้นส่วนไม่ถูกต้อง" }, 400);
  const part = await ctx.env.FILES.resumeMultipartUpload(key, uploadId).uploadPart(partNumber, ctx.request.body);
  return json({ part_number: part.partNumber, etag: part.etag });
}
