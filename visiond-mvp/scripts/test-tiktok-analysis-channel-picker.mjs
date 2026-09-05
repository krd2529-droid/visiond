import assert from "node:assert/strict";
import fs from "node:fs";
const read=file=>fs.readFileSync(new URL(`../${file}`,import.meta.url),"utf8"),client=read("public/tiktok-analyzer.js"),css=read("public/tiktok-analyzer.css");
for(const token of ['id="analysisChannelPicker"','id="analysisChannelOptions"','เลือกช่องจากรายการที่เชื่อมแล้ว','data-analysis-channel','กำลังดูช่องนี้','เลือกดูช่องนี้'])assert.ok(client.includes(token),token);
assert.match(client,/state\.channels\.filter\(channel=>channel\.follower_count!==null&&channel\.follower_count!==void 0\)/);
assert.match(client,/renderChannels\(\)[\s\S]*renderAnalysisChannelPicker\(\)/);
assert.match(client,/setOutputScope\("channel"\);setWorkspaceView\("output"\);await selectChannel/);
for(const token of ['.analysis-channel-picker{','.analysis-channel-options{display:flex','overflow-x:auto','.analysis-channel-option.active{','.workspace-input .analysis-channel-picker{display:none','@media(max-width:700px)'])assert.ok(css.includes(token),token);
console.log("TikTok visible analysis channel picker: PASS");
