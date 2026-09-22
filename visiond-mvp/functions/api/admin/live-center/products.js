import {listLiveProducts,liveHeadFromGet} from '../../../_live_center.js';
export const onRequestGet=listLiveProducts;
export const onRequestHead=ctx=>liveHeadFromGet(ctx,listLiveProducts);
