import {json,currentUser} from '../../_lib.js';export async function onRequestGet(ctx){const user=await currentUser(ctx);return user?json({user}):json({error:'not logged in'},401)}
