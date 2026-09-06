import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../public/tiktok-analyzer.js', import.meta.url), 'utf8');
const body = source.match(/function reconcileProductPrepInventory[\s\S]*?\n\}/)[0];
const cards = [];
const total = {textContent: ''};
const result = {hidden: true};
const dots = [...'ABCDEF'].map(textContent => ({textContent, nextElementSibling: {textContent: ''}}));
const list = {
  querySelectorAll: () => [...cards],
  insertAdjacentHTML(_, html) {
    const name = html.match(/<b>(.*?)<\/b>/)[1];
    const badge = {textContent: ''};
    const order = {textContent: ''};
    const card = {
      querySelector: selector => selector.includes('copy b') ? {textContent: name} : selector.includes('grade') ? badge : order,
      querySelectorAll: () => [],
      remove: () => cards.splice(cards.indexOf(card), 1)
    };
    cards.push(card);
    this.lastElementChild = card;
  }
};
const context = vm.createContext({
  $: selector => selector.includes('data-list') ? list : selector === '#result' ? result : selector.includes('.total') ? total : {querySelectorAll: () => dots},
  normalizeProductName: value => String(value || '').trim().toLowerCase(),
  escapeHtml: value => String(value || ''),
  typeLabels: Object.fromEntries([...'ABCDEF'].map(x => [x,x]))
});
vm.runInContext(body, context);
const reconcile = context.reconcileProductPrepInventory;
const product = {name:'Saved sales product', product_type:'D', inventory_status:'kept'};
reconcile([product]);
assert.equal(cards.length, 1, 'saved product appears without a prior AI result');
assert.equal(result.hidden, false);
assert.equal(total.textContent, '1/40');
assert.equal(dots[3].nextElementSibling.textContent, 1);
reconcile([product]);
assert.equal(cards.length, 1, 'reloading or re-adding does not duplicate');
reconcile([{...product, product_type:'B'}]);
assert.equal(cards[0].querySelector('.product-prep-grade').textContent, 'B');
reconcile([{...product, inventory_status:'discarded'}]);
assert.equal(cards.length, 0);
assert.equal(total.textContent, '0/40');
const saveBody = source.match(/async function setProductC\([\s\S]*?\n\}/)[0];
assert.ok(saveBody.includes('reconcileProductPrepInventory(state.inventoryProducts)'), 'add success refreshes visible shortlist');
console.log('Shortlist add, reload, duplicate, grade and discard: PASS');
