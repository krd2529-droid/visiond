(function installPopup(scope){
  'use strict';

  const Core=scope.VisionDShopeeCore,STORAGE_KEY='visiondShopeeHandoffV1',MAX_JSON_BYTES=256*1024;
  const elements={
    jsonFile:document.querySelector('#jsonFile'),importStatus:document.querySelector('#importStatus'),preview:document.querySelector('#preview'),
    productId:document.querySelector('#productId'),productName:document.querySelector('#productName'),productSku:document.querySelector('#productSku'),productGtin:document.querySelector('#productGtin'),
    productSales:document.querySelector('#productSales'),productShipping:document.querySelector('#productShipping'),imageCount:document.querySelector('#imageCount'),imageList:document.querySelector('#imageList'),
    fillButton:document.querySelector('#fillButton'),clearButton:document.querySelector('#clearButton'),fillStatus:document.querySelector('#fillStatus'),fieldResults:document.querySelector('#fieldResults')
  };
  let handoff=null;
  const setStatus=(element,text,kind='muted')=>{element.textContent=text;element.className=`status ${kind}`};
  const storageGet=key=>new Promise(resolve=>chrome.storage.session.get(key,resolve));
  const storageSet=value=>new Promise(resolve=>chrome.storage.session.set(value,resolve));
  const storageRemove=key=>new Promise(resolve=>chrome.storage.session.remove(key,resolve));

  function firstErrorMessage(errors){
    const error=errors[0];
    if(!error)return'ไฟล์ไม่ถูกต้อง';
    const labels={wrong_schema:'schema ไม่ถูกต้อง',wrong_version:'version ไม่รองรับ',incomplete:'ข้อมูลใน VisionD ยังไม่ครบ',private_field:'พบฟิลด์ส่วนตัวที่ไม่อนุญาต',unexpected_shape:'โครงสร้างไฟล์ไม่ตรงกับ v1',invalid_image_count:'จำนวนรูปไม่ถูกต้อง',untrusted_image_origin:'URL รูปไม่ใช่ VisionD'};
    return `${labels[error.code]||error.message} · ${error.path}`;
  }

  function render(value){
    const product=value.product,page1=product.page_1,page2=product.page_2,fields=Core.page2FieldValues(value);
    elements.productId.textContent=`VisionD product #${product.visiond_product_id}`;
    elements.productName.textContent=page1.name;
    elements.productSku.textContent=page1.sku;
    elements.productGtin.textContent=page1.gtin;
    elements.productSales.textContent=`${fields.price} THB · ${fields.stock} ชิ้น`;
    elements.productShipping.textContent=`${fields.weight} kg · ${fields.width} × ${fields.length} × ${fields.height} cm`;
    elements.imageCount.textContent=`รูป ${page1.images.length} รูป · รูปแรกเป็นปก`;
    elements.imageList.replaceChildren(...page1.images.map((image,index)=>{const item=document.createElement('li'),url=new URL(image.url);item.textContent=`${index===0?'ปก · ':''}${url.hostname}${url.pathname}`;return item}));
    elements.preview.hidden=false;
    elements.fillButton.disabled=false;
    elements.clearButton.disabled=false;
  }

  function resetView(){
    handoff=null;elements.preview.hidden=true;elements.fillButton.disabled=true;elements.clearButton.disabled=true;elements.imageList.replaceChildren();elements.fieldResults.hidden=true;elements.fieldResults.replaceChildren();
  }

  async function accept(raw,{persist=true}={}){
    const checked=Core.validateHandoff(raw);
    if(!checked.ok){resetView();setStatus(elements.importStatus,firstErrorMessage(checked.errors),'error');return false}
    handoff=checked.value;
    if(persist)await storageSet({[STORAGE_KEY]:handoff});
    render(handoff);
    setStatus(elements.importStatus,'JSON v1 ถูกต้องและข้อมูลครบ พร้อมกรอก Shopee','success');
    setStatus(elements.fillStatus,'เปิดหน้าสร้างสินค้า Shopee แล้วกด “กรอกหน้าที่เปิดอยู่”','muted');
    return true;
  }

  async function importFile(file){
    if(!file)return;
    if(file.size>MAX_JSON_BYTES){resetView();setStatus(elements.importStatus,'ไฟล์ JSON ใหญ่เกิน 256 KB','error');return}
    let raw;
    try{raw=JSON.parse(await file.text())}catch{resetView();setStatus(elements.importStatus,'อ่าน JSON ไม่ได้ กรุณาดาวน์โหลดใหม่จาก VisionD','error');return}
    await accept(raw);
  }

  const activeTab=()=>new Promise(resolve=>chrome.tabs.query({active:true,currentWindow:true},tabs=>resolve(tabs[0]||null)));
  const sendToTab=(tabId,payload)=>new Promise(resolve=>chrome.tabs.sendMessage(tabId,payload,response=>{
    if(chrome.runtime.lastError)return resolve({ok:false,code:'extension_unavailable',message:chrome.runtime.lastError.message});
    resolve(response||{ok:false,code:'extension_unavailable'});
  }));

  function showFieldResults(results=[]){
    elements.fieldResults.replaceChildren(...results.map(result=>{const item=document.createElement('li');item.textContent=`${result.field}: ${result.status}${result.message?` · ${result.message}`:''}`;return item}));
    elements.fieldResults.hidden=!results.length;
  }

  async function fill(){
    if(!handoff)return;
    elements.fillButton.disabled=true;
    setStatus(elements.fillStatus,'กำลังตรวจหน้าและกรอกข้อมูล…','muted');
    const tab=await activeTab();
    let target=false;
    try{const url=new URL(tab?.url||'');target=url.hostname==='seller.shopee.co.th'&&url.pathname==='/portal/product/new'}catch{}
    if(!tab||!target){setStatus(elements.fillStatus,'ต้องเปิดหน้าสร้างสินค้า Shopee ที่กำหนดก่อน','error');elements.fillButton.disabled=false;return}
    const response=await sendToTab(tab.id,{type:'VISIOND_SHOPEE_FILL_CURRENT',handoff});
    showFieldResults(response.fields);
    const kind=response.ok?'success':response.code==='image_capacity'?'warning':'error';
    setStatus(elements.fillStatus,response.message||`กรอกไม่สำเร็จ (${response.code||'unknown'})`,kind);
    elements.fillButton.disabled=false;
  }

  async function clear(){
    await storageRemove(STORAGE_KEY);resetView();elements.jsonFile.value='';setStatus(elements.importStatus,'ล้าง JSON จาก Extension แล้ว','muted');setStatus(elements.fillStatus,'Extension จะไม่กด ขั้นตอนต่อไป / บันทึก / เผยแพร่','muted');
  }

  elements.jsonFile.addEventListener('change',()=>importFile(elements.jsonFile.files?.[0]));
  elements.fillButton.addEventListener('click',fill);
  elements.clearButton.addEventListener('click',clear);
  storageGet(STORAGE_KEY).then(stored=>stored?.[STORAGE_KEY]?accept(stored[STORAGE_KEY],{persist:false}):null);

  scope.VisionDShopeePopupTest=Object.freeze({accept,clear,fill,importFile});
})(globalThis);
