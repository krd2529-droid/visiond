(()=>{
  const MAX_BYTES=20*1024*1024,MAX_PIXELS=40_000_000,MAX_EDGE=12_000,MIN_EDGE=320;
  const MIME_SIGNATURES={
    'image/jpeg':bytes=>bytes[0]===0xff&&bytes[1]===0xd8&&bytes[2]===0xff,
    'image/png':bytes=>[0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a].every((byte,index)=>bytes[index]===byte),
    'image/webp':bytes=>String.fromCharCode(...bytes.slice(0,4))==='RIFF'&&String.fromCharCode(...bytes.slice(8,12))==='WEBP'
  };
  const imageInput=document.querySelector('#veditImage'),nameInput=document.querySelector('#veditProductName'),priceInput=document.querySelector('#veditPriceText'),canvas=document.querySelector('#veditCanvas'),empty=document.querySelector('#veditEmpty'),status=document.querySelector('#veditStatus'),resolution=document.querySelector('#veditResolution'),download=document.querySelector('#veditDownload'),context=canvas.getContext('2d',{alpha:false});
  const segmenter=globalThis.Intl?.Segmenter?new Intl.Segmenter('th',{granularity:'grapheme'}):null;
  let bitmap=null,outputName='vedit-product',selectionGeneration=0,readyGeneration=0,encoding=false;
  const clean=value=>String(value||'').replace(/[\u0000-\u001f\u007f-\u009f]+/g,' ').replace(/\s+/g,' ').trim();
  const graphemes=value=>segmenter?[...segmenter.segment(value)].map(item=>item.segment):Array.from(value);
  const setStatus=(message,state='')=>{status.textContent=message;if(state)status.dataset.state=state;else delete status.dataset.state};
  const updateCount=input=>{const counter=document.querySelector(`[data-count-for="${input.id}"]`);if(counter)counter.textContent=String(graphemes(input.value).length)};
  const canExport=()=>Boolean(bitmap)&&readyGeneration===selectionGeneration&&!encoding&&Boolean(clean(nameInput.value))&&Boolean(clean(priceInput.value));
  const syncDownload=()=>{download.disabled=!canExport()};
  function releaseBitmap(){bitmap?.close?.();bitmap=null;readyGeneration=0}
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
  function render(){
    if(!bitmap||readyGeneration!==selectionGeneration)return;
    const width=canvas.width,height=canvas.height,scale=Math.min(width,height),padding=Math.max(8,Math.round(scale*.025)),red='#b5121b';
    context.clearRect(0,0,width,height);context.drawImage(bitmap,0,0,width,height);context.textBaseline='middle';
    const name=clean(nameInput.value)||'ชื่อสินค้า',top=fittedLines(context,name,width-padding*2,3,Math.max(18,Math.round(scale*.065)),Math.max(11,Math.round(scale*.03))),topLine=Math.round(top.fontSize*1.22),topHeight=Math.min(Math.round(height*.42),Math.max(Math.round(scale*.12),padding*2+topLine*top.lines.length));
    context.fillStyle=red;context.fillRect(0,0,width,topHeight);context.fillStyle='#fff';context.textAlign='center';context.font=`900 ${top.fontSize}px "Noto Sans Thai","Leelawadee UI",Tahoma,Arial,sans-serif`;top.lines.forEach((line,index)=>context.fillText(line,width/2,padding+topLine*(index+.5),width-padding*2));
    const price=clean(priceInput.value)||'ราคา',badgeMax=Math.max(120,Math.round(width*.52)),badge=fittedLines(context,price,badgeMax-padding*2,3,Math.max(17,Math.round(scale*.055)),Math.max(10,Math.round(scale*.028))),badgeLine=Math.round(badge.fontSize*1.22);context.font=`900 ${badge.fontSize}px "Noto Sans Thai","Leelawadee UI",Tahoma,Arial,sans-serif`;
    const textWidth=Math.max(...badge.lines.map(line=>context.measureText(line).width),badge.fontSize*2),badgeWidth=Math.min(badgeMax,Math.ceil(textWidth+padding*2)),badgeHeight=Math.ceil(badgeLine*badge.lines.length+padding*1.5),badgeX=Math.max(0,width-badgeWidth),badgeY=Math.max(topHeight,height-badgeHeight);
    context.fillStyle=red;context.fillRect(badgeX,badgeY,badgeWidth,badgeHeight);context.fillStyle='#fff';context.textAlign='center';badge.lines.forEach((line,index)=>context.fillText(line,badgeX+badgeWidth/2,badgeY+padding*.75+badgeLine*(index+.5),badgeWidth-padding*2));
    Object.assign(canvas.dataset,{topLines:String(top.lines.length),badgeLines:String(badge.lines.length),sourceWidth:String(width),sourceHeight:String(height),badgeX:String(badgeX),badgeY:String(badgeY),badgeWidth:String(badgeWidth),badgeHeight:String(badgeHeight)});
    canvas.setAttribute('aria-label',`ตัวอย่างภาพสินค้า ${width} คูณ ${height} พิกเซล ชื่อ ${name} ข้อความ ${price}`);
  }
  async function hasMatchingSignature(file){const bytes=new Uint8Array(await file.slice(0,16).arrayBuffer());return Boolean(MIME_SIGNATURES[file.type]?.(bytes))}
  async function selectImage(){
    const generation=++selectionGeneration,file=imageInput.files?.[0];encoding=false;resetPreview(file?'กำลังตรวจสอบรูป…':'เลือกรูปสินค้าเพื่อเริ่มแต่งภาพ');
    if(!file)return;
    if(!MIME_SIGNATURES[file.type]){imageInput.value='';setStatus('รองรับเฉพาะไฟล์ JPG, PNG หรือ WebP','error');return}
    if(file.size<=0||file.size>MAX_BYTES){imageInput.value='';setStatus('ไฟล์รูปต้องมีขนาดมากกว่า 0 และไม่เกิน 20 MB','error');return}
    try{
      if(!await hasMatchingSignature(file)){if(generation!==selectionGeneration)return;imageInput.value='';setStatus('ชนิดไฟล์ไม่ตรงกับข้อมูลรูป กรุณาเลือก JPG, PNG หรือ WebP ที่สมบูรณ์','error');return}
      setStatus('กำลังอ่านรูป…');
      const next=await createImageBitmap(file,{imageOrientation:'from-image'});
      if(generation!==selectionGeneration){next.close?.();return}
      const pixels=next.width*next.height;
      if(next.width<MIN_EDGE||next.height<MIN_EDGE||next.width>MAX_EDGE||next.height>MAX_EDGE||pixels>MAX_PIXELS){next.close?.();imageInput.value='';setStatus('รูปต้องมีขนาดอย่างน้อย 320×320 และไม่เกิน 12,000 พิกเซลต่อด้านหรือ 40 ล้านพิกเซล','error');return}
      bitmap=next;readyGeneration=generation;canvas.width=next.width;canvas.height=next.height;outputName=(file.name.replace(/\.[^.]+$/,'').replace(/[^a-z0-9ก-๙_-]+/gi,'-').replace(/^-+|-+$/g,'')||'vedit-product').slice(0,80);empty.hidden=true;canvas.hidden=false;resolution.textContent=`${next.width.toLocaleString('th-TH')} × ${next.height.toLocaleString('th-TH')} px`;render();syncDownload();setStatus('พร้อมดาวน์โหลด ภาพที่ส่งออกจะมีขนาดเท่าต้นฉบับ','success');
    }catch{if(generation!==selectionGeneration)return;imageInput.value='';resetPreview('เปิดไฟล์รูปไม่สำเร็จ กรุณาเลือก JPG, PNG หรือ WebP ที่สมบูรณ์','error')}
  }
  function refreshText(event){updateCount(event.target);render();syncDownload();if(bitmap&&!canExport())setStatus('กรุณากรอกชื่อสินค้าและราคา / ข้อความอื่นให้ครบ','error');else if(bitmap)setStatus('พร้อมดาวน์โหลด ภาพที่ส่งออกจะมีขนาดเท่าต้นฉบับ','success')}
  imageInput.addEventListener('change',selectImage);nameInput.addEventListener('input',refreshText);priceInput.addEventListener('input',refreshText);updateCount(nameInput);updateCount(priceInput);
  download.addEventListener('click',()=>{
    if(!canExport())return;
    const generation=selectionGeneration;render();encoding=true;syncDownload();setStatus('กำลังสร้างไฟล์ PNG…');
    canvas.toBlob(blob=>{
      encoding=false;if(generation!==selectionGeneration){syncDownload();return}
      if(!blob){syncDownload();setStatus('สร้างไฟล์ไม่สำเร็จ กรุณาลองอีกครั้ง','error');return}
      const url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=`${outputName}-vedit.png`;document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),0);syncDownload();setStatus('ดาวน์โหลด PNG ขนาดต้นฉบับแล้ว','success');
    },'image/png');
  });
  addEventListener('pagehide',()=>{selectionGeneration+=1;releaseBitmap()},{once:true});
})();
