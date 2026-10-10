import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';

const workflowUrl=new URL('../../.github/workflows/deploy-vpage.yml',import.meta.url);
assert.ok(existsSync(workflowUrl),'missing Vpage-only GitHub Actions deployment workflow');
const workflow=readFileSync(workflowUrl,'utf8');

function scalar(value){const text=value.trim();if((text.startsWith("'")&&text.endsWith("'"))||(text.startsWith('"')&&text.endsWith('"')))return text.slice(1,-1);if(text==='true'||text==='false')return text==='true';if(/^\d+$/.test(text))return Number(text);if(text.startsWith('[')&&text.endsWith(']'))return text.slice(1,-1).split(',').map(item=>scalar(item));return text}
function parseYamlSubset(source){
  const lines=source.split(/\r?\n/),root={},stack=[{indent:-1,value:root}];
  const nextContent=start=>{for(let index=start;index<lines.length;index++){const text=lines[index].trim();if(text&&!text.startsWith('#'))return{text,indent:lines[index].match(/^ */)[0].length}}return null};
  for(let index=0;index<lines.length;index++){
    const raw=lines[index];if(!raw.trim()||raw.trim().startsWith('#'))continue;const indent=raw.match(/^ */)[0].length;assert.equal(indent%2,0,`invalid YAML indentation on line ${index+1}`);let text=raw.trim().replace(/\s+#\s.*$/,'');while(indent<=stack.at(-1).indent)stack.pop();const parent=stack.at(-1).value;
    if(text.startsWith('- ')){assert.ok(Array.isArray(parent),`YAML sequence without array parent on line ${index+1}`);const rest=text.slice(2),entry=rest.match(/^([^:]+):(.*)$/);if(!entry){parent.push(scalar(rest));continue}const object={},key=entry[1].trim(),tail=entry[2].trim();object[key]=tail?scalar(tail):{};parent.push(object);stack.push({indent,value:object});if(!tail)stack.push({indent:indent+1,value:object[key]});continue}
    const entry=text.match(/^([^:]+):(.*)$/);assert.ok(entry,`invalid YAML mapping on line ${index+1}`);const key=entry[1].trim(),tail=entry[2].trim();if(tail==='|'){const block=[];while(index+1<lines.length&&lines[index+1].match(/^ */)[0].length>indent)block.push(lines[++index].slice(indent+2));parent[key]=block.join('\n');continue}if(tail){parent[key]=scalar(tail);continue}const next=nextContent(index+1),child=next&&next.indent>indent&&next.text.startsWith('- ')?[]:{};parent[key]=child;stack.push({indent,value:child});
  }
  return root;
}

assert.doesNotMatch(workflow,/\t| +$/m,'workflow must use stable space indentation without trailing whitespace');
const parsed=parseYamlSubset(workflow),job=parsed.jobs['deploy-vpage'],steps=job.steps;
assert.match(steps[3].run,/node scripts\/test-vpage-media-migration\.mjs/);assert.match(steps[3].run,/node scripts\/test-vpage-owned-media\.mjs/);
assert.deepEqual(parsed.on.push.branches,['main']);
assert.deepEqual(parsed.on.push.paths,['.github/workflows/deploy-vpage.yml','visiond-mvp/package.json','visiond-mvp/package-lock.json','visiond-mvp/services/vpage/src/**','visiond-mvp/services/vpage/wrangler.toml','visiond-mvp/services/vpage/migrations/0006_vpage_media.sql','visiond-mvp/scripts/apply-vpage-media-migration.mjs']);
assert.deepEqual(parsed.on.workflow_dispatch,{});assert.equal(parsed.on.pull_request,undefined);assert.equal(parsed.on.pull_request_target,undefined);
const triggers=path=>parsed.on.push.paths.some(pattern=>pattern.endsWith('/**')?path.startsWith(pattern.slice(0,-2)):path===pattern);
for(const path of ['.github/workflows/deploy-vpage.yml','visiond-mvp/package.json','visiond-mvp/package-lock.json','visiond-mvp/services/vpage/src/index.js','visiond-mvp/services/vpage/wrangler.toml'])assert.equal(triggers(path),true,`${path} must trigger`);
for(const path of ['visiond-mvp/services/vpage/migrations/0004.sql','visiond-mvp/functions/_vpage-provisioning.js','visiond-mvp/public/vpage.js','visiond-mvp/services/tiktok-commission-collector/index.js','docs/vpage.md'])assert.equal(triggers(path),false,`${path} must not trigger`);
assert.deepEqual(parsed.permissions,{contents:'read'});assert.deepEqual(parsed.concurrency,{group:'vpage-production','cancel-in-progress':false});
assert.equal(job.if,"github.ref == 'refs/heads/main'");assert.equal(job['timeout-minutes'],15);assert.equal(job.defaults.run['working-directory'],'visiond-mvp');
const actionRefs=steps.filter(step=>step.uses).map(step=>step.uses);assert.deepEqual(actionRefs,['actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1','actions/setup-node@820762786026740c76f36085b0efc47a31fe5020']);for(const ref of actionRefs)assert.match(ref,/^actions\/(?:checkout|setup-node)@[a-f0-9]{40}$/);
assert.equal(steps[0].with['persist-credentials'],false);assert.equal(steps[1].with['node-version'],'22.20.0');assert.equal(steps[1].with['cache-dependency-path'],'visiond-mvp/package-lock.json');assert.equal(steps[2].run,'npm ci --ignore-scripts');
const dryRun='node_modules/.bin/wrangler deploy --dry-run --strict --config services/vpage/wrangler.toml',deploy='node_modules/.bin/wrangler deploy --strict --config services/vpage/wrangler.toml',dryIndex=steps.findIndex(step=>step.run===dryRun),deployIndex=steps.findIndex(step=>step.run===deploy);assert.ok(dryIndex>2&&deployIndex>dryIndex,'strict dry-run must precede the one production deploy');assert.equal(steps[dryIndex].env,undefined,'dry-run must not receive production secrets');
const migrateIndex=steps.findIndex(step=>step.run==='node scripts/apply-vpage-compensation-migration.mjs');assert.ok(migrateIndex>dryIndex&&migrateIndex<deployIndex,'compensation schema must precede Worker deploy');
const mediaIndex=steps.findIndex(step=>step.run==='node scripts/apply-vpage-media-migration.mjs');assert.ok(mediaIndex>migrateIndex&&mediaIndex<deployIndex,'private bucket and media schema must precede Worker deploy');
const envSteps=steps.filter(step=>step.env);assert.equal(envSteps.length,3);assert.deepEqual(envSteps,[steps[migrateIndex],steps[mediaIndex],steps[deployIndex]]);for(const step of envSteps)assert.deepEqual(step.env,{CLOUDFLARE_API_TOKEN:'${{ secrets.CLOUDFLARE_API_TOKEN }}',CLOUDFLARE_ACCOUNT_ID:'${{ secrets.CLOUDFLARE_ACCOUNT_ID }}'});assert.equal(job.env,undefined);assert.equal(parsed.env,undefined);
assert.match(steps[3].run,/node scripts\/test-v020163-vpage-multi-items\.mjs/);assert.match(steps[3].run,/node scripts\/test-v020163-vpage-multi-items-runtime\.mjs/);assert.match(steps[3].run,/node scripts\/test-v020162-vpage-editor-runtime\.mjs/);
assert.match(steps[3].run,/node scripts\/test-vpage-compensation-worker\.mjs/);assert.match(steps[3].run,/node scripts\/test-vpage-compensation-migration\.mjs/);
assert.doesNotMatch(workflow,/continue-on-error|wrangler d1|d1 execute|migrations apply|secret put|pages deploy|wrangler route|VPAGE_SHARED_SECRET|account_id\s*=|api[_-]?token\s*=|echo .*secret/i);for(const step of steps)assert.doesNotMatch(step.run||'',/\.sql\b/i,'SQL must run only through verified installers');assert.equal((workflow.match(/\$\{\{ secrets\./g)||[]).length,6,'only schema and deploy steps receive approved secrets');
console.log('PASS parsed Vpage workflow trigger fixtures, main ref guard, pinned supply chain, permissions, strict dry-run/deploy, concurrency and step-scoped secrets');
