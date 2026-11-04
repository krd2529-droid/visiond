import {execFileSync} from 'node:child_process';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const dir=mkdtempSync(join(tmpdir(),'visiond-pair-intent-'));
try{
 const exe=join(dir,'PairIntentUriHarness.exe'),compiler=join(process.env.WINDIR||'C:\\Windows','Microsoft.NET','Framework64','v4.0.30319','csc.exe');
 execFileSync(compiler,['/nologo','/target:exe','/main:PairIntentUriHarness','/r:System.Security.dll','/r:System.Web.Extensions.dll','/r:System.Windows.Forms.dll','/r:System.Drawing.dll','/r:System.Management.dll','/out:'+exe,'tools\\browser-launcher\\Launcher.cs','tools\\browser-launcher\\Setup.cs','scripts\\fixtures\\PairIntentUriHarness.cs'],{stdio:'inherit'});
 console.log(execFileSync(exe,[],{encoding:'utf8',timeout:10000}).trim());
}finally{rmSync(dir,{recursive:true,force:true})}
