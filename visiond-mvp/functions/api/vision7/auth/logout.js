import {json} from '../../../_lib.js';import {ensureDatabase} from '../../../_schema.js';import {ensureVision7AuthSchema,revokeVision7Session} from '../../../_vision7_auth.js';
export async function onRequestPost(ctx){await ensureDatabase(ctx.env);await ensureVision7AuthSchema(ctx.env);await revokeVision7Session(ctx);return json({ok:true},200,{'cache-control':'no-store'});}
