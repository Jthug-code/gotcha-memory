#!/usr/bin/env node
/*
 * gotcha-memory — save a gotcha to your local private store.
 * Usage:
 *   node remember.js --claim "Ren'Py Movie freezes on VFR video; use constant-fps MP4" \
 *                    --subject renpy --domain game-dev/renpy [--version 8.x]
 * Private by default: the store lives at ~/.claude/gotcha-memory/gotchas.jsonl and never
 * leaves your machine. A light scrub blocks obvious secrets/paths.
 */
const fs = require("fs");
const os = require("os");
const path = require("path");

function storePath() {
  return path.join(os.homedir(), ".claude", "gotcha-memory", "gotchas.jsonl");
}
function arg(name) {
  const i = process.argv.indexOf("--" + name);
  return i >= 0 && i + 1 < process.argv.length ? process.argv[i + 1] : "";
}

const claim = arg("claim").trim();
const subject = arg("subject").trim();
const domain = arg("domain").trim();
const version = arg("version").trim();

if (!claim || !subject) {
  console.error("need --claim and --subject");
  process.exit(1);
}
const blob = [claim, subject, domain].join(" ");
if (/(api[_-]?key|secret|token|password|bearer|private[_-]?key)/i.test(blob) ||
    /[A-Za-z]:[\\/]|\/Users\/|\/home\/|~\//.test(blob)) {
  console.error("HELD: this looks like it contains a credential or a local path — edit it to a general fact and retry.");
  process.exit(2);
}

const p = storePath();
fs.mkdirSync(path.dirname(p), { recursive: true });
let existing = [];
try {
  existing = fs.readFileSync(p, "utf8").split(/\r?\n/).filter(Boolean).map((l) => JSON.parse(l));
} catch (e) {}
if (existing.some((f) => (f.claim || "").trim().toLowerCase() === claim.toLowerCase() && (f.subject || "") === subject)) {
  console.log("already saved.");
  process.exit(0);
}
const fact = { claim, subject, domain, version, confidence: 0.65, corroborations: 1, added: new Date().toISOString().slice(0, 10) };
fs.appendFileSync(p, JSON.stringify(fact) + "\n", "utf8");
console.log("saved a gotcha about '" + subject + "'. your store now has " + (existing.length + 1) + ".");
