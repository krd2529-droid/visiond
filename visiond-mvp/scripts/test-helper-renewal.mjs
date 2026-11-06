import {mkdtempSync,rmSync} from 'node:fs';
import {join,resolve,sep} from 'node:path';
import {execFileSync} from 'node:child_process';
const base=resolve('.'),work=mkdtempSync(join(base,'renew-test-'));
try{
 const exe=join(work,'HelperRenewalHarness.exe');
 execFileSync(join(process.env.WINDIR||'C:\\Windows','Microsoft.NET','Framework64','v4.0.30319','csc.exe'),['/nologo','/target:exe','/main:HelperRenewalHarness','/r:System.Security.dll','/r:System.Web.Extensions.dll','/r:System.Windows.Forms.dll','/r:System.Drawing.dll','/r:System.Management.dll','/out:'+exe,'tools\\browser-launcher\\Launcher.cs','tools\\browser-launcher\\Setup.cs','scripts\\fixtures\\HelperRenewalHarness.cs'],{stdio:'inherit'});
 console.log(execFileSync(exe,[work],{encoding:'utf8',timeout:10000}).trim());
}finally{if(!work.startsWith(base+sep))throw Error('unsafe fixture path');rmSync(work,{recursive:true,force:true})}
