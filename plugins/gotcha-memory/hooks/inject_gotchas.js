#!/usr/bin/env node
/*
 * gotcha-memory — proactive injection (UserPromptSubmit hook).
 * On every prompt, surface the user's saved gotchas relevant to it, BEFORE Claude
 * answers. Precision-first: a SUBJECT match (e.g. "renpy") is strong; a generic
 * body-word match is weak; and nothing is injected unless a relevance FLOOR is
 * cleared — silence beats noise. Reads a local, private store (bootstrapped on first
 * run from the shipped seed). Node, because Claude Code guarantees it everywhere.
 */
const fs = require("fs");
const os = require("os");
const path = require("path");

const STOP = new Set((
  "the a an and or but to of in on at by for with from as is are was were be been being " +
  "do does did have has had can could will would should shall may might must this that these " +
  "those it its they them their you your my me we us our he she his her how what when where " +
  "why who which any all some other others another more most much many few every each both " +
  "here there then than also just like so such very too only even still way ways thing things " +
  "get got use using used make made want need into out off up down about again new old good " +
  "help please really kind sort lot able now today work works working"
).split(" "));

const SUBJECT_W = 5, BODY_W = 1, FLOOR = 4, MAX = 3;
// v0.1.2 precision (2026-10-28): long prompts share 4+ ordinary words with long claims by chance, so BG3 gotchas were
// injected into unrelated memory/ops prompts and even into automated task notifications. A subject hit now needs one
// supporting body word; a body-only match needs BODY_ONLY_MIN hits AND BODY_ONLY_SHARE of the prompt's content terms.
const BODY_ONLY_MIN = 6, BODY_ONLY_SHARE = 0.3;
// automated turns (background-task results, system notices) are not user asks: inject nothing
const AUTOMATED = /^\s*(<task-notification>|\[SYSTEM NOTIFICATION|<system-reminder>)/;

function relevant(subjectHit, bodyHits, nPromptTerms) {
  if (subjectHit) return bodyHits >= 1;
  return bodyHits >= Math.max(BODY_ONLY_MIN, Math.ceil(BODY_ONLY_SHARE * nPromptTerms));
}

function norm(s) {
  return String(s || "").toLowerCase().replace(/['’`]/g, "").replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
}
function termsOf(s) {
  return norm(s).split(" ").filter((t) => t.length >= 3 && !STOP.has(t));
}
function userStore() {
  return process.env.GOTCHA_STORE || path.join(os.homedir(), ".claude", "gotcha-memory", "gotchas.jsonl");
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
function readStdin() { try { return fs.readFileSync(0, "utf8"); } catch (e) { return ""; } }

function main() {
  let data = {};
  try { data = JSON.parse(readStdin() || "{}"); } catch (e) {}
  if (AUTOMATED.test(String(data.prompt || ""))) return;
  const promptTerms = new Set(termsOf(data.prompt));
  if (!promptTerms.size) return;

  const store = userStore();
  if (!fs.existsSync(store)) {
    try {
      fs.mkdirSync(path.dirname(store), { recursive: true });
      const seed = loadJsonl(seedFile());
      fs.writeFileSync(store, seed.map((f) => JSON.stringify(f)).join("\n") + (seed.length ? "\n" : ""), "utf8");
    } catch (e) {}
  }
  const facts = loadJsonl(store);
  if (!facts.length) return;

  const scored = [];
  for (const f of facts) {
    const subjectWords = new Set(norm(f.subject).split(" ").filter((w) => w.length >= 3));
    const subjectHit = [...subjectWords].some((w) => promptTerms.has(w));
    const bodyTerms = new Set(norm((f.claim || "") + " " + (f.domain || "")).split(" "));
    let bodyHits = 0;
    // a subject word repeated in the claim is not separate support
    for (const t of promptTerms) if (bodyTerms.has(t) && !subjectWords.has(t)) bodyHits++;
    const score = (subjectHit ? SUBJECT_W : 0) + bodyHits * BODY_W;
    if (score >= FLOOR && relevant(subjectHit, bodyHits, promptTerms.size)) scored.push([score * (f.confidence || 0.6), f]);
  }
  if (!scored.length) return; // nothing strongly relevant -> stay silent

  scored.sort((a, b) => b[0] - a[0]);
  const top = scored.slice(0, MAX).map(([, f]) => "- " + f.claim);
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: "UserPromptSubmit",
      additionalContext: "Your saved gotchas relevant here (gotcha-memory):\n" + top.join("\n"),
    },
  }));
}
main();
