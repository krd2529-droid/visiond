import { json, requireUser } from "../../_lib.js";
import { ensureDatabase } from "../../_schema.js";
import { COURSE_PLANS } from "../../_course_plans.js";

export async function onRequestGet(ctx) {
  await ensureDatabase(ctx.env);
  const auth = await requireUser(ctx);
  if (auth.error) return auth.error;

  const credit = await ctx.env.DB.prepare(
    "SELECT COUNT(*) credit_balance FROM course_right_credits WHERE user_id=? AND active=1 AND used_course_id IS NULL",
  )
    .bind(auth.user.id)
    .first();

  return json(
    {
      credit_balance: Number(credit?.credit_balance) || 0,
      plans: Object.values(COURSE_PLANS).sort((a, b) => a.number - b.number),
    },
    200,
    { "cache-control": "no-store" },
  );
}
