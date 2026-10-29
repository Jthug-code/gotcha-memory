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
const domain = arg("domain").trim();
const version = arg("version").trim();

// v0.1.2 (2026-10-28): the injector matches the subject WORD BY WORD, so a subject is one canonical, distinctive token.
// "baldurs-gate-3" split into "baldurs" + "gate" and pulled BG3 gotchas into every prompt about gates; four spellings
// of one game also defeated "one name per thing".
const ALIASES = [[/baldur|^bg3([-_ ]|$)|^bg3se$/i, "bg3"], [/^ren'?py$/i, "renpy"], [/^mod\.?io$/i, "modio"]];
function canonSubject(s) {
  s = s.trim().toLowerCase();
  for (const [re, to] of ALIASES) if (re.test(s)) return to;
  return s;
}
const subject = canonSubject(arg("subject"));

if (!claim || !subject) {
  console.error("need --claim and --subject");
  process.exit(1);
}
// soft lint: long claims and multi-word subjects match unrelated prompts by chance (the store's median claim was 703 chars)
const subjectWords = subject.split(/[^a-z0-9]+/).filter((w) => w.length >= 3);
if (claim.length > 400) console.error("NOTE: claim is " + claim.length + " chars; keep it under ~300 (trigger terms + the fix) and put the story in a memory file.");
if (subjectWords.length > 1) console.error("NOTE: subject '" + subject + "' has " + subjectWords.length + " words, and each one matches on its own; prefer ONE distinctive token (renpy, illugen, dpi).");
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
