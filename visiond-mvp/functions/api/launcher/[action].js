import {launcherRoute} from '../../_browser_launcher.js';
export async function onRequest(ctx){try{return await launcherRoute(ctx)}catch{return new Response(JSON.stringify({error:'LAUNCHER_REQUEST_FAILED'}),{status:409,headers:{'content-type':'application/json','cache-control':'private, no-store'}})}}
