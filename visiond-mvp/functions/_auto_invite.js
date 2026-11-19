import { encryptVision7Key, decryptVision7Key } from './_vision7_license_crypto.js';

export const AUTO_INVITE_CODE = 'auto-invite';
export const AUTO_INVITE_PUBLIC_KEY_B64 = 'JqH16J2rvezIpuJfJ1YzuG4fV+cKbKgnjHRapN3p3nw=';
const PKCS8_PREFIX = '302e020100300506032b657004220420';
const encoder = new TextEncoder();
const b64url = bytes => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const fromBase64 = value => Uint8Array.from(atob(value), c => c.charCodeAt(0));

export function normalizeAutoInviteMachineId(value) {
  const id = String(value || '').trim().toUpperCase();
  return /^[0-9A-F]{4}(?:-[0-9A-F]{4}){3}$/.test(id) ? id : '';
}

export async function autoInviteSigner(env) {
  const value = String(env.AUTO_INVITE_SIGNING_SEED || '').trim();
  if (!/^[A-Za-z0-9+/]{43}=$/.test(value)) throw new Error('AUTO_INVITE_SIGNER_UNAVAILABLE');
  const seed = fromBase64(value);
  if (seed.length !== 32) throw new Error('AUTO_INVITE_SIGNER_UNAVAILABLE');
  const prefix = Uint8Array.from(PKCS8_PREFIX.match(/../g), h => parseInt(h, 16));
  const der = new Uint8Array(prefix.length + seed.length);
  der.set(prefix); der.set(seed, prefix.length);
  const privateKey = await crypto.subtle.importKey('pkcs8', der, { name: 'Ed25519' }, false, ['sign']);
  const publicKey = await crypto.subtle.importKey('raw', fromBase64(AUTO_INVITE_PUBLIC_KEY_B64), { name: 'Ed25519' }, false, ['verify']);
  const probe = encoder.encode('AutoInvite signer check');
  if (!await crypto.subtle.verify('Ed25519', publicKey, await crypto.subtle.sign('Ed25519', privateKey, probe), probe))
    throw new Error('AUTO_INVITE_SIGNER_MISMATCH');
  return privateKey;
}

export async function signAutoInviteKey(privateKey, machineId, customerName, expiresAt = '', issuedAt = '') {
  const payload = encoder.encode(JSON.stringify({ m: machineId, e: expiresAt, n: String(customerName || '').trim().slice(0, 120), ...(issuedAt ? { i: issuedAt } : {}) }));
  const signature = new Uint8Array(await crypto.subtle.sign('Ed25519', privateKey, payload));
  return `${b64url(payload)}.${b64url(signature)}`;
}

export async function ensureAutoInviteSchema(env) {
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS auto_invite_issues (
    order_item_id INTEGER PRIMARY KEY, order_id INTEGER NOT NULL, user_id INTEGER NOT NULL,
    program_id INTEGER NOT NULL, machine_id TEXT NOT NULL, key_ciphertext TEXT NOT NULL DEFAULT '',
    plan_code TEXT NOT NULL DEFAULT 'lifetime', expires_at TEXT,
    key_last4 TEXT NOT NULL DEFAULT '', issued_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(order_item_id) REFERENCES order_items(id) ON DELETE CASCADE,
    FOREIGN KEY(order_id) REFERENCES orders(id) ON DELETE CASCADE,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY(program_id) REFERENCES vision7_programs(id) ON DELETE CASCADE
  )`).run();
  await env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_auto_invite_issues_user ON auto_invite_issues(user_id,order_item_id DESC)').run();
  await env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_auto_invite_issues_program ON auto_invite_issues(program_id,order_item_id DESC)').run();
  await env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_auto_invite_issues_renewal ON auto_invite_issues(user_id,machine_id,plan_code,expires_at DESC)').run();
  await env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_auto_invite_order_items_product ON order_items(product_id,id DESC)').run();
}

export async function ensureAutoInviteGrantSchema(env) {
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS auto_invite_grants (
    id INTEGER PRIMARY KEY, request_id TEXT NOT NULL UNIQUE, program_id INTEGER NOT NULL,
    recipient_id INTEGER NOT NULL, issuer_id INTEGER NOT NULL, machine_id TEXT NOT NULL,
    duration_days INTEGER, expires_at TEXT, key_ciphertext TEXT NOT NULL DEFAULT '',
    key_last4 TEXT NOT NULL DEFAULT '', issued_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(program_id) REFERENCES vision7_programs(id),
    FOREIGN KEY(recipient_id) REFERENCES users(id), FOREIGN KEY(issuer_id) REFERENCES users(id)
  )`).run();
  await env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_auto_invite_grants_recipient ON auto_invite_grants(program_id,recipient_id,expires_at,id DESC)').run();
  await env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_auto_invite_grants_recent ON auto_invite_grants(id DESC)').run();
  await env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_auto_invite_grants_user ON auto_invite_grants(recipient_id,id DESC)').run();
}

export const activeAutoInviteGrantSql = `SELECT id FROM auto_invite_grants
    WHERE program_id=? AND recipient_id=? AND key_ciphertext<>''
      AND (expires_at IS NULL OR expires_at>strftime('%Y-%m-%dT%H:%M:%SZ','now'))
    LIMIT 1`;
export async function activeAutoInviteGrant(env, programId, recipientId) {
  const row = await env.DB.prepare(activeAutoInviteGrantSql).bind(programId,recipientId).first();
  return Boolean(row);
}

export async function grantAutoInvite(env, { requestId, recipient, issuerId, machineId, durationDays, privateKey }) {
  const program = await env.DB.prepare("SELECT id FROM vision7_programs WHERE code='auto-invite' LIMIT 1").first();
  if (!program) throw new Error('AUTO_INVITE_PROGRAM_MISSING');
  await env.DB.prepare(`INSERT OR IGNORE INTO auto_invite_grants
    (request_id,program_id,recipient_id,issuer_id,machine_id,duration_days,expires_at,issued_at)
    SELECT ?,p.id,?,?,?,?,CASE WHEN ? IS NULL THEN NULL ELSE strftime('%Y-%m-%dT%H:%M:%SZ',unixepoch(stamp.issued_at)+?*86400,'unixepoch') END,stamp.issued_at
    FROM vision7_programs p CROSS JOIN (SELECT strftime('%Y-%m-%dT%H:%M:%SZ','now') issued_at) stamp WHERE p.id=?`)
    .bind(requestId,recipient.id,issuerId,machineId,durationDays,durationDays,durationDays,program.id).run();
  const row = await env.DB.prepare('SELECT * FROM auto_invite_grants WHERE request_id=?').bind(requestId).first();
  if (!row || row.program_id!==program.id || row.recipient_id!==recipient.id || row.issuer_id!==issuerId ||
      row.machine_id!==machineId || row.duration_days!==durationDays) return { conflict:true };
  if (!row.key_ciphertext) {
    if (!privateKey) throw new Error('AUTO_INVITE_SIGNER_UNAVAILABLE');
    const issuedAt = String(row.issued_at);
    const key = await signAutoInviteKey(privateKey,machineId,recipient.name||recipient.email,row.expires_at||'',issuedAt);
    const ciphertext = await encryptVision7Key(env,key);
    await env.DB.prepare("UPDATE auto_invite_grants SET key_ciphertext=?,key_last4=? WHERE id=? AND key_ciphertext=''")
      .bind(ciphertext,key.slice(-4),row.id).run();
  }
  const winner = await env.DB.prepare('SELECT * FROM auto_invite_grants WHERE id=?').bind(row.id).first();
  if (!winner?.key_ciphertext) throw new Error('AUTO_INVITE_GRANT_NOT_SAVED');
  return { id:winner.id, key:await decryptVision7Key(env,winner.key_ciphertext), expires_at:winner.expires_at,
    machine_id:winner.machine_id, existing:Boolean(row.key_ciphertext) };
}

export async function autoInvitePurchase(env, orderItemId, userId) {
  return env.DB.prepare(`SELECT oi.id order_item_id,oi.order_id,o.user_id,p.id program_id,q.plan_code,oi.price,u.name,u.username,u.email,
    i.machine_id,i.key_ciphertext,i.key_last4,i.issued_at,i.expires_at
    FROM order_items oi JOIN orders o ON o.id=oi.order_id AND o.status='paid'
    JOIN vision7_plans q ON q.product_id=oi.product_id AND q.plan_code IN ('monthly','lifetime')
    JOIN vision7_programs p ON p.id=q.program_id AND p.code='auto-invite'
    JOIN users u ON u.id=o.user_id
    LEFT JOIN auto_invite_issues i ON i.order_item_id=oi.id
    WHERE oi.id=? AND o.user_id=? AND ((q.plan_code='monthly' AND oi.price=59000) OR (q.plan_code='lifetime' AND oi.price IN (69000,159000))) LIMIT 1`).bind(orderItemId,userId).first();
}

export async function claimAutoInvite(env, purchase, machineId, privateKey) {
  if (purchase.machine_id && purchase.machine_id !== machineId) return { conflict: true };
  if (purchase.key_ciphertext) return { key: await decryptVision7Key(env, purchase.key_ciphertext), existing: true };
  await env.DB.prepare(`INSERT OR IGNORE INTO auto_invite_issues
    (order_item_id,order_id,user_id,program_id,machine_id,plan_code,expires_at,key_ciphertext,key_last4)
    SELECT oi.id,o.id,o.user_id,p.id,?,q.plan_code,
      CASE WHEN q.plan_code='monthly' THEN strftime('%Y-%m-%dT%H:%M:%SZ',
        MAX(unixepoch('now'),COALESCE((SELECT unixepoch(previous.expires_at)
          FROM auto_invite_issues previous JOIN orders prior ON prior.id=previous.order_id AND prior.status='paid'
          WHERE previous.user_id=o.user_id AND previous.machine_id=? AND previous.plan_code='monthly'
          ORDER BY previous.expires_at DESC LIMIT 1),0))+2592000,'unixepoch') ELSE NULL END,'',''
    FROM orders o JOIN order_items oi ON oi.order_id=o.id
    JOIN vision7_plans q ON q.product_id=oi.product_id AND q.plan_code=?
    JOIN vision7_programs p ON p.id=q.program_id AND p.code='auto-invite'
    WHERE oi.id=? AND o.id=? AND o.user_id=? AND o.status='paid' AND oi.price=?
    `).bind(machineId,machineId,purchase.plan_code,purchase.order_item_id,purchase.order_id,purchase.user_id,purchase.price).run();
  const reserved = await autoInvitePurchase(env, purchase.order_item_id, purchase.user_id);
  if (!reserved?.machine_id) throw new Error('AUTO_INVITE_CLAIM_NOT_SAVED');
  if (reserved.machine_id !== machineId) return { conflict: true };
  if (reserved.key_ciphertext) return { key: await decryptVision7Key(env, reserved.key_ciphertext), existing: true };
  if (!privateKey) throw new Error('AUTO_INVITE_SIGNER_UNAVAILABLE');
  const issuedAt = String(reserved.issued_at).replace(' ','T')+'Z';
  const key = await signAutoInviteKey(privateKey,machineId,reserved.name||reserved.username||reserved.email,reserved.expires_at||'',issuedAt);
  const ciphertext = await encryptVision7Key(env,key);
  await env.DB.prepare(`UPDATE auto_invite_issues SET key_ciphertext=?,key_last4=?
    WHERE order_item_id=? AND machine_id=? AND key_ciphertext=''`).bind(ciphertext,key.slice(-4),purchase.order_item_id,machineId).run();
  const winner = await autoInvitePurchase(env,purchase.order_item_id,purchase.user_id);
  if (!winner?.key_ciphertext || winner.machine_id !== machineId) throw new Error('AUTO_INVITE_CLAIM_NOT_SAVED');
  return { key: await decryptVision7Key(env,winner.key_ciphertext), existing: winner.key_ciphertext !== ciphertext };
}
