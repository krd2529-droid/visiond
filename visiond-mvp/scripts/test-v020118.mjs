import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {DatabaseSync} from 'node:sqlite';
import {onRequestGet as listAccounts,onRequestPost as createAccount} from '../functions/api/admin/account-vault/index.js';
import {onRequestPatch as updateAccount} from '../functions/api/admin/account-vault/[id].js';
import {socialAccountValues} from '../functions/_account_vault_social.js';

const read=path=>fs.readFile(new URL('../'+path,import.meta.url),'utf8');
const sqlite=new DatabaseSync(':memory:');
sqlite.exec('PRAGMA foreign_keys=ON');
sqlite.exec(`CREATE TABLE users(id INTEGER PRIMARY KEY,email TEXT,username TEXT,name TEXT,phone TEXT,role TEXT,created_at TEXT DEFAULT CURRENT_TIMESTAMP);CREATE TABLE sessions(id TEXT PRIMARY KEY,user_id INTEGER,expires_at TEXT);CREATE TABLE entitlements(id INTEGER PRIMARY KEY,user_id INTEGER,product_id INTEGER,active INTEGER);CREATE TABLE products(id INTEGER PRIMARY KEY,category TEXT);CREATE TABLE courses(product_id INTEGER,course_type TEXT);CREATE TABLE course_right_credits(id INTEGER PRIMARY KEY,user_id INTEGER,product_id INTEGER);`);
sqlite.exec(await read('migrations/0076_account_vault.sql'));
sqlite.exec(await read('migrations/0108_account_vault_social_hint.sql'));
sqlite.exec("INSERT INTO users(id,email,username,name,phone,role) VALUES(1,'boss@example.test','boss','Boss','','boss'),(2,'user@example.test','user','User','','user');INSERT INTO sessions(id,user_id,expires_at) VALUES('boss-session',1,'2099-01-01 00:00:00'),('user-session',2,'2099-01-01 00:00:00')");

const seen=[];
class Bound{
  constructor(sql,args=[]){this.sql=sql;this.args=args}
  bind(...args){return new Bound(this.sql,args)}
  first(){seen.push(this.sql);return sqlite.prepare(this.sql).get(...this.args)}
  all(){seen.push(this.sql);return{results:sqlite.prepare(this.sql).all(...this.args)}}
  run(){seen.push(this.sql);const result=sqlite.prepare(this.sql).run(...this.args);return{meta:{changes:Number(result.changes),last_row_id:Number(result.lastInsertRowid)}}}
}
const env={ACCOUNT_VAULT_ENCRYPTION_KEY:'test-key-that-is-at-least-thirty-two-characters',DB:{prepare:sql=>new Bound(sql)}};
const request=(url,{method='GET',session='boss-session',body}={})=>new Request(url,{method,headers:{cookie:'vd_session='+session,...(body?{'content-type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});
const ctx=(url,options={},id)=>({env,request:request(url,options),params:id?{id:String(id)}:{}});
const shopee={platform:'Shopee',account_name:'Boss Shopee',login_url:'seller.shopee.co.th',phone:'',email:'boss-shopee@example.test',password_hint:'orange-cart',note:'ร้านหลัก'};
const suggestedPlatforms=['Facebook','Instagram','TikTok','YouTube','LINE','X','Shopee'];

for(const platform of suggestedPlatforms)assert.equal(socialAccountValues({...shopee,platform}).platform,platform);
assert.equal(socialAccountValues({...shopee,platform:'Custom Marketplace'}).platform,'Custom Marketplace','datalist remains a suggestion and preserves custom platform text');
const html=await read('public/account-vault.html');
assert.deepEqual([...html.matchAll(/<option value="([^"]+)">/g)].map(match=>match[1]),suggestedPlatforms,'Shopee joins the existing platform suggestions without replacing them');

seen.length=0;
let response=await createAccount(ctx('https://fixture.test/api/admin/account-vault',{method:'POST',session:'user-session',body:shopee}));
assert.equal(response.status,403);assert.equal(seen.some(sql=>sql.includes('admin_account_vault')),false,'non-Boss denial occurs before vault reads or writes');

seen.length=0;
response=await createAccount(ctx('https://fixture.test/api/admin/account-vault',{method:'POST',body:shopee}));
assert.equal(response.status,201);assert.equal(response.headers.get('cache-control'),'private, no-store');
let data=await response.json(),id=data.item.id;
assert.equal(data.item.platform,'Shopee');assert.equal(data.item.login_url,'https://seller.shopee.co.th/');assert.equal(Object.hasOwn(data.item,'email'),false);
assert.equal(seen.filter(sql=>/^INSERT INTO admin_account_vault/.test(sql)).length,1);assert.equal(seen.some(sql=>/CREATE|ALTER/.test(sql)),false);

seen.length=0;
response=await listAccounts(ctx('https://fixture.test/api/admin/account-vault?limit=24'));
assert.equal(response.status,200);data=await response.json();assert.equal(data.pagination.limit,24);assert.equal(data.items.length,1);assert.equal(data.items[0].platform,'Shopee');
assert.equal(seen.filter(sql=>sql.includes('admin_account_vault')).length,1,'list remains one bounded keyset vault query');assert.equal(seen.some(sql=>/CREATE|ALTER/.test(sql)),false);

seen.length=0;
response=await updateAccount(ctx('https://fixture.test/api/admin/account-vault/'+id,{method:'PATCH',body:{...shopee,account_name:'Boss Shopee Updated',login_url:'https://seller.shopee.co.th/account/signin'}},id));
assert.equal(response.status,200);data=await response.json();assert.equal(data.item.platform,'Shopee');assert.equal(data.item.account_name,'Boss Shopee Updated');assert.equal(data.item.login_url,'https://seller.shopee.co.th/account/signin');

const custom={...shopee,platform:'Custom Marketplace',account_name:'Existing Custom Platform',login_url:'custom.example.test'};
seen.length=0;response=await createAccount(ctx('https://fixture.test/api/admin/account-vault',{method:'POST',body:custom}));assert.equal(response.status,201);data=await response.json();const customId=data.item.id;assert.equal(data.item.platform,'Custom Marketplace');assert.equal(data.item.login_url,'https://custom.example.test/');assert.equal(seen.filter(sql=>/^INSERT INTO admin_account_vault/.test(sql)).length,1);
seen.length=0;response=await updateAccount(ctx('https://fixture.test/api/admin/account-vault/'+customId,{method:'PATCH',body:{...custom,account_name:'Existing Custom Platform Updated'}},customId));assert.equal(response.status,200);data=await response.json();assert.equal(data.item.platform,'Custom Marketplace');assert.equal(data.item.account_name,'Existing Custom Platform Updated');assert.equal(seen.filter(sql=>/^UPDATE admin_account_vault/.test(sql)).length,1);

sqlite.close();
console.log('PASS v0.20.118 Shopee Boss vault add/edit/list, custom platform preservation, role denial and bounded list');
