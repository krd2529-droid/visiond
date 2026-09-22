import {downloadLivePackage} from '../../../../../../../_live_center.js';
export const onRequestGet=ctx=>downloadLivePackage(ctx);
export const onRequestHead=ctx=>downloadLivePackage(ctx,{head:true});
