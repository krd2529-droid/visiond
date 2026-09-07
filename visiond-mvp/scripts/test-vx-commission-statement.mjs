import assert from 'node:assert/strict';
import fs from 'node:fs';
import { onRequestGet } from '../functions/api/vx/payouts/[id].js';

const read = file => fs.readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
const payout = { id:'p1',payout_no:'VX-TEST',referrer_user_id:7,amount:20000,currency:'THB',status:'paid',recipient_name:'ผู้รับ' };
const items = [{ id:'c1',order_id:1,order_no:'VD-1',base_amount:50000,rate_bps:2000,amount:10000,currency:'THB' },{ id:'c2',order_id:2,order_no:'VD-2',base_amount:40000,rate_bps:2500,amount:10000,currency:'THB' }];
const database = (userId=7,payoutRow=payout) => ({ exec:async()=>{},prepare(sql){return{bind(){return this},first:async()=>sql.includes('FROM sessions')?{id:userId,name:'ผู้รับ',role:'user'}:payoutRow,all:async()=>({results:items}),run:async()=>({meta:{changes:0}})}} });
const request = new Request('https://visiondonline.com/api/vx/payouts/p1',{headers:{cookie:'vd_session=s'}});
const response = await onRequestGet({ env:{DB:database()},request,params:{id:'p1'} });
assert.equal(response.status,200);const body=await response.json();assert.equal(body.statement.total_base_amount,90000);assert.equal(body.statement.total_commission,20000);assert.deepEqual(body.statement.items.map(item=>item.rate_percent),[20,25]);
assert.equal((await onRequestGet({env:{DB:database(8)},request,params:{id:'p1'}})).status,403);
assert.equal((await onRequestGet({env:{DB:database(7,{...payout,amount:20001})},request,params:{id:'p1'}})).status,409);
for(const token of ['ยอดขายเต็มรวม','เปอร์เซ็นต์ค่าคอม','ยอดรวมค่าคอมทั้งหมด','printStatement'])assert.match(read('public/vx-commission-statement.html'),new RegExp(token));
assert.match(read('functions/api/vx/payouts/[id].js'),/totalCommission !== Number\(payout\.amount\)/);assert.match(read('functions/api/vx/payouts/[id].js'),/ไม่มีสิทธิ์ดูเอกสารนี้/);assert.match(read('public/vx-affiliate.js'),/payoutStatements/);assert.match(read('public/vx-affiliate-admin.js'),/vx-commission-statement\.html/);
console.log('VX commission payout statement: PASS');
