const rows=document.querySelector('#dailyTaskRows'),dateInput=document.querySelector('#taskDate'),status=document.querySelector('#taskStatus'),summary=document.querySelector('#taskSummary'),form=document.querySelector('#customTaskForm'),labelInput=document.querySelector('#customTaskLabel');
let tasks=[];
const localDate=(date=new Date())=>`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
dateInput.value=localDate();
function setStatus(message,error=false){status.textContent=message;status.classList.toggle('is-error',error)}
function render(nextTasks){
  tasks=nextTasks;rows.replaceChildren();const done=tasks.filter(task=>task.completed_at).length;summary.textContent=`เสร็จ ${done}/${tasks.length} · เหลือ ${tasks.length-done}`;
  for(const task of tasks){
    const complete=Boolean(task.completed_at),row=document.createElement('tr');row.className=complete?'is-complete':'is-incomplete';
    const state=document.createElement('td');state.textContent=complete?'ทำแล้ว':'ยังไม่ทำ';
    const name=document.createElement('td'),strong=document.createElement('strong');strong.className='task-label';strong.textContent=task.label;name.append(strong);
    const actionCell=document.createElement('td'),actions=document.createElement('div');actions.className='task-actions';
    const toggle=document.createElement('button');toggle.type='button';toggle.className=`vds-btn vds-btn--small ${complete?'vds-btn--secondary':'vds-btn--primary'}`;toggle.textContent=complete?'ยกเลิกว่าทำแล้ว':'ทำแล้ว';toggle.addEventListener('click',()=>toggleTask(task,!complete,toggle));actions.append(toggle);
    if(task.is_custom){const remove=document.createElement('button');remove.type='button';remove.className='vds-btn vds-btn--danger vds-btn--small';remove.textContent='ลบ';remove.addEventListener('click',()=>removeTask(task,remove));actions.append(remove)}
    actionCell.append(actions);row.append(state,name,actionCell);rows.append(row);
  }
}
async function request(options={}){const url=options.date?`/api/admin/daily-tasks?date=${encodeURIComponent(options.date)}`:'/api/admin/daily-tasks';delete options.date;const response=await fetch(url,options);const data=await response.json().catch(()=>({}));if(!response.ok)throw new Error(data.error||'ทำรายการไม่สำเร็จ');return data}
async function load(){setStatus('กำลังโหลดรายการงาน…');try{const data=await request({headers:{accept:'application/json'},date:dateInput.value});render(data.tasks);setStatus(`รายการของวันที่ ${dateInput.value}`)}catch(error){setStatus(error.message,true)}}
async function mutate(body,button){button.disabled=true;try{const data=await request({method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({...body,date:dateInput.value})});render(data.tasks);setStatus('บันทึกแล้ว')}catch(error){setStatus(error.message,true)}finally{button.disabled=false}}
async function toggleTask(task,completed,button){await mutate({action:'toggle',key:task.key,completed},button)}
async function removeTask(task,button){if(!confirm(`ลบ “${task.label}” ออกจากวันนี้?`))return;button.disabled=true;try{const data=await request({method:'DELETE',headers:{'content-type':'application/json'},body:JSON.stringify({date:dateInput.value,key:task.key})});render(data.tasks);setStatus('ลบรายการแล้ว')}catch(error){setStatus(error.message,true)}finally{button.disabled=false}}
dateInput.addEventListener('change',load);document.querySelector('#todayButton').addEventListener('click',()=>{dateInput.value=localDate();load()});
form.addEventListener('submit',async event=>{event.preventDefault();const button=form.querySelector('button');await mutate({action:'add',label:labelInput.value},button);if(!status.classList.contains('is-error')){labelInput.value='';labelInput.focus()}});
load();
