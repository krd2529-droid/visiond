// Build public frozen release bytes only; never execute setup/install/pair.
import {execFileSync} from 'node:child_process';
import {mkdirSync,readFileSync,writeFileSync,existsSync,unlinkSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {createHash} from 'node:crypto';
const version='0.20.75',dir=resolve('public/downloads/visiond-helper',version),exe=join(dir,'VisionD-Helper-Setup.exe'),zip=join(dir,'VisionD-Helper-Source.zip');
mkdirSync(dir,{recursive:true});
const compiler=join(process.env.WINDIR||'C:\\Windows','Microsoft.NET','Framework64','v4.0.30319','csc.exe');
execFileSync(compiler,['/nologo','/target:winexe','/platform:x64','/optimize+','/r:System.Security.dll','/r:System.Web.Extensions.dll','/r:System.Windows.Forms.dll','/r:System.Drawing.dll','/r:System.Management.dll','/out:'+exe,'tools\\browser-launcher\\Launcher.cs','tools\\browser-launcher\\Setup.cs'],{stdio:'inherit'});
const sources=['Launcher.cs','Setup.cs','InstallState.ps1','install.ps1','uninstall.ps1','README.md','build-release.mjs','LICENSE'];
const sourcePath=name=>name==='LICENSE'?resolve('LICENSE'):resolve('tools/browser-launcher',name);
const quote=v=>"'"+v.replaceAll("'","''")+"'";
if(existsSync(zip))unlinkSync(zip);
const archiveCommand="Add-Type -AssemblyName System.IO.Compression; Add-Type -AssemblyName System.IO.Compression.FileSystem; $archive=[IO.Compression.ZipFile]::Open("+quote(zip)+",[IO.Compression.ZipArchiveMode]::Create); try { "+sources.map(name=>"[IO.Compression.ZipFileExtensions]::CreateEntryFromFile($archive,"+quote(sourcePath(name))+","+quote(name)+") | Out-Null").join('; ')+' } finally { $archive.Dispose() }';
execFileSync('powershell.exe',['-NoProfile','-NonInteractive','-Command',archiveCommand],{stdio:'inherit'});
const sha=path=>createHash('sha256').update(readFileSync(path)).digest('hex');
const pe=readFileSync(exe),optional=pe.readUInt32LE(0x3c)+24,magic=pe.readUInt16LE(optional),securityDirectory=optional+(magic===0x10b?96:magic===0x20b?112:NaN)+4*8;
if(!Number.isFinite(securityDirectory)||pe.readUInt32LE(securityDirectory)!==0||pe.readUInt32LE(securityDirectory+4)!==0)throw new Error('Signed/nonstandard PE requires explicit signature verification before release');
const signature='NotSigned'; // Measured: final PE has no Authenticode certificate directory.
const manifest={version,platform:'Windows x64 / .NET Framework 4.8 / Chrome',signature_status:signature,executable:{file:'VisionD-Helper-Setup.exe',sha256:sha(exe)},source_archive:{file:'VisionD-Helper-Source.zip',sha256:sha(zip)},sources:sources.map(file=>({file,sha256:sha(sourcePath(file))}))};
writeFileSync(join(dir,'release.json'),JSON.stringify(manifest,null,2)+'\n');
writeFileSync(join(dir,'SHA256SUMS.txt'),manifest.executable.sha256+'  '+manifest.executable.file+'\n'+manifest.source_archive.sha256+'  '+manifest.source_archive.file+'\n');
console.log('Built frozen release '+version+'; signature='+signature+'; sha256='+manifest.executable.sha256);
