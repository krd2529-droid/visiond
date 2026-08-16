const enc=new TextEncoder(),dec=new TextDecoder(),AAD=enc.encode('visiond-partner-credentials-v1'),PREFIX='vdpa1:';
const b64=a=>btoa(String.fromCharCode(...a)),unb64=s=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
const master=env=>String(env.VISIOND_PARTNER_ENCRYPTION_KEY||env.VISIOND_CHANNEL_ENCRYPTION_KEY||'');
async function key(env){const secret=master(env);if(secret.length<32)throw new Error('PARTNER_ENCRYPTION_NOT_CONFIGURED');const digest=await crypto.subtle.digest('SHA-256',enc.encode(secret));return crypto.subtle.importKey('raw',digest,{name:'AES-GCM'},false,['encrypt','decrypt'])}
export const partnerEncryptionReady=env=>master(env).length>=32;
export async function encryptPartnerSecret(env,value){const iv=crypto.getRandomValues(new Uint8Array(12)),data=await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:AAD},await key(env),enc.encode(String(value)));return `${PREFIX}${b64(iv)}:${b64(new Uint8Array(data))}`}
export async function decryptPartnerSecret(env,value){const parts=String(value||'').slice(PREFIX.length).split(':');if(parts.length!==2)throw new Error('PARTNER_CIPHERTEXT_INVALID');const data=await crypto.subtle.decrypt({name:'AES-GCM',iv:unb64(parts[0]),additionalData:AAD},await key(env),unb64(parts[1]));return dec.decode(data)}
