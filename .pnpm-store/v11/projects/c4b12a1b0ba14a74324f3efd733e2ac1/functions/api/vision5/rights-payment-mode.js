import {json} from '../../_lib.js';
import {loadPaymentSettings} from '../../_payment.js';

export async function onRequestGet(ctx){
  const settings=await loadPaymentSettings(ctx.env);
  return json({auto_verify:settings.vision5_rights_auto_verify===true,mode:settings.vision5_rights_auto_verify?'easyslip':'boss_review'},200,{'cache-control':'no-store'});
}
