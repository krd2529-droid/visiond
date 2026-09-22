import {createLiveVersion,listLiveVersions,liveHeadFromGet} from '../../../../../_live_center.js';
export const onRequestGet=listLiveVersions;
export const onRequestHead=ctx=>liveHeadFromGet(ctx,listLiveVersions);
export const onRequestPost=createLiveVersion;
