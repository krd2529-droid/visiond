import assert from 'node:assert/strict';
import { generateKeyPairSync, createHash } from 'node:crypto';
import { mkdtempSync, writeFileSync, readFileSync, existsSync, readdirSync, rmSync, statSync, cpSync, appendFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const [handoffArg, archiveArg] = process.argv.slice(2);
if (!handoffArg || !archiveArg) throw new Error('Usage: node test-vrecord-external-package.mjs <handoff-dir> <publisher-ffmpeg-zip>');
const handoff = resolve(handoffArg), archive = resolve(archiveArg);
const temporary = mkdtempSync(join(tmpdir(), 'vrecord-external-'));
function run(exe, args, options = {}) {
  const result = spawnSync(exe, args, { encoding: 'utf8', timeout: 180000, ...options });
  assert.equal(result.status, 0, `${exe} ${args.join(' ')}\n${result.stdout}\n${result.stderr}`);
  return result.stdout;
}
try {
  const pair = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const jwk = pair.publicKey.export({ format: 'jwk' });
  const xml = `<RSAKeyValue><Modulus>${Buffer.from(jwk.n, 'base64url').toString('base64')}</Modulus><Exponent>${Buffer.from(jwk.e, 'base64url').toString('base64')}</Exponent></RSAKeyValue>`;
  const publicKey = join(temporary, 'public.xml'); writeFileSync(publicKey, xml);
  const build = join(temporary, 'build');
  const scripts = resolve('scripts');
  run('pwsh', ['-NoProfile', '-File', join(scripts, 'prepare-vrecord-build.ps1'), '-HandoffDirectory', handoff, '-PublicKeyXml', publicKey, '-OutputDirectory', build]);
  const customer = join(build, 'customer');
  assert.deepEqual(readdirSync(customer).sort(), ['Install-FFmpeg.ps1', 'README.txt', 'V-Record.Updater.exe', 'V-Record.exe'].sort());
  const updateSource = readFileSync(join(build, 'source', 'UpdateCore.cs'), 'utf8');
  const recorderSource = readFileSync(join(build, 'source', 'Recorder.cs'), 'utf8');
  assert.match(updateSource, /"Install-FFmpeg.ps1","package-manifest.json"/);
  assert.doesNotMatch(updateSource, /"tools\/ffmpeg.exe"/);
  assert.match(recorderSource, /Btn\("ติดตั้ง FFmpeg"[^\n]+InstallEngine\(\)/);
  assert.match(recorderSource, /void InstallEngine\(\)\{try\{PackageIntegrity\.VerifyInstalled\(\);[^\n]+Process\.Start\(start\)/);
  const next = join(temporary, 'next'); cpSync(customer, next, { recursive: true });
  appendFileSync(join(next, 'README.txt'), '\nUpdate smoke 0.6.1\n');
  const secret = pair.privateKey.export({ format: 'der', type: 'pkcs8' }).toString('base64');
  run(process.execPath, [join(scripts, 'sign-vrecord-package-stdin.mjs'), customer, publicKey, '0.6.0'], { input: secret });
  run(process.execPath, [join(scripts, 'sign-vrecord-package-stdin.mjs'), next, publicKey, '0.6.1'], { input: secret });
  const compiler = join(process.env.WINDIR, 'Microsoft.NET', 'Framework64', 'v4.0.30319', 'csc.exe');
  const smoke = join(temporary, 'ExternalPackageSmoke.exe');
  run(compiler, ['/nologo', `/out:${smoke}`, '/reference:System.Web.Extensions.dll', join(scripts, 'vrecord-external-package-smoke.cs'), join(scripts, 'vrecord-external-engine.cs'), join(build, 'source', 'Integrity.cs')]);
  run(smoke, [customer, publicKey]);
  const installed = run('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', join(customer, 'Install-FFmpeg.ps1'), '-ArchivePath', archive]);
  assert.match(installed, /SHA-256/);
  run(smoke, [customer, publicKey, 'installed']);
  const engine = join(customer, 'tools', 'ffmpeg.exe');
  assert.equal(createHash('sha256').update(readFileSync(engine)).digest('hex').toUpperCase(), '3256173F3F8BFFD7DF12227C68ADF68025EDB1832273A9530688A7BB1ED8EDEC');
  assert.ok(existsSync(join(customer, 'tools', 'FFmpeg-LICENSE.txt')));
  assert.ok(existsSync(join(customer, 'tools', 'FFmpeg-README.txt')));
  assert.ok(statSync(engine).size === 105423872);
  const subtitleSmoke = join(temporary, 'SubtitleSmoke.exe');
  run(compiler, ['/nologo', `/out:${subtitleSmoke}`, '/reference:System.Drawing.dll', '/reference:System.Windows.Forms.dll', '/reference:System.Web.Extensions.dll', '/reference:System.Security.dll', join(handoff, 'tests', 'SubtitleSmoke.cs'), join(build, 'source', 'Subtitles.cs'), join(build, 'source', 'Licensing.cs'), join(build, 'source', 'Integrity.cs')]);
  run(subtitleSmoke, [customer]);
  const updateSmoke = join(temporary, 'ExternalUpdateSmoke.exe');
  run(compiler, ['/nologo', `/out:${updateSmoke}`, '/reference:System.Web.Extensions.dll', '/reference:System.Windows.Forms.dll', '/reference:System.Drawing.dll', '/reference:System.Security.dll', '/reference:System.IO.Compression.dll', join(scripts, 'vrecord-external-update-smoke.cs'), join(build, 'source', 'UpdateCore.cs'), join(build, 'source', 'Integrity.cs'), join(build, 'source', 'Licensing.cs')]);
  run(updateSmoke, [customer, next, publicKey]);
  if (process.argv.includes('--capture')) {
    const sessionSmoke = join(temporary, 'SessionSmoke.exe');
    run(compiler, ['/nologo', `/out:${sessionSmoke}`, '/reference:System.Drawing.dll', join(handoff, 'tests', 'SessionSmoke.cs'), join(build, 'source', 'RecordingSession.cs'), join(build, 'source', 'AudioCapture.cs')]);
    run(sessionSmoke, [customer], { timeout: 90000 });
  }
  console.log('PASS external V-Record package: clean build, signed manifest, missing/wrong engine denial, verified publisher installation, subtitle MP4/preview, update isolation');
} finally { rmSync(temporary, { recursive: true, force: true }); }
