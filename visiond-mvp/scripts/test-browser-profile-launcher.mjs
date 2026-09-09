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
  execFileSync(compiler, ["/nologo", "/target:exe", "/optimize+", `/out:${exe}`, "tools\\browser-launcher\\Launcher.cs"], { stdio: "pipe" });

  const inspect = (uri) => spawnSync(exe, ["--inspect", uri], { encoding: "utf8" });
  const a = "74747d05-d182-4745-a0e1-dad444952cf5";
  const b = "3a6c1ca9-260b-4179-9a77-0fff095f0007";
  const slot = "f5a2ae61-e93f-4dd0-8ab8-e594234fcf2a";
  const a1 = inspect(`visiond-profile://open?mode=existing&channel_id=${a}`);
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
  assert.equal(boundA.status, 0);
  assert.match(boundA.stdout, new RegExp(`profile_leaf=slot-${slot}`), "bound channel must reopen its original slot directory");
  assert.equal(normalizedA.stdout, a1.stdout, "Windows-normalized empty root path must preserve the same channel profile");
  assert.equal(normalizedNew.stdout, n1.stdout, "Windows-normalized empty root path must preserve the same pending slot");

  const invalid = [
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

  assert.match(launcherSource, /UseShellExecute = false/);
  assert.match(launcherSource, /QuoteArgument\("--user-data-dir=" \+ profileDirectory\)/);
  assert.match(launcherSource, /https:\/\/visiondonline\.com\/tiktok-analyzer/);
  assert.doesNotMatch(launcherSource, /cmd\.exe|powershell\.exe|ProcessStartInfo\(raw|Process\.Start\(raw/i);
  assert.match(installSource, /HKCU:\\Software\\Classes\\visiond-profile/);
  assert.match(installSource, /Assert-VisionDProtocolState/);
  assert.match(uninstallSource, /Assert-VisionDProtocolState/);
  assert.match(uninstallSource, /preserved under LocalAppData/);

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
  timers.shift()();
  assert.equal(controller.launchExisting(b, slot, "shop"), true);
  assert.equal(invoked.at(-1), `visiond-profile://open?mode=existing&channel_id=${b}&slot_id=${slot}&intent=shop`);
  timers.shift()();
  assert.equal(controller.launchExisting("../../not-a-channel", "", "view"), false);
  assert.equal(controller.launchExisting(b, slot, "evil"), false);
  assert.equal(invoked.length, 4);

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

  assert.match(analyzerSource, /browserLauncher\.launchNew\(\)/, "+new must always request a fresh isolated slot");
  assert.match(analyzerSource, /browserLauncher\.launchExisting\(context\.channelId,String\(channel\.browser_profile_slot_id\|\|""\),mode\)/);
  assert.match(analyzerSource, /launcherContext\?\.slotId\?state\.channels\.find/,
    "current profile identity must be resolved against any owned channel, not only the selected channel");
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
