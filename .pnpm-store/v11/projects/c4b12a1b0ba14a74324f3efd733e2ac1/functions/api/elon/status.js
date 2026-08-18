import {json} from '../../_lib.js';
import {isElonWebEnabled} from '../../_elon_databases.js';
export async function onRequestGet(ctx){let enabled=false;try{enabled=await isElonWebEnabled(ctx.env)}catch{}return json({enabled},200,{'cache-control':'no-store'})}
