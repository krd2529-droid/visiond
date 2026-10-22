import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { Store } from '../src/store.mjs';
import { RequestCache } from '../src/read-cache.mjs';
import { generateDraft, testOpenAIConnection } from '../src/openai.mjs';
import { PublishingService, hashLocalMedia } from '../src/publishing.mjs';
import { prepareSelectedMedia } from '../src/media-selection.mjs';

async function withStore(run) {
  const dir = mkdtempSync(join(tmpdir(),'social-work-test-'));
  const path = join(dir,'data.db');
  let store = new Store(path);
  try { await run({ dir, get: () => store, reopen: () => { store.close(); store = new Store(path); } }); }
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

test('local media metadata survives restart and reselection clears text approval', () => withStore(async ({dir,get,reopen}) => {
  const path = join(dir,'clip.mp4'); writeFileSync(path,'synthetic media only');
  const hash = await hashLocalMedia(path);
  const file = {localPath:path,name:'clip.mp4',bytes:hash.bytes,sha256:hash.sha256,mimeType:'video/mp4'};
  const ws = get().createWorkspace('youtube','Media channel');
  const job = get().createJob(ws.id,'Caption');
  get().editDraft(job.id,'Approved caption');
  get().attachMedia(job.id,[file]);
  assert.throws(() => get().attachMedia(job.id,[file,file]),/หนึ่งไฟล์/);
  assert.throws(() => get().attachMedia(job.id,[{...file,mimeType:'image/jpeg'}]),/วิดีโอ/);
  get().submit(job.id); get().approve(job.id,'Reviewer');
  assert.equal(get().mediaForJob(job.id)[0].sha256,hash.sha256);
  assert.equal('local_path' in get().mediaForJob(job.id)[0],false);
  assert.throws(() => get().attachMedia(job.id,[{...file,sha256:'bad'}]),/ไฟล์สื่อไม่ถูกต้อง/);
  assert.equal(get().job(job.id).status,'approved');
  await assert.rejects(hashLocalMedia(join(dir,'missing.mp4')));
  assert.equal(get().mediaForJob(job.id)[0].sha256,hash.sha256);
  get().attachMedia(job.id,[file]);
  assert.equal(get().job(job.id).status,'draft');
  assert.equal(get().job(job.id).approval_text,null);
  assert.equal(get().db.prepare('SELECT count(*) AS n FROM publication_approvals WHERE job_id=?').get(job.id).n,0);
  reopen();
  assert.equal(get().mediaForJob(job.id)[0].display_name,'clip.mp4');
}));

test('missing or unreadable selected media exposes no local path and preserves prior selection', () => withStore(async ({dir,get}) => {
  const oldPath = join(dir,'old.mp4'); writeFileSync(oldPath,'existing media');
  const selected = await prepareSelectedMedia([oldPath]);
  const ws = get().createWorkspace('youtube','Private path test');
  const job = get().createJob(ws.id,'Caption');
  get().attachMedia(job.id,selected);
  const before = get().mediaForJob(job.id);
  const missingPath = join(dir,'sensitive-missing.mp4');
  await assert.rejects(prepareSelectedMedia([missingPath]),error => {
    assert.equal(error.message,'อ่านไฟล์สื่อที่เลือกไม่ได้ กรุณาตรวจไฟล์แล้วเลือกใหม่');
    assert.equal(error.message.includes(dir),false);
    return true;
  });
  const deniedPath = join(dir,'private-denied.mp4');
  await assert.rejects(prepareSelectedMedia([deniedPath],{
    statFile:async () => ({isFile:() => true,size:123}),
    hashFile:async () => { throw new Error(`EACCES: permission denied, open '${deniedPath}'`); }
  }),error => {
    assert.equal(error.message,'อ่านไฟล์สื่อที่เลือกไม่ได้ กรุณาตรวจไฟล์แล้วเลือกใหม่');
    assert.equal(error.message.includes(deniedPath),false);
    return true;
  });
  assert.deepEqual(get().mediaForJob(job.id),before);
}));

test('existing text-only database upgrades without granting publish approval', () => {
  const dir = mkdtempSync(join(tmpdir(),'social-work-upgrade-test-'));
  const path = join(dir,'old.db');
  let old = new DatabaseSync(path);
  try {
    old.exec(`CREATE TABLE workspaces(id TEXT PRIMARY KEY,platform TEXT NOT NULL,name TEXT NOT NULL,created_at TEXT NOT NULL,updated_at TEXT NOT NULL);
      CREATE TABLE jobs(id TEXT PRIMARY KEY,workspace_id TEXT NOT NULL,instruction TEXT NOT NULL,status TEXT NOT NULL,draft TEXT NOT NULL,approval_text TEXT,approver TEXT,approved_at TEXT,result TEXT,error TEXT,created_at TEXT NOT NULL,updated_at TEXT NOT NULL);
      CREATE TABLE events(id TEXT PRIMARY KEY,job_id TEXT NOT NULL,kind TEXT NOT NULL,detail TEXT NOT NULL,created_at TEXT NOT NULL,actor TEXT,snapshot_text TEXT,content_sha256 TEXT);
      INSERT INTO workspaces VALUES('old-ws','youtube','Old channel','2026-01-01','2026-01-01');
      INSERT INTO jobs VALUES('old-job','old-ws','Caption','approved','Old text','Old text','Reviewer','2026-01-01',NULL,NULL,'2026-01-01','2026-01-01');`);
    old.close(); old = null;
    const upgraded = new Store(path);
    try {
      assert.equal(upgraded.job('old-job').approval_text,'Old text');
      assert.deepEqual(upgraded.mediaForJob('old-job'),[]);
      assert.throws(() => upgraded.reservePublication('old-job'),/ยังไม่ได้อนุมัติชุดเผยแพร่/);
      assert.equal(upgraded.publicationAttempt('old-job'),null);
    } finally { upgraded.close(); }
  } finally { old?.close(); rmSync(dir,{recursive:true,force:true}); }
});

test('text approval alone cannot reserve a YouTube publication or invoke a connector', () => withStore(async ({get}) => {
  const ws = get().createWorkspace('youtube','No media channel');
  const job = get().createJob(ws.id,'Caption');
  get().editDraft(job.id,'Text only'); get().submit(job.id); get().approve(job.id,'Reviewer');
  let calls = 0;
  const service = new PublishingService(get(),new Map([['youtube',{
    authorize:async () => { calls++; return {connected:true,workspaceId:ws.id,platform:'youtube',accountId:'account-1'}; },
    publish:async () => { calls++; return {remoteId:'remote-1'}; }, verify:async () => { calls++; return {confirmed:true,remoteId:'remote-1'}; }
  }]]));
  await assert.rejects(service.publish(job.id),/ยังไม่ได้อนุมัติชุดเผยแพร่/);
  assert.throws(() => get().approvePublicationManifest(job.id,{accountId:'account-1',privacy:'private',reviewer:'Reviewer'}),/ต้องเลือกวิดีโอหนึ่งไฟล์/);
  assert.equal(calls,0);
  assert.equal(get().publicationAttempt(job.id),null);
}));

test('complete approved media manifest is one-shot and requires matching authorized account and remote readback', () => withStore(async ({dir,get,reopen}) => {
  const path = join(dir,'clip.mp4'); writeFileSync(path,'synthetic approved video');
  const hash = await hashLocalMedia(path);
  const ws = get().createWorkspace('tiktok','Test channel');
  const job = get().createJob(ws.id,'Caption');
  get().editDraft(job.id,'Exact reviewed text');
  get().attachMedia(job.id,[{localPath:path,name:'clip.mp4',bytes:hash.bytes,sha256:hash.sha256,mimeType:'video/mp4'}]);
  get().submit(job.id); get().approve(job.id,'Text reviewer');
  assert.throws(() => get().approvePublicationManifest(job.id,{accountId:'',privacy:'private',reviewer:'Publish reviewer'}),/บัญชีปลายทาง/);
  get().approvePublicationManifest(job.id,{accountId:'account-1',privacy:'private',reviewer:'Publish reviewer'});
  assert.equal(get().events(job.id).items.find(event => event.kind === 'publication_manifest_approved').snapshot_text.includes(path),false);
  let publishCalls = 0, verifiedCalls = 0, seenKey;
  const adapter = {
    authorize:async () => ({connected:true,workspaceId:ws.id,platform:'tiktok',accountId:'wrong-account'}),
    publish:async ({manifest,idempotencyKey}) => { publishCalls++; seenKey=idempotencyKey; assert.equal(manifest.text,'Exact reviewed text'); assert.equal(manifest.media[0].sha256,hash.sha256); return {remoteId:'remote-1'}; },
    verify:async ({remoteId}) => { verifiedCalls++; return {confirmed:true,remoteId}; }
  };
  const service = new PublishingService(get(),new Map([['tiktok',adapter]]));
  await assert.rejects(service.publish(job.id),/สิทธิ์เผยแพร่/);
  assert.equal(get().publicationAttempt(job.id),null);
  adapter.authorize = async () => ({connected:true,workspaceId:ws.id,platform:'tiktok',accountId:'account-1'});
  writeFileSync(path,'changed after approval');
  await assert.rejects(service.publish(job.id),/ไฟล์สื่อเปลี่ยน/);
  assert.equal(get().publicationAttempt(job.id),null);
  writeFileSync(path,'synthetic approved video');
  const published = await service.publish(job.id);
  assert.equal(published.status,'published_verified');
  assert.equal(publishCalls,1); assert.equal(verifiedCalls,1);
  assert.match(seenKey,/^[a-f0-9-]{36}$/);
  const attempt = get().publicationAttempt(job.id);
  assert.equal(attempt.state,'verified'); assert.equal(attempt.idempotency_key,seenKey);
  assert.equal(JSON.parse(attempt.approved_manifest_json).accountId,'account-1');
  await assert.rejects(service.publish(job.id),/อนุมัติข้อความ/);
  reopen();
  assert.equal(get().publicationAttempt(job.id).state,'verified');
  assert.equal(get().job(job.id).status,'published_verified');
  assert.match(JSON.stringify(get().db.prepare("EXPLAIN QUERY PLAN SELECT job_id FROM publication_attempts WHERE state='in_flight' ORDER BY created_at,job_id LIMIT 24").all()),/publication_attempts_state/);
}));

test('ambiguous result and crash recovery never retry a reserved publication', () => withStore(async ({dir,get,reopen}) => {
  const path = join(dir,'clip.mp4'); writeFileSync(path,'synthetic video');
  const hash = await hashLocalMedia(path);
  const ws = get().createWorkspace('youtube','Crash channel');
  const makeApproved = label => {
    const job = get().createJob(ws.id,label);
    get().editDraft(job.id,'Review this clip');
    get().attachMedia(job.id,[{localPath:path,name:'clip.mp4',bytes:hash.bytes,sha256:hash.sha256,mimeType:'video/mp4'}]);
    get().submit(job.id); get().approve(job.id,'Text reviewer');
    get().approvePublicationManifest(job.id,{accountId:'account-1',privacy:'private',reviewer:'Publish reviewer'});
    return job;
  };
  const first = makeApproved('First');
  let calls = 0;
  const service = new PublishingService(get(),new Map([['youtube',{
    authorize:async () => ({connected:true,workspaceId:ws.id,platform:'youtube',accountId:'account-1'}),
    publish:async () => { calls++; throw new Error('network outcome unknown'); },
    verify:async () => { throw new Error('should not run'); }
  }]]));
  await assert.rejects(service.publish(first.id),/ผลการเผยแพร่ยังไม่แน่ชัด/);
  assert.equal(calls,1);
  assert.equal(get().publicationAttempt(first.id).state,'uncertain');
  assert.throws(() => get().editDraft(first.id,'changed'),/สถานะปัจจุบัน/);
  const second = makeApproved('Second');
  const key = get().reservePublication(second.id).idempotency_key;
  reopen();
  assert.equal(get().publicationAttempt(first.id).state,'uncertain');
  assert.equal(get().publicationAttempt(second.id).state,'uncertain');
  assert.equal(get().publicationAttempt(second.id).idempotency_key,key);
  assert.equal(get().job(second.id).status,'publication_uncertain');
  assert.throws(() => get().reservePublication(second.id),/อนุมัติข้อความ/);
}));
