const MODEL_PATTERN=/^[a-zA-Z0-9._:-]{1,100}$/;
const TIMEOUT_MS=25000;

const cleanModel=(value,fallback)=>MODEL_PATTERN.test(String(value||''))?String(value):fallback;
const secret=value=>String(value||'').trim();

export function selectElonProvider(env={}){
  // ELON uses dedicated credentials. Shared Vision 2/OpenAI keys are accepted
  // only when the operator explicitly opts in during a controlled migration.
  const allowShared=String(env.ELON_ALLOW_SHARED_PROVIDER_KEYS||'')==='1';
  const openaiKey=secret(env.ELON_OPENAI_API_KEY)||(allowShared?secret(env.OPENAI_API_KEY):'');
  if(openaiKey)return {name:'openai',key:openaiKey,model:cleanModel(env.OPENAI_MODEL,'gpt-4.1-mini')};
  const geminiKey=secret(env.ELON_GEMINI_API_KEY)||(allowShared?(secret(env.GEMINI_API_KEY)||secret(env.GEMINI_API_KEY_2)):'');
  if(geminiKey)return {name:'gemini',key:geminiKey,model:cleanModel(env.ELON_GEMINI_MODEL||env.GEMINI_TEXT_MODEL,'gemini-2.5-flash')};
  return null;
}

export async function requestElonProvider(provider,{systemPrompt,history,message},{fetchImpl=fetch,signalFactory=()=>AbortSignal.timeout(TIMEOUT_MS)}={}){
  if(!provider)throw new Error('AI_NOT_CONFIGURED');
  return provider.name==='openai'
    ? requestOpenAI(provider,{systemPrompt,history,message},fetchImpl,signalFactory)
    : requestGemini(provider,{systemPrompt,history,message},fetchImpl,signalFactory);
}

async function requestOpenAI(provider,input,fetchImpl,signalFactory){
  const response=await fetchImpl('https://api.openai.com/v1/responses',{
    method:'POST',
    headers:{authorization:`Bearer ${provider.key}`,'content-type':'application/json'},
    body:JSON.stringify({model:provider.model,instructions:input.systemPrompt,input:[...input.history,{role:'user',content:input.message}],max_output_tokens:500,store:false}),
    signal:signalFactory()
  });
  if(!response.ok)throw new Error(`OPENAI_HTTP_${response.status}`);
  const payload=await response.json();
  return {payload,usage:payload?.usage||null};
}

async function requestGemini(provider,input,fetchImpl,signalFactory){
  const contents=[...input.history,{role:'user',content:input.message}].map(item=>({
    role:item.role==='assistant'?'model':'user',
    parts:[{text:String(item.content||'')}]
  }));
  const response=await fetchImpl(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(provider.model)}:generateContent`,{
    method:'POST',
    headers:{'content-type':'application/json','x-goog-api-key':provider.key},
    body:JSON.stringify({
      systemInstruction:{parts:[{text:input.systemPrompt}]},
      contents,
      generationConfig:{maxOutputTokens:500}
    }),
    signal:signalFactory()
  });
  if(!response.ok)throw new Error(`GEMINI_HTTP_${response.status}`);
  const payload=await response.json();
  return {payload,usage:payload?.usageMetadata||null};
}

export function extractProviderText(providerName,payload){
  if(providerName==='gemini')return (payload?.candidates?.[0]?.content?.parts||[]).map(part=>typeof part?.text==='string'?part.text:'').join('').trim();
  if(typeof payload?.output_text==='string'&&payload.output_text.trim())return payload.output_text.trim();
  for(const item of payload?.output||[])for(const part of item?.content||[])if(part?.type==='output_text'&&part?.text)return String(part.text).trim();
  return '';
}
