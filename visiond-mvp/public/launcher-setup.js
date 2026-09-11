(()=>{
 const expectedHash='ad1898e402be306f1cf4e7f8b71bf5860b7725ccbafcb0f78c80e36e8fa92c8a';
 const choice=document.getElementById('setup-state'),guidance=document.getElementById('setup-guidance'),download=document.getElementById('download'),status=document.getElementById('download-status');
 const guides={new:'ยังไม่เคยติดตั้ง: ดาวน์โหลดด้วยปุ่มด้านบน เปิดไฟล์จากรายการดาวน์โหลด / Run แล้วเลือกติดตั้งและยืนยัน Windows การดาวน์โหลดไม่ใช่การติดตั้ง จากนั้นอ่านผลในหน้าต่าง Helper',outdated:'มีรุ่นเก่า: ดาวน์โหลด v0.20.78 ด้านบน เปิดไฟล์และเลือกติดตั้ง / อัปเดตตัวช่วย โปรไฟล์เดิมจะคงอยู่ อย่าสรุปว่ารุ่นใหม่ติดตั้งแล้วจากการดาวน์โหลดเพียงอย่างเดียว', 'not-running':'ผูกแล้วแต่ไม่ตอบรับ: เปิด Helper และเลือกติดตั้ง / อัปเดตเพื่อให้ตรวจการเริ่มทำงาน หากรุ่นต่ำกว่า v0.20.78 ให้ดาวน์โหลดอัปเดตก่อน หาก Helper แจ้งพอร์ตเดิมถูกใช้งานจึงเลือกซ่อม อย่าผูกซ้ำหรือกด Connect ซ้ำโดยยังไม่ตรวจคำขอเดิม',repair:'ใช้ขั้นตอนนี้เฉพาะเมื่อ Helper แจ้งพอร์ตเดิมถูกใช้งาน: กดซ่อมพอร์ต / ยืนยันเครื่องใหม่ใน Helper แล้วกรอกรหัส 12 ตัวในหน้านี้ด้วยบัญชีเดิม เทียบรหัสและยืนยันแทน Helper เดิม รอ Helper ตรวจพอร์ตใหม่ ก่อนยืนยันข้อมูลเดิมจะคงอยู่ ไม่ต้องปิด Chrome',paired:'ผูกและตรวจตัวช่วยพร้อมแล้ว: กลับ Analyzer และรีเฟรชสถานะช่องก่อนดำเนินการต่อ ไม่ต้องผูกซ้ำ หากมีคำขอเปิดค้างอยู่ให้ตรวจสถานะคำขอเดิมก่อน การติดตั้ง Helper ยังไม่ใช่การอนุญาต TikTok API'};
 const showGuide=()=>{if(guidance&&choice&&Object.hasOwn(guides,choice.value))guidance.textContent=guides[choice.value]};choice?.addEventListener?.('change',showGuide);showGuide();
 download?.addEventListener?.('click',event=>{if(!download.href){event.preventDefault();return}status.textContent='ส่งคำขอดาวน์โหลดให้เบราว์เซอร์แล้ว ตรวจรายการดาวน์โหลดของคุณ จากนั้นเปิดไฟล์ / Run ด้วยตนเอง ยังไม่ได้ติดตั้งอัตโนมัติ'});
 const controller=new AbortController();let timer;
 Promise.race([(async()=>{
  const r=await fetch('/downloads/visiond-helper/0.20.78/release.json',{cache:'no-store',signal:controller.signal});
  if(!r.ok)throw Error();const m=await r.json();
  if(m.version!=='0.20.78'||m.signature_status!=='NotSigned'||m.executable?.file!=='VisionD-Helper-Setup.exe'||m.executable.sha256!==expectedHash)throw Error();return m;
 })(),new Promise((_,reject)=>{timer=setTimeout(()=>{controller.abort();reject(Error())},5000)})]).then(m=>{
  document.getElementById('hash').textContent='SHA256: '+m.executable.sha256;
  document.getElementById('signature').textContent='รุ่นนี้ยังไม่มีลายเซ็นดิจิทัลผู้เผยแพร่ Windows อาจเตือนหรือปิดกั้น ตรวจแหล่งดาวน์โหลดและ SHA256 ก่อนเปิด';
  const link=document.getElementById('download');link.href='/downloads/visiond-helper/0.20.78/VisionD-Helper-Setup.exe';link.removeAttribute('aria-disabled');
  status.textContent='ตรวจข้อมูลไฟล์แล้ว กดดาวน์โหลดเพื่อบันทึกไฟล์ผ่านเบราว์เซอร์นี้';
 }).catch(()=>{document.getElementById('signature').textContent='อ่านข้อมูลยืนยันไฟล์ไม่ได้ กรุณาโหลดหน้านี้ใหม่ก่อนดาวน์โหลด';status.textContent='ยังเปิดดาวน์โหลดไม่ได้ โหลดหน้านี้ใหม่เพื่อตรวจไฟล์อีกครั้ง'}).finally(()=>clearTimeout(timer));
})();
