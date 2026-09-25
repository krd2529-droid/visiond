import { startLiveAvatarSession, stopLiveAvatarSession } from '../../../../../_live_portrait_foundation.js';

export const onRequestPost = startLiveAvatarSession;
export const onRequestDelete = stopLiveAvatarSession;
