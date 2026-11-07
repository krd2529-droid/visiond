(()=>{
 const expectedHash='793a13bf334db9eed1df3c15517a2a8aceb6d9833c7870ff529625c4298e0fde';
 const download=document.getElementById('download');
 const controller=new AbortController();let timer;
 Promise.race([(async()=>{
  const r=await fetch('/downloads/visiond-helper/0.20.86/release.json',{cache:'no-store',signal:controller.signal});
  if(!r.ok)throw Error();const m=await r.json();
  if(m.version!=='0.20.86'||m.signature_status!=='NotSigned'||m.executable?.file!=='VisionD-Helper-Setup.exe'||m.executable.sha256!==expectedHash)throw Error();return m;
 })(),new Promise((_,reject)=>{timer=setTimeout(()=>{controller.abort();reject(Error())},5000)})]).then(()=>{
  download.href='/downloads/visiond-helper/0.20.86/VisionD-Helper-Setup.exe';download.removeAttribute('aria-disabled');
  window.visiondHelperDownloadReady=true;window.dispatchEvent(new Event('visiond-helper-download-ready'));
 }).catch(()=>{const progress=document.getElementById('wizard-progress'),retry=document.getElementById('wizard-retry');progress.textContent='ตรวจไฟล์ดาวน์โหลดไม่สำเร็จ โหลดหน้านี้ใหม่เพื่อลองอีกครั้ง';retry.hidden=false}).finally(()=>clearTimeout(timer));
})();
