(()=>{
 const expectedHash='df5d0d15298ee1c26a73a35601c1822e2bd19333a1fdab52d2bfdcad28ae8284';
 const download=document.getElementById('download');
 const controller=new AbortController();let timer;
 Promise.race([(async()=>{
  const r=await fetch('/downloads/visiond-helper/0.20.84/release.json',{cache:'no-store',signal:controller.signal});
  if(!r.ok)throw Error();const m=await r.json();
  if(m.version!=='0.20.84'||m.signature_status!=='NotSigned'||m.executable?.file!=='VisionD-Helper-Setup.exe'||m.executable.sha256!==expectedHash)throw Error();return m;
 })(),new Promise((_,reject)=>{timer=setTimeout(()=>{controller.abort();reject(Error())},5000)})]).then(()=>{
  download.href='/downloads/visiond-helper/0.20.84/VisionD-Helper-Setup.exe';download.removeAttribute('aria-disabled');
  window.visiondHelperDownloadReady=true;window.dispatchEvent(new Event('visiond-helper-download-ready'));
 }).catch(()=>{const progress=document.getElementById('wizard-progress'),retry=document.getElementById('wizard-retry');progress.textContent='ตรวจไฟล์ดาวน์โหลดไม่สำเร็จ โหลดหน้านี้ใหม่เพื่อลองอีกครั้ง';retry.hidden=false}).finally(()=>clearTimeout(timer));
})();
