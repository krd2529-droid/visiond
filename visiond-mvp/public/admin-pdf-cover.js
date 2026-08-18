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
    if(kind==="kids"){g.addColorStop(0,"#fff3a9");g.addColorStop(1,"#ff9b65")}else if(kind==="elegant"){g.addColorStop(0,"#101922");g.addColorStop(1,"#725471")}else{g.addColorStop(0,"#063f3c");g.addColorStop(1,"#16bbb3")}
    ctx.fillStyle=g;ctx.fillRect(0,0,1000,1400);
    ctx.globalAlpha=.18;ctx.fillStyle="#fff";
    if(kind==="kids")for(const [x,y,r] of [[90,120,48],[890,190,70],[120,1210,66],[860,1160,42]]){ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill()}
    else for(let i=-300;i<1500;i+=150){ctx.save();ctx.translate(i,700);ctx.rotate(-.55);ctx.fillRect(-18,-900,36,1800);ctx.restore()}
    ctx.globalAlpha=1;
  }
  function drawImage(){
    if(!productImage)return;
    const box={x:105,y:390,w:790,h:760},scale=Math.min(box.w/productImage.width,box.h/productImage.height),w=productImage.width*scale,h=productImage.height*scale;
    ctx.save();rounded(box.x,box.y,box.w,box.h,38);ctx.clip();ctx.fillStyle="#fff";ctx.fillRect(box.x,box.y,box.w,box.h);ctx.drawImage(productImage,box.x+(box.w-w)/2,box.y+(box.h-h)/2,w,h);ctx.restore();
    ctx.strokeStyle=template()==="kids"?"#743510":"#ffffff";ctx.lineWidth=10;rounded(box.x,box.y,box.w,box.h,38);ctx.stroke();
  }
  function render(){
    const kind=template(),title=titleInput.value.trim();background(kind);drawImage();
    ctx.textAlign="center";ctx.textBaseline="middle";ctx.fillStyle=kind==="kids"?"#71320d":"#fff";
    const fontFamily=kind==="kids"?'Tahoma, sans-serif':kind==="elegant"?'Georgia, Tahoma, serif':'Tahoma, sans-serif';
    let size=82,wrapped=[];do{wrapped=lines(title||"ชื่อปก PDF",850,`900 ${size}px ${fontFamily}`,3);if(wrapped.every(x=>ctx.measureText(x).width<=850))break;size-=4}while(size>46);
    ctx.font=`900 ${size}px ${fontFamily}`;const start=205-(wrapped.length-1)*(size*.6);wrapped.forEach((line,index)=>ctx.fillText(line,500,start+index*size*1.18));
    ctx.font=`700 27px Tahoma, sans-serif`;ctx.globalAlpha=.9;ctx.fillText("VISIOND DIGITAL PDF",500,1300);ctx.globalAlpha=1;
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
