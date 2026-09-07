(function(global){
  const safeText=(value,limit=120)=>String(value??'').replace(/[\u0000-\u001f\u007f]/g,' ').trim().slice(0,limit);
  const money=(amount,currency)=>new Intl.NumberFormat('th-TH',{style:'currency',currency:safeText(currency,3)||'THB',maximumFractionDigits:2}).format(Number(amount)||0);
  const roundRect=(ctx,x,y,w,h,r,fill,stroke)=>{const radius=Math.min(r,w/2,h/2);ctx.beginPath();ctx.moveTo(x+radius,y);ctx.lineTo(x+w-radius,y);ctx.quadraticCurveTo(x+w,y,x+w,y+radius);ctx.lineTo(x+w,y+h-radius);ctx.quadraticCurveTo(x+w,y+h,x+w-radius,y+h);ctx.lineTo(x+radius,y+h);ctx.quadraticCurveTo(x,y+h,x,y+h-radius);ctx.lineTo(x,y+radius);ctx.quadraticCurveTo(x,y,x+radius,y);if(fill){ctx.fillStyle=fill;ctx.fill()}if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=2;ctx.stroke()}};
  const fitText=(ctx,text,maxWidth,start,min=24)=>{let size=start;while(size>min){ctx.font=`800 ${size}px "Noto Sans Thai",sans-serif`;if(ctx.measureText(text).width<=maxWidth)break;size-=2}return size};
  function drawCommissionCard(model){
    const total=Number(model?.total);if(!Number.isFinite(total))throw new Error('ไม่มีข้อมูลค่าคอมสำหรับสร้างรูป');
    const canvas=document.createElement('canvas'),ctx=canvas.getContext('2d');canvas.width = 1080; canvas.height = 1350;
    const bg=ctx.createLinearGradient(0,0,1080,1350);bg.addColorStop(0,'#021f20');bg.addColorStop(.55,'#064f4c');bg.addColorStop(1,'#08a59c');ctx.fillStyle=bg;ctx.fillRect(0,0,1080,1350);
    ctx.globalAlpha=.15;ctx.strokeStyle='#67fff2';ctx.lineWidth=2;for(let i=-300;i<1300;i+=86){ctx.beginPath();ctx.moveTo(i,0);ctx.lineTo(i+600,1350);ctx.stroke()}ctx.globalAlpha=1;
    ctx.fillStyle='#16e2d1';ctx.font='900 82px sans-serif';ctx.fillText('VX',68,112);ctx.fillStyle='#d8fffb';ctx.font='700 24px sans-serif';ctx.fillText('BY VTOOLS',210,92);
    roundRect(ctx,68,155,944,240,34,'rgba(0,18,19,.72)','#2be4d7');ctx.fillStyle='#b9fff8';ctx.font='600 30px "Noto Sans Thai",sans-serif';ctx.fillText('สรุปค่าคอมมิชชัน',108,215);
    const totalText=money(total,model.currency);fitText(ctx,totalText,850,104,58);ctx.fillStyle='#fff';ctx.fillText(totalText,108,325);
    ctx.fillStyle='#a9f7ef';ctx.font='600 25px "Noto Sans Thai",sans-serif';ctx.fillText(safeText(model.range||'ช่วงข้อมูลที่เลือก',50),108,365);
    ctx.fillStyle='#fff';ctx.font='800 46px "Noto Sans Thai",sans-serif';ctx.fillText(safeText(model.owner||'รวมทุกช่อง',36),68,475);
    ctx.fillStyle='#b9fff8';ctx.font='500 25px "Noto Sans Thai",sans-serif';ctx.fillText('ข้อมูลจาก TikTok Shop · แยกตามช่อง',68,515);
    const channels=Array.isArray(model.channels)?model.channels.slice().sort((a,b)=>Number(b.amount)-Number(a.amount)).slice(0,6):[],max=Math.max(1,...channels.map(item=>Number(item.amount)||0));
    if(channels.length){channels.forEach((item,index)=>{const y=565+index*105,amount=Math.max(0,Number(item.amount)||0);roundRect(ctx,68,y,944,82,20,'rgba(255,255,255,.12)');ctx.fillStyle='#fff';ctx.font='700 27px "Noto Sans Thai",sans-serif';ctx.fillText(safeText(item.channel||'ไม่ระบุช่อง',30),92,y+35);ctx.fillStyle='#d7fffb';ctx.font='700 24px sans-serif';ctx.textAlign='right';ctx.fillText(money(amount,model.currency),982,y+35);ctx.textAlign='left';roundRect(ctx,92,y+53,866,10,5,'rgba(255,255,255,.18)');roundRect(ctx,92,y+53,Math.max(12,866*amount/max),10,5,'#21ead8')})}
    else{roundRect(ctx,68,565,944,120,24,'rgba(255,255,255,.1)');ctx.fillStyle='#d7fffb';ctx.font='600 29px "Noto Sans Thai",sans-serif';ctx.fillText('ยอดรวมจากช่องที่เลือก',100,635)}
    const footerY=channels.length?1215:760;roundRect(ctx,68,footerY,944,82,22,'rgba(0,24,25,.5)','#62e8df');ctx.fillStyle='#fff';ctx.font='600 23px "Noto Sans Thai",sans-serif';ctx.fillText(model.referralUrl?safeText(model.referralUrl,72):'visiondonline.com',94,footerY+50);
    ctx.fillStyle='#d1fffa';ctx.font='500 20px "Noto Sans Thai",sans-serif';ctx.fillText('ยอดอาจเปลี่ยนตามการคืนสินค้าและการยืนยันของ TikTok',68,1325);
    return canvas;
  }
  async function shareCommissionCard(model){
    const canvas=drawCommissionCard(model),blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));if(!blob)throw new Error('สร้างรูปไม่สำเร็จ');
    const file=new File([blob],`visiond-commission-${Date.now()}.png`,{type:'image/png'});
    if(navigator.share&&navigator.canShare?.({files:[file]})){await navigator.share({title:'สรุปค่าคอม VisionD',text:model.referralUrl||'',files:[file]});return'shared'}
    const link=document.createElement('a');link.download=file.name;link.href=URL.createObjectURL(blob);link.click();setTimeout(()=>URL.revokeObjectURL(link.href),1000);return'downloaded';
  }
  global.VisionDCommissionCard={drawCommissionCard,shareCommissionCard};
})(window);
