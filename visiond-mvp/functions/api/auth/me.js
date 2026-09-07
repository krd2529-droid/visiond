import {json,currentUser} from '../../_lib.js';
export async function onRequestGet(ctx){
  const user=await currentUser(ctx,{includeSessionExpiry:true});
  const headers={'cache-control':'private, no-store'};
  if(!user)return json({error:'not logged in'},401,headers);
  const {session_expires_at,...account}=user;
  return json({user:account,session_expires_at,server_time:new Date().toISOString()},200,headers);
}
