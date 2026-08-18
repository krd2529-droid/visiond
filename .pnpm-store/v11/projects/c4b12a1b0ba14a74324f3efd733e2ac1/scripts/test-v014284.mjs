import assert from "node:assert/strict";
import fs from "node:fs";

const html = fs.readFileSync("public/course-seller.html", "utf8");
const episode = fs.readFileSync("public/course-draft-first-ep.js", "utf8");

assert.match(html, /name="expected_episodes"/i, "course form must expose the EP count required by the EP builder");
assert.match(html, /name="expected_episodes"[\s\S]*?value="1"/i, "EP count must default to one");
assert.match(episode, /form\.elements\.expected_episodes/, "EP builder must bind to the form EP count");
assert.match(episode, /episode-builder/, "EP builder must render inside the course basket form");
assert.match(episode, /episodes_json/, "course basket request must include all EP definitions");
assert.match(episode, /\/lessons\/\$\{lesson\.id\}/, "each EP upload must remain attached to its created course basket");

console.log("PASS v0.14.284: EP builder has its required form contract and remains part of one course basket");
