import assert from 'node:assert/strict';
import {normalizeVpageContentSet} from '../functions/_vpage-provisioning.js';

const legacy={set_no:1,product_image_url:'https://images.example/hero.jpg',detail_text:'รายละเอียด',text_size:'medium',text_style:'normal',youtube_url:'',background_image_url:'https://images.example/background.jpg',product_items:[{destination_url:'https://shop.example/item',image_url:''}],contact_items:[{contact_type:'line',destination_url:'https://line.me/R/ti/p/@example',image_url:''}]};
const normalizedLegacy=normalizeVpageContentSet(legacy,1);
assert.ok(normalizedLegacy,'existing image-only page remains valid');
assert.equal(Object.hasOwn(normalizedLegacy,'background_color'),false,'old create snapshots retain their request hash shape');
assert.equal(Object.hasOwn(normalizedLegacy,'text_font'),false);
assert.equal(Object.hasOwn(normalizedLegacy,'text_color'),false);

const styled={...legacy,background_image_url:'',background_color:'#123456',text_font:'serif',text_color:'#FFFFFF'};
const normalizedStyled=normalizeVpageContentSet(styled,1);
assert.equal(normalizedStyled.background_image_url,'');
assert.equal(normalizedStyled.background_color,'#123456');
assert.equal(normalizedStyled.text_font,'serif');
assert.equal(normalizedStyled.text_color,'#ffffff');
assert.equal(normalizeVpageContentSet({...styled,background_color:'red'},1),null);
assert.equal(normalizeVpageContentSet({...styled,text_color:'red;}'},1),null);
assert.equal(normalizeVpageContentSet({...styled,text_font:'url(evil)'},1),null);
assert.equal(normalizeVpageContentSet({...styled,background_color:undefined},1),null,'solid background needs a valid color');
console.log('PASS Vpage styling create normalization, legacy compatibility and CSS input validation');
