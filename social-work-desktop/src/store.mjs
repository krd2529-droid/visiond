import { DatabaseSync } from 'node:sqlite';
import { randomUUID, createHash } from 'node:crypto';

const PLATFORMS = new Set(['youtube', 'tiktok', 'facebook_page']);
const TERMINAL = new Set(['prepared_locally', 'published_verified', 'publication_uncertain', 'cancelled']);
const pageSize = 24;
const now = () => new Date().toISOString();
const cursorOf = row => Buffer.from(JSON.stringify([row.created_at, row.id])).toString('base64url');
function parseCursor(value) {
  if (!value) return null;
  try {
    const pair = JSON.parse(Buffer.from(value, 'base64url').toString());
    if (Array.isArray(pair) && pair.length === 2 && pair.every(x => typeof x === 'string')) return pair;
  } catch { /* invalid cursor */ }
  throw new Error('ตัวชี้หน้าข้อมูลไม่ถูกต้อง');
}

export class Store {
  constructor(path) {
    this.db = new DatabaseSync(path);
    this.db.exec(`PRAGMA journal_mode=WAL;
      PRAGMA foreign_keys=ON;
      CREATE TABLE IF NOT EXISTS workspaces (
        id TEXT PRIMARY KEY, platform TEXT NOT NULL, name TEXT NOT NULL,
        created_at TEXT NOT NULL, updated_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS workspaces_page ON workspaces(created_at DESC,id DESC);
      CREATE TABLE IF NOT EXISTS jobs (
        id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL REFERENCES workspaces(id),
        instruction TEXT NOT NULL, status TEXT NOT NULL, draft TEXT NOT NULL DEFAULT '',
        approval_text TEXT, approver TEXT, approved_at TEXT, result TEXT,
        error TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS jobs_workspace_page ON jobs(workspace_id,created_at DESC,id DESC);
      CREATE INDEX IF NOT EXISTS jobs_page ON jobs(created_at DESC,id DESC);
      CREATE INDEX IF NOT EXISTS jobs_status_page ON jobs(status,created_at DESC,id DESC);
      CREATE INDEX IF NOT EXISTS jobs_workspace_status_page ON jobs(workspace_id,status,created_at DESC,id DESC);
      CREATE TABLE IF NOT EXISTS events (
        id TEXT PRIMARY KEY, job_id TEXT NOT NULL REFERENCES jobs(id),
        kind TEXT NOT NULL, detail TEXT NOT NULL, created_at TEXT NOT NULL,
        actor TEXT, snapshot_text TEXT, content_sha256 TEXT
      );
      CREATE INDEX IF NOT EXISTS events_job_page ON events(job_id,created_at DESC,id DESC);
      CREATE TABLE IF NOT EXISTS job_media (
        job_id TEXT NOT NULL REFERENCES jobs(id), position INTEGER NOT NULL,
        local_path TEXT NOT NULL, display_name TEXT NOT NULL, bytes INTEGER NOT NULL,
        sha256 TEXT NOT NULL, mime_type TEXT NOT NULL,
        PRIMARY KEY(job_id,position)
      );
      CREATE TABLE IF NOT EXISTS publication_approvals (
        job_id TEXT PRIMARY KEY REFERENCES jobs(id), manifest_json TEXT NOT NULL,
        manifest_sha256 TEXT NOT NULL, reviewer TEXT NOT NULL, approved_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS publication_attempts (
        job_id TEXT PRIMARY KEY REFERENCES jobs(id), idempotency_key TEXT NOT NULL UNIQUE,
        platform TEXT NOT NULL, workspace_id TEXT NOT NULL, approved_manifest_json TEXT NOT NULL,
        approved_manifest_sha256 TEXT NOT NULL, state TEXT NOT NULL,
        remote_id TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS publication_attempts_state ON publication_attempts(state,created_at,job_id);`);
    const eventColumns = new Set(this.db.prepare('PRAGMA table_info(events)').all().map(column => column.name));
    for (const [column,type] of [['actor','TEXT'],['snapshot_text','TEXT'],['content_sha256','TEXT']]) {
      if (!eventColumns.has(column)) this.db.exec(`ALTER TABLE events ADD COLUMN ${column} ${type}`);
    }
    // A lost process must never resume an in-flight operation automatically.
    for (const job of this.db.prepare("SELECT id FROM jobs WHERE status IN ('generating','executing')").all()) {
      this.transition(job.id, ['generating', 'executing'], 'failed', { error: 'งานหยุดเมื่อปิดแอป กรุณาตรวจและเริ่มใหม่ด้วยตนเอง' }, 'interrupted');
    }
    // A request may have reached a platform before a crash. Never retry it automatically.
    while (true) {
      const pending = this.db.prepare("SELECT job_id FROM publication_attempts WHERE state='in_flight' ORDER BY created_at,job_id LIMIT 24").all();
      if (!pending.length) break;
      for (const attempt of pending) this.markPublicationUncertain(attempt.job_id);
    }
  }
  close() { this.db.close(); }
  createWorkspace(platform, name) {
    if (!PLATFORMS.has(platform)) throw new Error('ไม่รองรับแพลตฟอร์มนี้');
    name = String(name || '').trim();
    if (!name || name.length > 100) throw new Error('กรุณาใส่ชื่อพื้นที่ช่อง ไม่เกิน 100 ตัวอักษร');
    const id = randomUUID(), at = now();
    this.db.prepare('INSERT INTO workspaces VALUES (?,?,?,?,?)').run(id, platform, name, at, at);
    return this.workspace(id);
  }
  workspace(id) { return this.db.prepare('SELECT * FROM workspaces WHERE id=?').get(id) || null; }
  listWorkspaces(cursor) {
    const c = parseCursor(cursor);
    const rows = c ? this.db.prepare('SELECT * FROM workspaces WHERE (created_at,id)<(?,?) ORDER BY created_at DESC,id DESC LIMIT ?').all(...c, pageSize + 1)
      : this.db.prepare('SELECT * FROM workspaces ORDER BY created_at DESC,id DESC LIMIT ?').all(pageSize + 1);
    return { items: rows.slice(0,pageSize), nextCursor: rows.length > pageSize ? cursorOf(rows[pageSize-1]) : null };
  }
  createJob(workspaceId, instruction) {
    if (!this.workspace(workspaceId)) throw new Error('ไม่พบพื้นที่ช่อง');
    instruction = String(instruction || '').trim();
    if (!instruction || instruction.length > 5000) throw new Error('กรุณาใส่คำสั่ง ไม่เกิน 5,000 ตัวอักษร');
    const id = randomUUID(), at = now();
    this.db.exec('BEGIN IMMEDIATE');
    try {
      this.db.prepare('INSERT INTO jobs(id,workspace_id,instruction,status,created_at,updated_at) VALUES (?,?,?,?,?,?)').run(id, workspaceId, instruction, 'draft', at, at);
      this.event(id, 'created', 'สร้างงานร่าง');
      this.db.exec('COMMIT');
    } catch (error) { this.db.exec('ROLLBACK'); throw error; }
    return this.job(id);
  }
  job(id) { return this.db.prepare('SELECT * FROM jobs WHERE id=?').get(id) || null; }
  mediaForJob(id) { return this.db.prepare('SELECT position,display_name,bytes,sha256,mime_type FROM job_media WHERE job_id=? ORDER BY position').all(id); }
  mediaForPublication(id) { return this.db.prepare('SELECT position,local_path,display_name,bytes,sha256,mime_type FROM job_media WHERE job_id=? ORDER BY position').all(id); }
  attachMedia(id, files) {
    if (!Array.isArray(files) || files.length > 10) throw new Error('เลือกได้ไม่เกิน 10 ไฟล์ต่อหนึ่งงาน');
    for (const file of files) {
      if (!file || typeof file.localPath !== 'string' || !file.localPath || typeof file.name !== 'string' || !file.name || !Number.isSafeInteger(file.bytes) || file.bytes <= 0 || !/^[a-f0-9]{64}$/.test(file.sha256) || typeof file.mimeType !== 'string' || !file.mimeType) throw new Error('ข้อมูลไฟล์สื่อไม่ถูกต้อง');
    }
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const job = this.job(id);
      if (!job || !['draft','awaiting_approval','approved','failed'].includes(job.status)) throw new Error('เปลี่ยนไฟล์ในสถานะนี้ไม่ได้');
      const workspace = this.workspace(job.workspace_id);
      if (['youtube','tiktok'].includes(workspace?.platform) && (files.length > 1 || files.some(file => !file.mimeType.startsWith('video/')))) throw new Error('พื้นที่ YouTube/TikTok เลือกวิดีโอได้ครั้งละหนึ่งไฟล์');
      this.db.prepare('DELETE FROM job_media WHERE job_id=?').run(id);
      files.forEach((file,index) => this.db.prepare('INSERT INTO job_media VALUES (?,?,?,?,?,?,?)').run(id,index,file.localPath,file.name,file.bytes,file.sha256,file.mimeType));
      this.db.prepare('DELETE FROM publication_approvals WHERE job_id=?').run(id);
      this.db.prepare("UPDATE jobs SET status='draft',approval_text=NULL,approver=NULL,approved_at=NULL,result=NULL,error=NULL,updated_at=? WHERE id=?").run(now(),id);
      this.event(id,'media_changed_approval_reset','เลือกไฟล์สื่อใหม่และล้างการอนุมัติเดิม');
      this.db.exec('COMMIT');
      return this.job(id);
    } catch (error) { this.db.exec('ROLLBACK'); throw error; }
  }
  listJobs({ workspaceId, status, cursor } = {}) {
    const c = parseCursor(cursor);
    const where = [], args = [];
    if (workspaceId) { where.push('workspace_id=?'); args.push(workspaceId); }
    if (status) { where.push('status=?'); args.push(status); }
    if (c) { where.push('(created_at,id)<(?,?)'); args.push(...c); }
    const sql = `SELECT * FROM jobs ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY created_at DESC,id DESC LIMIT ?`;
    const rows = this.db.prepare(sql).all(...args, pageSize + 1);
    return { items: rows.slice(0,pageSize), nextCursor: rows.length > pageSize ? cursorOf(rows[pageSize-1]) : null };
  }
  events(jobId, cursor) {
    if (!this.job(jobId)) throw new Error('ไม่พบงาน');
    const c = parseCursor(cursor);
    const rows = c ? this.db.prepare('SELECT * FROM events WHERE job_id=? AND (created_at,id)<(?,?) ORDER BY created_at DESC,id DESC LIMIT ?').all(jobId,...c,pageSize+1)
      : this.db.prepare('SELECT * FROM events WHERE job_id=? ORDER BY created_at DESC,id DESC LIMIT ?').all(jobId,pageSize+1);
    return { items: rows.slice(0,pageSize), nextCursor: rows.length > pageSize ? cursorOf(rows[pageSize-1]) : null };
  }
  event(jobId, kind, detail, audit = {}) {
    this.db.prepare('INSERT INTO events(id,job_id,kind,detail,created_at,actor,snapshot_text,content_sha256) VALUES (?,?,?,?,?,?,?,?)')
      .run(randomUUID(),jobId,kind,detail,now(),audit.actor || null,audit.snapshot || null,
        audit.snapshot ? createHash('sha256').update(audit.snapshot).digest('hex') : null);
  }
  transition(id, allowed, status, patch = {}, kind = status, audit = {}) {
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const prior = this.job(id);
      if (!prior) throw new Error('ไม่พบงาน');
      if (!allowed.includes(prior.status)) throw new Error('ทำรายการนี้ไม่ได้ในสถานะปัจจุบัน กรุณาเปิดงานใหม่อีกครั้ง');
      const keys = Object.keys(patch);
      const sql = `UPDATE jobs SET status=?, updated_at=?${keys.map(k => `, ${k}=?`).join('')} WHERE id=? AND status=?`;
      this.db.prepare(sql).run(status,now(),...keys.map(k => patch[k]),id,prior.status);
      if (kind === 'edited_approval_reset') this.db.prepare('DELETE FROM publication_approvals WHERE job_id=?').run(id);
      this.event(id,kind,`${prior.status} → ${status}`,audit);
      this.db.exec('COMMIT');
      return this.job(id);
    } catch (error) { this.db.exec('ROLLBACK'); throw error; }
  }
  startGeneration(id) { return this.transition(id,['draft','failed'],'generating',{ error:null },'generation_started'); }
  completeGeneration(id,text) {
    text = String(text || '').trim();
    if (!text) throw new Error('AI ไม่ส่งเนื้อหาร่างกลับมา');
    return this.transition(id,['generating'],'awaiting_approval',{draft:text,approval_text:null,approver:null,approved_at:null,error:null},'draft_ready');
  }
  fail(id,error) { return this.transition(id,['generating','executing'],'failed',{error:String(error).slice(0,400)},'failed'); }
  editDraft(id,text) {
    text = String(text || '').trim();
    if (!text || text.length > 30000) throw new Error('เนื้อหาต้องมี 1–30,000 ตัวอักษร');
    return this.transition(id,['draft','awaiting_approval','approved','failed'],'draft',{draft:text,approval_text:null,approver:null,approved_at:null,result:null,error:null},'edited_approval_reset');
  }
  submit(id) {
    const job = this.job(id);
    if (!job?.draft?.trim()) throw new Error('กรุณาให้ AI ร่างหรือเขียนเนื้อหาก่อน');
    return this.transition(id,['draft'],'awaiting_approval',{},'submitted_for_review');
  }
  approve(id,approver) {
    approver = String(approver || '').trim();
    if (!approver || approver.length > 100) throw new Error('กรุณาใส่ชื่อผู้อนุมัติ ไม่เกิน 100 ตัวอักษร');
    const job = this.job(id);
    if (!job?.draft?.trim()) throw new Error('ไม่มีเนื้อหาให้อนุมัติ');
    return this.transition(id,['awaiting_approval'],'approved',{approval_text:job.draft,approver,approved_at:now()},'approved_exact_content',{actor:approver,snapshot:job.draft});
  }
  // Internal-only future seam: not exposed through IPC until OAuth target/privacy review exists.
  approvePublicationManifest(id, { accountId, privacy, reviewer }) {
    const job = this.job(id), workspace = job && this.workspace(job.workspace_id);
    accountId = String(accountId || '').trim(); privacy = String(privacy || '').trim(); reviewer = String(reviewer || '').trim();
    if (!job || !workspace || !['approved','prepared_locally'].includes(job.status) || !job.approval_text || job.approval_text !== job.draft || !job.approved_at) throw new Error('ต้องอนุมัติข้อความฉบับปัจจุบันก่อน');
    if (!accountId || accountId.length > 200 || !privacy || privacy.length > 100 || !reviewer || reviewer.length > 100) throw new Error('ต้องระบุบัญชีปลายทาง ความเป็นส่วนตัว และผู้อนุมัติ');
    const media = this.mediaForPublication(id);
    if (['youtube','tiktok'].includes(workspace.platform) && (media.length !== 1 || !media[0].mime_type.startsWith('video/'))) throw new Error('แพลตฟอร์มนี้ต้องเลือกวิดีโอหนึ่งไฟล์ก่อนอนุมัติเผยแพร่');
    const manifest = { jobId:id, workspaceId:workspace.id, platform:workspace.platform, text:job.approval_text,
      textApprovedAt:job.approved_at, accountId, privacy,
      media:media.map(file => ({ localPath:file.local_path,name:file.display_name,bytes:file.bytes,sha256:file.sha256,mimeType:file.mime_type })) };
    const json = JSON.stringify(manifest), hash = createHash('sha256').update(json).digest('hex'), at = now();
    const visibleSnapshot = JSON.stringify({ ...manifest, media:manifest.media.map(({localPath,...file}) => file) });
    this.db.exec('BEGIN IMMEDIATE');
    try {
      if (this.db.prepare('SELECT 1 FROM publication_approvals WHERE job_id=?').get(id)) throw new Error('งานนี้มีการอนุมัติเผยแพร่แล้ว');
      this.db.prepare('INSERT INTO publication_approvals VALUES (?,?,?,?,?)').run(id,json,hash,reviewer,at);
      this.event(id,'publication_manifest_approved','อนุมัติชุดข้อความ สื่อ บัญชี และความเป็นส่วนตัว',{actor:reviewer,snapshot:visibleSnapshot});
      this.db.exec('COMMIT');
      return { manifestSha256:hash, approvedAt:at };
    } catch (error) { this.db.exec('ROLLBACK'); throw error; }
  }
  publicationCandidate(id) {
    const job = this.job(id);
    if (!job || !['approved','prepared_locally'].includes(job.status) || !job.approver || !job.approved_at || !job.approval_text || job.approval_text !== job.draft) {
      throw new Error('ต้องอนุมัติข้อความฉบับปัจจุบันก่อนเผยแพร่');
    }
    const workspace = this.workspace(job.workspace_id);
    if (!workspace) throw new Error('ไม่พบพื้นที่ช่อง');
    const approval = this.db.prepare('SELECT * FROM publication_approvals WHERE job_id=?').get(id);
    if (!approval) throw new Error('ยังไม่ได้อนุมัติชุดเผยแพร่ที่รวมสื่อ บัญชี และความเป็นส่วนตัว');
    const manifest = JSON.parse(approval.manifest_json);
    const media = this.mediaForPublication(id);
    if (createHash('sha256').update(approval.manifest_json).digest('hex') !== approval.manifest_sha256 ||
        manifest.jobId !== id || manifest.workspaceId !== workspace.id || manifest.platform !== workspace.platform ||
        manifest.text !== job.approval_text || manifest.textApprovedAt !== job.approved_at ||
        !manifest.accountId || !manifest.privacy || !Array.isArray(manifest.media) ||
        (['youtube','tiktok'].includes(workspace.platform) && (manifest.media.length !== 1 || !manifest.media[0].mimeType.startsWith('video/'))) ||
        JSON.stringify(manifest.media) !== JSON.stringify(media.map(file => ({ localPath:file.local_path,name:file.display_name,bytes:file.bytes,sha256:file.sha256,mimeType:file.mime_type })))) {
      throw new Error('ชุดเผยแพร่ที่อนุมัติไม่ตรงกับงานปัจจุบัน');
    }
    return { job, workspace, manifest, approval };
  }
  publicationAttempt(id) { return this.db.prepare('SELECT * FROM publication_attempts WHERE job_id=?').get(id) || null; }
  reservePublication(id) {
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const { job, workspace, approval } = this.publicationCandidate(id);
      if (this.publicationAttempt(id)) throw new Error('งานนี้เคยเริ่มเผยแพร่แล้ว ห้ามส่งซ้ำอัตโนมัติ');
      const at = now(), key = randomUUID();
      this.db.prepare('INSERT INTO publication_attempts(job_id,idempotency_key,platform,workspace_id,approved_manifest_json,approved_manifest_sha256,state,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?)')
        .run(id,key,workspace.platform,workspace.id,approval.manifest_json,approval.manifest_sha256,'in_flight',at,at);
      this.db.prepare("UPDATE jobs SET status='publishing',result=NULL,error=NULL,updated_at=? WHERE id=?").run(at,id);
      const approvedManifest = JSON.parse(approval.manifest_json);
      const visibleSnapshot = JSON.stringify({ ...approvedManifest, media:approvedManifest.media.map(({localPath,...file}) => file) });
      this.event(id,'publication_reserved','บันทึกคำขอเผยแพร่หนึ่งครั้งก่อนเรียกแพลตฟอร์ม',{actor:approval.reviewer,snapshot:visibleSnapshot});
      this.db.exec('COMMIT');
      return this.publicationAttempt(id);
    } catch (error) { this.db.exec('ROLLBACK'); throw error; }
  }
  confirmPublication(id, remoteId) {
    remoteId = String(remoteId || '').trim();
    if (!remoteId || remoteId.length > 500) throw new Error('รหัสโพสต์จากแพลตฟอร์มไม่ถูกต้อง');
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const attempt = this.publicationAttempt(id), job = this.job(id);
      if (!attempt || attempt.state !== 'in_flight' || job?.status !== 'publishing') throw new Error('ไม่มีคำขอเผยแพร่ที่รอยืนยัน');
      const at = now();
      this.db.prepare("UPDATE publication_attempts SET state='verified',remote_id=?,updated_at=? WHERE job_id=?").run(remoteId,at,id);
      this.db.prepare("UPDATE jobs SET status='published_verified',result=?,error=NULL,updated_at=? WHERE id=?")
        .run(`ยืนยันการเผยแพร่จากแพลตฟอร์มแล้ว · รหัส ${remoteId}`,at,id);
      this.event(id,'publication_verified','ยืนยันผลจากแพลตฟอร์มแล้ว');
      this.db.exec('COMMIT');
      return this.job(id);
    } catch (error) { this.db.exec('ROLLBACK'); throw error; }
  }
  markPublicationUncertain(id) {
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const attempt = this.publicationAttempt(id), job = this.job(id);
      if (!attempt || attempt.state !== 'in_flight' || job?.status !== 'publishing') throw new Error('ไม่มีคำขอเผยแพร่ที่รอยืนยัน');
      const at = now();
      this.db.prepare("UPDATE publication_attempts SET state='uncertain',updated_at=? WHERE job_id=?").run(at,id);
      this.db.prepare("UPDATE jobs SET status='publication_uncertain',result=?,error=NULL,updated_at=? WHERE id=?")
        .run('ไม่สามารถยืนยันผลการเผยแพร่ได้ ห้ามส่งซ้ำจนกว่าจะตรวจสถานะบนแพลตฟอร์มด้วยตนเอง',at,id);
      this.event(id,'publication_uncertain','ผลไม่แน่ชัดและปิดการส่งซ้ำอัตโนมัติ');
      this.db.exec('COMMIT');
      return this.job(id);
    } catch (error) { this.db.exec('ROLLBACK'); throw error; }
  }
  execute(id) {
    const job = this.job(id);
    if (!job || job.status !== 'approved' || !job.approval_text || job.approval_text !== job.draft) throw new Error('ต้องอนุมัติข้อความฉบับปัจจุบันก่อน');
    this.transition(id,['approved'],'executing',{},'local_execution_started');
    return this.transition(id,['executing'],'prepared_locally',{result:'บันทึกข้อความที่อนุมัติเป็นแพ็กงานในเครื่องแล้ว ยังไม่ได้โพสต์หรือตั้งเวลาเผยแพร่'},'local_result_saved');
  }
  cancel(id) {
    const job = this.job(id);
    if (!job || TERMINAL.has(job.status) || job.status === 'executing') throw new Error('ยกเลิกงานในสถานะนี้ไม่ได้');
    return this.transition(id,['draft','awaiting_approval','approved','failed'],'cancelled',{},'cancelled');
  }
  summary() {
    return this.db.prepare("SELECT status, COUNT(*) AS count FROM jobs GROUP BY status").all();
  }
  explain(filters = {}) {
    const where = [], args = [];
    if (filters.workspaceId) { where.push('workspace_id=?'); args.push(filters.workspaceId); }
    if (filters.status) { where.push('status=?'); args.push(filters.status); }
    return this.db.prepare(`EXPLAIN QUERY PLAN SELECT * FROM jobs ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY created_at DESC,id DESC LIMIT 24`).all(...args);
  }
}
