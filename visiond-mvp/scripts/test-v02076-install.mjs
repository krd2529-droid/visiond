import assert from 'node:assert/strict';import{mkdtempSync,readFileSync,writeFileSync,rmSync}from'node:fs';import{tmpdir}from'node:os';import{join}from'node:path';import{execFileSync}from'node:child_process';
const work=mkdtempSync(join(tmpdir(),'visiond-install-isolated-')),literal='@"'+work.replaceAll('"','""')+'"';
try{
 let native=readFileSync('tools/browser-launcher/Launcher.cs','utf8').replaceAll('Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData)',literal).replace('Local\\\\VisionDLauncher-','Local\\\\VisionDLauncher-Test-'+work.split(/[\\/]/).at(-1)+'-');
 let setup='using Registry=FakeRegistry;\n'+readFileSync('tools/browser-launcher/Setup.cs','utf8').replaceAll('Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData)',literal);
 setup=setup.replace(/private static void NotifyRegistry\(\)\{[^\n]+\}/,'private static void NotifyRegistry(){}');
 setup=setup.replace(/private static bool HasOwnedService\(\)\{[^\n]+\}/,'private static bool HasOwnedService(){return OrphanInstallHarness.HasService();}');
 setup=setup.replace(/private static void StopOwned\(\)\{[\s\S]*?\n  \}\n  private static Process Start/,'private static void StopOwned(){OrphanInstallHarness.StopService();}\n  private static Process Start');
 setup=setup.replace(/private static Process Start\(string argument\)\{return (Process.Start\([^\n]+)\}\r?\n/,'private static Process Start(string argument){var process=$1OrphanInstallHarness.Track(process,argument);return process;}\n');
 setup=setup.replace(/(WriteSetting\(undo,UninstallKey,"DisplayName"[^\n]+\n)/,'$1   OrphanInstallHarness.AfterRegistration();\n');
 assert.match(setup,/OrphanInstallHarness.Track/);assert.match(setup,/OrphanInstallHarness.StopService/);assert.match(setup,/AfterRegistration/);assert.doesNotMatch(setup,/Environment.GetFolderPath\(Environment.SpecialFolder.LocalApplicationData\)/);
 const a=join(work,'Launcher.cs'),b=join(work,'Setup.cs'),exe=join(work,'OrphanInstallHarness.exe');writeFileSync(a,native);writeFileSync(b,setup);
 execFileSync(join(process.env.WINDIR||'C:\\Windows','Microsoft.NET','Framework64','v4.0.30319','csc.exe'),['/nologo','/target:exe','/main:OrphanInstallHarness','/r:System.Security.dll','/r:System.Web.Extensions.dll','/r:System.Windows.Forms.dll','/r:System.Drawing.dll','/r:System.Management.dll','/out:'+exe,a,b,'scripts\\fixtures\\SetupRegistryHarness.cs','scripts\\fixtures\\OrphanInstallHarness.cs'],{stdio:'inherit'});
 console.log(execFileSync(exe,[],{encoding:'utf8',timeout:30000}).trim());
}finally{rmSync(work,{recursive:true,force:true})}
