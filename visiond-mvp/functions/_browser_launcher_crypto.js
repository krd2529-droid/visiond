const enc=new TextEncoder(),dec=new TextDecoder();
const bytes=hex=>Uint8Array.from(hex.match(/../g)||[],x=>parseInt(x,16));
const hex=data=>Array.from(new Uint8Array(data),v=>v.toString(16).padStart(2,'0')).join('');
export const launcherRandom=()=>hex(crypto.getRandomValues(new Uint8Array(32)));
export const launcherHex=value=>typeof value==='string'&&/^[0-9a-f]{64}$/.test(value);
async function storageKey(env){const value=String(env.VISIOND_CHANNEL_ENCRYPTION_KEY||'');if(value.length<32)throw new Error('LAUNCHER_ENCRYPTION_NOT_CONFIGURED');return crypto.subtle.importKey('raw',await crypto.subtle.digest('SHA-256',enc.encode('visiond-launcher-storage-v1\n'+value)),{name:'AES-GCM'},false,['encrypt','decrypt'])}
export async function sealLauncher(env,value,aad){const iv=crypto.getRandomValues(new Uint8Array(12)),body=await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:enc.encode(aad)},await storageKey(env),enc.encode(value));return hex(iv)+':'+hex(body)}
export async function openLauncher(env,value,aad){const [iv,body,...rest]=String(value).split(':');if(rest.length||!/^[0-9a-f]{24}$/.test(iv)||!body||body.length%2||!/^[0-9a-f]+$/.test(body))throw new Error('LAUNCHER_CIPHERTEXT_INVALID');return dec.decode(await crypto.subtle.decrypt({name:'AES-GCM',iv:bytes(iv),additionalData:enc.encode(aad)},await storageKey(env),bytes(body)))}
export const helperAAD=h=>`helper-v1\n${h.id}\n${h.user_id||0}\n${h.key_version}`;
export const commandAAD=c=>`command-v1\n${c.id}\n${c.user_id}\n${c.helper_id}\n${c.key_version}`;
export function launcherCanonical(purpose,helper,version,command,nonce,expiry,digest){if(version!==1)throw new Error('LAUNCHER_KEY_VERSION_INVALID');return ['visiond-launcher-v1',purpose,'POST','/api/launcher/'+purpose,helper,String(version),command,nonce,expiry,digest].join('\n')}
export async function launcherMac(secret,canonical){const key=await crypto.subtle.importKey('raw',bytes(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);return hex(await crypto.subtle.sign('HMAC',key,enc.encode(canonical)))}
export function equalLauncherMac(a,b){if(!launcherHex(a)||!launcherHex(b))return false;let d=0;for(let i=0;i<64;i++)d|=a.charCodeAt(i)^b.charCodeAt(i);return d===0}
