import assert from 'node:assert/strict';
import {readFileSync,mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync,spawn} from 'node:child_process';
import {createHash} from 'node:crypto';
const root='public/downloads/visiond-helper/0.20.76/',manifest=JSON.parse(readFileSync(root+'release.json')),sha=p=>createHash('sha256').update(readFileSync(p)).digest('hex');
for(const entry of [manifest.executable,manifest.source_archive])assert.equal(sha(root+entry.file),entry.sha256);
for(const entry of manifest.sources)assert.equal(sha(entry.file==='LICENSE'?'LICENSE':'tools/browser-launcher/'+entry.file),entry.sha256,'source archive provenance '+entry.file);
assert.ok(manifest.sources.some(s=>s.file==='LICENSE'));assert.equal(manifest.signature_status,'NotSigned');
const binary=readFileSync(root+manifest.executable.file),pe=binary.readUInt32LE(0x3c),optional=pe+24;assert.equal(binary.readUInt16LE(pe+4),0x8664,'actual PE machine x64');assert.equal(binary.readUInt16LE(optional),0x20b);assert.equal(binary.readUInt16LE(optional+68),2,'Windows GUI subsystem');assert.equal(binary.readUInt32LE(optional+112+32),0,'no Authenticode certificate');assert.ok(binary.length<25*1024*1024);
const headers=readFileSync('public/_headers','utf8');assert.match(headers,/VisionD-Helper-Setup\.exe\s+Content-Type: application\/octet-stream\s+Content-Disposition: attachment;/);assert.match(headers,/VisionD-Helper-Source\.zip\s+Content-Type: application\/zip\s+Content-Disposition: attachment;/);
const setup=readFileSync('tools/browser-launcher/Setup.cs','utf8');assert.match(setup,/PairExplicit\(\);status.Text=LocalHelper.PairStatus/);assert.doesNotMatch(setup,/Start\("--pair"\)/);
const self=setup.slice(setup.indexOf('if(String.Equals(source,Exe'),setup.indexOf('Directory.CreateDirectory(Root)'));assert.doesNotMatch(self,/File\.(Move|Copy|Delete)/,'installed-path branch never overwrites executing image');assert.match(setup,/if\(!String.Equals\(Process.GetCurrentProcess\(\).MainModule.FileName,Exe[\s\S]*File.Delete\(Exe\)/);
assert.match(self,/created=Start\("--serve"\);try\{Ready\(created\)/);assert.match(self,/finally\{if\(created!=null\)StopCreated\(created\);\}/,'repair failure stops only this attempt process');assert.match(setup,/stopped=HasOwnedService\(\);StopOwned\(\)/,'rollback captures actual prior running state');assert.match(setup,/if\(owned&&stopped&&File.Exists\(Exe\)\)Ready\(Start\("--serve"\)\)/);
const work=mkdtempSync(join(tmpdir(),'visiond-setup-safe-'));try{
 const altered=join(work,'Setup.cs'),exe=join(work,'SetupRegistryHarness.exe');
 // Only registry dependency is substituted; installer and GUI are never invoked.
 writeFileSync(altered,'using Registry=FakeRegistry;\n'+setup.replace('Global\\\\VisionDHelperSetup-','Local\\\\VisionDHelperSetup-Test-'+work.split(/[\\/]/).at(-1)+'-'));
 execFileSync(join(process.env.WINDIR||'C:\\Windows','Microsoft.NET','Framework64','v4.0.30319','csc.exe'),['/nologo','/target:exe','/main:SetupRegistryHarness','/r:System.Security.dll','/r:System.Web.Extensions.dll','/r:System.Windows.Forms.dll','/r:System.Drawing.dll','/r:System.Management.dll','/out:'+exe,'tools\\browser-launcher\\Launcher.cs',altered,'scripts\\fixtures\\SetupRegistryHarness.cs'],{stdio:'inherit'});
 console.log(execFileSync(exe,[],{encoding:'utf8',timeout:10000}).trim());
 const holding=spawn(exe,['hold'],{windowsHide:true,stdio:['pipe','pipe','pipe']});
 try{await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('lock harness timeout')),5000);holding.stdout.once('data',data=>{clearTimeout(timer);assert.match(String(data),/LOCKED/);resolve()});holding.once('error',reject)});assert.match(execFileSync(exe,['probe'],{encoding:'utf8',timeout:5000}),/BUSY/,'second setup process cannot enter mutation boundary');}finally{holding.stdin.end('\n');await new Promise(resolve=>holding.once('exit',resolve))}
 assert.match(execFileSync(exe,['probe'],{encoding:'utf8',timeout:5000}),/LOCKED/,'lock released for explicit retry');
 console.log('PASS actual cross-process setup mutex rejects concurrent entry and admits later retry (unique test mutex only)');
}finally{rmSync(work,{recursive:true,force:true})}
console.log('PASS frozen bytes/source hashes, MIT license inclusion, x64 GUI/unsigned PE, attachment headers and self-image branch contract');
