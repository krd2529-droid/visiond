import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {launcherCanonical,launcherMac} from '../functions/_browser_launcher_crypto.js';
import {sha256} from '../functions/_lib.js';
const work=mkdtempSync(join(tmpdir(),'visiond-native-http-')),exe=join(work,'TransportHarness.exe');
try{
 execFileSync(join(process.env.WINDIR||'C:\\Windows','Microsoft.NET','Framework64','v4.0.30319','csc.exe'),['/nologo','/target:exe','/main:LauncherTransportHarness','/r:System.Security.dll','/r:System.Web.Extensions.dll','/out:'+exe,'tools\\browser-launcher\\Launcher.cs','scripts\\fixtures\\LauncherTransportHarness.cs']);
 const output=execFileSync(exe,[join(work,'journals')],{encoding:'utf8',timeout:15000});
 const expected=await launcherMac('a'.repeat(64),launcherCanonical('claim','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',1,'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','b'.repeat(64),'2030-01-01 00:00:00',await sha256('')));
 assert.equal(output.match(/MAC=([a-f0-9]{64})/)?.[1],expected,'native/Workers HMAC canonical bytes match');
 console.log(output.replace(/^MAC=.*\r?\n/m,''));
}finally{rmSync(work,{recursive:true,force:true})}
