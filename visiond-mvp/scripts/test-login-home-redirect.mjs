import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync(new URL('../public/member-auth.js',import.meta.url),'utf8').replace(/^import\([^\n]+\);\r?\n/,'');

async function submit(formId,saved,responseOk=true){
  const entries=saved===undefined?[]:[['vd_return_to',saved]];
  const storage=new Map(entries),handlers={},requests=[];
  const button={textContent:'ส่ง',disabled:false};
  const form={id:formId,querySelector:()=>button};
  const message={textContent:''};
  const location={origin:'https://visiondonline.com',href:'https://visiondonline.com/login.html'};
  const document={querySelector(selector){
    if(selector==='#pageAuthMsg')return message;
    if(selector==='#loginPageForm'&&formId==='loginPageForm')return {addEventListener:(_,handler)=>handlers.submit=handler};
    if(selector==='#registerPageForm'&&formId==='registerPageForm')return {addEventListener:(_,handler)=>handlers.submit=handler};
    return null;
  }};
  const fields=formId==='loginPageForm'?[['login','member'],['password','password']]:[
    ['firstName','Member'],['lastName','Test'],['email','member@example.test'],['phone','0812345678'],
    ['password','password'],['confirmPassword','password'],['termsAccepted','true']
  ];
  const context={document,sessionStorage:{getItem:key=>storage.get(key),removeItem:key=>storage.delete(key)},
    location,URL,FormData:class{constructor(){this.fields=fields}*[Symbol.iterator](){yield* this.fields}},
    fetch:async(endpoint,options)=>{requests.push({endpoint,options});return {ok:responseOk,status:401,json:async()=>responseOk?{}:{error:'Invalid credentials'}}},
    window:{visiondTrack:()=>{}}};
  vm.runInNewContext(source,context,{filename:'member-auth.js'});
  handlers.submit({preventDefault(){},currentTarget:form});
  await new Promise(resolve=>setImmediate(resolve));
  return {location,storage,requests,message,button};
}

const ordinary=await submit('loginPageForm');
assert.equal(ordinary.location.href,'/');
assert.equal(ordinary.requests[0].endpoint,'/api/auth/login');

for(const target of ['/cart','/learn.html?course=7#lesson']){
  const result=await submit('loginPageForm',target);
  assert.equal(result.location.href,target);
  assert.equal(result.storage.has('vd_return_to'),false);
}
for(const target of ['//evil.example/path','/\\evil.example','https://evil.example/path']){
  const result=await submit('loginPageForm',target);
  assert.equal(result.location.href,'/',`unsafe return target ${target}`);
}
const registration=await submit('registerPageForm');
assert.equal(registration.location.href,'/dashboard.html');
assert.equal(registration.requests[0].endpoint,'/api/auth/register');
const failed=await submit('loginPageForm','/cart',false);
assert.equal(failed.location.href,'https://visiondonline.com/login.html');
assert.equal(failed.storage.get('vd_return_to'),'/cart');
assert.equal(failed.message.textContent,'Invalid credentials');
assert.equal(failed.button.disabled,false);

console.log('PASS login homepage fallback, safe return, unsafe fallback, registration and failed login');
