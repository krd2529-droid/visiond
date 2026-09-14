import {json,currentUser,requireUser} from './_lib.js';
import {requireVxUser,vxRequestAccessStillCurrent} from './_vx_access.js';

export const VX_BOSS_CHANNEL_OPERATOR_SCOPE='boss_tiktok_channel_operator';
const headers={'cache-control':'private, no-store'};

export async function activeVxWorkspaceDelegation(env,userId){
  return env.DB.prepare(`SELECT d.id,d.delegate_user_id,d.owner_user_id,d.scope
    FROM vx_workspace_delegations d
    JOIN users delegate ON delegate.id=d.delegate_user_id AND delegate.role='user' AND COALESCE(delegate.is_test_user,0)=0
    JOIN users owner ON owner.id=d.owner_user_id AND owner.role='boss'
    WHERE d.delegate_user_id=? AND d.scope=? AND d.revoked_at IS NULL
    LIMIT 1`).bind(userId,VX_BOSS_CHANNEL_OPERATOR_SCOPE).first();
}

export async function requireVxWorkspaceUser(ctx,options={}){
  const actor=await requireUser(ctx,{includeCourseOwner:false});
  if(actor.error)return actor;
  if(actor.user.role==='user'){
    const delegation=await activeVxWorkspaceDelegation(ctx.env,actor.user.id);
    if(delegation)return {
      user:actor.user,
      vx:{active:true,admin:false,account_limit:null,access_source:'workspace_delegation',id:delegation.id},
      workspace:{delegated:true,owner_user_id:Number(delegation.owner_user_id),scope:delegation.scope,delegation_id:delegation.id}
    };
    const revoked=await ctx.env.DB.prepare('SELECT id FROM vx_workspace_delegations WHERE delegate_user_id=? AND scope=? LIMIT 1').bind(actor.user.id,VX_BOSS_CHANNEL_OPERATOR_SCOPE).first();
    if(revoked)return {error:json({error:'สิทธิ์ผู้ปฏิบัติงานพื้นที่ช่อง VX ถูกยกเลิกแล้ว'},403,headers)};
  }
  const auth=await requireVxUser(ctx,options);
  return auth.error?auth:{...auth,workspace:{delegated:false,owner_user_id:Number(auth.user.id),scope:'self',delegation_id:null}};
}

export const vxWorkspaceOwnerId=auth=>Number(auth?.workspace?.owner_user_id||auth?.user?.id||0);
export const isVxWorkspaceDelegate=auth=>Boolean(auth?.workspace?.delegated);
export const vxWorkspaceView=auth=>({
  delegated:isVxWorkspaceDelegate(auth),
  scope:auth?.workspace?.scope||'self',
  can_create_channel:!isVxWorkspaceDelegate(auth),
  can_delete_channel:!isVxWorkspaceDelegate(auth),
  can_view_commission:!isVxWorkspaceDelegate(auth)
});

export async function vxWorkspaceAccessStillCurrent(ctx,expected){
  if(!isVxWorkspaceDelegate(expected))return vxRequestAccessStillCurrent(ctx,expected);
  const actor=await currentUser(ctx,{includeCourseOwner:false});
  if(!actor||Number(actor.id)!==Number(expected.user.id))return false;
  const delegation=await activeVxWorkspaceDelegation(ctx.env,actor.id);
  return Boolean(delegation&&delegation.id===expected.workspace.delegation_id&&Number(delegation.owner_user_id)===vxWorkspaceOwnerId(expected));
}

export async function denyActiveVxWorkspaceDelegate(ctx,message='บัญชีผู้ปฏิบัติงาน VX ไม่มีสิทธิ์ดูข้อมูลค่าคอมมิชชัน'){
  const actor=await requireUser(ctx,{includeCourseOwner:false});if(actor.error)return actor;
  if(actor.user.role==='user'&&await activeVxWorkspaceDelegation(ctx.env,actor.user.id))return {error:json({error:message},403,headers)};
  return actor;
}
