(function installVisionDShopeeContent(scope){
  'use strict';
  if(scope!==scope.top)return;
  const Core=scope.VisionDShopeeCore,Config=scope.VisionDShopeeSelectors;
  if(!Core||!Config)throw new Error('VisionD Shopee extension dependencies are missing');
  let generation=0,activeController=null;
  const normalize=value=>String(value??'').replace(/\s+/g,' ').trim();
  const isVisible=element=>{if(!(element instanceof Element)||element.hidden)return false;const style=getComputedStyle(element),rect=element.getBoundingClientRect();return style.display!=='none'&&style.visibility!=='hidden'&&style.opacity!=='0'&&rect.width>0&&rect.height>0};
  const unique=items=>[...new Set(items.filter(Boolean))];
  const fieldResult=(field,status,extra={})=>({field,status,...extra});
  const failure=(code,message,fields=[],details={})=>({ok:false,code,message,fields,details});
  const targetPage=()=>location.hostname===Config.target.host&&location.pathname===Config.target.path;
  const guard=(job,...elements)=>{if(job.signal.aborted||job.id!==generation||job.href!==location.href||!targetPage()||elements.some(element=>element&&(!element.isConnected||!isVisible(element))))throw new DOMException('Stale fill generation','AbortError')};

  function textNodes(labels,root=document){
    const wanted=new Set(labels.map(normalize));
    return [...root.querySelectorAll('label,legend,span,div,p,strong')].filter(node=>isVisible(node)&&wanted.has(normalize(node.textContent)));
  }
  function visibleControls(container,selector='input:not([type="hidden"]):not([type="file"]),textarea,select,[contenteditable="true"],button[role="combobox"],[role="combobox"]',excluded=[]){
    const blocked=new Set(excluded);return unique([...container.querySelectorAll(selector)].filter(control=>isVisible(control)&&!control.disabled&&!blocked.has(control)));
  }
  function associatedControls(node,selector,excluded=[]){
    const matches=[];
    if(node.matches('label')&&node.control)matches.push(node.control);
    if(node.id)matches.push(...document.querySelectorAll(`[aria-labelledby~="${CSS.escape(node.id)}"]`));
    for(const candidate of document.querySelectorAll('[aria-label]'))if(normalize(candidate.getAttribute('aria-label'))===normalize(node.textContent))matches.push(candidate);
    let current=node;
    for(let depth=0;current&&depth<6;depth++,current=current.parentElement){
      if(!current.matches?.('label,.product-edit-form-item,.eds-form-item,.form-item,[role="group"],fieldset'))continue;
      const controls=visibleControls(current,selector,excluded);if(controls.length===1)matches.push(controls[0]);
    }
    return unique(matches.filter(control=>control.matches?.(selector)&&isVisible(control)&&!excluded.includes(control)));
  }
  function locateByLabels(labels,{selector,excluded=[]}={}){
    const controlSelector=selector||'input:not([type="hidden"]):not([type="file"]),textarea,select,[contenteditable="true"],button[role="combobox"],[role="combobox"]';
    const direct=[];
    for(const label of labels){direct.push(...document.querySelectorAll(`[aria-label="${CSS.escape(label)}"]`));direct.push(...document.querySelectorAll(`input[placeholder="${CSS.escape(label)}"],textarea[placeholder="${CSS.escape(label)}"]`))}
    const fromText=textNodes(labels).flatMap(node=>associatedControls(node,controlSelector,excluded));
    const controls=unique([...direct,...fromText].filter(control=>control.matches?.(controlSelector)&&isVisible(control)&&!control.disabled&&!excluded.includes(control)));
    return controls.length===1?{ok:true,element:controls[0]}:{ok:false,count:controls.length};
  }

  function galleryContext(input){
    const upload=input.closest('.shopee-file-upload');if(!upload)return null;
    const ancestry=[];let current=upload;
    for(let depth=0;current&&depth<6&&!current.matches('form,main,body,html');depth++,current=current.parentElement)ancestry.push(current);
    if(ancestry.some(element=>Config.page1.excludedSectionText.some(term=>normalize(element.textContent).includes(term))))return null;
    return ancestry.find(element=>{const text=normalize(element.textContent);return text.includes(Config.page1.imageSectionText)&&Config.page1.imageCapacityPattern.test(text)})||null;
  }
  function mediaCounter(context){
    const match=normalize(context?.textContent).match(Config.page1.imageCapacityPattern);
    return match?{current:Number(match[1]),capacity:Number(match[2])}:null;
  }
  function locatePage1(){
    const imagePairs=unique([...document.querySelectorAll(Config.page1.imageInput)].filter(isVisible)).map(element=>({element,context:galleryContext(element)})).filter(item=>item.context);
    const titleContainers=unique([...document.querySelectorAll(Config.page1.titleContainer)].filter(isVisible));
    const titleCandidates=titleContainers.flatMap(container=>visibleControls(container,'input:not([type="hidden"]),textarea')).filter(control=>!control.placeholder||control.placeholder===Config.page1.titlePlaceholder);
    const gtinCandidates=unique([...document.querySelectorAll(`input[placeholder="${CSS.escape(Config.page1.gtinPlaceholder)}"]`)].filter(isVisible)).filter(input=>{
      const container=input.closest('.product-edit-form-item,.product-edit-form-item-content,.eds-form-item,.form-item,[role="group"]');
      const text=normalize(container?.textContent);return container&&text.includes('GTIN')&&!Config.page1.excludedSectionText.some(term=>text.includes(term));
    });
    return{
      evidence:imagePairs.length+titleContainers.length+gtinCandidates.length,
      image:imagePairs.length===1?{ok:true,...imagePairs[0]}:{ok:false,count:imagePairs.length},
      title:titleCandidates.length===1?{ok:true,element:titleCandidates[0]}:{ok:false,count:titleCandidates.length},
      gtin:gtinCandidates.length===1?{ok:true,element:gtinCandidates[0]}:{ok:false,count:gtinCandidates.length}
    };
  }
  function locatePage2(){
    const labels=Config.page2,controls={
      category:locateByLabels(labels.categoryLabels,{selector:'select,button[role="combobox"],[role="combobox"],input[role="combobox"]'}),sellerSku:locateByLabels(labels.sellerSkuLabels),brand:locateByLabels(labels.brandLabels),
      description:locateByLabels(labels.descriptionLabels,{selector:'textarea,[contenteditable="true"],input:not([type="hidden"])'}),price:locateByLabels(labels.priceLabels),stock:locateByLabels(labels.stockLabels),
      weight:locateByLabels(labels.weightLabels),width:locateByLabels(labels.widthLabels),length:locateByLabels(labels.lengthLabels),height:locateByLabels(labels.heightLabels)
    };
    return{evidence:Object.values(controls).filter(item=>item.ok).length,controls};
  }
  function assertCurrentPage1(job,located){
    guard(job,located.image.element,located.image.context,located.title.element,located.gtin.element);const current=locatePage1();
    if(!current.image.ok||!current.title.ok||!current.gtin.ok||current.image.element!==located.image.element||current.image.context!==located.image.context||current.title.element!==located.title.element||current.gtin.element!==located.gtin.element)throw new DOMException('Page-1 identity changed','AbortError');
  }
  function assertCurrentPage2(job,located){
    const required=['category','brand','description','price','stock','weight','width','length','height'];guard(job,...required.map(key=>located.controls[key].element));const current=locatePage2();
    if(required.some(key=>!current.controls[key].ok||current.controls[key].element!==located.controls[key].element))throw new DOMException('Page-2 identity changed','AbortError');
  }
  function detect(){const page1=locatePage1();if(page1.evidence>=2)return{page:1,located:page1};const page2=locatePage2();if(page2.evidence>=5)return{page:2,located:page2};return{page:0,page1,page2}}
  function waitForPage(job,timeout=5000){
    const immediate=detect();if(immediate.page)return Promise.resolve(immediate);
    return new Promise(resolve=>{let settled=false;const finish=result=>{if(settled)return;settled=true;observer.disconnect();clearTimeout(timer);job.signal.removeEventListener('abort',aborted);resolve(result)};const observer=new MutationObserver(()=>{const found=detect();if(found.page)finish(found)}),timer=setTimeout(()=>finish(detect()),timeout),aborted=()=>finish({page:0,aborted:true});observer.observe(document.documentElement,{childList:true,subtree:true});job.signal.addEventListener('abort',aborted,{once:true})});
  }

  function runtimeMessage(payload){return new Promise(resolve=>chrome.runtime.sendMessage(payload,response=>{if(chrome.runtime.lastError)return resolve({ok:false,code:'extension_message'});resolve(response||{ok:false,code:'extension_message'})}))}
  const getState=()=>runtimeMessage({type:'VISIOND_SHOPEE_GET_FILL_STATE'});
  const setState=state=>runtimeMessage({type:'VISIOND_SHOPEE_SET_FILL_STATE',state});
  const decode=value=>{const binary=atob(value),bytes=new Uint8Array(binary.length);for(let index=0;index<binary.length;index++)bytes[index]=binary.charCodeAt(index);return bytes};
  function fetchImage(image,productId,job){
    return new Promise(resolve=>{
      guard(job);const port=chrome.runtime.connect({name:'visiond-shopee-image-fetch'}),chunks=[];let meta=null,total=0,done=false;
      const finish=value=>{if(done)return;done=true;clearTimeout(timer);job.signal.removeEventListener('abort',abort);try{port.disconnect()}catch{}resolve(value)};
      const abort=()=>finish({ok:false,code:'stale_generation'}),timer=setTimeout(()=>finish({ok:false,code:'image_timeout'}),12000);
      job.signal.addEventListener('abort',abort,{once:true});port.onDisconnect.addListener(()=>{if(!done)finish({ok:false,code:'worker_disconnected'})});
      port.onMessage.addListener(message=>{
        if(!message?.ok)return finish(message||{ok:false,code:'image_download'});
        if(message.type==='start'){meta=message;return}
        if(message.type==='chunk'){const bytes=decode(message.data);total+=bytes.length;if(total>5*1024*1024)return finish({ok:false,code:'image_too_large'});chunks.push(bytes);return}
        if(message.type==='end'){if(!meta||total!==meta.size)return finish({ok:false,code:'image_transfer'});finish({ok:true,mime:meta.mime,extension:meta.extension,chunks,size:total})}
      });
      port.postMessage({type:'fetch',url:image.url,productId});
    });
  }
  async function prepareImages(images,productId,job){
    const files=[];let aggregate=0;
    for(let index=0;index<images.length;index++){
      guard(job);const response=await fetchImage(images[index],productId,job);guard(job);
      if(!response.ok)return failure(response.code||'image_download',`ดาวน์โหลดรูปที่ ${index+1} ไม่สำเร็จ`,[],{index,response});
      aggregate+=response.size;if(aggregate>50*1024*1024)return failure('image_aggregate','ขนาดรูปรวมเกินขอบเขต 50 MiB');
      const name=index===0?`visiond-cover-01.${response.extension}`:`visiond-image-${String(index+1).padStart(2,'0')}.${response.extension}`;
      files.push(new File(response.chunks,name,{type:response.mime,lastModified:Date.now()}));
    }
    return{ok:true,files,aggregate};
  }
  function assignFiles(input,files){const transfer=new DataTransfer();files.forEach(file=>transfer.items.add(file));input.files=transfer.files;input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new Event('change',{bubbles:true}))}
  function uploadErrors(scope){
    const failureText=/(?:ไม่สำเร็จ|ล้มเหลว|ผิดพลาด|ไม่สามารถ|failed|error|invalid)/i,uploadText=/(?:อัปโหลด|รูปภาพ|รูป|upload|image)/i;
    return unique([...scope.querySelectorAll('[role="alert"],[aria-live="assertive"],.error,[class*="error" i]')].filter(isVisible).map(element=>normalize(element.textContent)).filter(text=>failureText.test(text)&&uploadText.test(text)));
  }
  function waitForMedia(context,errorScope,expected,job,baselineErrors=[],timeout=8000){
    return new Promise(resolve=>{let settled=false,stableTimer=null;const finish=value=>{if(settled)return;settled=true;observer.disconnect();clearTimeout(timer);clearTimeout(stableTimer);job.signal.removeEventListener('abort',aborted);resolve(value)};const errorsNow=()=>uploadErrors(errorScope).filter(error=>!baselineErrors.includes(error));const inspect=()=>{const errors=errorsNow();if(errors.length)return finish({observed:false,error:'image_upload_error',errors,...(mediaCounter(context)||{})});const counter=mediaCounter(context);if(counter?.current>expected)return finish({observed:false,error:'image_count_conflict',...counter});if(counter?.current===expected){if(!stableTimer)stableTimer=setTimeout(()=>{const delayedErrors=errorsNow(),latest=mediaCounter(context);if(delayedErrors.length)return finish({observed:false,error:'image_upload_error',errors:delayedErrors,...(latest||{})});if(latest?.current>expected)return finish({observed:false,error:'image_count_conflict',...latest});if(latest?.current===expected)finish({observed:true,...latest})},500)}else if(stableTimer){clearTimeout(stableTimer);stableTimer=null}};const observer=new MutationObserver(inspect),timer=setTimeout(()=>finish({observed:false,...(mediaCounter(context)||{})}),timeout),aborted=()=>finish({observed:false,aborted:true});observer.observe(errorScope,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:['class','hidden','style','aria-hidden']});job.signal.addEventListener('abort',aborted,{once:true});inspect()});
  }

  function nativeSet(control,value){
    const text=String(value);
    if(control.isContentEditable){control.textContent=text;control.dispatchEvent(new InputEvent('input',{bubbles:true,inputType:'insertText',data:text}));control.dispatchEvent(new Event('change',{bubbles:true}));return}
    const prototype=control instanceof HTMLTextAreaElement?HTMLTextAreaElement.prototype:control instanceof HTMLSelectElement?HTMLSelectElement.prototype:HTMLInputElement.prototype,setter=Object.getOwnPropertyDescriptor(prototype,'value')?.set;
    if(!setter)throw new Error('control_setter_missing');setter.call(control,text);control.dispatchEvent(new Event('input',{bubbles:true}));control.dispatchEvent(new Event('change',{bubbles:true}));control.dispatchEvent(new FocusEvent('blur',{bubbles:true}));
  }
  const semanticValue=(value,{multiline=false}={})=>multiline?String(value??'').replace(/\r\n?/g,'\n'):String(value??'');
  const readValue=control=>control.isContentEditable?control.textContent:control.value;
  async function setAndVerify(control,value,job,options={}){guard(job,control);nativeSet(control,value);await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));guard(job,control);if(semanticValue(readValue(control),options)!==semanticValue(value,options))throw new Error('vue_readback_mismatch')}

  async function fillPage1(handoff,located,job,state){
    const drift=['image','title','gtin'].filter(key=>!located[key].ok).map(key=>fieldResult(key,'selector_drift',{matches:located[key].count}));if(drift.length)return failure('selector_drift','ไม่พบช่องหน้า 1 แบบเอกลักษณ์',drift);
    const counter=mediaCounter(located.image.context),images=handoff.product.page_1.images;if(!counter)return failure('selector_drift','อ่านตัวนับรูปไม่ได้');
    if(images.length>counter.capacity)return failure('image_capacity',`Shopee รับได้ ${counter.capacity} รูป แต่ JSON มี ${images.length} รูป`,[fieldResult('images','blocked',{payload_count:images.length,platform_capacity:counter.capacity})],{payload_count:images.length,platform_capacity:counter.capacity});
    const fingerprint=Core.handoffFingerprint(handoff),prior=state?.state;
    if(prior&&prior.fingerprint!==fingerprint)return failure('changed_payload_conflict','ฟอร์มนี้เคยกรอกด้วย JSON คนละสินค้า กรุณาตรวจและเริ่มหน้าใหม่');
    if(counter.current>0){
      if(prior?.fingerprint===fingerprint&&prior.page1?.status==='files_selected'&&counter.current===images.length)return{ok:true,code:'page_1_unchanged',page:1,message:'ไฟล์รูปชุดนี้เคยถูกเลือกและตัวนับ Shopee แสดงครบแล้ว จึงไม่เลือกซ้ำ',fields:[fieldResult('images','unchanged',{count:counter.current,confirmation:'counter_observed'}),fieldResult('sku','deferred')]};
      return failure(prior?.page1?.status==='partial'?'image_upload_conflict':'existing_media_conflict','พบรูปเดิมใน Shopee จึงไม่เพิ่มหรือลบรูปอัตโนมัติ',[fieldResult('images','conflict',{current:counter.current})]);
    }
    const prepared=await prepareImages(images,handoff.product.visiond_product_id,job);if(!prepared.ok)return prepared;assertCurrentPage1(job,located);
    const form=located.image.element.closest('form'),errorScope=located.image.element.closest('main')||form?.parentElement||form||located.image.context.parentElement||located.image.context,baselineErrors=uploadErrors(errorScope);if(baselineErrors.length)return failure('image_upload_error','พบข้อผิดพลาดอัปโหลดรูปบน Shopee ก่อนเริ่ม',[fieldResult('images','blocked',{errors:baselineErrors})]);
    const pendingState=await setState({fingerprint,page1:{status:'pending',count:images.length}});if(!pendingState.ok)return failure('state_unavailable','บันทึกสถานะ idempotency ไม่สำเร็จ จึงยังไม่เลือกไฟล์รูป');assertCurrentPage1(job,located);assignFiles(located.image.element,prepared.files);
    const confirmation=await waitForMedia(located.image.context,errorScope,images.length,job,baselineErrors);assertCurrentPage1(job,located);
    if(!confirmation.observed){const observed=confirmation.current||0,persisted=await setState({fingerprint,page1:{status:'partial',count:observed,expected:images.length,error:confirmation.error||null}});if(!persisted.ok)return failure('state_unavailable','เลือกไฟล์แล้ว แต่บันทึกสถานะ idempotency ไม่สำเร็จ',[fieldResult('images','partial',{observed_count:observed,expected_count:images.length})]);const message=confirmation.error==='image_count_conflict'?'ตัวนับรูป Shopee มากกว่าจำนวนใน JSON จึงหยุดเพื่อไม่แตะรูปที่ไม่ทราบที่มา':confirmation.error?'Shopee แจ้งว่าอัปโหลดรูปไม่สำเร็จ':'ตัวนับ Shopee ยังไม่แสดงไฟล์รูปครบ';return failure(confirmation.error||'image_upload_unconfirmed',message,[fieldResult('images','partial',{observed_count:observed,expected_count:images.length,errors:confirmation.errors||[]})])}
    try{assertCurrentPage1(job,located);await setAndVerify(located.title.element,handoff.product.page_1.name,job);assertCurrentPage1(job,located);await setAndVerify(located.gtin.element,handoff.product.page_1.gtin,job)}catch(error){const persisted=await setState({fingerprint,page1:{status:'partial',count:images.length}});return failure(persisted.ok?'vue_readback':'state_unavailable',persisted.ok?'Shopee ไม่ยืนยันค่าข้อความหลังกรอก':'กรอกบางส่วนแล้ว แต่บันทึกสถานะ idempotency ไม่สำเร็จ',[fieldResult('name','unconfirmed'),fieldResult('gtin','unconfirmed')],{reason:error.message})}
    const completedState=await setState({fingerprint,page1:{status:'files_selected',count:images.length,confirmation:'counter_observed'}});if(!completedState.ok)return failure('state_unavailable','เลือกไฟล์และกรอกข้อความแล้ว แต่บันทึกสถานะ idempotency ไม่สำเร็จ',[fieldResult('images','files_selected',{count:images.length,confirmation:'counter_observed'}),fieldResult('name','confirmed'),fieldResult('gtin','confirmed')]);
    return{ok:true,code:'page_1_filled',page:1,message:'เลือกไฟล์รูปและกรอกหน้า 1 แล้ว โปรดตรวจสถานะอัปโหลดบน Shopee และไปหน้าถัดไปด้วยตนเอง',fields:[fieldResult('images','files_selected',{count:images.length,confirmation:'counter_observed'}),fieldResult('name','confirmed'),fieldResult('gtin','confirmed'),fieldResult('sku','deferred',{message:'ยังไม่พบ Seller SKU ที่แยกจาก GTIN'})],requires_user_navigation:true};
  }

  function nonSubmittingClickTarget(control){
    const interactive=control.closest('button,input,a[href]');
    if(interactive instanceof HTMLAnchorElement)return false;
    if(interactive instanceof HTMLButtonElement)return interactive.type==='button';
    if(interactive instanceof HTMLInputElement)return['button','checkbox','radio'].includes(interactive.type);
    return !(control instanceof HTMLFormElement);
  }
  function allowedCategoryControl(control){
    if(control instanceof HTMLSelectElement)return true;
    if(control.getAttribute('role')!=='combobox')return false;
    if(control instanceof HTMLButtonElement)return control.type==='button';
    if(control instanceof HTMLInputElement)return['text','search'].includes(control.type);
    return nonSubmittingClickTarget(control);
  }
  function clickAllowedCategory(element,kind,root){
    if(kind==='control'){if(!allowedCategoryControl(element))throw new Error('category_control_not_allowlisted')}
    else if(!root?.contains(element)||!['option','treeitem','menuitem'].includes(element.getAttribute('role'))||!nonSubmittingClickTarget(element))throw new Error('category_option_not_allowlisted');
    element.click();
  }
  async function categoryRoot(control,job){
    const id=control.getAttribute('aria-controls');if(id){const root=document.getElementById(id);if(root&&isVisible(root))return root}
    const before=new Set([...document.querySelectorAll('[role="dialog"],[role="listbox"],[role="menu"],[role="tree"]')].filter(isVisible));clickAllowedCategory(control,'control');
    const deadline=Date.now()+3000;
    while(Date.now()<deadline){guard(job,control);const roots=[...document.querySelectorAll('[role="dialog"],[role="listbox"],[role="menu"],[role="tree"]')].filter(root=>isVisible(root)&&!before.has(root));if(roots.length===1)return roots[0];if(roots.length>1)throw new Error('category_root_ambiguous');await new Promise(resolve=>setTimeout(resolve,50))}
    throw new Error('category_root_missing');
  }
  async function selectCategory(control,path,job){
    const joined=path.join(' > ');
    if(control instanceof HTMLSelectElement){const options=[...control.options].filter(option=>normalize(option.textContent)===joined);if(options.length!==1)throw new Error('category_option_missing');await setAndVerify(control,options[0].value,job);if(normalize(control.selectedOptions[0]?.textContent)!==joined)throw new Error('category_readback');return}
    const root=await categoryRoot(control,job);
    for(const segment of path){const deadline=Date.now()+3000;let option=null;while(Date.now()<deadline){guard(job,control,root);const options=unique([...root.querySelectorAll('[role="option"],[role="treeitem"],[role="menuitem"]')].filter(item=>isVisible(item)&&normalize(item.textContent)===normalize(segment)));if(options.length===1){option=options[0];break}if(options.length>1)throw new Error('category_option_ambiguous');await new Promise(resolve=>setTimeout(resolve,50))}if(!option)throw new Error('category_option_missing');clickAllowedCategory(option,'option',root)}
    await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));guard(job,control);const readback=normalize(control.value||control.textContent||control.getAttribute('aria-label'));if(readback!==joined)throw new Error('category_readback');
  }
  async function fillPage2(handoff,located,job,state){
    const required=['category','brand','description','price','stock','weight','width','length','height'],drift=required.filter(key=>!located.controls[key].ok).map(key=>fieldResult(key,'selector_drift',{matches:located.controls[key].count}));if(drift.length)return failure('selector_drift','ไม่พบช่องหน้า 2 แบบเอกลักษณ์',drift);
    const fingerprint=Core.handoffFingerprint(handoff),prior=state?.state;if(prior&&prior.fingerprint!==fingerprint)return failure('changed_payload_conflict','ฟอร์มนี้เคยกรอกด้วย JSON คนละสินค้า');if(prior?.page2?.status==='confirmed')return{ok:true,code:'page_2_unchanged',page:2,message:'หน้า 2 เคยกรอกด้วยข้อมูลชุดนี้แล้ว จึงไม่กรอกซ้ำ',fields:[]};
    const pendingState=await setState({...prior,fingerprint,page2:{status:'pending'}});if(!pendingState.ok)return failure('state_unavailable','บันทึกสถานะ idempotency ไม่สำเร็จ จึงยังไม่กรอกหน้า 2');
    const values=Core.page2FieldValues(handoff);try{assertCurrentPage2(job,located);await selectCategory(located.controls.category.element,handoff.product.page_2.category_path,job);for(const key of['brand','description','price','stock','weight','width','length','height']){assertCurrentPage2(job,located);await setAndVerify(located.controls[key].element,values[key],job,{multiline:key==='description'})}if(located.controls.sellerSku.ok){assertCurrentPage2(job,located);await setAndVerify(located.controls.sellerSku.element,handoff.product.page_1.sku,job)}}catch(error){return failure('selector_drift','Shopee ไม่ยืนยันช่องหน้า 2 อย่างปลอดภัย',[],{reason:error.message})}
    const completedState=await setState({...prior,fingerprint,page2:{status:'confirmed'}});if(!completedState.ok)return failure('state_unavailable','กรอกหน้า 2 แล้ว แต่บันทึกสถานะ idempotency ไม่สำเร็จ');const fields=[fieldResult('category','confirmed'),...['brand','description','price','stock','weight','width','length','height'].map(key=>fieldResult(key,'confirmed')),fieldResult('sku',located.controls.sellerSku.ok?'confirmed':'deferred')];return{ok:true,code:'page_2_filled',page:2,message:'กรอกหน้า 2 แล้ว โปรดตรวจและบันทึก/เผยแพร่ด้วยตนเอง',fields,final_submit_automated:false};
  }

  async function runFill(raw,job){
    if(!targetPage())return failure('page_mismatch','เปิดหน้าสร้างสินค้า Shopee ที่กำหนดก่อน');const checked=Core.validateHandoff(raw);if(!checked.ok)return failure('invalid_handoff','JSON ไม่ผ่านการตรวจสอบ',[],{errors:checked.errors});const detected=await waitForPage(job);guard(job);if(!detected.page)return failure('page_mismatch','ไม่พบหน้า Shopee ที่รองรับภายในเวลาที่กำหนด');const state=await getState();guard(job);if(!state.ok)return failure('state_unavailable','อ่านสถานะ idempotency ของแท็บนี้ไม่สำเร็จ จึงยกเลิกก่อนกรอก');return detected.page===1?fillPage1(checked.value,detected.located,job,state):fillPage2(checked.value,detected.located,job,state);
  }
  function startFill(raw){activeController?.abort();activeController=new AbortController();const job={id:++generation,href:location.href,signal:activeController.signal};return runFill(raw,job).catch(error=>error?.name==='AbortError'?failure('stale_generation','หน้าถูกเปลี่ยนระหว่างกรอก จึงยกเลิกงานเก่า'):failure('unexpected',String(error?.message||error)))}
  chrome.runtime.onMessage.addListener((request,_sender,sendResponse)=>{if(request?.type==='VISIOND_SHOPEE_PING'){sendResponse({ok:true,target:targetPage()});return false}if(request?.type!=='VISIOND_SHOPEE_FILL_CURRENT')return false;startFill(request.handoff).then(sendResponse);return true});
  scope.VisionDShopeeContentTest=Object.freeze({startFill,detect,locatePage1,locatePage2,mediaCounter,allowedCategoryControl});
})(globalThis);
