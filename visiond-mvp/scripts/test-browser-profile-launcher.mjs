import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import vm from "node:vm";

const launcherSource = readFileSync("tools/browser-launcher/Launcher.cs", "utf8");
const bridgeSource = readFileSync("public/browser-profile-launcher.js", "utf8");
const analyzerSource = readFileSync("public/tiktok-analyzer.js", "utf8");
const installSource = readFileSync("tools/browser-launcher/install.ps1", "utf8");
const uninstallSource = readFileSync("tools/browser-launcher/uninstall.ps1", "utf8");
const installStateSource = readFileSync("tools/browser-launcher/InstallState.ps1", "utf8");
const work = mkdtempSync(join(tmpdir(), "visiond-launcher-test-"));
const exe = join(work, "VisionDBrowserLauncher.exe");
const compiler = join(process.env.WINDIR || "C:\\Windows", "Microsoft.NET", "Framework64", "v4.0.30319", "csc.exe");

try {
  execFileSync(compiler, ["/nologo", "/target:winexe", "/optimize+", "/r:System.Security.dll", "/r:System.Web.Extensions.dll", "/r:System.Windows.Forms.dll", "/r:System.Drawing.dll", "/r:System.Management.dll", `/out:${exe}`, "tools\\browser-launcher\\Launcher.cs", "tools\\browser-launcher\\Setup.cs"], { stdio: "pipe" });

  const inspect = (uri) => spawnSync(exe, ["--inspect", uri], { encoding: "utf8" });
  const a = "74747d05-d182-4745-a0e1-dad444952cf5";
  const b = "3a6c1ca9-260b-4179-9a77-0fff095f0007";
  const slot = "f5a2ae61-e93f-4dd0-8ab8-e594234fcf2a";
  const a1 = inspect(`visiond-profile://open?mode=existing&channel_id=${a}`);
  const initContract=spawnSync('powershell.exe',['-NoProfile','-Command',`$p=Start-Process -FilePath '${exe.replaceAll("'","''")}' -ArgumentList '--inspect','visiond-profile://open?mode=existing&channel_id=${a}' -WindowStyle Hidden -PassThru -Wait; exit $p.ExitCode`],{encoding:'utf8'});
  assert.equal(initContract.status,0,'actual GUI-subsystem process completion uses exit code without stdout');
  assert.doesNotMatch(installSource,/\$metadata|\$portLine/);assert.match(installSource,/Get-NetTCPConnection -State Listen -OwningProcess \$service.Id/);
  const a2 = inspect(`visiond-profile://open?mode=existing&channel_id=${a}`);
  const b1 = inspect(`visiond-profile://open?mode=existing&channel_id=${b}`);
  const n1 = inspect(`visiond-profile://open?mode=new&slot_id=${slot}`);
  const boundA = inspect(`visiond-profile://open?mode=existing&channel_id=${a}&slot_id=${slot}&intent=shop`);
  const normalizedA = inspect(`visiond-profile://open/?mode=existing&channel_id=${a}`);
  const normalizedNew = inspect(`visiond-profile://open/?mode=new&slot_id=${slot}`);
  assert.equal(a1.status, 0);
  assert.equal(a1.stdout, a2.stdout, "reopening A must resolve to the same deterministic profile");
  assert.match(a1.stdout, new RegExp(`profile_leaf=channel-${a}`));
  assert.match(b1.stdout, new RegExp(`profile_leaf=channel-${b}`));
  assert.notEqual(a1.stdout, b1.stdout, "A and B must use different profile directories");
  assert.match(n1.stdout, new RegExp(`profile_leaf=slot-${slot}`));
  assert.doesNotMatch(n1.stdout, /channel-/);
  const newTarget = n1.stdout.match(/^target=(.+)$/m)?.[1];
  assert.equal(newTarget, "https://www.tiktok.com/login", "new profiles must open the fixed TikTok Login page");
  assert.match(n1.stdout, /^target_has_query=false$/m, "the provider target must have no query payload");
  assert.doesNotMatch(newTarget, new RegExp(slot), "the TikTok target must contain no slot, channel or auth value");
  assert.doesNotMatch(newTarget, /visiondonline|launcher_|connect=|\?/, "new profile bootstrap must not open VisionD or an OAuth handoff");
  assert.equal(boundA.status, 0);
  assert.match(boundA.stdout, new RegExp(`profile_leaf=slot-${slot}`), "bound channel must reopen its original slot directory");
  assert.match(boundA.stdout, /^target=https:\/\/visiondonline\.com\/tiktok-analyzer$/m, "bound channel actions must retain the fixed VisionD target");
  assert.match(boundA.stdout, /^target_has_query=true$/m, "bound actions must retain their fixed channel handoff parameters");
  assert.equal(normalizedA.stdout, a1.stdout, "Windows-normalized empty root path must preserve the same channel profile");
  assert.equal(normalizedNew.stdout, n1.stdout, "Windows-normalized empty root path must preserve the same pending slot");

  const invalid = [
    `visiond-profile://open?mode=handoff&slot_id=${slot}&id=${a}&ticket=${'a'.repeat(63)}`,
    `visiond-profile://open?mode=handoff&slot_id=${slot}&id=${a}&ticket=${'a'.repeat(64)}&url=https://evil.example`,
    `visiond-profile://open?mode=handoff&slot_id=${slot}&id=${a}&ticket=${'A'.repeat(64)}`,
    "https://visiondonline.com/tiktok-analyzer",
    `visiond-profile://evil?mode=existing&channel_id=${a}`,
    `visiond-profile://open/path?mode=existing&channel_id=${a}`,
    `visiond-profile://open//?mode=existing&channel_id=${a}`,
    `visiond-profile://open?channel_id=${a}&mode=existing`,
    `visiond-profile://open?mode=existing&channel_id=${a}&channel_id=${b}`,
    `visiond-profile://open?mode=existing&channel_id=${a}&url=https://evil.example`,
    `visiond-profile://open?mode=existing&channel_id=${a}&slot_id=${slot}&intent=evil`,
    `visiond-profile://open?mode=existing&channel_id=${a}&slot_id=00000000-0000-0000-0000-000000000000&intent=view`,
    `visiond-profile://open?mode=existing&channel_id=${a}%26url%3Dhttps://evil.example`,
    `visiond-profile://open?mode=existing&channel_id=${a}#fragment`,
    "visiond-profile://open?mode=existing&channel_id=00000000-0000-0000-0000-000000000000",
    "visiond-profile://open?mode=new&slot_id=..\\..\\Chrome",
    `visiond-profile://open?mode=new&slot_id=${slot}\r\n--load-extension=evil`
  ];
  for (const uri of invalid) assert.notEqual(inspect(uri).status, 0, `must reject ${JSON.stringify(uri)}`);
  const handoff=inspect(`visiond-profile://open?mode=handoff&slot_id=${slot}&id=${a}&ticket=${'a'.repeat(64)}`);
  assert.equal(handoff.status,0);assert.match(handoff.stdout,new RegExp(`profile_leaf=slot-${slot}`));
  assert.match(handoff.stdout,/target=https:\/\/visiondonline.com\/tiktok-handoff.html/);
  assert.match(handoff.stdout,/target_has_query=false/);assert.doesNotMatch(handoff.stdout,/a{64}/,'inspect must not print capability');
  assert.match(a1.stdout,/target=https:\/\/www.tiktok.com\/login/,'view reuses legacy directory without VisionD login');
  for(const kind of ['slot','channel']){
    const direct=inspect(`visiond-profile://open?mode=handoff&profile_kind=${kind}&slot_id=${slot}&id=${a}&ticket=${'a'.repeat(64)}`);
    assert.equal(direct.status,0);assert.match(direct.stdout,new RegExp(`profile_leaf=${kind}-${slot}`));
    assert.match(direct.stdout,/target=https:\/\/visiondonline.com\/tiktok-handoff.html/);assert.doesNotMatch(direct.stdout,/a{64}/);
  }
  assert.notEqual(inspect(`visiond-profile://open?mode=handoff&profile_kind=evil&slot_id=${slot}&id=${a}&ticket=${'a'.repeat(64)}`).status,0);

  assert.match(launcherSource, /UseShellExecute = false/);
  assert.match(launcherSource, /QuoteArgument\("--no-default-browser-check"\)/);
  assert.doesNotMatch(launcherSource, /--no-first-run/);
  assert.match(launcherSource, /QuoteArgument\("--user-data-dir=" \+ profileDirectory\)/);
  assert.match(launcherSource, /private const string TikTokLoginUrl = "https:\/\/www\.tiktok\.com\/login"/);
  assert.match(launcherSource, /https:\/\/visiondonline\.com\/tiktok-analyzer/);
  assert.doesNotMatch(launcherSource, /cmd\.exe|powershell\.exe|ProcessStartInfo\(raw|Process\.Start\(raw/i);
  assert.match(installSource, /HKCU:\\Software\\Classes\\visiond-profile/);
  assert.match(installSource, /Assert-VisionDProtocolState/);
  assert.match(uninstallSource, /Assert-VisionDProtocolState/);
  assert.match(uninstallSource, /preserved under LocalAppData/);
  assert.match(installStateSource, /VisionDShellAssociationChangedEvent = \[uint32\]0x08000000/);
  assert.match(installStateSource, /VisionDShellAssociationNotifyFlags = \[uint32\]\(0x0000 -bor 0x1000\)/);
  const installRegistryWrite = installSource.indexOf("Set-Item -LiteralPath $commandKey -Value $expectedCommand");
  const installNotify = installSource.indexOf("Send-VisionDShellAssociationChanged");
  const installSuccess = installSource.indexOf("VisionD Browser Launcher installed");
  assert.ok(installSource.indexOf("Assert-VisionDProtocolState") < installRegistryWrite && installRegistryWrite < installNotify && installNotify < installSuccess,
    "install must notify only after its owned protocol write and before claiming success");
  const uninstallRemoval = uninstallSource.indexOf("Remove-Item -LiteralPath $schemeKey -Recurse -Force");
  const uninstallNotify = uninstallSource.indexOf("Send-VisionDShellAssociationChanged");
  const uninstallSuccess = uninstallSource.indexOf("VisionD Browser Launcher protocol and executable removed");
  assert.ok(uninstallRemoval >= 0 && uninstallRemoval < uninstallNotify && uninstallNotify < uninstallSuccess,
    "uninstall must notify only inside the actual owned-removal branch and before claiming success");
  assert.match(uninstallSource, /if \(\$schemeExists\) \{\s*Remove-Item -LiteralPath \$schemeKey -Recurse -Force\s*Send-VisionDShellAssociationChanged\s*\}/,
    "an absent protocol must be a notification no-op, while an owned removal notifies once");

  const stateRoot = join(work, "Install State With Spaces");
  const stateTest = join(work, "install-state-test.ps1");
  writeFileSync(stateTest, `
. '${join(process.cwd(), "tools/browser-launcher/InstallState.ps1").replaceAll("'", "''")}'
$root = '${stateRoot.replaceAll("'", "''")}'
New-Item -ItemType Directory -Path $root -Force | Out-Null
if ((Get-VisionDLauncherFileState -InstallRoot $root) -ne 'Empty') { exit 10 }
New-Item -ItemType Directory -Path (Join-Path $root 'Profiles\\slot-test') -Force | Out-Null
if ((Get-VisionDLauncherFileState -InstallRoot $root) -ne 'Empty') { exit 11 }
Set-Content -LiteralPath (Join-Path $root 'VisionDBrowserLauncher.exe') -Value 'owned-binary' -Encoding ASCII
try { Get-VisionDLauncherFileState -InstallRoot $root; exit 12 } catch {}
Write-VisionDLauncherMarker -LauncherPath (Join-Path $root 'VisionDBrowserLauncher.exe') -MarkerPath (Join-Path $root 'owner.txt')
if ((Get-VisionDLauncherFileState -InstallRoot $root) -ne 'Owned') { exit 13 }
Add-Content -LiteralPath (Join-Path $root 'VisionDBrowserLauncher.exe') -Value 'tampered'
try { Get-VisionDLauncherFileState -InstallRoot $root; exit 14 } catch {}
try { Assert-VisionDProtocolState -Exists $true -CurrentCommand 'foreign' -ExpectedCommand 'ours' -FileState 'Owned'; exit 15 } catch {}
Assert-VisionDProtocolState -Exists $false -CurrentCommand '' -ExpectedCommand 'ours' -FileState 'Empty'
$script:notification = @()
Send-VisionDShellAssociationChanged -NotifyOverride { param($eventId, $flags) $script:notification = @($eventId, $flags) }
if ($script:notification.Count -ne 2 -or $script:notification[0] -ne 0x08000000 -or $script:notification[1] -ne 0x1000) { exit 16 }
try { Send-VisionDShellAssociationChanged -NotifyOverride { throw 'notify-failed' }; exit 17 } catch { if ($_.Exception.Message -ne 'notify-failed') { exit 18 } }
exit 0
`, "utf8");
  const stateResult = spawnSync("powershell.exe", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", stateTest], { encoding: "utf8" });
  assert.equal(stateResult.status, 0, stateResult.stderr || stateResult.stdout);
  assert.match(installStateSource, /sha256=\(\[0-9A-F\]\{64\}\)/);
  assert.match(installStateSource, /already registered by another application or an incomplete install/);

  const timers = [];
  const context = {
    window: {},
    location: { search: "" },
    URLSearchParams,
    setTimeout(callback) { timers.push(callback); },
    document: {},
    console
  };
  vm.runInNewContext(bridgeSource, context, { filename: "browser-profile-launcher.js" });
  const create = context.window.createVisionDBrowserLauncher;
  assert.equal(typeof create, "function");
  const values = new Map();
  const invoked = [];
  const statuses = [];
  const controller = create({
    storage: { getItem: (key) => values.get(key) || "", setItem: (key, value) => values.set(key, value), removeItem: (key) => values.delete(key) },
    cryptoApi: { randomUUID: () => slot },
    invoke: (uri) => invoked.push(uri),
    setStatus: (message) => statuses.push(message),
    getOwnerId: () => "2"
  });
  assert.equal(controller.launchExisting(a, "", "view"), true);
  assert.equal(invoked.at(-1), `visiond-profile://open?mode=existing&channel_id=${a}&intent=view`);
  assert.equal(controller.launchNew(), false, "a rapid second custom-scheme request must be deduplicated");
  assert.equal(invoked.length, 1);
  timers.shift()();
  assert.equal(controller.launchNew(), true);
  assert.equal(invoked.at(-1), `visiond-profile://open?mode=new&slot_id=${slot}`);
  assert.equal(controller.readPending(), slot);
  timers.shift()();
  assert.equal(controller.reopenPending(), true);
  assert.equal(invoked.at(-1), `visiond-profile://open?mode=new&slot_id=${slot}`);
  assert.ok(statuses.at(-1)?.includes("TikTok Login"));
  assert.ok(statuses.at(-1)?.includes("ไม่ได้เชื่อม API เพิ่มโดยอัตโนมัติ"));
  timers.shift()();
  assert.equal(controller.launchExisting(b, slot, "shop"), true);
  assert.equal(invoked.at(-1), `visiond-profile://open?mode=existing&channel_id=${b}&slot_id=${slot}&intent=shop`);
  timers.shift()();
  assert.equal(controller.launchExisting("../../not-a-channel", "", "view"), false);
  assert.equal(controller.launchExisting(b, slot, "evil"), false);
  assert.equal(invoked.length, 4);
  const directController=create({invoke:uri=>invoked.push(uri),setStatus:()=>{}});
  const directTicket={id:a,slot_id:a,profile_kind:'channel',ticket:'a'.repeat(64)};
  assert.equal(directController.launchHandoff(directTicket),true);
  assert.equal(directController.launchHandoff(directTicket),false,'same physical profile is deduplicated');
  assert.equal(directController.launchHandoff({...directTicket,id:b,slot_id:b}),true,'A lock must not prevent immediate B dispatch');

  for (const cryptoApi of [{}, { randomUUID() { throw new Error("blocked"); } }, { randomUUID: () => "not-a-uuid" }]) {
    const failureMessages = [], failureInvocations = [];
    const unavailableCrypto = create({
      storage: null,
      cryptoApi,
      invoke: (uri) => failureInvocations.push(uri),
      setStatus: (message) => failureMessages.push(message),
      getOwnerId: () => "2"
    });
    assert.equal(unavailableCrypto.launchNew(), false);
    assert.equal(failureInvocations.length, 0);
    assert.ok(failureMessages.at(-1)?.includes("ไม่ได้เปิด Chrome แยก"));
  }

  const deniedValues = new Map(), deniedMessages = [];
  const deniedInvoke = create({
    storage: { getItem: (key) => deniedValues.get(key) || "", setItem: (key, value) => deniedValues.set(key, value), removeItem: (key) => deniedValues.delete(key) },
    cryptoApi: { randomUUID: () => slot },
    invoke: () => { throw new Error("protocol unavailable"); },
    setStatus: (...message) => deniedMessages.push(message),
    getOwnerId: () => "2"
  });
  assert.equal(deniedInvoke.launchNew(), false);
  assert.equal(deniedInvoke.readPending(), slot, "a denied native invocation retains only its nonsecret UUID so the user can retry the same profile");
  assert.equal(deniedMessages.at(-1)?.[1], "error");

  const raceStorage = new Map(), raceInvocations = [], raceSlots = [slot, "33333333-3333-4333-8333-333333333333"];
  const race = create({
    storage: { getItem: (key) => raceStorage.get(key) || "", setItem: (key, value) => raceStorage.set(key, value), removeItem: (key) => raceStorage.delete(key) },
    cryptoApi: { randomUUID: () => raceSlots.shift() },
    invoke: (uri) => raceInvocations.push(uri), setStatus: () => {}, getOwnerId: () => "2"
  });
  assert.equal(race.launchNew(), true);
  assert.equal(race.launchNew(), false, "the lock must reject before generating or saving a replacement slot");
  assert.equal(raceInvocations.length, 1);
  assert.equal(race.readPending(), slot, "rapid +new must preserve the slot that was actually invoked");
  assert.equal(raceSlots.length, 1, "the locked call must not consume a UUID");

  assert.match(analyzerSource, /requestNewBrowserProfile\(\)\{return routeProfileConnection\('tiktok_new'/, "+new must issue a real fresh server-authorized LoginKit flow");
  assert.doesNotMatch(analyzerSource, /data-continue-pending|data-restore-profile|createTikTokConnectionPreflight/);
  assert.match(analyzerSource, /commandLauncher\.openCommand\(/);
  assert.doesNotMatch(analyzerSource, /navigate: \(url\) => location.assign\(url\)/);
  assert.match(analyzerSource, /issueProfileOAuth\('view',event.currentTarget\)/,
    "view must use the authenticated command path; native profile-kind parser assertions above still apply");
  assert.match(analyzerSource, /if\(!launcherTargetConsumed&&launcherContext\?\.channelId\)/,
    "existing profile deep links must resolve the exact owner-scoped channel once");
  assert.match(analyzerSource, /actualSlot!==launcherContext\.slotId/,
    "missing, foreign or mismatched exact targets must fail closed");
  assert.doesNotMatch(analyzerSource, /launcher_trial|BrowserLauncherTrial/);
  assert.match(bridgeSource, /window\.createVisionDBrowserLauncher = createVisionDBrowserLauncher/);
  assert.doesNotMatch(bridgeSource, /fetch\(|XMLHttpRequest|\/api\//);
  console.log("PASS browser profile launcher native validation, bound-slot reuse and safe bridge");
} finally {
  rmSync(work, { recursive: true, force: true });
}
