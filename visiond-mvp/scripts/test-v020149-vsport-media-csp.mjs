import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {onRequest} from '../functions/_middleware.js';

const root=fileURLToPath(new URL('../',import.meta.url));
const policy=async pathname=>{
  const response=await onRequest({request:new Request(`https://visiond.test${pathname}`,{headers:{accept:'text/html'}}),next:async()=>new Response('<!doctype html><title>fixture</title>',{headers:{'content-type':'text/html; charset=utf-8'}})});
  return response.headers.get('content-security-policy');
};
const vsport=await policy('/vsport'),html=await policy('/vsport.html'),other=await policy('/');
assert.equal(vsport,html,'both V Sport entry paths have the same CSP');
assert.match(vsport,/; media-src 'self' blob:$/u,'only local video/media blob is added');
assert.equal(vsport.replace(/; media-src 'self' blob:$/u,''),other,'V Sport preserves every existing global CSP directive');
const browser='scripts/test-v020148-vsport-person-images-browser.mjs';
execFileSync(process.execPath,[browser],{cwd:root,stdio:'inherit',env:{...process.env,VSPORT_TEST_CSP:other,VSPORT_TEST_EXPECT_BLOCKED:'1'}});
execFileSync(process.execPath,[browser],{cwd:root,stdio:'inherit',env:{...process.env,VSPORT_TEST_CSP:vsport,VSPORT_TEST_EXPECT_BLOCKED:'0'}});
console.log('PASS v149 page-scoped CSP: old policy blocks local WebM, new policy exports ordered desktop/mobile video');
