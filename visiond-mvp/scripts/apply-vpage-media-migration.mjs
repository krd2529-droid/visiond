import {spawnSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';

const config=fileURLToPath(new URL('../services/vpage/wrangler.toml',import.meta.url));
const migration=fileURLToPath(new URL('../services/vpage/migrations/0006_vpage_media.sql',import.meta.url));
const wrangler=fileURLToPath(new URL('../node_modules/wrangler/bin/wrangler.js',import.meta.url));
const bucket='visiond-vpage-media';
const canonical=sql=>String(sql).replace(/\bIF NOT EXISTS\s+/gi,'').replace(/\s+/g,'').replace(/;$/,'').toLowerCase();

export function applyMigration(run){
  run(['--file',migration]);
  const expected=readFileSync(migration,'utf8').match(/CREATE (?:TABLE|INDEX)[\s\S]*?;|CREATE TRIGGER[\s\S]*?END;/g);
  for(const sql of expected){
    const name=sql.match(/^CREATE (?:TABLE|INDEX|TRIGGER) IF NOT EXISTS (\w+)/)[1];
    const rows=run(['--command',`SELECT sql FROM sqlite_master WHERE name='${name}' AND type IN ('table','index','trigger')`]);
    if(rows.length!==1||canonical(rows[0].sql)!==canonical(sql))throw new Error(`Vpage media schema verification failed: ${name}`);
  }
  console.log('Verified Vpage media migration 0006 tables, constraints, indexes and triggers');
}

export async function verifyBucket(get){
  const base=`/r2/buckets/${bucket}`;
  const info=await get(base);
  if(info?.name!==bucket)throw new Error('Exact Vpage media bucket missing');
  const managed=await get(`${base}/domains/managed`),custom=await get(`${base}/domains/custom`);
  if(managed?.enabled!==false||!Array.isArray(custom?.domains)||custom.domains.some(domain=>domain.enabled!==false))throw new Error('Vpage media bucket privacy verification failed');
  console.log('Verified exact private Vpage media bucket');
}

export function execute(args,spawn=spawnSync){
  const result=spawn(process.execPath,[wrangler,'d1','execute','vpage-db','--remote','--config',config,'--json',...args],{encoding:'utf8',maxBuffer:1024*1024});
  if(result.status!==0)throw new Error('Vpage media D1 operation failed');
  if(args[0]==='--file')return [];
  let payload;try{payload=JSON.parse(result.stdout)}catch{throw new Error('Vpage media D1 returned invalid JSON')}
  const rows=Array.isArray(payload)?payload:[payload];
  if(!rows.length||rows.some(row=>row.success!==true))throw new Error('Vpage media D1 rejected a statement');
  return rows.flatMap(row=>row.results||[]);
}

export async function cloudflare(path,{account=process.env.CLOUDFLARE_ACCOUNT_ID,token=process.env.CLOUDFLARE_API_TOKEN,fetcher=fetch}={}){
  if(!/^[a-f0-9]{32}$/.test(account||'')||!token)throw new Error('Isolated Vpage deployment credentials missing');
  let response;try{response=await fetcher(`https://api.cloudflare.com/client/v4/accounts/${account}${path}`,{headers:{authorization:`Bearer ${token}`},signal:AbortSignal.timeout(20000)})}catch{throw new Error('Vpage bucket verification network request failed')}
  if(!response.ok)throw new Error(`Vpage bucket verification failed (HTTP ${response.status})`);
  let body;try{body=await response.json()}catch{throw new Error('Vpage bucket verification returned invalid JSON')}
  if(body.success!==true)throw new Error('Vpage bucket API rejected verification');
  return body.result;
}

if(process.argv[1]===fileURLToPath(import.meta.url)){await verifyBucket(cloudflare);applyMigration(execute)}
