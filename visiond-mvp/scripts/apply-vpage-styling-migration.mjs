import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const config=fileURLToPath(new URL('../services/vpage/wrangler.toml',import.meta.url));
const migration=fileURLToPath(new URL('../services/vpage/migrations/0004_vpage_styling.sql',import.meta.url));
const wrangler=fileURLToPath(new URL('../node_modules/wrangler/bin/wrangler.js',import.meta.url));
const expected=new Set(['background_color','text_font','text_color']);

function execute(args){
  const run=spawnSync(process.execPath,[wrangler,'d1','execute','vpage-db','--remote','--config',config,'--json',...args],{encoding:'utf8',maxBuffer:1024*1024});
  if(run.status!==0)throw new Error(`Vpage D1 command failed (${run.status}): ${run.stderr.trim()}`);
  let result;
  try{result=JSON.parse(run.stdout)}catch{throw new Error('Vpage D1 did not return valid JSON')}
  const rows=Array.isArray(result)?result:[result];
  if(rows.some(row=>row.success!==true))throw new Error('Vpage D1 reported an unsuccessful statement');
  return rows.flatMap(row=>row.results||[]);
}

function columns(run){
  const rows=run(['--command','PRAGMA table_info(vpage_content_sets)']);
  if(!rows.length)throw new Error('Vpage content table is missing or inaccessible');
  return new Set(rows.map(row=>String(row.name)));
}

export function applyMigration(run){
  const before=columns(run);
  const present=[...expected].filter(name=>before.has(name));
  if(present.length>0&&present.length<expected.size)throw new Error(`Partial Vpage styling schema: ${present.join(', ')}`);
  if(!present.length){
    run(['--file',migration]);
    console.log('Applied Vpage styling migration 0004');
  }else console.log('Vpage styling migration already present');
  const after=columns(run);
  if([...expected].some(name=>!after.has(name)))throw new Error('Vpage styling schema verification failed');
  console.log('Verified Vpage styling columns');
}

if(process.argv[1]===fileURLToPath(import.meta.url))applyMigration(execute);
