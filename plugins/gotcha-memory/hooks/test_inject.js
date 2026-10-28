#!/usr/bin/env node
/* Precision tests for inject_gotchas.js (v0.1.2): run `node test_inject.js`; exits non-zero on a failure.
 * Uses a temp fixture store via GOTCHA_STORE, so the user's real store is never touched. */
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

const HOOK = path.join(__dirname, "inject_gotchas.js");
const store = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "gotcha-test-")), "gotchas.jsonl");
const facts = [
  { subject: "bg3", domain: "game-modding/bg3", confidence: 0.9,
    claim: "BG3 Elemental Affinity is gated on IsSpell(); a smite reaction rides a plain Ranged Attack, so a Lightning Arrow smite gets no affinity bonus." },
  { subject: "cursor", domain: "tooling/cursor", confidence: 0.8,
    claim: "Cursor snapshots its user-level rules directory at startup, so a new or edited global rule needs a full restart, not a new chat; settings User Rules are read per chat." },
  { subject: "renpy", domain: "game-dev/renpy", confidence: 0.7,
    claim: "Ren'Py's Movie displayable freezes on variable-frame-rate video; encode a CONSTANT-fps MP4." },
];
fs.writeFileSync(store, facts.map((f) => JSON.stringify(f)).join("\n") + "\n");

function run(prompt) {
  const r = spawnSync(process.execPath, [HOOK], { input: JSON.stringify({ prompt }), env: { ...process.env, GOTCHA_STORE: store } });
  const out = String(r.stdout || "");
  return out ? JSON.parse(out).hookSpecificOutput.additionalContext : "";
}

const cases = [
  // [prompt, substring expected in the injection, or null for silence]
  ["the elemental affinity bonus on my lightning arrow smite is missing in bg3", "Elemental Affinity"],
  ["my renpy movie freezes when the video plays", "Movie displayable"],
  ["i edited a cursor rule file but the new chat does not pick it up", "snapshots"],
  // unrelated prompts that used to pull gotchas in by sharing ordinary words with long claims
  ["yes, and make sure that new work only loads the project info it needs and doesn't waste context window on useless garbage for unrelated work. a new chat for instance should only get the universal rules such as those derived from that reddit thread.", null],
  ["system is still extreemly unstable, bring all work to a stop so I can reboot", null],
  // a bare subject word with nothing supporting it stays silent
  ["bg3", null],
  // automated turns never inject
  ["<task-notification>\n<task-id>x</task-id> the elemental affinity lightning arrow smite bg3 report completed", null],
  ["[SYSTEM NOTIFICATION - NOT USER INPUT] renpy movie freezes", null],
];
let failed = 0;
for (const [prompt, want] of cases) {
  const got = run(prompt);
  const ok = want === null ? got === "" : got.includes(want);
  if (!ok) failed++;
  console.log((ok ? "ok   " : "FAIL ") + JSON.stringify(prompt.slice(0, 70)) + (want === null ? " -> silent" : " -> " + want) + (ok ? "" : "  | got: " + JSON.stringify(got.slice(0, 120))));
}
process.exit(failed ? 1 : 0);
