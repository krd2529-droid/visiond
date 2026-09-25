import { startLocalAudienceSession, stopLocalAudienceSession } from '../../../../../../_live_audience_foundation.js';

export const onRequestPost = startLocalAudienceSession;
export const onRequestDelete = stopLocalAudienceSession;
