import assert from 'node:assert/strict';
import fs from 'node:fs';
import {VisionDPartnerClient,newIdempotencyKey,newRequestId,signVisionDWebhook,validatePartnerConfig} from '../integrations/web2/visiond-partner-client.mjs';

assert.equal(fs.readFileSync('VERSION.txt','utf8').trim(),'v0.14.223');
assert.throws(()=>validatePartnerConfig({baseUrl:'http://test.invalid',clientId:'id',clientSecret:'1234567890123456',fetch(){}}),/HTTPS/);
assert.match(newRequestId(),/^web2-/);assert.match(newIdempotencyKey('order'),/^order-/);
const secret='starter-kit-test-secret-not-production',signature=await signVisionDWebhook(secret,'1800000000','{"ok":true}');assert.match(signature,/^v1=[a-f0-9]{64}$/);
const calls=[],mockFetch=async(url,options={})=>{calls.push({url,options});return new Response(JSON.stringify({ok:true,items:[]}),{status:200,headers:{'content-type':'application/json'}})};
const client=new VisionDPartnerClient({baseUrl:'https://visiond.example.invalid/api/partner/v1',clientId:'test-client-placeholder',clientSecret:secret,fetch:mockFetch});
await client.products({limit:10,category:'paper-doll'});await client.syncCustomer({external_customer_id:'CUSTOMER-1',name:'Test'},{idempotencyKey:'customer-00000001'});await client.signedEvent({type:'customer',external_id:'CUSTOMER-1',data:{external_customer_id:'CUSTOMER-1',name:'Test'}},{idempotencyKey:'event-00000001',timestamp:'1800000000'});
assert.equal(calls.length,3);assert.match(calls[0].url,/products\?limit=10&cursor=0&category=paper-doll/);assert.equal(calls[1].options.headers['idempotency-key'],'customer-00000001');assert.match(calls[2].options.headers['x-visiond-signature'],/^v1=/);
await assert.rejects(()=>client.syncCustomer({external_customer_id:'C-1',access_token:'forbidden'},{idempotencyKey:'customer-00000002'}),/FORBIDDEN_SENSITIVE_FIELD/);
assert.equal(JSON.stringify(calls).includes(secret),true,'mock transport must receive secret only in outbound headers');
assert.equal(Object.keys(client).length,0,'credential must remain in private class field');
console.log('v0.14.223 Web2 backend starter client config IDs sync signed events and sensitive payload guard: PASS');
