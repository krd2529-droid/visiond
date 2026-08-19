import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");
const version = (await read("VERSION.txt")).trim();
const [home, admin] = await Promise.all([
  read("public/index.html"),
  read("public/admin.html"),
]);

assert.match(version, /^v\d+\.\d+\.\d+$/, "VERSION.txt must contain a semantic version");
const escapedVersion = version.replaceAll(".", "\\.");
assert.match(
  home,
  new RegExp(`class="visiond-build-version"[^>]*>WEB ${escapedVersion}<`),
  "WEB badge must equal VERSION.txt",
);
assert.match(
  admin,
  new RegExp(`class="visiond-build-version"[^>]*>ADMIN ${escapedVersion}<`),
  "ADMIN badge must equal VERSION.txt",
);

console.log(`Visible version parity PASS: WEB ${version} / ADMIN ${version}`);
