const forbidden=/(?:^|_)(?:password|passcode|access_token|refresh_token|api_key|client_secret|authorization|card_number|pan|cvv|cvc|expiry|bank_account|account_number|routing_number|swift|iban)(?:$|_)/i;
const encoder=new TextEncoder();

function sensitivePath(value,path='payload'){
  if(Array.isArray(value)){for(let index=0;index<value.length;index++){const found=sensitivePath(value[index],`${path}[${index}]`);if(found)return found}return''}
  if(value&&typeof value==='object'){for(const[key,child]of Object.entries(value)){if(forbidden.test(key))return`${path}.${key}`;const found=sensitivePath(child,`${path}.${key}`);if(found)return found}}
  return'';
}

function hex(buffer){return[...new Uint8Array(buffer)].map(value=>value.toString(16).padStart(2,'0')).join('')}
export const newRequestId=(prefix='web2')=>`${prefix}-${crypto.randomUUID()}`;
export const newIdempotencyKey=(resource='event')=>`${resource}-${crypto.randomUUID()}`;

export function validatePartnerConfig(config={}){
  const baseUrl=String(config.baseUrl||'').replace(/\/+$/,'');
  if(!/^https:\/\//i.test(baseUrl))throw new Error('VISIOND_BASE_URL_MUST_USE_HTTPS');
  if(!String(config.clientId||'').trim())throw new Error('VISIOND_CLIENT_ID_REQUIRED');
  if(String(config.clientSecret||'').length<16)throw new Error('VISIOND_CLIENT_SECRET_REQUIRED');
  if(typeof(config.fetch||globalThis.fetch)!=='function')throw new Error('FETCH_REQUIRED');
  return{baseUrl,clientId:String(config.clientId).trim(),clientSecret:String(config.clientSecret),fetch:config.fetch||globalThis.fetch};
}

export async function signVisionDWebhook(clientSecret,timestamp,rawBody){
  const key=await crypto.subtle.importKey('raw',encoder.encode(String(clientSecret)),{name:'HMAC',hash:'SHA-256'},false,['sign']);
  return`v1=${hex(await crypto.subtle.sign('HMAC',key,encoder.encode(`${timestamp}.${rawBody}`)))}`;
}

export class VisionDPartnerClient{
  #config;
  constructor(config){this.#config=validatePartnerConfig(config)}
  async #request(path,{method='GET',body,idempotencyKey,requestId=newRequestId()}={}){
    const forbiddenPath=sensitivePath(body);if(forbiddenPath)throw new Error(`FORBIDDEN_SENSITIVE_FIELD:${forbiddenPath}`);
    const headers={'x-visiond-client-id':this.#config.clientId,authorization:`Bearer ${this.#config.clientSecret}`,'x-request-id':requestId};
    if(body!==undefined)headers['content-type']='application/json';if(idempotencyKey)headers['idempotency-key']=idempotencyKey;
    const response=await this.#config.fetch(`${this.#config.baseUrl}${path}`,{method,headers,body:body===undefined?undefined:JSON.stringify(body)}),data=await response.json().catch(()=>({}));
    if(!response.ok){const error=new Error(data.error||`VISIOND_HTTP_${response.status}`);error.status=response.status;error.requestId=data.request_id||response.headers?.get?.('x-request-id')||requestId;throw error}
    return data;
  }
  products({limit=50,cursor=0,category=''}={}){const query=new URLSearchParams({limit:String(limit),cursor:String(cursor)});if(category)query.set('category',category);return this.#request(`/products?${query}`)}
  product(id){if(!Number.isSafeInteger(Number(id))||Number(id)<1)throw new Error('VISIOND_PRODUCT_ID_INVALID');return this.#request(`/products/${Number(id)}`)}
  productChanges({limit=250,cursor=0}={}){const query=new URLSearchParams({limit:String(limit),cursor:String(cursor)});return this.#request(`/products/changes?${query}`)}
  createCommerceOrder(order,{idempotencyKey=newIdempotencyKey('commerce-order'),requestId}={}){return this.#request('/commerce/orders',{method:'POST',body:order,idempotencyKey,requestId})}
  commerceOrder(externalOrderId){const id=encodeURIComponent(String(externalOrderId||''));if(!id)throw new Error('VISIOND_EXTERNAL_ORDER_ID_REQUIRED');return this.#request(`/commerce/orders/${id}`)}
  async *productPages({limit=100,category=''}={}){let cursor=0;const seen=new Set();for(let page=0;page<10000;page++){const result=await this.products({limit,cursor,category});yield result;const next=result?.pagination?.next_cursor;if(!result?.pagination?.has_more||!Number.isSafeInteger(Number(next))||seen.has(String(next)))return;seen.add(String(next));cursor=Number(next)}throw new Error('VISIOND_PRODUCT_PAGINATION_LIMIT')}
  async *productChangePages({limit=250,cursor=0}={}){const seen=new Set();for(let page=0;page<10000;page++){const result=await this.productChanges({limit,cursor});yield result;const next=result?.pagination?.next_cursor;if(!Number.isSafeInteger(Number(next))||Number(next)<Number(cursor)||seen.has(String(next)))throw new Error('VISIOND_PRODUCT_CHANGE_CURSOR_INVALID');if(!result?.pagination?.has_more)return;seen.add(String(next));cursor=Number(next)}throw new Error('VISIOND_PRODUCT_CHANGE_PAGINATION_LIMIT')}
  syncCustomer(customer,{idempotencyKey=newIdempotencyKey('customer'),requestId}={}){return this.#request('/customers/sync',{method:'POST',body:customer,idempotencyKey,requestId})}
  syncOrder(order,{idempotencyKey=newIdempotencyKey('order'),requestId}={}){return this.#request('/orders/sync',{method:'POST',body:order,idempotencyKey,requestId})}
  async signedEvent(event,{idempotencyKey=newIdempotencyKey('event'),requestId,timestamp=String(Math.floor(Date.now()/1000))}={}){
    const forbiddenPath=sensitivePath(event?.data);if(forbiddenPath)throw new Error(`FORBIDDEN_SENSITIVE_FIELD:${forbiddenPath}`);
    const rawBody=JSON.stringify(event),signature=await signVisionDWebhook(this.#config.clientSecret,timestamp,rawBody),headers={'content-type':'application/json','x-visiond-client-id':this.#config.clientId,'x-visiond-timestamp':timestamp,'x-visiond-signature':signature,'idempotency-key':idempotencyKey,'x-request-id':requestId||newRequestId('event')};
    const response=await this.#config.fetch(`${this.#config.baseUrl}/webhooks/events`,{method:'POST',headers,body:rawBody}),data=await response.json().catch(()=>({}));
    if(!response.ok){const error=new Error(data.error||`VISIOND_HTTP_${response.status}`);error.status=response.status;throw error}return data;
  }
}
