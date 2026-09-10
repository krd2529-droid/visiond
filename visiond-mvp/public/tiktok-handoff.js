(() => {
  const fragment=location.hash.slice(1);history.replaceState(null,'',location.pathname);
  const uuid='[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}';
  const match=new RegExp(`^id=(${uuid})&slot_id=(${uuid})&ticket=([0-9a-f]{64})$`).exec(fragment);
  const fail=()=>{document.getElementById('status').textContent='คำขอหมดอายุหรือไม่ถูกต้อง กลับหน้าหลัก VisionD แล้วเริ่มใหม่';};
  if(!match){fail();return;}
  fetch('/api/tiktok/handoff-redeem',{method:'POST',credentials:'same-origin',cache:'no-store',referrerPolicy:'no-referrer',headers:{'content-type':'application/json'},body:JSON.stringify({id:match[1],slot_id:match[2],ticket:match[3]})}).then(async response=>{
    if(!response.ok)throw new Error('invalid');const body=await response.json(),url=new URL(body.url);
    if(!((url.origin==='https://www.tiktok.com'&&url.pathname==='/v2/auth/authorize/')||(url.origin==='https://shop.tiktok.com'&&url.pathname==='/alliance/creator/auth')))throw new Error('invalid');
    location.replace(url.href);
  }).catch(fail);
})();
