import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const config=fileURLToPath(new URL('../services/vpage/wrangler.toml',import.meta.url));
const migration=fileURLToPath(new URL('../services/vpage/migrations/0005_vpage_compensation.sql',import.meta.url));
const wrangler=fileURLToPath(new URL('../node_modules/wrangler/bin/wrangler.js',import.meta.url));
const receiptColumns=['idempotency_key','page_id','owner_ref','actor_ref','days','before_expires_at','after_expires_at','created_at'];

function execute(args){
  const run=spawnSync(process.execPath,[wrangler,'d1','execute','vpage-db','--remote','--config',config,'--json',...args],{encoding:'utf8',maxBuffer:1024*1024});
  if(run.status!==0)throw new Error(`Vpage compensation D1 operation failed (exit ${run.status})`);
  if(args[0]==='--file')return [];
  let payload;try{payload=JSON.parse(run.stdout)}catch{throw new Error('Vpage compensation D1 returned invalid JSON')}
  const result=Array.isArray(payload)?payload:[payload];if(result.some(row=>row.success!==true))throw new Error('Vpage compensation D1 rejected a statement');
  return result.flatMap(row=>row.results||[]);
}

export function applyMigration(run){
  run(['--file',migration]);console.log('Applied or verified Vpage compensation migration 0005');
  const columns=new Set(run(['--command','PRAGMA table_info(vpage_compensation_requests)']).map(row=>String(row.name)));
  const guards=new Set(run(['--command','PRAGMA table_info(vpage_compensation_guards)']).map(row=>String(row.name)));
  const indexes=new Set(run(['--command','PRAGMA index_list(vpage_compensation_requests)']).map(row=>String(row.name)));
  if(receiptColumns.some(name=>!columns.has(name))||!guards.has('token')||!indexes.has('idx_vpage_compensation_page'))throw new Error('Vpage compensation schema verification failed');
  console.log('Verified Vpage compensation schema and index');
}

if(process.argv[1]===fileURLToPath(import.meta.url))applyMigration(execute);
