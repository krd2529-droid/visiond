import {requireVxUser,vxRequestAccessStillCurrent,vxChannelInsert,vxChannelRestore} from '../../_vx_access.js';
import {ensureDatabase} from '../../_schema.js';
import {ensureTikTokAnalyzerSchema} from '../../_tiktok_analyzer.js';
import {consumeTikTokState,exchangeTikTokCode,fetchTikTokProfile,prepareTikTokConnection,syncTikTokConnection,tikTokOAuthConfig,tikTokProfileBindingStatement} from '../../_tiktok_oauth.js';
import {requireD1DataFetchAvailable} from '../../_d1_quota_breaker.js';
import {consumeHandoff,handoffGuardStatements,handoffCompletion,prepareHandoffContinuation} from '../../_tiktok_handoff.js';

const back=(status,detail='',channelId='',profileSlotId='')=>{
  const url=new URL('https://visiondonline.com/tiktok-analyzer');
  url.searchParams.set('tiktok',status);
  if(detail)url.searchParams.set('detail',detail);
  if(channelId)url.searchParams.set('channel_id',channelId);
  if(profileSlotId){url.searchParams.set('launcher_profile','1');url.searchParams.set('launcher_mode','new');url.searchParams.set('launcher_slot',profileSlotId)}
  return Response.redirect(url.href,302);
};
const clean=(value,max=500)=>String(value??'').trim().slice(0,max);

async function channelPlanForProfile(ctx,auth,requestedChannelId,profile,limit){
  const env=ctx.env,userId=auth.user.id;
  if(requestedChannelId){
    const channel=await env.DB.prepare('SELECT id FROM tiktok_channels WHERE id=? AND created_by=? AND archived_at IS NULL').bind(requestedChannelId,userId).first();
    return channel?.id?{channelId:channel.id,statement:null,kind:'existing'}:null;
  }
  const linked=await env.DB.prepare('SELECT c.channel_id FROM tiktok_connections c JOIN tiktok_channels ch ON ch.id=c.channel_id WHERE c.user_id=? AND c.open_id=? AND ch.created_by=? LIMIT 1').bind(userId,clean(profile.open_id,200),userId).first();
  if(linked?.channel_id){
    if(!await vxRequestAccessStillCurrent(ctx,auth))throw new Error('VX_ACCESS_EXPIRED');
    return{channelId:linked.channel_id,statement:vxChannelRestore(env,userId,limit,linked.channel_id,clean(profile.display_name,120)||'TikTok Creator'),kind:'restore'};
  }
  const channelId=crypto.randomUUID();
  if(!await vxRequestAccessStillCurrent(ctx,auth))throw new Error('VX_ACCESS_EXPIRED');
  return{channelId,statement:vxChannelInsert(env,userId,limit,channelId,clean(profile.display_name,120)||'TikTok Creator'),kind:'create'};
}

export async function onRequestGet(ctx){
  await ensureDatabase(ctx.env);await ensureTikTokAnalyzerSchema(ctx.env);
  const incomingState=new URL(ctx.request.url).searchParams.get('state')||'',isHandoff=incomingState.startsWith('h1');
  const handoff=isHandoff?await consumeHandoff(ctx,incomingState,'tiktok'):null;
  if(isHandoff&&!handoff)return handoffCompletion('invalid_state');
  const auth=handoff?.auth||await requireVxUser(ctx);if(auth.error)return back('login_required');
  const url=new URL(ctx.request.url),providerError=String(url.searchParams.get('error')||'').slice(0,100),code=String(url.searchParams.get('code')||'').trim(),state=String(url.searchParams.get('state')||'').trim();if(!state)return back('invalid_callback');
  const stateRow=handoff?.stateRow||await consumeTikTokState(ctx.env,state,auth.user.id);if(!stateRow)return back('invalid_state');
  const profileSlotId=String(stateRow.profile_slot_id||''),done=(status,detail='',targetChannelId=stateRow.channel_id)=>handoff?handoffCompletion(status,targetChannelId,auth.handoff.id):back(status,detail,targetChannelId,profileSlotId);
  if(providerError)return done('denied',providerError);if(!code)return done('invalid_callback');
  let channelId=stateRow.channel_id;
  try{
    const config=tikTokOAuthConfig(ctx.env);if(!config.configured)return done('not_configured','',channelId);
    const token=await exchangeTikTokCode(config,code),profile=await fetchTikTokProfile(token.access_token);if(!profile.open_id)return done('profile_failed','',channelId);
    if(!await vxRequestAccessStillCurrent(ctx,auth))return done('access_expired','',stateRow.channel_id);
    const plan=await channelPlanForProfile(ctx,auth,channelId,profile,auth.vx.account_limit);if(!plan)return done('channel_unavailable','',stateRow.channel_id);channelId=plan.channelId;
    if(!await vxRequestAccessStillCurrent(ctx,auth))return done('access_expired','',channelId);
    const prepared=await prepareTikTokConnection(ctx.env,auth.user.id,channelId,token,profile),statements=[];
    const existingBinding=await ctx.env.DB.prepare('SELECT slot_id,user_id,channel_id,provider_open_id FROM tiktok_browser_profile_bindings WHERE channel_id=? OR (user_id=? AND provider_open_id=?) LIMIT 1').bind(channelId,auth.user.id,prepared.openId).first();
    if(!profileSlotId&&existingBinding&&(Number(existingBinding.user_id)!==Number(auth.user.id)||existingBinding.channel_id!==channelId||existingBinding.provider_open_id!==prepared.openId))return done('profile_conflict','',channelId);
    if(!profileSlotId&&plan.kind==='existing'&&!await ctx.env.DB.prepare('SELECT id FROM tiktok_channels WHERE id=? AND created_by=? AND archived_at IS NULL').bind(channelId,auth.user.id).first())return done('channel_unavailable','',channelId);
    if(!await vxRequestAccessStillCurrent(ctx,auth))return done('access_expired','',channelId);
    if(plan.statement)statements.push(plan.statement);
    statements.push(prepared.statement);
    if(profileSlotId)statements.push(tikTokProfileBindingStatement(ctx.env,{slotId:profileSlotId,userId:auth.user.id,channelId,openId:prepared.openId,profileKind:auth.handoff?.profile_kind||'slot'}));
    const continuation=handoff?await prepareHandoffContinuation(ctx.env,auth,channelId):null;
    if(continuation)statements.push(...continuation.statements);
    let results=[];
    try{const guards=handoffGuardStatements(ctx.env,auth);results=(await ctx.env.DB.batch([...guards,...statements])).slice(guards.length)}catch(error){
        const failure=String(error?.message||error).toLowerCase();
        if(failure.includes('profile_binding_prerequisite')&&plan.kind!=='existing'&&auth.vx.account_limit!==null){const count=await ctx.env.DB.prepare('SELECT COUNT(*) count FROM tiktok_channels WHERE created_by=? AND archived_at IS NULL').bind(auth.user.id).first();if(Number(count?.count)>=Number(auth.vx.account_limit))throw new Error('VX_ACCOUNT_LIMIT')}
        if(failure.includes('profile_binding')||failure.includes('unique')||failure.includes('constraint'))return done('profile_conflict','',channelId);
        throw error;
    }
    const connectionResult=results[plan.statement?1:0];
    if(plan.statement&&results[0]?.meta?.changes!==1)throw new Error('VX_ACCOUNT_LIMIT');
    if(connectionResult?.meta?.changes!==1)return done('profile_conflict','',channelId);
    if(continuation)return continuation.response;
    const connection=await ctx.env.DB.prepare("SELECT * FROM tiktok_connections WHERE id=? AND user_id=? AND channel_id=? AND open_id=? AND status='active'").bind(prepared.id,auth.user.id,channelId,prepared.openId).first();if(!connection)return done('channel_unavailable','',channelId);
    if(handoff)return done('connected','',channelId);
    const blocked=await requireD1DataFetchAvailable(ctx,'tiktok_oauth_post_connect_sync');if(blocked)return done('connected','sync_deferred_d1_quota',channelId);await syncTikTokConnection(ctx.env,connection);return done('connected','',channelId);
  }catch(error){
    if(error?.message==='VX_ACCESS_EXPIRED')return done('access_expired','',stateRow.channel_id);
    if(error?.message==='VX_ACCOUNT_LIMIT')return done('account_limit','บัญชีครบตามแพ็กเกจแล้ว กรุณาลบช่องเดิมหรือเลือกแพ็กเกจใหม่ที่ Vtools',channelId);
    if(String(error?.message||'').includes('TIKTOK_PROFILE_BINDING'))return done('profile_conflict','',channelId);
    if(error?.code==='TIKTOK_ACCOUNT_ALREADY_LINKED')return done('account_already_linked',error.channelName,channelId);
    if(error?.code==='TIKTOK_CHANNEL_ALREADY_LINKED')return done('channel_already_linked',error.accountName,channelId);
    console.error('TIKTOK_OAUTH_CALLBACK_FAILED',{message:String(error?.message||error).slice(0,180)});return done('failed','',channelId);
  }
}
