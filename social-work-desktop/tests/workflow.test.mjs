import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Store } from '../src/store.mjs';
import { RequestCache } from '../src/read-cache.mjs';
import { generateDraft, testOpenAIConnection } from '../src/openai.mjs';

function withStore(run) {
  const dir = mkdtempSync(join(tmpdir(),'social-work-test-'));
  const path = join(dir,'data.db');
  let store = new Store(path);
  try { run({ get: () => store, reopen: () => { store.close(); store = new Store(path); } }); }
  finally { store.close(); rmSync(dir,{recursive:true,force:true}); }
}

test('approval is bound to exact draft and immutable audit snapshot survives edits and restart', () => withStore(({get,reopen}) => {
  const ws = get().createWorkspace('youtube','Channel A');
  const job = get().createJob(ws.id,'Write a description');
  assert.throws(() => get().execute(job.id),/อนุมัติ/);
  get().startGeneration(job.id);
  get().completeGeneration(job.id,'First draft');
  get().approve(job.id,'Editor A');
  const audit = get().events(job.id).items.find(event => event.kind === 'approved_exact_content');
  assert.equal(audit.snapshot_text,'First draft');
  assert.equal(audit.actor,'Editor A');
  assert.match(audit.content_sha256,/^[a-f0-9]{64}$/);
  get().editDraft(job.id,'Revised draft');
  assert.equal(get().job(job.id).approval_text,null);
  assert.throws(() => get().execute(job.id),/อนุมัติ/);
  get().submit(job.id);
  get().approve(job.id,'Editor B');
  get().execute(job.id);
  assert.equal(get().job(job.id).status,'prepared_locally');
  assert.match(get().job(job.id).result,/ยังไม่ได้โพสต์/);
  assert.throws(() => get().execute(job.id),/อนุมัติ/);
  reopen();
  assert.equal(get().job(job.id).status,'prepared_locally');
  assert.deepEqual(get().events(job.id).items.filter(event => event.kind === 'approved_exact_content').map(event => event.snapshot_text).sort(),['First draft','Revised draft']);
}));

test('restart marks active work failed and never resumes or prepares it', () => withStore(({get,reopen}) => {
  const ws = get().createWorkspace('tiktok','Channel B');
  const job = get().createJob(ws.id,'Make a caption');
  get().startGeneration(job.id);
  reopen();
  assert.equal(get().job(job.id).status,'failed');
  assert.match(get().job(job.id).error,/หยุดเมื่อปิดแอป/);
  assert.equal(get().job(job.id).approval_text,null);
}));

test('workspace and job keyset pages are bounded without duplicates; query uses index', () => withStore(({get}) => {
  const ws = get().createWorkspace('facebook_page','Page C');
  for (let i=0;i<53;i++) get().createJob(ws.id,`Task ${i}`);
  const ids = [];
  let cursor = null;
  do { const page = get().listJobs({workspaceId:ws.id,cursor}); assert.ok(page.items.length<=24); ids.push(...page.items.map(job => job.id)); cursor=page.nextCursor; } while(cursor);
  assert.equal(ids.length,53);
  assert.equal(new Set(ids).size,53);
  assert.match(JSON.stringify(get().explain({workspaceId:ws.id})),/jobs_workspace_page/);
  assert.match(JSON.stringify(get().explain()),/jobs_page/);
  assert.match(JSON.stringify(get().explain({workspaceId:ws.id,status:'draft'})),/jobs_workspace_status_page/);
  assert.match(JSON.stringify(get().explain({status:'draft'})),/jobs_status_page/);
  for (let i=0;i<27;i++) get().createWorkspace('youtube',`Channel ${i}`);
  const first=get().listWorkspaces(), second=get().listWorkspaces(first.nextCursor);
  assert.equal(first.items.length,24);
  assert.equal(second.items.length,4);
  assert.equal(new Set([...first.items,...second.items].map(item=>item.id)).size,28);
}));

test('request cache deduplicates concurrent reads and invalidation defeats stale in-flight result', async () => {
  const cache = new RequestCache(10000);
  let calls=0, resolveOld;
  const old = cache.get('jobs:{}',() => { calls++; return new Promise(resolve => { resolveOld=resolve; }); });
  assert.equal(cache.get('jobs:{}',() => { calls++; return 'wrong'; }),old);
  await Promise.resolve();
  cache.invalidate(key => key.startsWith('jobs:'));
  const fresh = await cache.get('jobs:{}',() => { calls++; return 'new'; });
  resolveOld('old');
  assert.equal(await old,'old');
  assert.equal(fresh,'new');
  assert.equal(await cache.get('jobs:{}',() => 'wrong'),'new');
  assert.equal(calls,2);
});

test('OpenAI request sends key only in authorization and collects text from message items', async () => {
  let request;
  const text = await generateDraft({instruction:'Draft a title',workspace:{platform:'youtube',name:'A'},apiKey:'test-secret',fetchImpl:async (_url,options) => {
    request=options;
    return {ok:true,json:async () => ({status:'completed',output:[{type:'reasoning'}, {type:'message',content:[{type:'output_text',text:'Hello'},{type:'output_text',text:'world'}]}]})};
  }});
  assert.equal(text,'Hello\nworld');
  assert.equal(request.headers.Authorization,'Bearer test-secret');
  assert.equal(request.body.includes('test-secret'),false);
  assert.equal(JSON.parse(request.body).store,false);
});

test('explicit OpenAI connection test uses a bounded real-response-shaped request without persisting work', async () => {
  let request;
  const result = await testOpenAIConnection({apiKey:'test-secret',fetchImpl:async (_url,options) => {
    request = JSON.parse(options.body);
    return {ok:true,json:async () => ({status:'completed',output:[{type:'message',content:[{type:'output_text',text:'รับทราบ'}]}]})};
  }});
  assert.deepEqual(result,{connected:true});
  assert.equal(request.max_output_tokens,64);
  assert.equal(request.store,false);
  assert.equal(JSON.stringify(request).includes('test-secret'),false);
  await assert.rejects(testOpenAIConnection({apiKey:'bad',fetchImpl:async () => ({ok:false,status:401})}),/HTTP 401/);
});
