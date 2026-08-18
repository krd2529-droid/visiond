(()=>{
  const form=document.querySelector('#sellerCourseForm');
  if(!form)return;
  const countInput=form.elements.expected_episodes;
  const rule=form.querySelector('.course-cover-rule');
  const intro=document.querySelector('#createPanel>p');
  const submit=form.querySelector('button[type="submit"]');
  if(!countInput||!rule||!submit)return;

  if(intro)intro.textContent='กรอกข้อมูลตะกร้าก่อน แล้วอัปโหลดชื่อ คำอธิบาย คลิป และเอกสารของแต่ละ EP ต่อได้ทันทีในตะกร้าเดียวกัน';
  submit.textContent='บันทึกตะกร้าคอร์สพร้อม EP';
  countInput.inputMode='numeric';
  countInput.setAttribute('aria-describedby','episodeBuilderHelp');
  rule.insertAdjacentHTML('afterend',`<fieldset class="draft-first-ep episode-builder"><legend>ขั้นต่อไป · อัปโหลดงาน EP ในตะกร้าคอร์ส</legend><div class="episode-builder-head"><p id="episodeBuilderHelp">ทุก EP อยู่ในตะกร้าคอร์สเดียวกัน ใส่ชื่อ คำอธิบาย คลิป และเอกสารประกอบได้เลย ก่อนบันทึกร่าง</p><div class="episode-builder-controls"><strong id="episodeBuilderProgress" aria-live="polite"></strong><button id="addEpisodeCard" class="primary" type="button">+ เพิ่ม EP</button></div></div><div id="episodeCards" class="episode-cards"></div></fieldset>`);

  const cards=document.querySelector('#episodeCards');
  const progress=document.querySelector('#episodeBuilderProgress');
  const addEpisodeButton=document.querySelector('#addEpisodeCard');
  let renderedCount=0,createdCourseId=0,createdLessons=[],uploadedEpisodes=new Set();

  function readVideoResolution(file){
    return new Promise((resolve,reject)=>{
      const video=document.createElement('video'),url=URL.createObjectURL(file);
      const finish=callback=>{URL.revokeObjectURL(url);video.removeAttribute('src');callback()};
      video.preload='metadata';
      video.onloadedmetadata=()=>{const resolution={width:Number(video.videoWidth),height:Number(video.videoHeight)};finish(()=>resolve(resolution))};
      video.onerror=()=>finish(()=>reject(new Error('อ่านความละเอียดคลิปไม่ได้ กรุณาแปลงไฟล์เป็น MP4/WebM 720p แล้วลองใหม่')));
      video.src=url;
    });
  }
  async function validateVideoResolution(file,position){
    if(!file)return '';
    try{
      const {width,height}=await readVideoResolution(file),landscape=width>=height;
      if((landscape&&(width>1280||height>720))||(!landscape&&(width>720||height>1280)))return `EP.${position}: คลิป ${width}×${height}px สูงเกิน 720p กรุณาแปลงเป็นไม่เกิน 1280×720 (แนวนอน) หรือ 720×1280 (แนวตั้ง)`;
      return '';
    }catch(error){return `EP.${position}: ${error.message}`}
  }

  const clampCount=value=>Math.min(200,Math.max(1,Math.trunc(Number(value)||1)));
  const cardHasData=card=>[...card.querySelectorAll('input:not([type=file]),textarea')].some(x=>String(x.value||'').trim())||[...card.querySelectorAll('input[type=file]')].some(x=>x.files?.length);
  const episodeData=card=>({
    position:Number(card.dataset.episode),
    sort_order:Number(card.dataset.episode)*10,
    title:card.querySelector('[data-field="title"]').value.trim(),
    description:card.querySelector('[data-field="description"]').value.trim(),
    duration_seconds:Math.max(0,Math.round((Number(card.querySelector('[data-field="minutes"]').value)||0)*60))
  });
  function refreshCard(card){
    const data=episodeData(card),hasFiles=[...card.querySelectorAll('input[type=file]')].some(x=>x.files?.length);
    card.querySelector('.episode-card-title').textContent=`EP.${String(data.position).padStart(2,'0')} — ${data.title||'ยังไม่ตั้งชื่อ'}`;
    card.querySelector('.episode-card-state').textContent=data.title?(hasFiles?'พร้อมอัปโหลด':'บันทึกรายละเอียด'):'ยังไม่กรอก';
    card.classList.toggle('is-ready',Boolean(data.title));
    const ready=[...cards.children].filter(x=>episodeData(x).title).length;
    progress.textContent=`เตรียมแล้ว ${ready}/${cards.children.length} EP`;
  }
  function makeCard(index){
    const card=document.createElement('article');
    card.className='episode-card';card.dataset.episode=index;
    card.innerHTML=`<div class="episode-card-head"><span class="episode-card-title">EP.${String(index).padStart(2,'0')} — ยังไม่ตั้งชื่อ</span><span class="episode-card-state">ยังไม่กรอก</span></div><div class="episode-card-body" role="group" aria-label="ข้อมูล EP.${index}"><div class="draft-first-ep-grid"><label>ชื่อ EP <input data-field="title" maxlength="180" placeholder="เช่น เริ่มต้นใช้งาน" required></label><label>ความยาวโดยประมาณ (นาที)<input data-field="minutes" type="number" min="0" step="0.5" inputmode="decimal"></label><label class="span2">คำอธิบาย EP<textarea data-field="description" rows="3" maxlength="3000" placeholder="อธิบายสิ่งที่จะเรียนในตอนนี้"></textarea></label><label class="draft-upload-box">🎥 คลิป MP4/WEBM สูงสุด 2 GB · รับไม่เกิน 720p (แนวนอน 1280×720 / แนวตั้ง 720×1280)<input data-field="video" type="file" accept="video/mp4,video/webm"></label><label>คุณภาพวิดีโอ<select data-field="video_quality"><option value="720">720p (แนะนำ)</option><option value="480">480p (ประหยัดพื้นที่)</option></select></label><label class="draft-upload-box">📎 เอกสารหรือไฟล์ประกอบ<input data-field="documents" type="file" multiple></label></div></div>`;
    card.querySelectorAll('input,textarea').forEach(input=>{input.addEventListener('input',()=>refreshCard(card));input.addEventListener('change',()=>refreshCard(card))});
    const videoInput=card.querySelector('[data-field="video"]');
    videoInput.addEventListener('change',async()=>{const file=videoInput.files?.[0],error=await validateVideoResolution(file,index);if(error){sellerMessage.textContent=error;videoInput.value='';refreshCard(card)}});
    return card;
  }
  function renderCount(next,{confirmRemoval=true}={}){
    next=clampCount(next);
    if(next<renderedCount){
      const removed=[...cards.children].slice(next);
      if(confirmRemoval&&removed.some(cardHasData)&&!confirm(`ลดเหลือ ${next} EP ใช่ไหม? ข้อมูลและไฟล์ของ EP ที่ถูกตัดจะหายจากแบบฟอร์ม`)){countInput.value=renderedCount;return false}
      removed.forEach(card=>card.remove());
    }else for(let i=renderedCount+1;i<=next;i++)cards.append(makeCard(i));
    renderedCount=next;countInput.value=next;
    if(cards.lastElementChild)refreshCard(cards.lastElementChild);else progress.textContent=`เตรียมแล้ว 0/${next} EP`;
    return true;
  }
  countInput.addEventListener('change',()=>renderCount(countInput.value));
  countInput.addEventListener('blur',()=>renderCount(countInput.value));
  addEpisodeButton.addEventListener('click',()=>{
    if(renderedCount>=200){sellerMessage.textContent='เพิ่มได้สูงสุด 200 EP ต่อตะกร้าคอร์ส';return}
    renderCount(renderedCount+1,{confirmRemoval:false});
    cards.lastElementChild?.querySelector('[data-field="title"]')?.focus();
  });
  renderCount(countInput.value,{confirmRemoval:false});

  function openInvalidField(){
    const invalid=form.querySelector(':invalid');if(!invalid)return false;
    const card=invalid.closest('.episode-card');if(card)sellerMessage.textContent=`กรุณาตรวจข้อมูล EP.${card.dataset.episode}`;
    invalid.focus();invalid.reportValidity();return true;
  }
  function lockEpisodePlan(){
    countInput.disabled=true;cards.classList.add('plan-locked');
    cards.querySelectorAll('[data-field="title"],[data-field="description"],[data-field="minutes"]').forEach(input=>input.disabled=true);
  }
  function markUploaded(card){
    card.classList.add('is-uploaded');card.querySelector('.episode-card-state').textContent='อัปโหลดสำเร็จ';
    card.querySelectorAll('input[type="file"]').forEach(input=>input.disabled=true);
  }

  async function validateFiles(){
    for(const card of cards.children){
      const position=card.dataset.episode,video=card.querySelector('[data-field="video"]').files?.[0],docs=[...card.querySelector('[data-field="documents"]').files||[]];
      if(video&&(!['video/mp4','video/webm'].includes(video.type)||video.size>2*1024*1024*1024))return `EP.${position}: คลิปต้องเป็น MP4 หรือ WEBM ขนาดไม่เกิน 2 GB`;
      const resolutionError=await validateVideoResolution(video,position);if(resolutionError)return resolutionError;
      if(docs.some(file=>file.size>200*1024*1024))return `EP.${position}: ไฟล์ประกอบแต่ละไฟล์ต้องไม่เกิน 200 MB`;
    }
    return '';
  }
  async function fetchLessons(courseId){
    const response=await fetch(`/api/course-seller/${courseId}/lessons`,{cache:'no-store'}),data=await response.json().catch(()=>({}));
    if(!response.ok)throw new Error(data.error||'โหลดรายการ EP ไม่สำเร็จ');
    return data.items||[];
  }
  async function uploadLargeVideo(courseId,lessonId,file,quality,position){
    const initResponse=await fetch(`/api/course-seller/${courseId}/lesson-video-multipart/init`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({lesson_id:Number(lessonId),file_name:file.name,file_type:file.type,file_size:file.size,quality:Number(quality)})});
    const init=await initResponse.json().catch(()=>({}));if(!initResponse.ok)throw new Error(init.error||`EP.${position}: เริ่มอัปโหลดคลิปไม่สำเร็จ`);
    const parts=[];
    try{
      for(let offset=0,partNumber=1;offset<file.size;offset+=init.chunk_size,partNumber++){
        const end=Math.min(file.size,offset+init.chunk_size),percent=Math.round((offset/file.size)*100);
        sellerMessage.textContent=`กำลังอัปโหลดคลิป EP.${position} ${percent}% กรุณาอย่าปิดหน้านี้…`;
        const partResponse=await fetch(`/api/course-seller/${courseId}/lesson-video-multipart/part?key=${encodeURIComponent(init.key)}&upload_id=${encodeURIComponent(init.upload_id)}&part_number=${partNumber}`,{method:'PUT',body:file.slice(offset,end)}),part=await partResponse.json().catch(()=>({}));
        if(!partResponse.ok)throw new Error(part.error||`EP.${position}: อัปโหลดส่วนที่ ${partNumber} ไม่สำเร็จ`);parts.push(part);
      }
      const completeResponse=await fetch(`/api/course-seller/${courseId}/lesson-video-multipart/complete`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({key:init.key,upload_id:init.upload_id,file_size:file.size,parts})}),complete=await completeResponse.json().catch(()=>({}));
      if(!completeResponse.ok)throw new Error(complete.error||`EP.${position}: รวมคลิปไม่สำเร็จ`);return complete;
    }catch(error){await fetch(`/api/course-seller/${courseId}/lesson-video-multipart/abort`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({key:init.key,upload_id:init.upload_id})}).catch(()=>{});throw error}
  }
  async function uploadEpisode(courseId,lesson,card,index,total){
    const video=card.querySelector('[data-field="video"]').files?.[0],documents=[...card.querySelector('[data-field="documents"]').files||[]];
    if(!video&&!documents.length)return;
    const data=episodeData(card),payload=new FormData();
    payload.set('title',data.title);payload.set('description',data.description);payload.set('duration_seconds',String(data.duration_seconds));
    documents.forEach(file=>payload.append('documents',file));
    sellerMessage.textContent=`กำลังบันทึก EP ${index}/${total} กรุณาอย่าปิดหน้านี้…`;
    const response=await fetch(`/api/course-seller/${courseId}/lessons/${lesson.id}`,{method:'PUT',body:payload}),result=await response.json().catch(()=>({}));
    if(!response.ok)throw new Error(`EP.${index}: ${result.error||'อัปโหลดไม่สำเร็จ'}`);
    if(video)await uploadLargeVideo(courseId,lesson.id,video,card.querySelector('[data-field="video_quality"]').value,index);
    uploadedEpisodes.add(index);markUploaded(card);
  }
  form.onsubmit=async event=>{
    event.preventDefault();
    renderCount(countInput.value,{confirmRemoval:false});
    const firstMissing=[...cards.children].find(card=>!card.querySelector('[data-field="title"]').value.trim());
    if(firstMissing){
      const title=firstMissing.querySelector('[data-field="title"]');
      sellerMessage.textContent=`กรุณาใส่ชื่อ EP.${firstMissing.dataset.episode}`;title.focus();return;
    }
    if(openInvalidField()||!form.reportValidity())return;
    const fileError=await validateFiles();if(fileError){sellerMessage.textContent=fileError;return}
    const episodeCards=[...cards.children],episodes=episodeCards.map(episodeData);
    if(!createdCourseId&&!confirm(`สร้างคอร์สร่าง ${episodes.length} EP หรือไม่? ยังไม่หักเครดิตและยังไม่เริ่มนับ 30 วัน`))return;
    const button=event.submitter;button.disabled=true;sellerMessage.textContent='กำลังสร้างคอร์สร่างและบันทึกรายละเอียด EP…';
    let data={id:createdCourseId,lessons:createdLessons};
    if(!createdCourseId){
      const courseForm=new FormData(form);courseForm.set('expected_episodes',String(episodes.length));courseForm.set('episodes_json',JSON.stringify(episodes));
      const response=await fetch('/api/course-seller',{method:'POST',body:courseForm});data=await response.json().catch(()=>({}));
      if(!response.ok){sellerMessage.textContent=data.error||'สร้างคอร์สร่างไม่สำเร็จ';button.disabled=false;return}
      createdCourseId=Number(data.id);createdLessons=Array.isArray(data.lessons)?data.lessons:[];lockEpisodePlan();
    }
    try{
      const lessons=(createdLessons.length?createdLessons:await fetchLessons(createdCourseId)).sort((a,b)=>Number(a.sort_order)-Number(b.sort_order));createdLessons=lessons;
      if(lessons.length<episodes.length)throw new Error('ระบบสร้างช่อง EP ไม่ครบ กรุณาเปิดจัดการ EP แล้วลองใหม่');
      for(let i=0;i<episodeCards.length;i++)if(!uploadedEpisodes.has(i+1))await uploadEpisode(createdCourseId,lessons[i],episodeCards[i],i+1,episodeCards.length);
      sellerMessage.textContent=`บันทึกตะกร้าคอร์สพร้อม ${episodes.length} EP สำเร็จแล้ว`;
      const finishedId=createdCourseId;form.reset();countInput.disabled=false;cards.classList.remove('plan-locked');renderedCount=0;createdCourseId=0;createdLessons=[];uploadedEpisodes=new Set();cards.replaceChildren();renderCount(1,{confirmRemoval:false});button.textContent='บันทึกตะกร้าคอร์สพร้อม EP';createPanel.hidden=true;await load();
      const course=state.courses.find(item=>Number(item.id)===finishedId);if(course)openLessons(course);
    }catch(error){
      sellerMessage.textContent=`สร้างคอร์สร่างแล้ว แต่ ${error.message} ข้อมูลในแบบฟอร์มยังอยู่ กด “ลองอัปโหลดต่อ” เพื่อทำต่อจาก EP ที่ไม่สำเร็จ`;
      button.textContent='ลองอัปโหลดต่อ';
      await load();
    }finally{button.disabled=false}
  };
})();
