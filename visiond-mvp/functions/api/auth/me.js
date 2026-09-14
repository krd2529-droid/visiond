import {json,currentUser} from '../../_lib.js';
import {activeVxWorkspaceDelegation,VX_BOSS_CHANNEL_OPERATOR_SCOPE} from '../../_vx_workspace.js';
export async function onRequestGet(ctx){
  const user=await currentUser(ctx,{includeSessionExpiry:true});
  const headers={'cache-control':'private, no-store'};
  if(!user)return json({error:'not logged in'},401,headers);
  const {session_expires_at,...account}=user;
  const delegation=user.role==='user'?await activeVxWorkspaceDelegation(ctx.env,user.id):null;
  const vx_workspace=delegation?.scope===VX_BOSS_CHANNEL_OPERATOR_SCOPE?{delegated:true,scope:delegation.scope,landing_path:'/tiktok-analyzer.html'}:{delegated:false};
  return json({user:account,vx_workspace,session_expires_at,server_time:new Date().toISOString()},200,headers);
}
