(()=>{
  const form=document.querySelector('#sellerCourseForm');
  if(!form)return;
  const countInput=form.elements.expected_episodes;
  const rule=form.querySelector('.course-cover-rule');
  const intro=document.querySelector('#createPanel>p');
  const submit=form.querySelector('button[type="submit"]');
  if(!countInput||!rule||!submit)return;

  if(intro)intro.textContent='ระบุจำนวน EP แล้วระบบจะเตรียมช่องชื่อ รายละเอียด คลิป และไฟล์ประกอบให้ครบทุกตอน';
  submit.textContent='สร้างคอร์สร่างและบันทึก EP';
  countInput.inputMode='numeric';
  countInput.setAttribute('aria-describedby','episodeBuilderHelp');
  rule.insertAdjacentHTML('afterend',`<fieldset class="draft-first-ep episode-builder"><legend>🎬 เตรียมเนื้อหาแต่ละ EP</legend><div class="episode-builder-head"><p id="episodeBuilderHelp">กรอกชื่อและรายละเอียดไว้ก่อนได้ คลิปกับไฟล์ประกอบเลือกอัปโหลดตอนนี้หรือภายหลังก็ได้</p><div class="episode-builder-actions"><strong id="episodeBuilderProgress" aria-live="polite"></strong><button id="collapseEpisodeCards" type="button">ยุบทั้งหมด</button></div></div><div id="episodeCards" class="episode-cards"></div></fieldset>`);

  const cards=document.querySelector('#episodeCards');
  const progress=document.querySelector('#episodeBuilderProgress');
  const collapseButton=document.querySelector('#collapseEpisodeCards');
  let renderedCount=0,createdCourseId=0,createdLessons=[],uploadedEpisodes=new Set();

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
    const panelId=`episode-card-panel-${index}`;
    card.innerHTML=`<button class="episode-card-toggle" type="button" aria-expanded="${index===1?'true':'false'}" aria-controls="${panelId}"><span class="episode-card-title">EP.${String(index).padStart(2,'0')} — ยังไม่ตั้งชื่อ</span><span class="episode-card-state">ยังไม่กรอก</span><i aria-hidden="true">⌄</i></button><div id="${panelId}" class="episode-card-body" role="region" aria-label="ข้อมูล EP.${index}" ${index===1?'':'hidden'}><div class="draft-first-ep-grid"><label>ชื่อ EP <input data-field="title" maxlength="180" placeholder="เช่น เริ่มต้นใช้งาน" required></label><label>ความยาวโดยประมาณ (นาที)<input data-field="minutes" type="number" min="0" step="0.5" inputmode="decimal"></label><label class="span2">คำอธิบาย EP<textarea data-field="description" rows="3" maxlength="3000" placeholder="อธิบายสิ่งที่จะเรียนในตอนนี้"></textarea></label><label class="draft-upload-box">🎥 คลิป MP4/WEBM ไม่เกิน 200 MB<input data-field="video" type="file" accept="video/mp4,video/webm"></label><label class="draft-upload-box">📎 เอกสารหรือไฟล์ประกอบ<input data-field="documents" type="file" multiple></label></div></div>`;
    const toggle=card.querySelector('.episode-card-toggle'),body=card.querySelector('.episode-card-body');
    toggle.onclick=()=>{const open=body.hidden;body.hidden=!open;toggle.setAttribute('aria-expanded',String(open))};
    card.querySelectorAll('input,textarea').forEach(input=>{input.addEventListener('input',()=>refreshCard(card));input.addEventListener('change',()=>refreshCard(card))});
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
  collapseButton.onclick=()=>cards.querySelectorAll('.episode-card').forEach(card=>{card.querySelector('.episode-card-body').hidden=true;card.querySelector('.episode-card-toggle').setAttribute('aria-expanded','false')});
  renderCount(countInput.value,{confirmRemoval:false});

  function openInvalidField(){
    const invalid=form.querySelector(':invalid');if(!invalid)return false;
    const card=invalid.closest('.episode-card');if(card){const body=card.querySelector('.episode-card-body'),toggle=card.querySelector('.episode-card-toggle');body.hidden=false;toggle.setAttribute('aria-expanded','true');sellerMessage.textContent=`กรุณาตรวจข้อมูล EP.${card.dataset.episode}`}
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

  function validateFiles(){
    for(const card of cards.children){
      const position=card.dataset.episode,video=card.querySelector('[data-field="video"]').files?.[0],docs=[...card.querySelector('[data-field="documents"]').files||[]];
      if(video&&(!['video/mp4','video/webm'].includes(video.type)||video.size>200*1024*1024))return `EP.${position}: คลิปต้องเป็น MP4 หรือ WEBM ไม่เกิน 200 MB`;
      if(docs.some(file=>file.size>200*1024*1024))return `EP.${position}: ไฟล์ประกอบแต่ละไฟล์ต้องไม่เกิน 200 MB`;
    }
    return '';
  }
  async function fetchLessons(courseId){
    const response=await fetch(`/api/course-seller/${courseId}/lessons`,{cache:'no-store'}),data=await response.json().catch(()=>({}));
    if(!response.ok)throw new Error(data.error||'โหลดรายการ EP ไม่สำเร็จ');
    return data.items||[];
  }
  async function uploadEpisode(courseId,lesson,card,index,total){
    const video=card.querySelector('[data-field="video"]').files?.[0],documents=[...card.querySelector('[data-field="documents"]').files||[]];
    if(!video&&!documents.length)return;
    const data=episodeData(card),payload=new FormData();
    payload.set('title',data.title);payload.set('description',data.description);payload.set('duration_seconds',String(data.duration_seconds));
    if(video)payload.set('video',video);documents.forEach(file=>payload.append('documents',file));
    sellerMessage.textContent=`กำลังอัปโหลด EP ${index}/${total} กรุณาอย่าปิดหน้านี้…`;
    const response=await fetch(`/api/course-seller/${courseId}/lessons/${lesson.id}`,{method:'PUT',body:payload}),result=await response.json().catch(()=>({}));
    if(!response.ok)throw new Error(`EP.${index}: ${result.error||'อัปโหลดไม่สำเร็จ'}`);
    uploadedEpisodes.add(index);markUploaded(card);
  }
  form.onsubmit=async event=>{
    event.preventDefault();
    renderCount(countInput.value,{confirmRemoval:false});
    const firstMissing=[...cards.children].find(card=>!card.querySelector('[data-field="title"]').value.trim());
    if(firstMissing){
      const body=firstMissing.querySelector('.episode-card-body'),toggle=firstMissing.querySelector('.episode-card-toggle'),title=firstMissing.querySelector('[data-field="title"]');
      body.hidden=false;toggle.setAttribute('aria-expanded','true');sellerMessage.textContent=`กรุณาใส่ชื่อ EP.${firstMissing.dataset.episode}`;title.focus();return;
    }
    if(openInvalidField()||!form.reportValidity())return;
    const fileError=validateFiles();if(fileError){sellerMessage.textContent=fileError;return}
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
      sellerMessage.textContent=`สร้างคอร์สร่าง ${episodes.length} EP สำเร็จแล้ว`;
      const finishedId=createdCourseId;form.reset();countInput.disabled=false;cards.classList.remove('plan-locked');renderedCount=0;createdCourseId=0;createdLessons=[];uploadedEpisodes=new Set();cards.replaceChildren();renderCount(1,{confirmRemoval:false});button.textContent='สร้างคอร์สร่างและบันทึก EP';createPanel.hidden=true;await load();
      const course=state.courses.find(item=>Number(item.id)===finishedId);if(course)openLessons(course);
    }catch(error){
      sellerMessage.textContent=`สร้างคอร์สร่างแล้ว แต่ ${error.message} ข้อมูลในแบบฟอร์มยังอยู่ กด “ลองอัปโหลดต่อ” เพื่อทำต่อจาก EP ที่ไม่สำเร็จ`;
      button.textContent='ลองอัปโหลดต่อ';
      await load();
    }finally{button.disabled=false}
  };
})();
