import {json} from '../../_lib.js';
export async function onRequestGet(ctx){const version=String(ctx.request.headers.get('x-veasy-app-version')||'').trim().slice(0,40);return json({ok:true,service:'visiond',mobile_api:'ready',app_version:version||null,server_time:new Date().toISOString()},200,{'cache-control':'no-store'});}
