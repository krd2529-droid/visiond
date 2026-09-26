import assert from 'node:assert/strict';

import { uploadLivePortrait } from '../functions/_live_portrait_foundation.js';

const showId = `live_${'f'.repeat(32)}`;

function strictRejectDb() {
  const queries = [];
  return {
    queries,
    prepare(sql) {
      queries.push(sql);
      return {
        bind() { return this; },
        async first() {
          if (/FROM sessions s JOIN users u/.test(sql)) return { id: 137, role: 'boss', name: 'Consent server test', is_course_owner: 0 };
          if (/FROM live_shows WHERE id=\? AND deleted_at IS NULL/.test(sql)) return { id: showId, created_by: 137, revision: 1 };
          throw new Error(`unexpected DB query before strict form rejection: ${sql}`);
        },
      };
    },
  };
}

async function portraitRequest(overrides = {}, { extra = null, omit = [] } = {}) {
  const values = {
    rights_consent: 'accepted',
    animation_consent: 'accepted',
    identity_scope: 'authorized_adult',
    consent_policy: 'visiond-live-portrait-consent-v1',
    expected_binding_revision: '0',
    ...overrides,
  };
  const form = new FormData();
  form.set('portrait', new Blob([Uint8Array.from([0xff, 0xd8, 0xff, 0xd9])], { type: 'image/jpeg' }), 'consent-test.jpg');
  for (const [key, value] of Object.entries(values)) if (!omit.includes(key)) form.set(key, value);
  if (extra) form.set(extra, 'unexpected');
  const encoded = new Request(`https://visiondonline.com/api/admin/live-center/shows/${showId}/presenter`, { method: 'POST', body: form });
  const body = await encoded.arrayBuffer();
  return new Request(encoded.url, {
    method: 'POST',
    headers: {
      cookie: 'vd_session=consent-server-test',
      'idempotency-key': 'consent.server.test.137',
      'content-type': encoded.headers.get('content-type'),
      'content-length': String(body.byteLength),
    },
    body,
  });
}

async function expectStrictReject(overrides, options, status, code) {
  const DB = strictRejectDb();
  const response = await uploadLivePortrait({
    request: await portraitRequest(overrides, options),
    params: { id: showId },
    env: { DB },
    waitUntil() {},
  });
  const payload = await response.json();
  assert.equal(response.status, status);
  assert.equal(payload.code, code);
  assert.equal(DB.queries.length, 2, 'invalid consent stops after authorization and indexed active-show lookup');
}

await expectStrictReject({}, { omit: ['rights_consent'] }, 400, 'LIVE_PORTRAIT_INVALID');
await expectStrictReject({ rights_consent: 'declined' }, {}, 422, 'LIVE_PORTRAIT_CONSENT_REQUIRED');
await expectStrictReject({ animation_consent: 'declined' }, {}, 422, 'LIVE_PORTRAIT_CONSENT_REQUIRED');
await expectStrictReject({ identity_scope: 'public_figure' }, {}, 422, 'LIVE_PORTRAIT_IDENTITY_REJECTED');
await expectStrictReject({ consent_policy: 'old-policy' }, {}, 409, 'LIVE_PORTRAIT_CONSENT_STALE');
await expectStrictReject({}, { extra: 'unexpected_field' }, 400, 'LIVE_PORTRAIT_INVALID');

console.log('v0.20.137 Photo Avatar strict consent omission, decline, identity, policy and allowlist rejection checks passed');
