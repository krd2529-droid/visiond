import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';

const root=process.cwd(),mobile=path.resolve(root,'../V-Easy-v1.0.9-work');
const read=p=>fs.readFileSync(path.join(root,p),'utf8'),mread=p=>fs.readFileSync(path.join(mobile,p),'utf8');
assert.equal(read('VERSION.txt').trim(),'v0.14.113');
assert.equal(JSON.parse(mread('package.json')).version,'1.0.12');
const middleware=read('functions/api/vision7/_middleware.js'),app=mread('public/app.js'),runtime=mread('public/android-runtime.js');
for(const token of ['try{response=await ctx.next()}','VISION7_MOBILE_API_INTERNAL_ERROR','request_id','access-control-allow-origin'])assert.ok(middleware.includes(token),token);
assert.match(middleware,/status:500/);
assert.match(middleware,/console\.error\('VISION7_MOBILE_API_INTERNAL_ERROR'/);
assert.match(app,/ข้อมูลที่กรอกยังอยู่ กดลองใหม่ได้/);
assert.doesNotMatch(app,/finally\{values\.password=''/);
for(const token of ['NETWORK_OR_CORS','VISION7_MOBILE_API_INTERNAL_ERROR','VEASY_KEY_NOT_FOUND','VEASY_SHOP_NAME_REQUIRED','VEASY_DEVICE_LIMIT'])assert.ok(app.includes(token),token);
assert.match(runtime,/error\.requestId=String\(data\.request_id\|\|''\)/);
assert.match(runtime,/app_version:'1\.0\.12'/);
assert.doesNotMatch(runtime,/console\.(?:log|debug|info).*password/);
console.log('v0.14.113 / V Easy v1.0.12 activation error lock passed');
