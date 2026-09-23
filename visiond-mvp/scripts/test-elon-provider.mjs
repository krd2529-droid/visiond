import assert from 'node:assert/strict';
import {extractProviderText,requestElonProvider,selectElonProvider} from '../functions/_elon-provider.js';

const input={systemPrompt:'VisionD only',history:[{role:'user',content:'ก่อนหน้า'},{role:'assistant',content:'คำตอบ'}],message:'ซื้ออย่างไร'};
const response=(payload,status=200)=>({ok:status>=200&&status<300,status,json:async()=>payload});

{
  const provider=selectElonProvider({ELON_OPENAI_API_KEY:'openai-secret',ELON_GEMINI_API_KEY:'gemini-secret'});
  assert.equal(provider.name,'openai');
  let request;
  const result=await requestElonProvider(provider,input,{fetchImpl:async(url,options)=>(request={url,options},response({output_text:'คำตอบ OpenAI',usage:{total_tokens:9}})),signalFactory:()=>null});
  assert.equal(extractProviderText(provider.name,result.payload),'คำตอบ OpenAI');
  assert.equal(request.url,'https://api.openai.com/v1/responses');
  assert.equal(request.options.headers.authorization,'Bearer openai-secret');
  assert.ok(!request.options.body.includes('openai-secret'));
}

{
  const provider=selectElonProvider({ELON_GEMINI_API_KEY:'gemini-secondary'});
  assert.equal(provider.name,'gemini');
  let request;
  const payload={candidates:[{content:{parts:[{text:'คำตอบ '},{text:'Gemini'}]}}],usageMetadata:{totalTokenCount:8}};
  const result=await requestElonProvider(provider,input,{fetchImpl:async(url,options)=>(request={url,options},response(payload)),signalFactory:()=>null});
  const body=JSON.parse(request.options.body);
  assert.match(request.url,/gemini-2\.5-flash:generateContent$/);
  assert.equal(request.options.headers['x-goog-api-key'],'gemini-secondary');
  assert.ok(!request.url.includes('gemini-secondary'));
  assert.ok(!request.options.body.includes('gemini-secondary'));
  assert.deepEqual(body.systemInstruction,{parts:[{text:'VisionD only'}]});
  assert.deepEqual(body.contents.map(item=>item.role),['user','model','user']);
  assert.deepEqual(body.generationConfig,{maxOutputTokens:900,temperature:0.35},'unrelated provider callers retain the exact default Gemini payload');
  assert.equal(extractProviderText(provider.name,result.payload),'คำตอบ Gemini');
}

{
  const schema={type:'object',properties:{schema:{type:'string'}},required:['schema'],additionalProperties:false};
  const bodies=[];
  const fetchImpl=async(_url,options)=>(bodies.push(JSON.parse(options.body)),response({candidates:[]}));
  await requestElonProvider({name:'gemini',key:'secret',model:'gemini-2.5-flash'},{...input,responseJsonSchema:schema,geminiThinkingBudget:0},{fetchImpl,signalFactory:()=>null});
  for(const model of ['gemini-custom','gemini-2.5-pro','gemini-2.5-flash-image'])await requestElonProvider({name:'gemini',key:'secret',model},{...input,responseJsonSchema:schema,geminiThinkingBudget:0},{fetchImpl,signalFactory:()=>null});
  assert.equal(bodies[0].generationConfig.responseMimeType,'application/json');
  assert.deepEqual(bodies[0].generationConfig.responseJsonSchema,schema);
  assert.deepEqual(bodies[0].generationConfig.thinkingConfig,{thinkingBudget:0});
  for(const body of bodies.slice(1)){assert.equal(body.generationConfig.responseMimeType,'application/json');assert.equal(body.generationConfig.thinkingConfig,undefined,'custom, Pro and image Gemini models are not sent a text-Flash-only thinking control')}
}

assert.equal(extractProviderText('gemini',{candidates:[]}), '');
await assert.rejects(()=>requestElonProvider({name:'gemini',key:'secret',model:'gemini-2.5-flash'},input,{fetchImpl:async()=>response({},429),signalFactory:()=>null}),/GEMINI_HTTP_429/);
await assert.rejects(()=>requestElonProvider({name:'openai',key:'secret',model:'gpt-4.1-mini'},input,{fetchImpl:async()=>{throw new DOMException('timed out','TimeoutError')},signalFactory:()=>null}),/timed out/);
assert.equal(selectElonProvider({}),null);
assert.equal(selectElonProvider({OPENAI_API_KEY:'shared-key'}),null);
assert.equal(selectElonProvider({OPENAI_API_KEY:'shared-key',ELON_ALLOW_SHARED_PROVIDER_KEYS:'1'}).key,'shared-key');
console.log('ELON provider mocked tests passed');
