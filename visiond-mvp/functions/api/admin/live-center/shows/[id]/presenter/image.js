import { getLivePortraitImage } from '../../../../../../_live_portrait_foundation.js';

export const onRequestGet = ctx => getLivePortraitImage(ctx);
export const onRequestHead = ctx => getLivePortraitImage(ctx, { head: true });
