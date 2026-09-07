(function(global){
  const safeText=(value,limit=120)=>String(value??'').replace(/[\u0000-\u001f\u007f]/g,' ').trim().slice(0,limit);
  const money=(amount,currency)=>new Intl.NumberFormat('th-TH',{style:'currency',currency:safeText(currency,3)||'THB',maximumFractionDigits:2}).format(Number(amount)||0);
  const roundRect=(ctx,x,y,w,h,r,fill,stroke)=>{const radius=Math.min(r,w/2,h/2);ctx.beginPath();ctx.moveTo(x+radius,y);ctx.lineTo(x+w-radius,y);ctx.quadraticCurveTo(x+w,y,x+w,y+radius);ctx.lineTo(x+w,y+h-radius);ctx.quadraticCurveTo(x+w,y+h,x+w-radius,y+h);ctx.lineTo(x+radius,y+h);ctx.quadraticCurveTo(x,y+h,x,y+h-radius);ctx.lineTo(x,y+radius);ctx.quadraticCurveTo(x,y,x+radius,y);if(fill){ctx.fillStyle=fill;ctx.fill()}if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=2;ctx.stroke()}};
  const fitText=(ctx,text,maxWidth,start,min=24)=>{let size=start;while(size>min){ctx.font=`800 ${size}px "Noto Sans Thai",sans-serif`;if(ctx.measureText(text).width<=maxWidth)break;size-=2}return size};
  const channelPages=(channels)=>{const list=Array.isArray(channels)?channels.slice():[];if(!list.length)return [[]];const pages=[];for(let index=0;index<list.length;index+=10)pages.push(list.slice(index,index+10));return pages};
  function drawCommissionCard(model,pageIndex=0){
    const total=Number(model?.total);if(!Number.isFinite(total))throw new Error('ไม่มีข้อมูลค่าคอมสำหรับสร้างรูป');
    const allChannels=Array.isArray(model.channels)?model.channels:[],pages=channelPages(allChannels),safePage=Math.min(Math.max(0,Number(pageIndex)||0),pages.length-1),channels=pages[safePage],firstNumber=safePage*10+1,lastNumber=firstNumber+channels.length-1;
    const canvas=document.createElement('canvas'),ctx=canvas.getContext('2d');canvas.width = 1080; canvas.height = 1350;
    const bg=ctx.createLinearGradient(0,0,1080,1350);bg.addColorStop(0,'#021f20');bg.addColorStop(.55,'#064f4c');bg.addColorStop(1,'#08a59c');ctx.fillStyle=bg;ctx.fillRect(0,0,1080,1350);
    ctx.globalAlpha=.15;ctx.strokeStyle='#67fff2';ctx.lineWidth=2;for(let i=-300;i<1300;i+=86){ctx.beginPath();ctx.moveTo(i,0);ctx.lineTo(i+600,1350);ctx.stroke()}ctx.globalAlpha=1;
    ctx.fillStyle='#16e2d1';ctx.font='900 82px sans-serif';ctx.fillText('VX',68,112);ctx.fillStyle='#d8fffb';ctx.font='700 24px sans-serif';ctx.fillText('BY VTOOLS',210,92);
    roundRect(ctx,68,155,944,220,34,'rgba(0,18,19,.72)','#2be4d7');ctx.fillStyle='#b9fff8';ctx.font='600 30px "Noto Sans Thai",sans-serif';ctx.fillText('ค่าคอมรวมทุกช่อง',108,215);
    const totalText=money(total,model.currency);fitText(ctx,totalText,850,104,58);ctx.fillStyle='#fff';ctx.fillText(totalText,108,325);
    ctx.fillStyle='#a9f7ef';ctx.font='600 25px "Noto Sans Thai",sans-serif';ctx.fillText(`ช่วงวันที่ ${safeText(model.range||'ที่เลือก',54)}`,108,360);
    ctx.fillStyle='#fff';ctx.font='800 42px "Noto Sans Thai",sans-serif';ctx.fillText(safeText(model.owner||'รวมทุกช่อง',36),68,440);
    ctx.fillStyle='#b9fff8';ctx.font='500 23px "Noto Sans Thai",sans-serif';ctx.fillText(channels.length?`ช่องที่ ${firstNumber}–${lastNumber} จาก ${allChannels.length} ช่อง · ภาพ ${safePage+1}/${pages.length}`:'ยังไม่มีรายการแยกตามช่อง',68,480);
    if(channels.length){channels.forEach((item,index)=>{const column=index<5?0:1,row=index%5,x=68+column*482,y=520+row*132,amount=Math.max(0,Number(item.amount)||0),number=firstNumber+index;roundRect(ctx,x,y,462,112,20,'rgba(255,255,255,.12)','rgba(98,232,223,.45)');ctx.fillStyle='#8ff7ed';ctx.font='700 20px "Noto Sans Thai",sans-serif';ctx.fillText(`ช่องที่ ${number}`,x+22,y+31);ctx.fillStyle='#fff';ctx.font='700 23px "Noto Sans Thai",sans-serif';ctx.fillText(safeText(item.channel||'ไม่ระบุชื่อช่อง',22),x+22,y+63);ctx.fillStyle='#d7fffb';ctx.font='800 25px "Noto Sans Thai",sans-serif';ctx.fillText(money(amount,model.currency),x+22,y+96)})}
    else{roundRect(ctx,68,520,944,120,24,'rgba(255,255,255,.1)');ctx.fillStyle='#d7fffb';ctx.font='600 29px "Noto Sans Thai",sans-serif';ctx.fillText('ยอดรวมจากช่องที่เลือก',100,590)}
    const footerY=1210;roundRect(ctx,68,footerY,944,72,22,'rgba(0,24,25,.5)','#62e8df');ctx.fillStyle='#fff';ctx.font='600 23px "Noto Sans Thai",sans-serif';ctx.fillText(model.referralUrl?safeText(model.referralUrl,72):'visiondonline.com',94,footerY+45);
    ctx.fillStyle='#d1fffa';ctx.font='500 20px "Noto Sans Thai",sans-serif';ctx.fillText('ยอดอาจเปลี่ยนตามการคืนสินค้าและการยืนยันของ TikTok',68,1325);
    return canvas;
  }
  function drawCommissionCards(model){
    const total=Number(model?.total);if(!Number.isFinite(total))throw new Error('ไม่มีข้อมูลค่าคอมสำหรับสร้างรูป');
    return channelPages(model.channels).map((_,index)=>drawCommissionCard(model,index));
  }
  async function shareCommissionCard(model){
    const canvases=drawCommissionCards(model),stamp=Date.now(),files=[];
    for(let index=0;index<canvases.length;index++){const blob=await new Promise(resolve=>canvases[index].toBlob(resolve,'image/png'));if(!blob)throw new Error('สร้างรูปไม่สำเร็จ');files.push(new File([blob],`visiond-commission-${stamp}-${index+1}of${canvases.length}.png`,{type:'image/png'}))}
    if(navigator.share&&navigator.canShare?.({files})){await navigator.share({title:'สรุปค่าคอม VisionD',text:model.referralUrl||'',files});return'shared'}
    files.forEach((file,index)=>setTimeout(()=>{const link=document.createElement('a');link.download=file.name;link.href=URL.createObjectURL(file);link.click();setTimeout(()=>URL.revokeObjectURL(link.href),1000)},index*250));return'downloaded';
  }
  global.VisionDCommissionCard={drawCommissionCard,drawCommissionCards,shareCommissionCard};
})(window);
