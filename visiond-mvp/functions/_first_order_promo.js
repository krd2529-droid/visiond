export const FIRST_ORDER_PROMO={minimum:39900,percent:50,cap:20000,durationHours:2};

export async function firstOrderPromoStatus(env,userId){
  const [state,setting]=await Promise.all([env.DB.prepare('SELECT login_count,offer_granted_at,offer_expires_at,used_order_id FROM first_order_promo_state WHERE user_id=?').bind(userId).first(),env.DB.prepare("SELECT value FROM settings WHERE key='first_order_promo_enabled'").first()]);
  const paid=await env.DB.prepare("SELECT 1 ok FROM orders WHERE user_id=? AND status='paid' LIMIT 1").bind(userId).first();
  const loginCount=Number(state?.login_count)||0,used=Boolean(state?.used_order_id||paid),expiresAt=state?.offer_expires_at||null;
  const enabled=setting?.value!=='0',active=enabled&&!used&&loginCount>=3&&expiresAt&&Date.parse(expiresAt)>Date.now();
  return {enabled,login_count:loginCount,stage:!enabled||used?'finished':loginCount>=3?'offer':loginCount>=2?'teaser':'none',active,used,expires_at:expiresAt,...FIRST_ORDER_PROMO};
}

export async function recordSuccessfulLogin(env,userId){
  await env.DB.batch([
    env.DB.prepare(`INSERT INTO first_order_promo_state(user_id,login_count,offer_granted_at,offer_expires_at,updated_at) VALUES(?,1,NULL,NULL,CURRENT_TIMESTAMP)
      ON CONFLICT(user_id) DO UPDATE SET login_count=login_count+1,offer_granted_at=CASE WHEN login_count+1>=3 AND offer_granted_at IS NULL THEN CURRENT_TIMESTAMP ELSE offer_granted_at END,offer_expires_at=CASE WHEN login_count+1>=3 AND offer_expires_at IS NULL THEN datetime('now','+2 hours') ELSE offer_expires_at END,updated_at=CURRENT_TIMESTAMP`).bind(userId),
    env.DB.prepare("INSERT INTO user_activity_log(user_id,event_type,path,metadata) VALUES(?,'login','/login','{}')").bind(userId)
  ]);
}

export function calculateFirstOrderDiscount(status,eligibleSubtotal){
  if(!status?.active||Number(eligibleSubtotal)<FIRST_ORDER_PROMO.minimum)return 0;
  return Math.min(FIRST_ORDER_PROMO.cap,Math.round(Number(eligibleSubtotal)*FIRST_ORDER_PROMO.percent/100));
}
