import {getLiveShow,liveHeadFromGet,updateLiveShow} from '../../../../_live_center.js';
export const onRequestGet=getLiveShow;
export const onRequestHead=ctx=>liveHeadFromGet(ctx,getLiveShow);
export const onRequestPut=updateLiveShow;
