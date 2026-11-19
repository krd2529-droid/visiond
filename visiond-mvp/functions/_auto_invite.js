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

export async function signAutoInviteKey(privateKey, machineId, customerName) {
  const payload = encoder.encode(JSON.stringify({ m: machineId, e: '', n: String(customerName || '').trim().slice(0, 120) }));
  const signature = new Uint8Array(await crypto.subtle.sign('Ed25519', privateKey, payload));
  return `${b64url(payload)}.${b64url(signature)}`;
}

export async function ensureAutoInviteSchema(env) {
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS auto_invite_issues (
    order_item_id INTEGER PRIMARY KEY, order_id INTEGER NOT NULL, user_id INTEGER NOT NULL,
    program_id INTEGER NOT NULL, machine_id TEXT NOT NULL, key_ciphertext TEXT NOT NULL,
    key_last4 TEXT NOT NULL, issued_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(order_item_id) REFERENCES order_items(id) ON DELETE CASCADE,
    FOREIGN KEY(order_id) REFERENCES orders(id) ON DELETE CASCADE,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY(program_id) REFERENCES vision7_programs(id) ON DELETE CASCADE
  )`).run();
  await env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_auto_invite_issues_user ON auto_invite_issues(user_id,order_item_id DESC)').run();
  await env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_auto_invite_issues_program ON auto_invite_issues(program_id,order_item_id DESC)').run();
  await env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_auto_invite_order_items_product ON order_items(product_id,id DESC)').run();
}

export async function autoInvitePurchase(env, orderItemId, userId) {
  return env.DB.prepare(`SELECT oi.id order_item_id,oi.order_id,o.user_id,p.id program_id,u.name,u.username,u.email,
    i.machine_id,i.key_ciphertext,i.key_last4,i.issued_at
    FROM order_items oi JOIN orders o ON o.id=oi.order_id AND o.status='paid'
    JOIN vision7_plans q ON q.product_id=oi.product_id AND q.plan_code='lifetime'
    JOIN vision7_programs p ON p.id=q.program_id AND p.code='auto-invite'
    JOIN users u ON u.id=o.user_id
    LEFT JOIN auto_invite_issues i ON i.order_item_id=oi.id
    WHERE oi.id=? AND o.user_id=? AND oi.price=69000 LIMIT 1`).bind(orderItemId,userId).first();
}

export async function claimAutoInvite(env, purchase, machineId, privateKey) {
  if (purchase.machine_id) {
    if (purchase.machine_id !== machineId) return { conflict: true };
    return { key: await decryptVision7Key(env, purchase.key_ciphertext), existing: true };
  }
  const key = await signAutoInviteKey(privateKey, machineId, purchase.name || purchase.username || purchase.email);
  const ciphertext = await encryptVision7Key(env, key);
  await env.DB.prepare(`INSERT OR IGNORE INTO auto_invite_issues
    (order_item_id,order_id,user_id,program_id,machine_id,key_ciphertext,key_last4)
    SELECT ?,?,?,?,?,?,? WHERE EXISTS (
      SELECT 1 FROM orders o JOIN order_items oi ON oi.order_id=o.id
      JOIN vision7_plans q ON q.product_id=oi.product_id AND q.plan_code='lifetime'
      JOIN vision7_programs p ON p.id=q.program_id AND p.code='auto-invite'
      WHERE oi.id=? AND o.id=? AND o.user_id=? AND o.status='paid' AND oi.price=69000
    )`).bind(purchase.order_item_id,purchase.order_id,purchase.user_id,purchase.program_id,machineId,ciphertext,key.slice(-4),purchase.order_item_id,purchase.order_id,purchase.user_id).run();
  const winner = await autoInvitePurchase(env, purchase.order_item_id, purchase.user_id);
  if (!winner?.machine_id) throw new Error('AUTO_INVITE_CLAIM_NOT_SAVED');
  if (winner.machine_id !== machineId) return { conflict: true };
  return { key: await decryptVision7Key(env, winner.key_ciphertext), existing: winner.key_ciphertext !== ciphertext };
}
