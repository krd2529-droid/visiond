import {json} from '../../_lib.js';
import {stockStore} from '../../_stock.js';
import {getStockProducts} from '../toys-center/products.js';

export async function onRequestGet(ctx){const store=stockStore(ctx.request.url,{defaultStore:'zippo'});return store?getStockProducts(ctx,store.id):json({error:'ร้านไม่ถูกต้อง'},400)}
