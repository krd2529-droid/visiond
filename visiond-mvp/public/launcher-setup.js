(()=>{
 const controller=new AbortController();let timer;
 Promise.race([(async()=>{
  const r=await fetch('/downloads/visiond-helper/0.20.74/release.json',{cache:'no-store',signal:controller.signal});
  if(!r.ok)throw Error();const m=await r.json();
  if(m.version!=='0.20.74'||m.signature_status!=='NotSigned'||m.executable?.file!=='VisionD-Helper-Setup.exe'||!/^[a-f0-9]{64}$/.test(m.executable.sha256))throw Error();return m;
 })(),new Promise((_,reject)=>{timer=setTimeout(()=>{controller.abort();reject(Error())},5000)})]).then(m=>{
  document.getElementById('hash').textContent='SHA256: '+m.executable.sha256;
  document.getElementById('signature').textContent='รุ่นนี้ยังไม่มีลายเซ็นดิจิทัลผู้เผยแพร่ Windows อาจเตือนหรือปิดกั้น ตรวจแหล่งดาวน์โหลดและ SHA256 ก่อนเปิด';
  const link=document.getElementById('download');link.href='/downloads/visiond-helper/0.20.74/VisionD-Helper-Setup.exe';link.removeAttribute('aria-disabled');
 }).catch(()=>{document.getElementById('signature').textContent='อ่านข้อมูลยืนยันไฟล์ไม่ได้ กรุณาโหลดหน้านี้ใหม่ก่อนดาวน์โหลด'}).finally(()=>clearTimeout(timer));
})();
