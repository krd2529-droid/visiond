(() => {
  const button = document.querySelector("#pdfCoverCreatorButton");
  const dialog = document.querySelector("#pdfCoverCreatorDialog");
  if (!button || !dialog) return;
  const canvas = dialog.querySelector("#pdfCoverCanvas"), ctx = canvas.getContext("2d");
  const titleInput = dialog.querySelector("#pdfCoverTitle"), imageInput = dialog.querySelector("#pdfCoverImage");
  const download = dialog.querySelector("#pdfCoverDownload"), message = dialog.querySelector("#pdfCoverMessage");
  let productImage = null, objectUrl = "";
  const template = () => dialog.querySelector('[name="pdf_cover_template"]:checked')?.value || "modern";
  const rounded = (x,y,w,h,r) => {ctx.beginPath();ctx.roundRect(x,y,w,h,r);ctx.closePath()};
  const lines = (text,maxWidth,font,maxLines=3) => {ctx.font=font;const words=String(text).trim().split(/\s+/),out=[];let line="";for(const word of words){const next=line?`${line} ${word}`:word;if(ctx.measureText(next).width<=maxWidth)line=next;else{if(line)out.push(line);line=word;if(out.length===maxLines-1)break}}if(line&&out.length<maxLines)out.push(line);return out};
  function background(kind){
    const g=ctx.createLinearGradient(0,0,1000,1400);
    if(kind==="kids"){g.addColorStop(0,"#fff8df");g.addColorStop(1,"#ffc9a2")}else if(kind==="elegant"){g.addColorStop(0,"#101b2c");g.addColorStop(1,"#263a4c")}else{g.addColorStop(0,"#f8f1e5");g.addColorStop(1,"#e8f5f1")}
    ctx.fillStyle=g;ctx.fillRect(0,0,1000,1400);
    if(kind==="modern"){
      ctx.fillStyle="#075f5a";ctx.fillRect(0,0,1000,28);ctx.fillRect(72,90,12,205);ctx.fillStyle="#d8a94f";ctx.fillRect(84,90,82,12);
      ctx.globalAlpha=.08;ctx.fillStyle="#075f5a";for(let y=40;y<1400;y+=36)ctx.fillRect(0,y,1000,1);ctx.globalAlpha=1;
    }else if(kind==="kids"){
      for(const [x,y,r,c] of [[75,110,82,"#47c7bc"],[910,120,110,"#ff8d85"],[90,1250,120,"#ffc83d"],[930,1240,85,"#6e8bff"]]){ctx.fillStyle=c;ctx.globalAlpha=.82;ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill()}ctx.globalAlpha=1;
    }else{
      ctx.strokeStyle="#d5b46c";ctx.lineWidth=3;ctx.strokeRect(42,42,916,1316);ctx.strokeRect(57,57,886,1286);ctx.fillStyle="#d5b46c";ctx.fillRect(410,82,180,3);
    }
  }
  function drawImage(kind){
    if(!productImage)return;
    const box=kind==="modern"?{x:86,y:440,w:828,h:710,r:8}:kind==="kids"?{x:105,y:420,w:790,h:740,r:56}:{x:120,y:420,w:760,h:720,r:4};
    const scale=Math.min((box.w-36)/productImage.width,(box.h-36)/productImage.height),w=productImage.width*scale,h=productImage.height*scale;
    ctx.save();ctx.shadowColor="#001f1d55";ctx.shadowBlur=kind==="kids"?30:42;ctx.shadowOffsetY=18;rounded(box.x,box.y,box.w,box.h,box.r);ctx.fillStyle="#fff";ctx.fill();ctx.restore();
    ctx.save();rounded(box.x+18,box.y+18,box.w-36,box.h-36,Math.max(2,box.r-10));ctx.clip();ctx.fillStyle="#fff";ctx.fillRect(box.x,box.y,box.w,box.h);ctx.drawImage(productImage,box.x+(box.w-w)/2,box.y+(box.h-h)/2,w,h);ctx.restore();
    ctx.strokeStyle=kind==="modern"?"#075f5a":kind==="kids"?"#fff":"#d5b46c";ctx.lineWidth=kind==="kids"?14:5;rounded(box.x,box.y,box.w,box.h,box.r);ctx.stroke();
    if(kind==="kids"){ctx.fillStyle="#ff5c77";rounded(690,1080,165,64,32);ctx.fill();ctx.fillStyle="#fff";ctx.font='800 25px "Leelawadee UI",Tahoma,sans-serif';ctx.fillText("สนุกเรียนรู้",772,1113)}
  }
  function render(){
    const kind=template(),title=titleInput.value.trim();background(kind);
    ctx.textAlign="center";ctx.textBaseline="middle";ctx.fillStyle=kind==="modern"?"#073f3d":kind==="kids"?"#3d315b":"#f7f0df";
    const fontFamily=kind==="elegant"?'"Leelawadee UI","Noto Sans Thai",Tahoma,sans-serif':'"Leelawadee UI","Noto Sans Thai",Tahoma,sans-serif';
    let size=kind==="modern"?72:kind==="kids"?78:68,wrapped=[];do{wrapped=lines(title||"ชื่อปก PDF",kind==="elegant"?760:820,`${kind==="elegant"?600:800} ${size}px ${fontFamily}`,3);if(wrapped.every(x=>ctx.measureText(x).width<=(kind==="elegant"?760:820)))break;size-=4}while(size>42);
    ctx.font=`${kind==="elegant"?600:800} ${size}px ${fontFamily}`;const centerY=kind==="modern"?245:kind==="kids"?245:230,start=centerY-(wrapped.length-1)*(size*.58);wrapped.forEach((line,index)=>ctx.fillText(line,500,start+index*size*1.18));
    if(kind==="modern"){ctx.fillStyle="#d8a94f";ctx.fillRect(430,348,140,5)}else if(kind==="kids"){ctx.strokeStyle="#3d315b";ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(390,350);ctx.quadraticCurveTo(500,375,610,350);ctx.stroke()}else{ctx.fillStyle="#d5b46c";ctx.fillRect(455,340,90,3)}
    drawImage(kind);
    ctx.fillStyle=kind==="modern"?"#075f5a":kind==="kids"?"#3d315b":"#d5b46c";ctx.font=`700 23px ${fontFamily}`;ctx.letterSpacing="3px";ctx.fillText("VISIOND  •  DIGITAL PDF",500,1285);ctx.letterSpacing="0px";
    download.disabled=!(title&&productImage);message.textContent=download.disabled?"ใส่ชื่อและเลือกรูปสินค้าเพื่อดาวน์โหลด":"พร้อมดาวน์โหลดปก PNG ขนาด 1000 × 1400 px";
  }
  button.addEventListener("click",()=>{dialog.showModal();render();requestAnimationFrame(()=>titleInput.focus())});
  titleInput.addEventListener("input",render);
  dialog.querySelectorAll('[name="pdf_cover_template"]').forEach(node=>node.addEventListener("change",render));
  imageInput.addEventListener("change",()=>{const file=imageInput.files?.[0];if(!file)return;if(!["image/jpeg","image/png","image/webp"].includes(file.type)||file.size>8*1024*1024){imageInput.value="";message.textContent="รูปต้องเป็น JPG, PNG หรือ WEBP ไม่เกิน 8 MB";download.disabled=true;return}if(objectUrl)URL.revokeObjectURL(objectUrl);objectUrl=URL.createObjectURL(file);const image=new Image();image.onload=()=>{productImage=image;render()};image.onerror=()=>{productImage=null;message.textContent="อ่านรูปสินค้าไม่สำเร็จ"};image.src=objectUrl});
  download.addEventListener("click",()=>{if(download.disabled)return;canvas.toBlob(blob=>{if(!blob)return;const href=URL.createObjectURL(blob),a=document.createElement("a");a.href=href;a.download=`ปก-PDF-${titleInput.value.trim().replace(/[\\/:*?\"<>|]+/g,"-").slice(0,60)}.png`;a.click();setTimeout(()=>URL.revokeObjectURL(href),1000)},"image/png")});
  dialog.addEventListener("close",()=>{if(objectUrl){URL.revokeObjectURL(objectUrl);objectUrl=""}productImage=null;imageInput.value="";titleInput.value="";render()});
  render();
})();
