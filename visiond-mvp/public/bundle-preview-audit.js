document.body.dataset.feature='BUNDLE-PREVIEW-001';const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const root=document.getElementById('bundles'),dialog=document.getElementById('editor'),candidates=document.getElementById('candidates'),current=document.getElementById('current'),revisions=document.getElementById('revisions'),state=document.getElementById('state');
let active=0,dataCache=null;
const image=(url,label,checked=false)=>`<label data-url="${esc(url)}"><input type="checkbox" value="${esc(url)}" ${checked?'checked':''}><img crossorigin="anonymous" src="${esc(url)}" alt="${esc(label)}"><small>${esc(label)}</small><b class="badge">ยังไม่ตรวจ</b></label>`;

async function load(){
  const response=await fetch('/api/admin/bundle-preview-audit',{cache:'no-store'}),data=await response.json().catch(()=>({}));
  root.innerHTML=response.ok&&data.items.length?data.items.map(item=>`<article class="bundle"><div><b>${esc(item.title)}</b><small> · ID ${item.id} · ${item.member_count} ตะกร้า · แก้รูป ${item.revision_count} ครั้ง</small></div><button data-id="${item.id}">ตรวจรูป</button></article>`).join(''):'<p>ยังไม่มีตะกร้ารวม</p>';
  root.querySelectorAll('button').forEach(button=>button.onclick=()=>open(button.dataset.id));
}
function renderRevisions(items){
  revisions.innerHTML=items.length?items.map(item=>`<div class="revision"><span>Revision ${item.id} · ${esc(item.created_at)}</span><button data-revision="${item.id}">ย้อนกลับจุดนี้</button></div>`).join(''):'<p>ยังไม่มีประวัติแก้รูป</p>';
  revisions.querySelectorAll('button').forEach(button=>button.onclick=()=>revert(button.dataset.revision));
}
async function open(id){
  active=id;state.textContent='กำลังโหลด…';if(!dialog.open)dialog.showModal();
  const response=await fetch(`/api/admin/bundle-preview-audit/${id}`,{cache:'no-store'}),data=await response.json();
  if(!response.ok){state.textContent=data.error;return}
  dataCache=data;document.getElementById('title').textContent=data.bundle.title;
  current.className='gallery current';current.innerHTML=data.bundle.preview_urls.map((url,index)=>image(url,`รูปเดิม ${index+1}`)).join('');
  const seen=new Set();candidates.className='gallery';candidates.innerHTML=data.members.flatMap(member=>[member.cover_url,...member.preview_urls].map(url=>({url,label:member.title}))).filter(item=>item.url&&!seen.has(item.url)&&seen.add(item.url)).map(item=>image(item.url,item.label,data.bundle.preview_urls.includes(item.url))).join('');
  renderRevisions(data.revisions);state.textContent='กด “ตรวจรูปอัตโนมัติ” เพื่อจัดอันดับรูปใบงาน';
}
async function scoreImage(source){
  if(source.tagName!=='CANVAS'&&!source.complete)await new Promise((resolve,reject)=>{source.onload=resolve;source.onerror=reject});
  const canvas=document.createElement('canvas'),size=96;canvas.width=size;canvas.height=size;const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(source,0,0,size,size);
  const pixels=ctx.getImageData(0,0,size,size).data;let light=0,saturation=0,edges=0,last=0;
  for(let i=0;i<pixels.length;i+=4){const max=Math.max(pixels[i],pixels[i+1],pixels[i+2]),min=Math.min(pixels[i],pixels[i+1],pixels[i+2]),lum=(max+min)/510;light+=lum;saturation+=(max-min)/255;if(i&&Math.abs(lum-last)>.18)edges++;last=lum}
  const count=pixels.length/4,white=light/count,gray=1-saturation/count,detail=edges/count,score=Math.round(Math.max(0,Math.min(100,(white*.48+gray*.27+Math.min(detail*4,1)*.25)*100)));
  return{score,kind:score>=62?'น่าจะเป็นใบงาน':score>=45?'ควรตรวจด้วยตา':'น่าจะเป็นปก/รายละเอียด'};
}
async function analyze(){
  const labels=[...candidates.querySelectorAll('label')];state.textContent=`กำลังตรวจ ${labels.length} รูป…`;
  for(const label of labels){try{const result=await scoreImage(label.querySelector('img'));label.dataset.score=result.score;label.className=result.score>=62?'recommended':result.score<45?'warning':'';label.querySelector('.badge').textContent=`${result.kind} · ${result.score}/100`}catch{label.querySelector('.badge').textContent='ตรวจรูปไม่ได้'}}
  labels.sort((a,b)=>Number(b.dataset.score||0)-Number(a.dataset.score||0)).forEach(label=>candidates.append(label));
  const recommended=labels.filter(label=>Number(label.dataset.score)>=62).slice(0,Math.max(1,dataCache.bundle.preview_urls.length));candidates.querySelectorAll('input').forEach(input=>input.checked=false);recommended.forEach(label=>label.querySelector('input').checked=true);
  state.textContent=`ตรวจเสร็จ · แนะนำ ${recommended.length} รูป กรุณาดูด้วยตาก่อนยืนยัน`;
}
const pdfjs=()=>import('/vendor/pdfjs/pdf.mjs?v=014407').then(lib=>{lib.GlobalWorkerOptions.workerSrc='/vendor/pdfjs/pdf.worker.mjs?v=014407';return lib});
async function scanPdf(){
  const members=dataCache.members.filter(member=>member.pdf_file_id);if(!members.length){state.textContent='สมาชิกชุดนี้ไม่มี PDF ให้ตรวจ';return}document.getElementById('scanPdf').disabled=true;
  try{const lib=await pdfjs();for(const member of members){state.textContent=`กำลังค้นใบงานใน PDF: ${member.title}`;const response=await fetch(`/api/admin/product-files/${member.pdf_file_id}`);if(!response.ok)continue;const pdf=await lib.getDocument({data:new Uint8Array(await response.arrayBuffer())}).promise,indexes=[2,Math.ceil(pdf.numPages/2),pdf.numPages].filter((page,index,all)=>page<=pdf.numPages&&all.indexOf(page)===index);let best=null;
    for(const pageNumber of indexes){const page=await pdf.getPage(pageNumber),viewport=page.getViewport({scale:1.2}),canvas=document.createElement('canvas');canvas.width=viewport.width;canvas.height=viewport.height;await page.render({canvasContext:canvas.getContext('2d'),viewport}).promise;const result=await scoreImage(canvas);if(!best||result.score>best.score)best={canvas,score:result.score,pageNumber}}
    if(best){const blob=await new Promise(resolve=>best.canvas.toBlob(resolve,'image/jpeg',.82)),form=new FormData();form.set('source_product_id',member.id);form.set('image',blob,`page-${best.pageNumber}.jpg`);const upload=await fetch(`/api/admin/bundle-preview-audit/${active}`,{method:'POST',body:form}),saved=await upload.json();if(upload.ok)candidates.insertAdjacentHTML('beforeend',image(saved.url,`${member.title} · PDF หน้า ${best.pageNumber}`,true))}await pdf.destroy()}
    state.textContent='เพิ่มรูปที่เหมาะที่สุดจาก PDF แล้ว กรุณาตรวจด้วยตาและกดยืนยัน';
  }catch(error){state.className='error';state.textContent=error.message||'ค้นรูปจาก PDF ไม่สำเร็จ'}finally{document.getElementById('scanPdf').disabled=false}
}
async function revert(id){
  if(!confirm('ย้อนรูปกลับตาม Revision นี้หรือไม่? Product ID และลำดับจะไม่เปลี่ยน'))return;
  const response=await fetch(`/api/admin/bundle-preview-audit/${active}`,{method:'PATCH',headers:{'content-type':'application/json'},body:JSON.stringify({revision_id:Number(id)})}),data=await response.json().catch(()=>({}));
  if(!response.ok){state.textContent=data.error;return}state.textContent='ย้อนรูปสำเร็จ';await open(active);await load();
}
document.getElementById('analyze').onclick=analyze;document.getElementById('scanPdf').onclick=scanPdf;
document.getElementById('save').onclick=async()=>{const button=document.getElementById('save'),preview_urls=[...candidates.querySelectorAll('input:checked')].map(input=>input.value);button.disabled=true;state.textContent='กำลังบันทึก Snapshot และเปลี่ยนรูป…';const response=await fetch(`/api/admin/bundle-preview-audit/${active}`,{method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify({preview_urls})}),data=await response.json().catch(()=>({}));button.disabled=false;if(!response.ok){state.className='error';state.textContent=data.error||'บันทึกไม่สำเร็จ';return}state.className='';state.textContent='เปลี่ยนเฉพาะรูปใน Product ID เดิมแล้ว';await load();setTimeout(()=>dialog.close(),500)};
load();
