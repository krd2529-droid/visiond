const enc=new TextEncoder(),dec=new TextDecoder(),CREDENTIAL_AAD=enc.encode('visiond-partner-credentials-v1'),DATA_AAD=enc.encode('visiond-partner-customer-data-v1'),CREDENTIAL_PREFIX='vdpa1:',DATA_PREFIX='vdpd1:';
const b64=a=>btoa(String.fromCharCode(...a)),unb64=s=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
const master=env=>String(env.VISIOND_PARTNER_ENCRYPTION_KEY||env.VISIOND_CHANNEL_ENCRYPTION_KEY||'');
async function key(env){const secret=master(env);if(secret.length<32)throw new Error('PARTNER_ENCRYPTION_NOT_CONFIGURED');const digest=await crypto.subtle.digest('SHA-256',enc.encode(secret));return crypto.subtle.importKey('raw',digest,{name:'AES-GCM'},false,['encrypt','decrypt'])}
export const partnerEncryptionReady=env=>master(env).length>=32;
async function encrypt(env,value,aad,prefix){const iv=crypto.getRandomValues(new Uint8Array(12)),data=await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:aad},await key(env),enc.encode(String(value)));return `${prefix}${b64(iv)}:${b64(new Uint8Array(data))}`}
async function decrypt(env,value,aad,prefix){const parts=String(value||'').slice(prefix.length).split(':');if(parts.length!==2||!String(value||'').startsWith(prefix))throw new Error('PARTNER_CIPHERTEXT_INVALID');const data=await crypto.subtle.decrypt({name:'AES-GCM',iv:unb64(parts[0]),additionalData:aad},await key(env),unb64(parts[1]));return dec.decode(data)}
export const encryptPartnerSecret=(env,value)=>encrypt(env,value,CREDENTIAL_AAD,CREDENTIAL_PREFIX);
export const decryptPartnerSecret=(env,value)=>decrypt(env,value,CREDENTIAL_AAD,CREDENTIAL_PREFIX);
export const encryptPartnerData=(env,value)=>encrypt(env,value,DATA_AAD,DATA_PREFIX);
export const decryptPartnerData=(env,value)=>decrypt(env,value,DATA_AAD,DATA_PREFIX);
