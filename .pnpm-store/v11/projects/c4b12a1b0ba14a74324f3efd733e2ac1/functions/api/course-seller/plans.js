import { json, requireUser } from "../../_lib.js";
import { ensureDatabase } from "../../_schema.js";
import { COURSE_PLANS } from "../../_course_plans.js";

export async function onRequestGet(ctx) {
  await ensureDatabase(ctx.env);
  const auth = await requireUser(ctx);
  if (auth.error) return auth.error;

  return json(
    {
      plans: Object.values(COURSE_PLANS).sort((a, b) => a.number - b.number),
    },
    200,
    { "cache-control": "no-store" },
  );
}
