#!/usr/bin/env node
/*
 * gotcha-memory — proactive injection (UserPromptSubmit hook).
 * On every prompt, surface the user's saved gotchas relevant to it, BEFORE Claude
 * answers — so you never re-debug the same wall. Reads a local, private store
 * (bootstrapped on first run from the seed shipped with the plugin). Written in Node
 * because Claude Code guarantees Node on every machine (unlike python3).
 */
const fs = require("fs");
const os = require("os");
const path = require("path");

const STOP = new Set(
  "the a an to of in on for and or is are be how do does you it with my your this that at by as if can what when where why get use i"
    .split(" ")
);

function userStore() {
  return path.join(os.homedir(), ".claude", "gotcha-memory", "gotchas.jsonl");
}
function seedFile() {
  return path.join(__dirname, "..", "seed", "gotchas.jsonl");
}
function loadJsonl(p) {
  const out = [];
  try {
    for (const line of fs.readFileSync(p, "utf8").split(/\r?\n/)) {
      const s = line.trim();
      if (!s) continue;
      try { out.push(JSON.parse(s)); } catch (e) {}
    }
  } catch (e) {}
  return out;
}
function readStdin() {
  try { return fs.readFileSync(0, "utf8"); } catch (e) { return ""; }
}
function esc(t) { return t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }

function main() {
  let data = {};
  try { data = JSON.parse(readStdin() || "{}"); } catch (e) {}
  const prompt = String(data.prompt || "");

  const store = userStore();
  if (!fs.existsSync(store)) {
    // first run: bootstrap the private store from the shipped seed
    try {
      fs.mkdirSync(path.dirname(store), { recursive: true });
      const seed = loadJsonl(seedFile());
      fs.writeFileSync(store, seed.map((f) => JSON.stringify(f)).join("\n") + (seed.length ? "\n" : ""), "utf8");
    } catch (e) {}
  }

  const facts = loadJsonl(store);
  if (!facts.length) return;

  const terms = prompt.toLowerCase().split(/\W+/).filter((t) => t.length > 2 && !STOP.has(t));
  if (!terms.length) return;

  const scored = [];
  for (const f of facts) {
    const blob = ((f.claim || "") + " " + (f.subject || "") + " " + (f.domain || "")).toLowerCase();
    let hits = 0;
    for (const t of terms) {
      const m = blob.match(new RegExp("\\b" + esc(t) + "\\b", "g"));
      hits += m ? m.length : 0;
    }
    if (hits) scored.push([hits * (f.confidence || 0.6), f]);
  }
  if (!scored.length) return;

  scored.sort((a, b) => b[0] - a[0]);
  const top = scored.slice(0, 3).map(([, f]) => "- " + f.claim);
  const msg = "Your saved gotchas relevant here (gotcha-memory):\n" + top.join("\n");
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: { hookEventName: "UserPromptSubmit", additionalContext: msg },
  }));
}
main();
