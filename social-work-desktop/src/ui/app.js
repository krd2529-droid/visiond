const api = window.socialWork;
const $ = id => document.getElementById(id);
const platformNames = { youtube: 'YouTube', tiktok: 'TikTok', facebook_page: 'Facebook Page' };
const statusNames = { draft:'ร่าง', generating:'AI กำลังร่าง', awaiting_approval:'รออนุมัติ', approved:'อนุมัติแล้ว', executing:'กำลังเตรียมในเครื่อง', prepared_locally:'เตรียมในเครื่องแล้ว · ยังไม่โพสต์', failed:'ล้มเหลว', cancelled:'ยกเลิก' };
const eventNames = {created:'สร้างงานร่าง',generation_started:'เริ่มให้ AI ร่าง',draft_ready:'ร่างพร้อมตรวจ',interrupted:'งานหยุดเมื่อปิดแอป',failed:'งานล้มเหลว',edited_approval_reset:'แก้ร่างและล้างการอนุมัติ',submitted_for_review:'ส่งร่างเข้าคิวอนุมัติ',approved_exact_content:'อนุมัติข้อความฉบับนี้',local_execution_started:'เริ่มเตรียมผลในเครื่อง',local_result_saved:'บันทึกแพ็กงานในเครื่องแล้ว',cancelled:'ยกเลิกงาน'};
let workspaces = [];
let workspaceCursor = null;
let selectedJob = null;
let libraryCursor = null, approvalCursor = null, eventCursor = null;
const currentView = () => document.querySelector('.view.active')?.id;

function notice(message = '', good = false) {
  const el = $('notice'); el.textContent = message; el.style.color = good ? '#82dec9' : '#ffc4b4';
}
async function action(fn, success) {
  try { const result = await fn(); if (success) notice(success,true); return result; }
  catch (error) { notice(error?.message || String(error)); return null; }
}
function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}
function clear(node) { node.replaceChildren(); }
function formatDate(value) { return value ? new Date(value).toLocaleString('th-TH') : '—'; }
function makeOption(value,text) { const option = el('option','',text); option.value = value; return option; }

async function loadWorkspaces(append = false) {
  const page = await api.listWorkspaces(append ? workspaceCursor : null);
  workspaces = append ? [...workspaces,...page.items] : page.items;
  workspaceCursor = page.nextCursor;
  for (const id of ['command-workspace','library-workspace']) {
    const select = $(id), previous = select.value;
    clear(select);
    if (id === 'library-workspace') select.append(makeOption('','ทุกพื้นที่ช่อง'));
    for (const ws of workspaces) select.append(makeOption(ws.id,`${platformNames[ws.platform]} · ${ws.name}`));
    if ([...select.options].some(option => option.value === previous)) select.value = previous;
  }
  const host = $('workspace-list'); clear(host);
  const overview = $('overview-workspaces'); clear(overview);
  for (const ws of workspaces) {
    const card = el('div','card');
    card.append(el('span','platform',platformNames[ws.platform]),el('h3','',ws.name),el('p','','พื้นที่สำหรับแผนงาน ร่าง และผลลัพธ์ในเครื่อง'),el('span','badge','ยังไม่เชื่อมต่อ'));
    overview.append(card);
    const row = el('button','job-row'); row.type = 'button';
    const info = el('div'); info.append(el('strong','',ws.name),el('small','',platformNames[ws.platform]));
    row.append(info,el('span','state','ยังไม่เชื่อมต่อ'));
    row.onclick = () => { $('command-workspace').value = ws.id; show('command'); };
    host.append(row);
  }
  if (!workspaces.length) { overview.append(el('div','empty','เพิ่มพื้นที่ช่องเพื่อเริ่มงาน')); host.append(el('div','empty','ยังไม่มีพื้นที่ช่อง')); }
  $('workspace-more').hidden = !workspaceCursor;
}

async function loadOverview() {
  const status = await api.status();
  $('api-pill').textContent = status.apiVerified ? `OpenAI ตอบสำเร็จ · ${status.model}` : status.apiConfigured ? 'พบคีย์ · ยังไม่ทดสอบ' : 'ยังไม่มีคีย์ OpenAI';
  $('api-pill').className = `pill ${status.apiVerified ? 'good':'warn'}`;
  $('api-status').textContent = status.apiVerified ? `ทดสอบการตอบจาก OpenAI สำเร็จในครั้งนี้ · รุ่นโมเดล ${status.model}` : status.apiConfigured ? `พบคีย์ในโปรเซสหลัก แต่ยังไม่ยืนยันว่าใช้ได้ · รุ่นโมเดล ${status.model}` : 'ยังไม่มีคีย์ API จึงยังใช้ AI สร้างร่างไม่ได้';
  const counts = Object.fromEntries(status.summary.map(item => [item.status,item.count]));
  const metrics = [
    ['รออนุมัติ',counts.awaiting_approval || 0],
    ['อนุมัติแล้ว',counts.approved || 0],
    ['เตรียมในเครื่องแล้ว',counts.prepared_locally || 0],
    ['ล้มเหลว',counts.failed || 0]
  ];
  const host = $('metric-grid'); clear(host);
  for (const [label,count] of metrics) { const metric = el('div','metric'); metric.append(el('span','',label),el('strong','',String(count))); host.append(metric); }
}

function renderJobRow(job) {
  const row = el('button','job-row'); row.type = 'button';
  const info = el('div');
  const ws = workspaces.find(item => item.id === job.workspace_id);
  info.append(el('strong','',job.instruction.slice(0,120)),el('small','',`${ws?.name || 'พื้นที่ช่อง'} · ${formatDate(job.created_at)}`));
  row.append(info,el('span','state',statusNames[job.status] || job.status));
  row.onclick = () => openJob(job.id);
  return row;
}
async function loadJobs(kind, append = false) {
  const approval = kind === 'approval';
  const host = $(approval ? 'approval-list':'library-list');
  const more = $(approval ? 'approval-more':'library-more');
  const cursor = append ? (approval ? approvalCursor : libraryCursor) : null;
  const filters = approval ? { status:'awaiting_approval', cursor } : { workspaceId:$('library-workspace').value || undefined, status:$('library-status').value || undefined, cursor };
  const page = await action(() => api.listJobs(filters));
  if (!page) return;
  if (!append) clear(host);
  for (const job of page.items) host.append(renderJobRow(job));
  if (!host.childElementCount) host.append(el('div','empty',approval ? 'ไม่มีร่างรออนุมัติ' : 'ไม่พบงานตามตัวกรองนี้'));
  if (approval) approvalCursor = page.nextCursor; else libraryCursor = page.nextCursor;
  more.hidden = !page.nextCursor;
}

function show(name) {
  for (const view of document.querySelectorAll('.view')) view.classList.toggle('active',view.id === name);
  for (const button of document.querySelectorAll('#nav button')) button.classList.toggle('selected',button.dataset.view === name);
  $('title').textContent = ({overview:'ภาพรวม',command:'สั่งงาน AI',approval:'คิวรออนุมัติ',library:'คลังงาน',workspaces:'พื้นที่ช่อง',settings:'ตั้งค่า'})[name];
  notice();
  if (name === 'overview' || name === 'settings') loadOverview().catch(error => notice(error.message));
  if (name === 'approval' || name === 'library') loadJobs(name);
  if (name === 'workspaces') loadWorkspaces().catch(error => notice(error.message));
}

function detailButton(label, fn, primary = false) {
  const button = el('button',primary ? 'primary':'subtle',label);
  button.type = 'button'; button.onclick = async () => {
    button.disabled = true;
    const result = await action(fn);
    button.disabled = false;
    if (result) { await openJob(selectedJob.id); await loadOverview(); if (currentView() === 'approval' || currentView() === 'library') await loadJobs(currentView()); }
  };
  return button;
}
async function openJob(id) {
  const data = await action(() => api.getJob(id));
  if (!data?.job) return;
  selectedJob = data.job;
  const job = data.job, ws = workspaces.find(item => item.id === job.workspace_id);
  $('detail-title').textContent = job.instruction.slice(0,120);
  const meta = $('detail-meta'); clear(meta);
  for (const value of [ws ? `${platformNames[ws.platform]} · ${ws.name}` : 'พื้นที่ช่อง',statusNames[job.status] || job.status,`สร้างเมื่อ ${formatDate(job.created_at)}`,job.approver ? `อนุมัติโดย ${job.approver} · ${formatDate(job.approved_at)}` : '']) if (value) meta.append(el('span','',value));
  $('draft-text').value = job.draft;
  $('draft-text').disabled = ['generating','executing','prepared_locally','cancelled'].includes(job.status);
  const actions = $('detail-actions'); clear(actions);
  if (!['generating','executing','prepared_locally','cancelled'].includes(job.status)) {
    if (job.status === 'draft' || job.status === 'failed') actions.append(detailButton('ให้ OpenAI ร่าง',() => api.generate(job.id),true));
    actions.append(detailButton('บันทึกการแก้ไข',() => api.editDraft(job.id,$('draft-text').value)));
  }
  if (job.status === 'draft' && job.draft) actions.append(detailButton('ส่งเข้าคิวอนุมัติ',() => api.submit(job.id),true));
  if (job.status === 'awaiting_approval') actions.append(detailButton('อนุมัติข้อความฉบับนี้',async () => {
    if ($('draft-text').value !== job.draft) throw new Error('บันทึกการแก้ไขก่อน การแก้ร่างจะล้างการอนุมัติ');
    const reviewer = prompt('ชื่อผู้อนุมัติสำหรับบันทึกประวัติ');
    if (!reviewer) throw new Error('ยกเลิกการอนุมัติ');
    return api.approve(job.id,reviewer);
  },true));
  if (job.status === 'approved') actions.append(detailButton('บันทึกแพ็กงานในเครื่อง',() => {
    if ($('draft-text').value !== job.draft) throw new Error('บันทึกการแก้ไขก่อน การแก้ร่างจะล้างการอนุมัติ');
    return api.execute(job.id);
  },true));
  if (['draft','awaiting_approval','approved','failed'].includes(job.status)) actions.append(detailButton('ยกเลิกงาน',() => api.cancel(job.id)));
  $('detail-result').textContent = job.result || job.error || '';
  renderEvents(data.events,false);
  if (!$('detail').open) $('detail').showModal();
}
function renderEvents(page,append) {
  const host = $('detail-events'); if (!append) clear(host);
  for (const event of page.items) {
    const node = el('div','event'); node.append(el('strong','',eventNames[event.kind] || event.kind),el('span','',formatDate(event.created_at)));
    if (event.snapshot_text) {
      const snapshot = el('details'); snapshot.append(el('summary','',`ข้อความที่ ${event.actor} อนุมัติ · SHA-256 ${event.content_sha256}`),el('pre','',event.snapshot_text)); node.append(snapshot);
    }
    host.append(node);
  }
  eventCursor = page.nextCursor; $('events-more').hidden = !eventCursor;
}

document.querySelectorAll('#nav button').forEach(button => button.onclick = () => show(button.dataset.view));
document.querySelectorAll('[data-goto]').forEach(button => button.onclick = () => show(button.dataset.goto));
$('create-workspace').onclick = async () => { const created = await action(() => api.createWorkspace($('new-platform').value,$('new-name').value),'เพิ่มพื้นที่ช่องแล้ว'); if (created) { $('new-name').value=''; await loadWorkspaces(); await loadOverview(); } };
$('create-job').onclick = async () => { const job = await action(() => api.createJob($('command-workspace').value,$('instruction').value),'สร้างงานร่างแล้ว'); if (job) { $('instruction').value=''; await openJob(job.id); await loadOverview(); } };
$('approval-more').onclick = () => loadJobs('approval',true);
$('library-more').onclick = () => loadJobs('library',true);
$('workspace-more').onclick = () => loadWorkspaces(true).catch(error => notice(error.message));
$('library-workspace').onchange = $('library-status').onchange = () => loadJobs('library');
$('close-detail').onclick = () => $('detail').close();
$('events-more').onclick = async () => { if (eventCursor && selectedJob) { const page = await action(() => api.getJob(selectedJob.id,eventCursor)); if (page?.events) renderEvents(page.events,true); } };
$('test-openai').onclick = async () => {
  const button = $('test-openai'); button.disabled = true;
  $('api-test-result').textContent = 'กำลังทดสอบกับ OpenAI จริง…';
  try { await api.testOpenAI(); $('api-test-result').textContent = 'ทดสอบสำเร็จ: OpenAI ส่งคำตอบกลับมา ไม่มีงานหรือโพสต์ถูกสร้าง'; notice('ทดสอบ OpenAI สำเร็จ',true); }
  catch (error) { $('api-test-result').textContent = `ทดสอบไม่สำเร็จ: ${error.message}`; notice(error.message); }
  finally { button.disabled = false; await loadOverview(); }
};

(async () => { try { await loadWorkspaces(); await loadOverview(); } catch (error) { notice(error.message); } })();
