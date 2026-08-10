import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';

const root=process.cwd();
const mobile=path.resolve(root,'../V-Easy-v1.0.9-work');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const mread=p=>fs.readFileSync(path.join(mobile,p),'utf8');

assert.equal(read('VERSION.txt').trim(),'v0.14.111');
assert.match(read('functions/api/vision7/_middleware.js'),/OPTIONS|Access-Control-Allow-Origin/);
for(const p of [
  'functions/api/vision7/shops/[shopId]/orders/[orderId]/cancel.js',
  'functions/api/vision7/shops/[shopId]/products/[productId].js',
  'functions/api/vision7/shops/[shopId]/bot.js',
  'migrations/0033_veasy_live_operations.sql'
]) assert.ok(fs.existsSync(path.join(root,p)),`missing ${p}`);

assert.equal(JSON.parse(mread('package.json')).version,'1.0.10');
const ui=mread('public/b111-mobile.js');
for(const token of ['LINE OA','Facebook Messenger','line-button','messenger-button','cancel-order','edit-product','veasy-notification-queue']) assert.ok(ui.includes(token),`missing mobile token ${token}`);
for(const token of ['urgent','page','reminder','snooze']) assert.ok(ui.toLowerCase().includes(token),`missing action queue token ${token}`);
assert.match(ui,/5.*10.*30|\[5,10,30\]/s,'reminder interval choices missing');
assert.match(ui,/Nitron|process/,'native limitation must stay explicit');

const apk=path.join(mobile,'dist/V-Easy-v1.0.10-debug.apk');
assert.ok(fs.existsSync(apk)&&fs.statSync(apk).size>100_000,'signed APK missing');

for(const envName of ['VISIOND_WEB_ZIP','VEASY_SOURCE_ZIP','VEASY_APK']){
  if(process.env[envName]) assert.ok(fs.existsSync(process.env[envName])&&fs.statSync(process.env[envName]).size>0,`${envName} invalid`);
}
console.log('v0.14.111 B1 source and artifact contracts passed');
