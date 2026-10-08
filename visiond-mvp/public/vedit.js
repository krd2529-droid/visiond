(()=>{
  const MAX_BYTES=20*1024*1024,MAX_PIXELS=40_000_000,MAX_EDGE=12_000,MIN_EDGE=320;
  const MIME_SIGNATURES={
    'image/jpeg':bytes=>bytes[0]===0xff&&bytes[1]===0xd8&&bytes[2]===0xff,
    'image/png':bytes=>[0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a].every((byte,index)=>bytes[index]===byte),
    'image/webp':bytes=>String.fromCharCode(...bytes.slice(0,4))==='RIFF'&&String.fromCharCode(...bytes.slice(8,12))==='WEBP'
  };
  const imageInput=document.querySelector('#veditImage'),archiveInput=document.querySelector('#veditArchive'),archiveSelect=document.querySelector('#veditArchivePreview'),archiveSelectLabel=document.querySelector('#veditArchivePreviewLabel'),archiveSummary=document.querySelector('#veditArchiveSummary'),cancel=document.querySelector('#veditCancel'),nameInput=document.querySelector('#veditProductName'),priceInput=document.querySelector('#veditPriceText'),canvas=document.querySelector('#veditCanvas'),empty=document.querySelector('#veditEmpty'),status=document.querySelector('#veditStatus'),resolution=document.querySelector('#veditResolution'),download=document.querySelector('#veditDownload'),context=canvas.getContext('2d',{alpha:false});
  const segmenter=globalThis.Intl?.Segmenter?new Intl.Segmenter('th',{granularity:'grapheme'}):null;
  let bitmap=null,outputName='vedit-product',selectionGeneration=0,readyGeneration=0,encoding=false,archive=null,batchController=null;
  const zipTools=()=>import('/vedit-zip.js?v=020175');
  const clean=value=>String(value||'').replace(/[\u0000-\u001f\u007f-\u009f]+/g,' ').replace(/\s+/g,' ').trim();
  const graphemes=value=>segmenter?[...segmenter.segment(value)].map(item=>item.segment):Array.from(value);
  const setStatus=(message,state='')=>{status.textContent=message;if(state)status.dataset.state=state;else delete status.dataset.state};
  const updateCount=input=>{const counter=document.querySelector(`[data-count-for="${input.id}"]`);if(counter)counter.textContent=String(graphemes(input.value).length)};
  const canExport=()=>Boolean(bitmap)&&readyGeneration===selectionGeneration&&!encoding&&Boolean(clean(nameInput.value))&&Boolean(clean(priceInput.value));
  const syncDownload=()=>{download.disabled=!canExport();download.textContent=archive?'ดาวน์โหลด ZIP ภาพที่แต่งแล้ว':'ดาวน์โหลด PNG ขนาดต้นฉบับ'};
  const setBusy=busy=>{encoding=busy;imageInput.disabled=busy;archiveInput.disabled=busy;archiveSelect.disabled=busy;nameInput.disabled=busy;priceInput.disabled=busy;cancel.hidden=!busy;syncDownload()};
  function releaseBitmap(){bitmap?.close?.();bitmap=null;readyGeneration=0}
  function clearArchive(){archive=null;archiveSelect.replaceChildren();archiveSelectLabel.hidden=true;archiveSummary.hidden=true;archiveSummary.textContent=''}
  function resetPreview(message,state=''){
    releaseBitmap();canvas.hidden=true;empty.hidden=false;resolution.textContent='ยังไม่มีรูป';delete canvas.dataset.topLines;delete canvas.dataset.badgeLines;syncDownload();setStatus(message,state);
  }
  function linesFor(ctx,text,maxWidth){
    const units=graphemes(clean(text)),lines=[];let line='';
    for(const unit of units){const next=line+unit;if(line&&ctx.measureText(next).width>maxWidth){lines.push(line.trimEnd());line=unit.trimStart()}else line=next}
    if(line||!lines.length)lines.push(line.trim());return lines;
  }
  function fittedLines(ctx,text,maxWidth,maxLines,startSize,minSize){
    let fontSize=startSize,lines=[];
    while(fontSize>=minSize){ctx.font=`900 ${fontSize}px "Noto Sans Thai","Leelawadee UI",Tahoma,Arial,sans-serif`;lines=linesFor(ctx,text,maxWidth);if(lines.length<=maxLines)return{fontSize,lines};fontSize-=Math.max(1,Math.round(startSize*.04))}
    ctx.font=`900 ${minSize}px "Noto Sans Thai","Leelawadee UI",Tahoma,Arial,sans-serif`;lines=linesFor(ctx,text,maxWidth);
    if(lines.length>maxLines){lines=lines.slice(0,maxLines);let last=lines[maxLines-1];while(last&&ctx.measureText(`${last}…`).width>maxWidth)last=graphemes(last).slice(0,-1).join('');lines[maxLines-1]=`${last}…`}
    return{fontSize:minSize,lines};
  }
  function renderTo(target,ctx,source,nameText,priceText,preview=false){
    const width=target.width,height=target.height,scale=Math.min(width,height),padding=Math.max(8,Math.round(scale*.025)),red='#b5121b';
    ctx.clearRect(0,0,width,height);ctx.drawImage(source,0,0,width,height);ctx.textBaseline='middle';
    const name=nameText||'ชื่อสินค้า',top=fittedLines(ctx,name,width-padding*2,3,Math.max(18,Math.round(scale*.065)),Math.max(11,Math.round(scale*.03))),topLine=Math.round(top.fontSize*1.22),topHeight=Math.min(Math.round(height*.42),Math.max(Math.round(scale*.12),padding*2+topLine*top.lines.length));
    ctx.fillStyle=red;ctx.fillRect(0,0,width,topHeight);ctx.fillStyle='#fff';ctx.textAlign='center';ctx.font=`900 ${top.fontSize}px "Noto Sans Thai","Leelawadee UI",Tahoma,Arial,sans-serif`;top.lines.forEach((line,index)=>ctx.fillText(line,width/2,padding+topLine*(index+.5),width-padding*2));
    const price=priceText||'ราคา',badgeMax=Math.max(120,Math.round(width*.52)),badge=fittedLines(ctx,price,badgeMax-padding*2,3,Math.max(17,Math.round(scale*.055)),Math.max(10,Math.round(scale*.028))),badgeLine=Math.round(badge.fontSize*1.22);ctx.font=`900 ${badge.fontSize}px "Noto Sans Thai","Leelawadee UI",Tahoma,Arial,sans-serif`;
    const textWidth=Math.max(...badge.lines.map(line=>ctx.measureText(line).width),badge.fontSize*2),badgeWidth=Math.min(badgeMax,Math.ceil(textWidth+padding*2)),badgeHeight=Math.ceil(badgeLine*badge.lines.length+padding*1.5),badgeX=Math.max(0,width-badgeWidth),badgeY=Math.max(topHeight,height-badgeHeight);
    ctx.fillStyle=red;ctx.fillRect(badgeX,badgeY,badgeWidth,badgeHeight);ctx.fillStyle='#fff';ctx.textAlign='center';badge.lines.forEach((line,index)=>ctx.fillText(line,badgeX+badgeWidth/2,badgeY+padding*.75+badgeLine*(index+.5),badgeWidth-padding*2));
    if(preview){Object.assign(target.dataset,{topLines:String(top.lines.length),badgeLines:String(badge.lines.length),sourceWidth:String(width),sourceHeight:String(height),badgeX:String(badgeX),badgeY:String(badgeY),badgeWidth:String(badgeWidth),badgeHeight:String(badgeHeight)});target.setAttribute('aria-label',`ตัวอย่างภาพสินค้า ${width} คูณ ${height} พิกเซล ชื่อ ${name} ข้อความ ${price}`)}
  }
  function render(){if(bitmap&&readyGeneration===selectionGeneration)renderTo(canvas,context,bitmap,clean(nameInput.value),clean(priceInput.value),true)}
  async function hasMatchingSignature(file){const bytes=new Uint8Array(await file.slice(0,16).arrayBuffer());return Boolean(MIME_SIGNATURES[file.type]?.(bytes))}
  function checkDimensions(next){const pixels=next.width*next.height;if(next.width<MIN_EDGE||next.height<MIN_EDGE||next.width>MAX_EDGE||next.height>MAX_EDGE||pixels>MAX_PIXELS)throw new Error('รูปต้องมีขนาดอย่างน้อย 320×320 และไม่เกิน 12,000 พิกเซลต่อด้านหรือ 40 ล้านพิกเซล')}
  function showBitmap(next,generation){releaseBitmap();bitmap=next;readyGeneration=generation;canvas.width=next.width;canvas.height=next.height;empty.hidden=true;canvas.hidden=false;resolution.textContent=`${next.width.toLocaleString('th-TH')} × ${next.height.toLocaleString('th-TH')} px`;render();syncDownload()}
  async function showArchivePreview(index){
    if(!archive)return;
    const generation=++selectionGeneration,selected=archive.entries[index];resetPreview(`กำลังเปิดตัวอย่าง ${index+1}/${archive.entries.length}…`);
    let next;
    try{const file=await archive.extract(selected);if(generation!==selectionGeneration)return;next=await createImageBitmap(file,{imageOrientation:'from-image'});if(generation!==selectionGeneration)return;checkDimensions(next);showBitmap(next,generation);next=null;setStatus(`ตัวอย่าง ${index+1}/${archive.entries.length} · พร้อมดาวน์โหลด ZIP`,'success')}
    catch(error){if(generation===selectionGeneration){clearArchive();archiveInput.value='';resetPreview(`เปิดตัวอย่างไม่สำเร็จ: ${error.message||'รูปไม่สมบูรณ์'}`,'error')}}
    finally{next?.close?.()}
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
      archive=inspected;outputName=(file.name.replace(/\.zip$/i,'').replace(/[^a-z0-9ก-๙_-]+/gi,'-').replace(/^-+|-+$/g,'')||'vedit-product').slice(0,60);
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
      outputName=(file.name.replace(/\.[^.]+$/,'').replace(/[^a-z0-9ก-๙_-]+/gi,'-').replace(/^-+|-+$/g,'')||'vedit-product').slice(0,80);showBitmap(next,generation);setStatus('พร้อมดาวน์โหลด ภาพที่ส่งออกจะมีขนาดเท่าต้นฉบับ','success');
    }catch{if(generation!==selectionGeneration)return;imageInput.value='';resetPreview('เปิดไฟล์รูปไม่สำเร็จ กรุณาเลือก JPG, PNG หรือ WebP ที่สมบูรณ์','error')}
  }
  function refreshText(event){updateCount(event.target);render();syncDownload();if(bitmap&&!canExport())setStatus('กรุณากรอกชื่อสินค้าและราคา / ข้อความอื่นให้ครบ','error');else if(bitmap)setStatus(archive?`พร้อมดาวน์โหลด ZIP ${archive.entries.length} รูป`:'พร้อมดาวน์โหลด ภาพที่ส่งออกจะมีขนาดเท่าต้นฉบับ','success')}
  imageInput.addEventListener('change',selectImage);archiveInput.addEventListener('change',selectArchive);archiveSelect.addEventListener('change',()=>showArchivePreview(Number(archiveSelect.value)));nameInput.addEventListener('input',refreshText);priceInput.addEventListener('input',refreshText);updateCount(nameInput);updateCount(priceInput);
  const canvasPng=target=>new Promise((resolve,reject)=>target.toBlob(blob=>blob?resolve(blob):reject(new Error('สร้าง PNG ไม่สำเร็จ')),'image/png'));
  const saveBlob=(blob,filename)=>{const url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=filename;document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),0)};
  async function downloadArchive(){
    if(!canExport()||!archive)return;
    const current=archive,generation=selectionGeneration,controller=new AbortController(),name=clean(nameInput.value),price=clean(priceInput.value),files=[];batchController=controller;setBusy(true);
    try{
      const {makeVeditZip}=await zipTools();
      for(let index=0;index<current.entries.length;index++){
        if(controller.signal.aborted||generation!==selectionGeneration)throw new DOMException('ยกเลิกการสร้าง ZIP แล้ว','AbortError');
        const entry=current.entries[index];setStatus(`กำลังแต่งรูป ${index+1}/${current.entries.length}: ${entry.name}`);
        const file=await current.extract(entry,{signal:controller.signal});
        let next;
        try{
          next=await createImageBitmap(file,{imageOrientation:'from-image'});
          if(controller.signal.aborted||generation!==selectionGeneration)throw new DOMException('ยกเลิกการสร้าง ZIP แล้ว','AbortError');
          checkDimensions(next);
          const output=document.createElement('canvas');let blob;
          try{output.width=next.width;output.height=next.height;renderTo(output,output.getContext('2d',{alpha:false}),next,name,price);blob=await canvasPng(output)}
          finally{output.width=0;output.height=0}
          if(controller.signal.aborted||generation!==selectionGeneration)throw new DOMException('ยกเลิกการสร้าง ZIP แล้ว','AbortError');
          const base=(entry.name.split('/').pop().replace(/\.[^.]+$/,'').normalize('NFC').replace(/[^a-z0-9ก-๙_-]+/gi,'-').replace(/^-+|-+$/g,'')||'image').slice(0,50);
          files.push({name:`${String(index+1).padStart(3,'0')}-${base}-vedit.png`,bytes:blob});
        }finally{next?.close?.()}
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
    const generation=selectionGeneration;render();encoding=true;syncDownload();setStatus('กำลังสร้างไฟล์ PNG…');
    canvas.toBlob(blob=>{
      encoding=false;if(generation!==selectionGeneration){syncDownload();return}
      if(!blob){syncDownload();setStatus('สร้างไฟล์ไม่สำเร็จ กรุณาลองอีกครั้ง','error');return}
      saveBlob(blob,`${outputName}-vedit.png`);syncDownload();setStatus('ดาวน์โหลด PNG ขนาดต้นฉบับแล้ว','success');
    },'image/png');
  });
  addEventListener('pagehide',()=>{selectionGeneration+=1;batchController?.abort();releaseBitmap();clearArchive()},{once:true});
})();
