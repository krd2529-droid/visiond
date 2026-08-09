import assert from 'node:assert/strict';
import {FIRST_ORDER_PROMO,calculateFirstOrderDiscount} from '../functions/_first_order_promo.js';
assert.equal(FIRST_ORDER_PROMO.minimum,39900);
assert.equal(calculateFirstOrderDiscount({active:true},39800),0);
assert.equal(calculateFirstOrderDiscount({active:true},39900),19950);
assert.equal(calculateFirstOrderDiscount({active:true},40000),20000);
assert.equal(calculateFirstOrderDiscount({active:true},99900),20000);
assert.equal(calculateFirstOrderDiscount({active:false},99900),0);
console.log('PASS first-order promotion: 399 บาทขึ้นไป, 50%, capped at 200 บาท');
