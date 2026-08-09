(()=>{
  const form=document.querySelector('#sellerCourseForm');
  if(!form)return;
  const intro=document.querySelector('#createPanel>p');
  if(intro)intro.textContent='กรอกข้อมูลคอร์สและเลือกอัปโหลด EP.1 ได้ทันที ระบบจะสร้างคอร์สร่างและเพิ่มบทเรียนให้ต่อเนื่องในครั้งเดียว';
  const submit=form.querySelector('button[type="submit"]');
  if(submit)submit.textContent='สร้างคอร์สร่างและอัปโหลด EP.1';
  const rule=form.querySelector('.course-cover-rule');
  rule?.insertAdjacentHTML('afterend',`<fieldset class="draft-first-ep"><legend>🎬 อัปโหลด EP.1 ได้เลย</legend><p class="draft-first-ep-note">ส่วนนี้เลือกอัปโหลดได้ทันที หรือเว้นไว้แล้วเพิ่ม EP ภายหลังก็ได้</p><div class="draft-first-ep-grid"><label>ชื่อ EP แรก<input name="initial_ep_title" value="บทนำ" placeholder="เช่น EP.1 เริ่มต้นใช้งาน"></label><label>ความยาวโดยประมาณ (วินาที)<input name="initial_ep_duration" type="number" min="0"></label><label class="draft-upload-box">🎥 คลิป MP4/WEBM ไม่เกิน 200 MB<input name="initial_ep_video" type="file" accept="video/mp4,video/webm"></label><label class="draft-upload-box">📎 เอกสารหรือไฟล์ประกอบ<input name="initial_ep_documents" type="file" multiple></label><label class="span2">คำอธิบาย EP<textarea name="initial_ep_description" rows="3" placeholder="อธิบายสิ่งที่จะเรียนในบทนี้"></textarea></label></div></fieldset>`);
  form.onsubmit=async event=>{
    event.preventDefault();
    const all=new FormData(form),video=all.get('initial_ep_video'),documents=all.getAll('initial_ep_documents').filter(file=>file instanceof File&&file.size),hasInitial=Boolean(video instanceof File&&video.size)||documents.length>0;
    if(hasInitial&&!String(all.get('initial_ep_title')||'').trim()){sellerMessage.textContent='กรุณาใส่ชื่อ EP แรก';return}
    if(!confirm(hasInitial?'สร้างคอร์สร่างและอัปโหลด EP.1 ตอนนี้หรือไม่?':'สร้างคอร์สร่างฟรีหรือไม่? ยังไม่หักเครดิตและยังไม่เริ่มนับ 30 วัน'))return;
    const button=event.submitter;button.disabled=true;sellerMessage.textContent=hasInitial?'กำลังสร้างคอร์สร่าง…':'กำลังสร้างคอร์สร่าง…';
    const courseForm=new FormData();
    for(const [key,value] of all.entries())if(!key.startsWith('initial_ep_'))courseForm.append(key,value);
    const response=await fetch('/api/course-seller',{method:'POST',body:courseForm}),data=await response.json().catch(()=>({}));
    if(!response.ok){sellerMessage.textContent=data.error||'สร้างคอร์สร่างไม่สำเร็จ';button.disabled=false;return}
    if(hasInitial){
      sellerMessage.textContent='สร้างคอร์สร่างแล้ว กำลังอัปโหลด EP.1 กรุณาอย่าปิดหน้านี้…';
      const lesson=new FormData();lesson.set('title',String(all.get('initial_ep_title')||'บทนำ'));lesson.set('description',String(all.get('initial_ep_description')||''));lesson.set('duration_seconds',String(all.get('initial_ep_duration')||0));
      if(video instanceof File&&video.size)lesson.set('video',video);
      documents.forEach(file=>lesson.append('documents',file));
      const upload=await fetch(`/api/course-seller/${data.id}/lessons`,{method:'POST',body:lesson}),result=await upload.json().catch(()=>({}));
      if(!upload.ok){sellerMessage.textContent=`สร้างคอร์สร่างแล้ว แต่ EP.1 อัปโหลดไม่สำเร็จ: ${result.error||'กรุณากดอัปโหลด/จัดการ EP แล้วลองใหม่'}`;button.disabled=false;await load();return}
      sellerMessage.textContent='สร้างคอร์สร่างและอัปโหลด EP.1 สำเร็จแล้ว';
    }else sellerMessage.textContent=data.message||'สร้างคอร์สร่างแล้ว';
    form.reset();createPanel.hidden=true;button.disabled=false;await load();const course=state.courses.find(item=>Number(item.id)===Number(data.id));if(course)openLessons(course);
  };
})();
