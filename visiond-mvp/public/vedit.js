(()=>{
  const MAX_BYTES=20*1024*1024,MAX_PIXELS=40_000_000,MAX_EDGE=12_000,MIN_EDGE=320;
  const MIME_SIGNATURES={
    'image/jpeg':bytes=>bytes[0]===0xff&&bytes[1]===0xd8&&bytes[2]===0xff,
    'image/png':bytes=>[0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a].every((byte,index)=>bytes[index]===byte),
    'image/webp':bytes=>String.fromCharCode(...bytes.slice(0,4))==='RIFF'&&String.fromCharCode(...bytes.slice(8,12))==='WEBP'
  };
  const imageInput=document.querySelector('#veditImage'),archiveInput=document.querySelector('#veditArchive'),archiveSelect=document.querySelector('#veditArchivePreview'),archiveSelectLabel=document.querySelector('#veditArchivePreviewLabel'),archiveSummary=document.querySelector('#veditArchiveSummary'),styleSelect=document.querySelector('#veditStyle'),cancel=document.querySelector('#veditCancel'),nameInput=document.querySelector('#veditProductName'),priceInput=document.querySelector('#veditPriceText'),canvas=document.querySelector('#veditCanvas'),empty=document.querySelector('#veditEmpty'),status=document.querySelector('#veditStatus'),resolution=document.querySelector('#veditResolution'),download=document.querySelector('#veditDownload'),context=canvas.getContext('2d',{alpha:true});
  const segmenter=globalThis.Intl?.Segmenter?new Intl.Segmenter('th',{granularity:'grapheme'}):null;
  let bitmap=null,outputName='vedit-product',selectionGeneration=0,readyGeneration=0,encoding=false,archive=null,batchController=null;
  const zipTools=()=>import('/vedit-zip.js?v=020175');
  const cutoutTools=()=>import('/vedit-cutout.js?v=020189');
  const STYLES={
    plain:{bar:'#b5121b',ink:'#fff',font:'"Noto Sans Thai","Leelawadee UI",Tahoma,Arial,sans-serif'},
    metal:{asset:'/vedit-assets/metal.png',bar:'#101923',ink:'#f3f6f6',font:'"Arial Narrow","Noto Sans Thai",Tahoma,sans-serif'},
    street:{asset:'/vedit-assets/street.png',bar:'#e3a906',ink:'#171611',font:'Impact,"Noto Sans Thai",Tahoma,sans-serif'},
    premium:{asset:'/vedit-assets/premium.png',bar:'#352318',ink:'#f5d593',font:'Georgia,"Noto Serif Thai",Tahoma,serif'},
    vintage:{asset:'/vedit-assets/vintage.png',bar:'#4b281c',ink:'#fff0d3',font:'Georgia,"Noto Serif Thai",Tahoma,serif'}
  };
  const styleImages=new Map(),loadedStyles=new Map();
  function loadStyle(key){
    const asset=STYLES[key]?.asset;if(!asset)return Promise.resolve(null);
    if(!styleImages.has(key))styleImages.set(key,new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>{loadedStyles.set(key,image);resolve(image)};image.onerror=()=>reject(new Error('โหลดพื้นหลังสไตล์ไม่สำเร็จ'));image.src=asset}).catch(error=>{styleImages.delete(key);throw error}));
    return styleImages.get(key);
  }
  const clean=value=>String(value||'').replace(/[\u0000-\u001f\u007f-\u009f]+/g,' ').replace(/\s+/g,' ').trim();
  const graphemes=value=>segmenter?[...segmenter.segment(value)].map(item=>item.segment):Array.from(value);
  const setStatus=(message,state='')=>{status.textContent=message;if(state)status.dataset.state=state;else delete status.dataset.state};
  const updateCount=input=>{const counter=document.querySelector(`[data-count-for="${input.id}"]`);if(counter)counter.textContent=String(graphemes(input.value).length)};
  const canExport=()=>Boolean(bitmap)&&readyGeneration===selectionGeneration&&!encoding&&Boolean(clean(nameInput.value))&&Boolean(clean(priceInput.value))&&(!archive||styleSelect.value==='plain'||loadedStyles.has(styleSelect.value));
  const syncDownload=()=>{download.disabled=!canExport();download.textContent=archive?'ดาวน์โหลด ZIP ภาพที่แต่งแล้ว':'ดาวน์โหลด PNG พร้อมกรอบชื่อและราคา'};
  const setBusy=busy=>{encoding=busy;imageInput.disabled=busy;archiveInput.disabled=busy;archiveSelect.disabled=busy;styleSelect.disabled=busy||!archive;nameInput.disabled=busy;priceInput.disabled=busy;cancel.hidden=!busy;syncDownload()};
  function releaseImage(image){if(image instanceof HTMLCanvasElement){image.width=0;image.height=0}else image?.close?.()}
  function releaseBitmap(){releaseImage(bitmap);bitmap=null;readyGeneration=0}
  function clearArchive(){archive=null;archiveSelect.replaceChildren();archiveSelectLabel.hidden=true;archiveSummary.hidden=true;archiveSummary.textContent='';styleSelect.disabled=true}
  function resetPreview(message,state=''){
    releaseBitmap();canvas.hidden=true;empty.hidden=false;resolution.textContent='ยังไม่มีรูป';for(const key of ['style','topLines','priceLines','priceStart','topHeight','bottomHeight','sourceWidth','sourceHeight'])delete canvas.dataset[key];syncDownload();setStatus(message,state);
  }
  function linesFor(ctx,text,maxWidth){
    const units=graphemes(clean(text)),lines=[];let line='';
    for(const unit of units){const next=line+unit;if(line&&ctx.measureText(next).width>maxWidth){lines.push(line.trimEnd());line=unit.trimStart()}else line=next}
    if(line||!lines.length)lines.push(line.trim());return lines;
  }
  function fittedLines(ctx,text,maxWidth,maxLines,startSize,minSize,font='"Noto Sans Thai","Leelawadee UI",Tahoma,Arial,sans-serif'){
    let fontSize=startSize,lines=[];
    while(fontSize>=minSize){ctx.font=`900 ${fontSize}px ${font}`;lines=linesFor(ctx,text,maxWidth);if(lines.length<=maxLines)return{fontSize,lines};fontSize-=Math.max(1,Math.round(startSize*.04))}
    ctx.font=`900 ${minSize}px ${font}`;lines=linesFor(ctx,text,maxWidth);
    if(lines.length>maxLines){lines=lines.slice(0,maxLines);let last=lines[maxLines-1];while(last&&ctx.measureText(`${last}…`).width>maxWidth)last=graphemes(last).slice(0,-1).join('');lines[maxLines-1]=`${last}…`}
    return{fontSize:minSize,lines};
  }
  function fittedName(ctx,text,maxWidth,startSize,font='"Noto Sans Thai","Leelawadee UI",Tahoma,Arial,sans-serif'){
    const name=clean(text);let fontSize=startSize;
    ctx.font=`900 ${fontSize}px ${font}`;
    if(ctx.measureText(name).width>maxWidth){
      let low=0,high=startSize;
      for(let i=0;i<20;i++){
        const middle=(low+high)/2;
        ctx.font=`900 ${middle}px ${font}`;
        if(ctx.measureText(name).width<=maxWidth)low=middle;else high=middle;
      }
      fontSize=low;
    }
    ctx.font=`900 ${fontSize}px ${font}`;
    return{fontSize,lines:[name]};
  }
  function renderStyled(target,ctx,source,nameText,priceText,key,backdrop,preview){
    const style=STYLES[key],width=source.width,sourceHeight=source.height,scale=Math.min(width,sourceHeight),pad=Math.max(8,Math.round(scale*.025));
    const name=nameText||'ชื่อสินค้า',top=fittedName(ctx,name,width-pad*2,Math.max(18,Math.round(scale*.065)),style.font);
    const price=fittedLines(ctx,priceText||'ราคา',width-pad*2,3,Math.max(17,Math.round(scale*.055)),Math.max(10,Math.round(scale*.028)),style.font);
    const nameLine=Math.max(1,Math.round(top.fontSize*1.22)),priceLine=Math.round(price.fontSize*1.22),gap=Math.max(4,Math.round(pad*.5));
    const priceStart=pad+nameLine+gap,topHeight=Math.max(Math.round(scale*.16),priceStart+priceLine*price.lines.length+pad);
    const brandSize=Math.max(17,Math.round(scale*.06)),bottomHeight=Math.max(Math.round(scale*.11),Math.round(brandSize*1.35)+pad*2),height=topHeight+sourceHeight+bottomHeight;
    target.width=width;target.height=height;
    ctx.fillStyle=style.bar;ctx.fillRect(0,0,width,topHeight);ctx.fillRect(0,topHeight+sourceHeight,width,bottomHeight);
    if(backdrop){
      const factor=Math.max(width/backdrop.naturalWidth,sourceHeight/backdrop.naturalHeight);
      const cropWidth=width/factor,cropHeight=sourceHeight/factor;
      ctx.drawImage(backdrop,(backdrop.naturalWidth-cropWidth)/2,(backdrop.naturalHeight-cropHeight)/2,cropWidth,cropHeight,0,topHeight,width,sourceHeight);
    }else{ctx.fillStyle='#fff';ctx.fillRect(0,topHeight,width,sourceHeight)}
    if(key==='street'){ctx.fillStyle='#171611';ctx.fillRect(0,topHeight-7,width,7);ctx.fillRect(0,height-bottomHeight,width,7)}
    else if(key==='premium'||key==='vintage'){ctx.fillStyle=style.ink;ctx.fillRect(pad,topHeight-6,width-pad*2,2);ctx.fillRect(pad,height-bottomHeight+5,width-pad*2,2)}
    ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle=style.ink;
    ctx.font=`900 ${top.fontSize}px ${style.font}`;ctx.fillText(top.lines[0],width/2,pad+nameLine/2,width-pad*2);
    ctx.font=`900 ${price.fontSize}px ${style.font}`;price.lines.forEach((line,index)=>ctx.fillText(line,width/2,priceStart+priceLine*(index+.5),width-pad*2));
    ctx.drawImage(source,0,topHeight,width,sourceHeight);
    ctx.font=`900 ${brandSize}px ${style.font}`;ctx.fillStyle=style.ink;ctx.fillText('Zippo Udon',width/2,height-bottomHeight/2,width-pad*2);
    if(preview){Object.assign(target.dataset,{style:key,topLines:String(top.lines.length),priceLines:String(price.lines.length),priceStart:String(priceStart),sourceWidth:String(source.width),sourceHeight:String(source.height),topHeight:String(topHeight),bottomHeight:String(bottomHeight)});target.setAttribute('aria-label',`ตัวอย่างสไตล์ ${key} ชื่อ ${nameText} ราคา ${priceText} Zippo Udon`)}
    return{width,height,sourceHeight,topHeight,bottomHeight};
  }
  function renderTo(target,ctx,source,nameText,priceText,preview=false,styleKey='legacy',backdrop=null){
    if(styleKey!=='legacy')return renderStyled(target,ctx,source,nameText,priceText,styleKey,backdrop,preview);
    const width=source.width,sourceHeight=source.height,scale=Math.min(width,sourceHeight),padding=Math.max(8,Math.round(scale*.025)),red='#b5121b';
    const name=nameText||'ชื่อสินค้า',top=fittedName(ctx,name,width-padding*2,Math.max(18,Math.round(scale*.065))),nameLine=Math.max(1,Math.round(top.fontSize*1.22));
    const price=priceText||'ราคา',priceTextLayout=fittedLines(ctx,price,width-padding*2,3,Math.max(17,Math.round(scale*.055)),Math.max(10,Math.round(scale*.028))),priceLine=Math.round(priceTextLayout.fontSize*1.22),gap=Math.max(4,Math.round(padding*.5));
    const priceStart=padding+nameLine+gap,topHeight=Math.max(Math.round(scale*.16),priceStart+priceLine*priceTextLayout.lines.length+padding),height=topHeight+sourceHeight;
    target.width=width;target.height=height;
    ctx.fillStyle=red;ctx.fillRect(0,0,width,topHeight);
    ctx.drawImage(source,0,topHeight);ctx.textBaseline='middle';ctx.textAlign='center';ctx.fillStyle='#fff';
    ctx.font=`900 ${top.fontSize}px "Noto Sans Thai","Leelawadee UI",Tahoma,Arial,sans-serif`;
    ctx.fillText(top.lines[0],width/2,padding+nameLine/2,width-padding*2);
    ctx.font=`900 ${priceTextLayout.fontSize}px "Noto Sans Thai","Leelawadee UI",Tahoma,Arial,sans-serif`;
    priceTextLayout.lines.forEach((line,index)=>ctx.fillText(line,width/2,priceStart+priceLine*(index+.5),width-padding*2));
    if(preview){Object.assign(target.dataset,{topLines:String(top.lines.length),priceLines:String(priceTextLayout.lines.length),priceStart:String(priceStart),sourceWidth:String(width),sourceHeight:String(sourceHeight),topHeight:String(topHeight)});target.setAttribute('aria-label',`ตัวอย่างภาพสินค้า ${width} คูณ ${height} พิกเซล ภาพต้นฉบับ ${width} คูณ ${sourceHeight} พิกเซล ชื่อ ${name} ข้อความ ${price}`)}
    return{width,height,sourceHeight,topHeight};
  }
  function render(){if(bitmap&&readyGeneration===selectionGeneration){const key=archive?styleSelect.value:'legacy',backdrop=loadedStyles.get(key)||null;if(key!=='legacy'&&key!=='plain'&&!backdrop)return;const size=renderTo(canvas,context,bitmap,clean(nameInput.value),clean(priceInput.value),true,key,backdrop);resolution.textContent=`ต้นฉบับ ${bitmap.width.toLocaleString('th-TH')} × ${bitmap.height.toLocaleString('th-TH')} px · ส่งออก ${size.width.toLocaleString('th-TH')} × ${size.height.toLocaleString('th-TH')} px`}}
  async function hasMatchingSignature(file){const bytes=new Uint8Array(await file.slice(0,16).arrayBuffer());return Boolean(MIME_SIGNATURES[file.type]?.(bytes))}
  function checkDimensions(next){const pixels=next.width*next.height;if(next.width<MIN_EDGE||next.height<MIN_EDGE||next.width>MAX_EDGE||next.height>MAX_EDGE||pixels>MAX_PIXELS)throw new Error('รูปต้องมีขนาดอย่างน้อย 320×320 และไม่เกิน 12,000 พิกเซลต่อด้านหรือ 40 ล้านพิกเซล')}
  function showBitmap(next,generation){releaseBitmap();bitmap=next;readyGeneration=generation;empty.hidden=true;canvas.hidden=false;render();syncDownload()}
  async function showArchivePreview(index){
    if(!archive)return;
    const generation=++selectionGeneration,selected=archive.entries[index];resetPreview(`กำลังเปิดตัวอย่าง ${index+1}/${archive.entries.length}…`);
    let next;
    try{const file=await archive.extract(selected);if(generation!==selectionGeneration)return;const {removeProductBackground}=await cutoutTools();next=await removeProductBackground(file);if(generation!==selectionGeneration)return;checkDimensions(next);for(;;){const key=styleSelect.value;await loadStyle(key);if(generation!==selectionGeneration)return;if(key===styleSelect.value)break}showBitmap(next,generation);next=null;setStatus(`ตัวอย่าง ${index+1}/${archive.entries.length} · พร้อมดาวน์โหลด ZIP`,'success')}
    catch(error){if(generation===selectionGeneration){clearArchive();archiveInput.value='';resetPreview(`เปิดตัวอย่างไม่สำเร็จ: ${error.message||'รูปไม่สมบูรณ์'}`,'error')}}
    finally{releaseImage(next)}
  }
  async function selectArchive(){
    const generation=++selectionGeneration,file=archiveInput.files?.[0];imageInput.value='';clearArchive();resetPreview(file?'กำลังตรวจ ZIP และรูปทุกภาพ…':'เลือกรูปสินค้าหรือ ZIP เพื่อเริ่มแต่งภาพ');if(!file)return;
    try{
      if(!/\.zip$/i.test(file.name))throw new Error('กรุณาเลือกไฟล์ .zip');
      const {inspectVeditZip}=await zipTools(),inspected=await inspectVeditZip(file);if(generation!==selectionGeneration)return;
      if(inspected.rejected.length){const first=inspected.rejected[0];throw new Error(`ZIP มีรายการที่ใช้ไม่ได้ ${inspected.rejected.length} รายการ: ${first.name} (${first.reason}) กรุณาแก้ ZIP แล้วเลือกใหม่`)}
      for(let index=0;index<inspected.entries.length;index++){
        if(generation!==selectionGeneration)return;
        setStatus(`กำลังตรวจรูป ${index+1}/${inspected.entries.length}…`);
        const entry=inspected.entries[index],image=await inspected.extract(entry);if(generation!==selectionGeneration)return;
        const next=await createImageBitmap(image,{imageOrientation:'from-image'});
        try{if(generation!==selectionGeneration)return;checkDimensions(next)}catch(error){throw new Error(`${entry.name}: ${error.message}`)}finally{next.close?.()}
      }
      if(generation!==selectionGeneration)return;
      archive=inspected;styleSelect.disabled=false;outputName=(file.name.replace(/\.zip$/i,'').replace(/[^a-z0-9ก-๙_-]+/gi,'-').replace(/^-+|-+$/g,'')||'vedit-product').slice(0,60);
      archiveSelect.replaceChildren(...inspected.entries.map((entry,index)=>new Option(`${index+1}. ${entry.name}`,String(index))));archiveSelectLabel.hidden=false;archiveSummary.hidden=false;archiveSummary.textContent=`${inspected.entries.length} รูป · ใช้ชื่อสินค้าและราคาเดียวกันทุกภาพ · ดูตัวอย่างแต่ละรูปได้ก่อนดาวน์โหลด`;
      await showArchivePreview(0);
    }catch(error){if(generation!==selectionGeneration)return;archiveInput.value='';clearArchive();resetPreview(`อ่าน ZIP ไม่สำเร็จ: ${error.message||'ไฟล์ไม่สมบูรณ์'}`,'error')}
  }
  async function selectImage(){
    const generation=++selectionGeneration,file=imageInput.files?.[0];archiveInput.value='';clearArchive();resetPreview(file?'กำลังตรวจสอบรูป…':'เลือกรูปสินค้าเพื่อเริ่มแต่งภาพ');
    if(!file)return;
    if(!MIME_SIGNATURES[file.type]){imageInput.value='';setStatus('รองรับเฉพาะไฟล์ JPG, PNG หรือ WebP','error');return}
    if(file.size<=0||file.size>MAX_BYTES){imageInput.value='';setStatus('ไฟล์รูปต้องมีขนาดมากกว่า 0 และไม่เกิน 20 MB','error');return}
    try{
      if(!await hasMatchingSignature(file)){if(generation!==selectionGeneration)return;imageInput.value='';setStatus('ชนิดไฟล์ไม่ตรงกับข้อมูลรูป กรุณาเลือก JPG, PNG หรือ WebP ที่สมบูรณ์','error');return}
      setStatus('กำลังอ่านรูป…');
      const next=await createImageBitmap(file,{imageOrientation:'from-image'});
      if(generation!==selectionGeneration){next.close?.();return}
      try{checkDimensions(next)}catch(error){next.close?.();imageInput.value='';setStatus(error.message,'error');return}
      outputName=(file.name.replace(/\.[^.]+$/,'').replace(/[^a-z0-9ก-๙_-]+/gi,'-').replace(/^-+|-+$/g,'')||'vedit-product').slice(0,80);showBitmap(next,generation);setStatus('พร้อมดาวน์โหลด ชื่อและราคาอยู่ในกรอบด้านบน ไม่บังภาพต้นฉบับ','success');
    }catch{if(generation!==selectionGeneration)return;imageInput.value='';resetPreview('เปิดไฟล์รูปไม่สำเร็จ กรุณาเลือก JPG, PNG หรือ WebP ที่สมบูรณ์','error')}
  }
  function refreshText(event){updateCount(event.target);render();syncDownload();if(bitmap&&!canExport())setStatus('กรุณากรอกชื่อสินค้าและราคา / ข้อความอื่นให้ครบ','error');else if(bitmap)setStatus(archive?`พร้อมดาวน์โหลด ZIP ${archive.entries.length} รูป`:'พร้อมดาวน์โหลด ชื่อและราคาอยู่ในกรอบด้านบน ไม่บังภาพต้นฉบับ','success')}
  imageInput.addEventListener('change',selectImage);archiveInput.addEventListener('change',selectArchive);archiveSelect.addEventListener('change',()=>showArchivePreview(Number(archiveSelect.value)));styleSelect.addEventListener('change',async()=>{if(!archive)return;const current=archive,key=styleSelect.value;syncDownload();setStatus('กำลังโหลดพื้นหลังสไตล์…');try{await loadStyle(key);if(archive!==current||styleSelect.value!==key)return;render();syncDownload();setStatus(`พร้อมดาวน์โหลด ZIP ${archive.entries.length} รูป`,'success')}catch(error){if(archive!==current||styleSelect.value!==key)return;syncDownload();setStatus(error.message,'error')}});nameInput.addEventListener('input',refreshText);priceInput.addEventListener('input',refreshText);updateCount(nameInput);updateCount(priceInput);
  const canvasPng=target=>new Promise((resolve,reject)=>target.toBlob(blob=>blob?resolve(blob):reject(new Error('สร้าง PNG ไม่สำเร็จ')),'image/png'));
  const saveBlob=(blob,filename)=>{const url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=filename;document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),0)};
  async function downloadArchive(){
    if(!canExport()||!archive)return;
    const current=archive,generation=selectionGeneration,controller=new AbortController(),name=clean(nameInput.value),price=clean(priceInput.value),styleKey=styleSelect.value,files=[];batchController=controller;setBusy(true);
    try{
      const {makeVeditZip}=await zipTools(),{removeProductBackground}=await cutoutTools(),backdrop=await loadStyle(styleKey);
      for(let index=0;index<current.entries.length;index++){
        if(controller.signal.aborted||generation!==selectionGeneration)throw new DOMException('ยกเลิกการสร้าง ZIP แล้ว','AbortError');
        const entry=current.entries[index];setStatus(`กำลังแต่งรูป ${index+1}/${current.entries.length}: ${entry.name}`);
        const file=await current.extract(entry,{signal:controller.signal});
        let next;
        try{
          next=await removeProductBackground(file,{signal:controller.signal});
          if(controller.signal.aborted||generation!==selectionGeneration)throw new DOMException('ยกเลิกการสร้าง ZIP แล้ว','AbortError');
          checkDimensions(next);
          const output=document.createElement('canvas');let blob;
          try{renderTo(output,output.getContext('2d',{alpha:true}),next,name,price,false,styleKey,backdrop);blob=await canvasPng(output)}
          finally{output.width=0;output.height=0}
          if(controller.signal.aborted||generation!==selectionGeneration)throw new DOMException('ยกเลิกการสร้าง ZIP แล้ว','AbortError');
          const base=(entry.name.split('/').pop().replace(/\.[^.]+$/,'').normalize('NFC').replace(/[^a-z0-9ก-๙_-]+/gi,'-').replace(/^-+|-+$/g,'')||'image').slice(0,50);
          files.push({name:`${String(index+1).padStart(3,'0')}-${base}-vedit.png`,bytes:blob});
        }finally{releaseImage(next)}
      }
      setStatus(`กำลังรวม ZIP ${files.length} รูป…`);
      const blob=await makeVeditZip(files,{signal:controller.signal});
      if(controller.signal.aborted||generation!==selectionGeneration)throw new DOMException('ยกเลิกการสร้าง ZIP แล้ว','AbortError');
      saveBlob(blob,`vedit-${outputName}.zip`);setStatus(`ดาวน์โหลด ZIP ครบ ${files.length} รูปแล้ว`,'success');
    }catch(error){setStatus(error.name==='AbortError'?'ยกเลิกการสร้าง ZIP แล้ว':`สร้าง ZIP ไม่สำเร็จ: ${error.message||'ไฟล์ไม่สมบูรณ์'} · ไม่มีไฟล์บางส่วนถูกดาวน์โหลด`,'error')}
    finally{files.length=0;batchController=null;setBusy(false)}
  }
  cancel.addEventListener('click',()=>batchController?.abort());
  download.addEventListener('click',()=>{
    if(!canExport())return;
    if(archive){void downloadArchive();return}
    const generation=selectionGeneration;encoding=true;syncDownload();setStatus('กำลังสร้างไฟล์ PNG…');
    canvas.toBlob(blob=>{
      encoding=false;if(generation!==selectionGeneration){syncDownload();return}
      if(!blob){syncDownload();setStatus('สร้างไฟล์ไม่สำเร็จ กรุณาลองอีกครั้ง','error');return}
      saveBlob(blob,`${outputName}-vedit.png`);syncDownload();setStatus('ดาวน์โหลด PNG พร้อมกรอบชื่อและราคาแล้ว','success');
    },'image/png');
  });
  addEventListener('pagehide',()=>{selectionGeneration+=1;batchController?.abort();releaseBitmap();clearArchive()},{once:true});
})();
