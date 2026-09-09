import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const source = await readFile(new URL("../public/tiktok-analyzer.js", import.meta.url), "utf8");
const functionSource = (name) => {
  const start = source.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `${name} must exist`);
  const brace = source.indexOf("{", start);
  let depth = 0, quote = "", escaped = false;
  for (let index = brace; index < source.length; index += 1) {
    const char = source[index];
    if (quote) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === quote) quote = "";
      continue;
    }
    if (char === "'" || char === '"' || char === "`") { quote = char; continue; }
    if (char === "{") depth += 1;
    else if (char === "}" && --depth === 0) return source.slice(start, index + 1);
  }
  throw new Error(`${name} must terminate`);
};

const ids = {
  a: "11111111-1111-4111-8111-111111111111",
  b: "22222222-2222-4222-8222-222222222222",
  slotA: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  slotB: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  pending: "cccccccc-cccc-4ccc-8ccc-cccccccccccc"
};
const channelA = { id: ids.a, name: "A", browser_profile_slot_id: ids.slotA };
const channelB = { id: ids.b, name: "B", browser_profile_slot_id: ids.slotB };
const legacyB = { id: ids.b, name: "B legacy", browser_profile_slot_id: "" };

const runtime = ({ selected, channels, launcherContext, pending = "" }) => {
  const nodes = new Map([
    ["[data-browser-profile-label]", { textContent: "" }],
    ["[data-open-channel-profile]", { hidden: true }],
    ["[data-continue-pending]", { hidden: true }],
    ["[data-reopen-pending-profile]", { hidden: true }]
  ]);
  const launches = [], preflights = [];
  const sandbox = {
    state: { selected, channels }, launcherContext,
    $: (selector) => nodes.get(selector) || null,
    browserLauncher: {
      readPending: () => pending, clearPending: () => {},
      launchExisting: (...args) => { launches.push(args); return true; }
    },
    channelOwnership: { capture: () => selected ? { channelId: selected } : null },
    connectionPreflight: { open: (mode) => { preflights.push(mode); return true; } },
    setBrowserProfileStatus: () => {}
  };
  vm.createContext(sandbox);
  vm.runInContext([
    functionSource("selectedChannel"), functionSource("browserProfileMatches"),
    functionSource("routeProfileConnection"), functionSource("updateBrowserProfilePanel"),
    "this.update=updateBrowserProfilePanel;this.route=routeProfileConnection;"
  ].join("\n"), sandbox);
  return { sandbox, nodes, launches, preflights };
};

{
  const value = runtime({ selected: ids.b, channels: [channelA, channelB], launcherContext: { mode: "new", slotId: ids.slotA, channelId: ids.a } });
  value.sandbox.update();
  assert.equal(value.nodes.get("[data-continue-pending]").hidden, true, "bound slot A is not a pending slot after selecting B");
  assert.match(value.nodes.get("[data-browser-profile-label]").textContent, /ประจำช่อง A/);
  assert.equal(value.sandbox.route("tiktok"), true);
  assert.deepEqual(JSON.parse(JSON.stringify(value.launches)), [[ids.b, ids.slotB, "tiktok"]]);
  assert.deepEqual(value.preflights, [], "B OAuth must not begin inside A profile");
}
{
  const value = runtime({ selected: ids.a, channels: [channelA, channelB], launcherContext: { mode: "existing", slotId: ids.slotA, channelId: ids.a } });
  value.sandbox.update();
  assert.equal(value.nodes.get("[data-open-channel-profile]").hidden, true);
  assert.equal(value.sandbox.route("shop"), true);
  assert.deepEqual(value.preflights, ["shop"], "the matching A profile may open the existing preflight");
  assert.deepEqual(value.launches, []);
}
{
  const value = runtime({ selected: ids.b, channels: [channelA, legacyB], launcherContext: { mode: "existing", slotId: ids.slotA, channelId: ids.a } });
  value.sandbox.update();
  assert.equal(value.sandbox.route("tiktok"), true);
  assert.deepEqual(JSON.parse(JSON.stringify(value.launches)), [[ids.b, "", "tiktok"]], "legacy B must use its B channel directory");
}
{
  const value = runtime({ selected: ids.b, channels: [legacyB], launcherContext: { mode: "new", slotId: ids.pending, channelId: "" } });
  value.sandbox.update();
  assert.equal(value.nodes.get("[data-continue-pending]").hidden, false, "an unbound new slot exposes an explicit Continue action");
}

const newProfileAction = (launcher) => {
  let panelUpdates = 0, unavailable = 0, oauthStarts = 0;
  const sandbox = {
    browserLauncher: launcher,
    updateBrowserProfilePanel: () => { panelUpdates += 1; },
    setBrowserProfileStatus: () => { unavailable += 1; },
    connectionPreflight: { open: () => { oauthStarts += 1; } }
  };
  vm.createContext(sandbox);
  vm.runInContext(`${functionSource("requestNewBrowserProfile")};this.run=requestNewBrowserProfile;`, sandbox);
  return { result: sandbox.run(), panelUpdates, unavailable, oauthStarts };
};
assert.deepEqual(newProfileAction({ launchNew: () => true }), { result: true, panelUpdates: 1, unavailable: 0, oauthStarts: 0 },
  "a successful +new request must immediately reveal its saved pending/reopen state without starting OAuth");
assert.deepEqual(newProfileAction({ launchNew: () => false }), { result: false, panelUpdates: 1, unavailable: 0, oauthStarts: 0 },
  "a locked or failed request keeps its launcher result while refreshing only the pending panel");
assert.deepEqual(newProfileAction(null), { result: false, panelUpdates: 1, unavailable: 1, oauthStarts: 0 },
  "an unavailable helper remains honest and never falls back to OAuth in the current profile");

assert.match(source, /oauthStatus === "connected" \? "เชื่อมต่อ TikTok สำเร็จ กำลังตรวจข้อมูล Chrome โปรไฟล์ของช่อง"/,
  "query status alone must not claim an authoritative profile binding");
assert.doesNotMatch(source, /oauthStatus === "connected" \? "[^"]*ผูก Chrome โปรไฟล์/);
console.log("PASS browser profile client routes selected/bound/pending/legacy states without profile confusion");
