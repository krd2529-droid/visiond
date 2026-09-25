import { deleteLivePortrait, listLivePortraits, uploadLivePortrait } from '../../../../../_live_portrait_foundation.js';

export const onRequestGet = listLivePortraits;
export const onRequestPost = uploadLivePortrait;
export const onRequestDelete = deleteLivePortrait;
