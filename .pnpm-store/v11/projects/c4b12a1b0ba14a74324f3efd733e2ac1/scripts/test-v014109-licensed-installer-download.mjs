import assert from "node:assert/strict";
import fs from "node:fs";
const read=(path)=>fs.readFileSync(path,"utf8");
const download=read("functions/api/vision7/apps/[code]/download.js");
const list=read("functions/api/vision7/apps/index.js");
const detail=read("functions/api/vision7/apps/[code]/index.js");
for(const token of ["requireVision7User","VISION7_LICENSE_REQUIRED","refreshLicenseExpiry","VISION7_LICENSE_INACTIVE",'["active", "trial"]',"private, no-store","content-disposition","x-content-type-options"])assert.ok(download.includes(token),token);
assert.match(download,/WHERE program_id=\? AND user_id=\?/);
assert.doesNotMatch(download,/cache-control", "public/);
for(const source of [list,detail]){
  assert.match(source,/EXISTS\(SELECT 1 FROM vision7_releases r WHERE r\.program_id=p\.id AND r\.status='published'\)/);
  assert.match(source,/download_ready/);
  assert.doesNotMatch(source,/installer_download_url/);
}
console.log("v0.14.109 licensed installer download gate passed");
