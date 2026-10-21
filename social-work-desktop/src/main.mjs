import { app, BrowserWindow, ipcMain } from 'electron';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { Store } from './store.mjs';
import { generateDraft, testOpenAIConnection } from './openai.mjs';
import { RequestCache } from './read-cache.mjs';

const root = dirname(fileURLToPath(import.meta.url));
const smoke = process.argv.includes('--smoke');
// Keep the original portable app's user-data path stable across installer upgrades.
app.setName('visiond-social-work-desktop');
if (smoke) app.disableHardwareAcceleration();
if (smoke) app.setPath('userData',process.env.SOCIAL_WORK_SMOKE_USER_DATA || mkdtempSync(join(tmpdir(),'visiond-social-smoke-')));
let store;
let apiVerified = false;
let apiTestInFlight = null;
const activeGeneration = new Set();
const readCache = new RequestCache();

function createWindow() {
  const window = new BrowserWindow({
    width: 1280, height: 820, minWidth: 900, minHeight: 620, show: !smoke, paintWhenInitiallyHidden: true,
    title: 'VisionD Social Work', backgroundColor: '#0c1220',
    webPreferences: {
      preload: join(root, 'preload.cjs'), contextIsolation: true,
      nodeIntegration: false, sandbox: true, webSecurity: true, spellcheck: false, backgroundThrottling: !smoke
    }
  });
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', event => event.preventDefault());
  window.loadFile(join(root, 'ui', 'index.html'));
  if (smoke) {
    const timeout = setTimeout(() => { console.error('SMOKE_TIMEOUT'); app.exit(1); },15000);
    window.webContents.once('did-finish-load',async () => {
      try {
        if (process.env.SOCIAL_WORK_SMOKE_CAPTURE) {
          await window.webContents.executeJavaScript(`new Promise((resolve,reject) => {
            let tries = 0;
            const timer = setInterval(() => {
              if (document.querySelector('#api-pill')?.textContent !== 'Checking OpenAI') { clearInterval(timer); resolve(); }
              else if (++tries > 30) { clearInterval(timer); reject(new Error('Overview did not render')); }
            },100);
          })`);
          const shot = await window.webContents.capturePage();
          if (shot.isEmpty()) throw new Error('Hidden overview capture is empty');
          writeFileSync(process.env.SOCIAL_WORK_SMOKE_CAPTURE,shot.toPNG());
        }
        const result = await window.webContents.executeJavaScript(`(async () => {
          if (!document.querySelector('#nav') || !document.body.textContent.includes('ยังไม่เชื่อมบัญชีโซเชียล')) throw new Error('UI missing');
          const ws = await window.socialWork.createWorkspace('youtube','Smoke channel');
          const job = await window.socialWork.createJob(ws.id,'Smoke instruction');
          await window.socialWork.editDraft(job.id,'Smoke draft');
          await window.socialWork.submit(job.id);
          await window.socialWork.approve(job.id,'Smoke reviewer');
          await window.socialWork.execute(job.id);
          const detail = await window.socialWork.getJob(job.id);
          if (detail.job.status !== 'prepared_locally' || !detail.events.items.some(e => e.snapshot_text === 'Smoke draft')) throw new Error('Workflow failed');
          return 'SMOKE_PASS';
        })()`);
        clearTimeout(timeout); console.log(result); app.exit(0);
      } catch (error) { clearTimeout(timeout); console.error(`SMOKE_FAIL: ${error.message}`); app.exit(1); }
    });
  }
}

function handle(name, fn) {
  ipcMain.handle(name, (event, ...args) => {
    if (!event.sender.getURL().startsWith('file://')) throw new Error('หน้าต่างแอปไม่ถูกต้อง');
    return fn(...args);
  });
}
function readCached(key, fn) { return readCache.get(key,fn); }
function invalidateWorkspace() {
  readCache.invalidate(key => key.startsWith('ws:'));
}
function invalidateJob(job) {
  readCache.invalidate(key => {
    if (!key.startsWith('jobs:')) return false;
    try {
      const filters = JSON.parse(key.slice(5));
      return (!filters.workspaceId || filters.workspaceId === job.workspace_id) && (!filters.status || filters.status === job.status);
    } catch { return true; }
  });
}
function mutateJob(id, fn) {
  const prior = store.job(id);
  const result = fn();
  if (prior) invalidateJob(prior);
  invalidateJob(result);
  return result;
}

app.whenReady().then(() => {
  store = new Store(join(app.getPath('userData'),'social-work.db'));
  handle('app:status', () => ({ apiConfigured: Boolean(process.env.OPENAI_API_KEY), apiVerified, model: process.env.OPENAI_MODEL || 'gpt-5-mini', platformConnected: false, summary: store.summary() }));
  handle('app:test-openai', () => {
    if (!apiTestInFlight) apiTestInFlight = testOpenAIConnection().then(result => { apiVerified = true; return result; }).catch(error => {
      apiVerified = false;
      throw error;
    }).finally(() => { apiTestInFlight = null; });
    return apiTestInFlight;
  });
  handle('workspaces:list', cursor => readCached(`ws:${cursor || ''}`, () => store.listWorkspaces(cursor)));
  handle('workspaces:create', (platform,name) => { const ws = store.createWorkspace(platform,name); invalidateWorkspace(); return ws; });
  handle('jobs:list', filters => readCached(`jobs:${JSON.stringify(filters || {})}`, () => store.listJobs(filters)));
  handle('jobs:create', (workspaceId,instruction) => { const job = store.createJob(workspaceId,instruction); invalidateJob(job); return job; });
  handle('jobs:get', (id,cursor) => ({ job: store.job(id), events: store.events(id,cursor) }));
  handle('jobs:edit', (id,text) => mutateJob(id,() => store.editDraft(id,text)));
  handle('jobs:submit', id => mutateJob(id,() => store.submit(id)));
  handle('jobs:approve', (id,reviewer) => mutateJob(id,() => store.approve(id,reviewer)));
  handle('jobs:execute', id => mutateJob(id,() => store.execute(id)));
  handle('jobs:cancel', id => mutateJob(id,() => store.cancel(id)));
  handle('jobs:generate', async id => {
    if (activeGeneration.has(id)) throw new Error('AI กำลังร่างงานนี้อยู่');
    const job = store.job(id);
    if (!job) throw new Error('ไม่พบงาน');
    const workspace = store.workspace(job.workspace_id);
    mutateJob(id,() => store.startGeneration(id));
    activeGeneration.add(id);
    try {
      const draft = await generateDraft({ instruction: job.instruction, workspace });
      return mutateJob(id,() => store.completeGeneration(id,draft));
    } catch (error) {
      const message = String(error?.message || 'สร้างร่างไม่สำเร็จ').slice(0,400);
      mutateJob(id,() => store.fail(id,message));
      throw new Error(message);
    } finally { activeGeneration.delete(id); }
  });
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('before-quit', () => store?.close());
