import {createLiveShow,listLiveShows,liveHeadFromGet} from '../../../../_live_center.js';
export const onRequestGet=listLiveShows;
export const onRequestHead=ctx=>liveHeadFromGet(ctx,listLiveShows);
export const onRequestPost=createLiveShow;
