import {json} from '../../_lib.js';
import {stockStore} from '../../_stock.js';
import {getStockFeed} from '../toys-center/feed.csv.js';

export async function onRequestGet(ctx){const store=stockStore(ctx.request.url,{defaultStore:'zippo'});return store?getStockFeed(ctx,store.id):json({error:'ร้านไม่ถูกต้อง'},400)}
