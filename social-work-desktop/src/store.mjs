import { DatabaseSync } from 'node:sqlite';
import { randomUUID, createHash } from 'node:crypto';

const PLATFORMS = new Set(['youtube', 'tiktok', 'facebook_page']);
const TERMINAL = new Set(['prepared_locally', 'cancelled']);
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
      CREATE INDEX IF NOT EXISTS events_job_page ON events(job_id,created_at DESC,id DESC);`);
    const eventColumns = new Set(this.db.prepare('PRAGMA table_info(events)').all().map(column => column.name));
    for (const [column,type] of [['actor','TEXT'],['snapshot_text','TEXT'],['content_sha256','TEXT']]) {
      if (!eventColumns.has(column)) this.db.exec(`ALTER TABLE events ADD COLUMN ${column} ${type}`);
    }
    // A lost process must never resume an in-flight operation automatically.
    for (const job of this.db.prepare("SELECT id FROM jobs WHERE status IN ('generating','executing')").all()) {
      this.transition(job.id, ['generating', 'executing'], 'failed', { error: 'งานหยุดเมื่อปิดแอป กรุณาตรวจและเริ่มใหม่ด้วยตนเอง' }, 'interrupted');
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
