import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");
const [version, home, admin, protocol, protocolArchive, roadmap, packageText] = await Promise.all([
  read("VERSION.txt"),
  read("public/index.html"),
  read("public/admin.html"),
  read("JARVIS-PATCH-PROTOCOL.md"),
  read("work-history/visiond/protocols/JARVIS-PATCH-PROTOCOL.md"),
  read("VISIOND-ROADMAP.md"),
  read("package.json"),
]);

assert.equal(version.trim(), "v0.14.321");
assert.match(home, /WEB v0\.14\.321/);
assert.match(admin, /ADMIN v0\.14\.321/);
assert.doesNotMatch(home, /WEB v0\.14\.289/);
assert.doesNotMatch(admin, /ADMIN v0\.14\.266/);
for (const source of [protocol, protocolArchive]) {
  assert.match(source, /Visible patch version parity rule/);
  assert.match(source, /npm run test:visible-version/);
}
assert.match(roadmap, /REL-VERSION-001/);
assert.equal(JSON.parse(packageText).scripts["test:visible-version"], "node scripts/visible-version-check.mjs");

console.log("v0.14.321 visible patch version governance PASS");
