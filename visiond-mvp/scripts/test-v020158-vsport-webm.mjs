import assert from 'node:assert/strict';
import {createHash,randomBytes} from 'node:crypto';
import {withFiniteWebmDuration} from '../public/vsport-webm.js';
import {isSilentVideoWebm} from '../functions/_vsport-video.js';

// Exact prefix of the 12-second noisy-canvas MediaRecorder WebM from Chrome.
const prefix=Buffer.from('1a45dfa39f4286810142f7810142f2810442f381084282847765626d42878104428581021853806701ffffffffffffff1549a966992ad7b1830f42404d80864368726f6d655741864368726f6d651654ae6bbeaebcd7810173c5877dcfc279b79cbb83810155ee81018685565f565039e09fb0820500ba8202d053c0810155b09055b1810155b9810255ba810d55bb81011f43b67501ffffffffffffffe78100','hex');
const cluster=prefix.indexOf(Buffer.from('1f43b675','hex'));assert.ok(cluster>0);
const body=randomBytes(9*1024*1024),raw=new Blob([prefix,body],{type:'video/webm'});
const originalArrayBuffer=Blob.prototype.arrayBuffer,reads=[];
Blob.prototype.arrayBuffer=async function(){reads.push(this.size);return originalArrayBuffer.call(this)};
let fixed;
try{fixed=await withFiniteWebmDuration(raw,12.024)}finally{Blob.prototype.arrayBuffer=originalArrayBuffer}
assert.deepEqual(reads,[65536],'metadata inspection must never buffer the full 9 MiB body');
assert.equal(fixed.size,raw.size+11);assert.equal(isSilentVideoWebm(new Uint8Array(await fixed.slice(0,65536).arrayBuffer())),true);
const header=new Uint8Array(await fixed.slice(0,cluster+32).arrayBuffer()),durationId=header.findIndex((byte,index)=>byte===0x44&&header[index+1]===0x89&&header[index+2]===0x88);
assert.ok(durationId>0,'Info/Duration inserted before Cluster');assert.ok(Math.abs(new DataView(header.buffer).getFloat64(durationId+3,false)-12024)<0.0001);
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
assert.equal(sha(Buffer.from(await raw.slice(cluster).arrayBuffer())),sha(Buffer.from(await fixed.slice(cluster+11).arrayBuffer())),'all Cluster/body bytes must be exact after 8 MiB multipart boundary');
const repeated=await withFiniteWebmDuration(fixed,12.024);assert.equal(repeated.size,fixed.size,'already tagged Info must not grow again');
const seekHead=Buffer.from('114d9b7480','hex'),unsafe=new Blob([prefix.subarray(0,cluster),seekHead,prefix.subarray(cluster),body],{type:'video/webm'});
await assert.rejects(()=>withFiniteWebmDuration(unsafe,12),/WEBM_DURATION_HEADER_UNSUPPORTED/);
await assert.rejects(()=>withFiniteWebmDuration(new Blob([new Uint8Array(512)],{type:'video/webm'}),12),/WEBM_DURATION_HEADER_UNSUPPORTED/);
console.log('PASS v0.20.158 bounded WebM Duration header, exact >8 MiB body/chunk integrity, idempotence and unsafe-header rejection');
