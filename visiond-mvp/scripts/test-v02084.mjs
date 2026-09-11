import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const source=readFileSync('tools/browser-launcher/Launcher.cs','utf8'),launch=source.slice(source.indexOf('internal static int Launch('),source.indexOf('internal static bool IsSetupPairUri'));
assert.match(launch,/QuoteArgument\("--no-first-run"\)/);assert.equal((launch.match(/Process.Start\(start\)/g)||[]).length,1);assert.equal((launch.match(/QuoteArgument\(target\)/g)||[]).length,1);assert.match(launch,/--no-default-browser-check[\s\S]*--no-first-run[\s\S]*--new-window[\s\S]*QuoteArgument\(target\)/);
const handoff=readFileSync('public/tiktok-handoff.js','utf8');for(const url of ['https://www.tiktok.com/v2/auth/authorize/','https://shop.tiktok.com/alliance/creator/auth']){
 let opens=0,replaces=0;const id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';const s={URL,location:{hash:'#id='+id+'&slot_id='+id+'&profile_kind=slot&ticket='+'a'.repeat(64),pathname:'/tiktok-handoff.html',replace:()=>replaces++},history:{replaceState(){}},document:{getElementById:()=>({})},window:{open:()=>opens++},fetch:async()=>({ok:true,json:async()=>({url})})};vm.runInNewContext(handoff,s);await new Promise(r=>setImmediate(r));assert.equal(opens,0);assert.equal(replaces,1);
}
console.log('PASS v84 fixed quoted first-run flag, one native target/start, LoginKit/Shop in-place handoff navigation');
