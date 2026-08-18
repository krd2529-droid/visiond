import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';

const root=process.cwd();
const mobile=path.resolve(root,'../V-Easy-v1.0.9-work');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const mread=p=>fs.readFileSync(path.join(mobile,p),'utf8');

assert.ok(/^v0\.14\.(?:11[1-9]|1[2-9]\d|[2-9]\d\d)$/.test(read('VERSION.txt').trim()),'v0.14.111 or later');
assert.match(read('functions/api/vision7/_middleware.js'),/OPTIONS|Access-Control-Allow-Origin/);
for(const p of [
  'functions/api/vision7/shops/[shopId]/orders/[orderId]/cancel.js',
  'functions/api/vision7/shops/[shopId]/products/[productId].js',
  'functions/api/vision7/shops/[shopId]/bot.js',
  'migrations/0033_veasy_live_operations.sql'
]) assert.ok(fs.existsSync(path.join(root,p)),`missing ${p}`);

assert.ok(/^1\.0\.(?:10|1[1-9]|[2-9]\d)$/.test(JSON.parse(mread('package.json')).version),'V Easy v1.0.10 or later');
const ui=mread('public/b111-mobile.js');
for(const token of ['LINE OA','Facebook Messenger','line-button','messenger-button','cancel-order','edit-product','veasy-notification-queue']) assert.ok(ui.includes(token),`missing mobile token ${token}`);
for(const token of ['urgent','page','reminder','snooze']) assert.ok(ui.toLowerCase().includes(token),`missing action queue token ${token}`);
assert.match(ui,/5.*10.*30|\[5,10,30\]/s,'reminder interval choices missing');
assert.match(ui,/Nitron|process/,'native limitation must stay explicit');

const apkCandidates=fs.readdirSync(path.join(mobile,'dist')).filter(x=>/^V-Easy-v1\.0\.(?:10|1[1-9]|[2-9]\d)-debug\.apk$/.test(x));
assert.ok(apkCandidates.some(x=>fs.statSync(path.join(mobile,'dist',x)).size>100_000),'signed APK missing');

for(const envName of ['VISIOND_WEB_ZIP','VEASY_APK']){
  if(process.env[envName]) assert.ok(fs.existsSync(process.env[envName])&&fs.statSync(process.env[envName]).size>0,`${envName} invalid`);
}
assert.ok(fs.existsSync(path.join(mobile,'public'))&&fs.existsSync(path.join(mobile,'scripts/build-apk.mjs')),'private versioned mobile source missing');
console.log('v0.14.111 B1 source and artifact contracts passed');
