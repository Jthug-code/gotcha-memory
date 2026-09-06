#!/usr/bin/env node
/*
 * gotcha-memory MCP server — zero-dependency stdio JSON-RPC (MCP).
 * Exposes two tools to ANY MCP client (Claude Code, Cursor, Cline, Zed, ...):
 *   - search_gotchas(query, top?)  -> your saved gotchas relevant to a query
 *   - save_gotcha(claim, subject, domain?, version?) -> persist a new gotcha
 * Backed by a single local JSONL store (GOTCHA_STORE, default
 * ~/.claude/gotcha-memory/gotchas.jsonl) — the SAME store the Claude injection
 * hook reads, so on-demand (any client) and proactive (Claude) share one brain.
 * Point GOTCHA_STORE at a path on your Pi to make it the central server.
 * No deps on purpose: runs with bare `node`, trivial to host or bundle.
 */
const fs = require("fs");
const os = require("os");
const path = require("path");
const readline = require("readline");

// ---------- store + relevance logic (mirrors the v0.1.1 injection hook) ----------
const STORE = process.env.GOTCHA_STORE || path.join(os.homedir(), ".claude", "gotcha-memory", "gotchas.jsonl");
const STOP = new Set((
  "the a an and or but to of in on at by for with from as is are was were be been being do " +
  "does did have has had can could will would should shall may might must this that these those " +
  "it its they them their you your my me we us our he she his her how what when where why who " +
  "which any all some other others another more most much many few every each both here there " +
  "then than also just like so such very too only even still way ways thing things get got use " +
  "using used make made want need into out off up down about again new old good help please " +
  "really kind sort lot able now today work works working"
).split(" "));
const SCRUB = [
  /(api[_-]?key|secret|token|password|bearer|private[_-]?key)/i,
  /[A-Za-z]:[\\/]|\/Users\/|\/home\/|~\//,
];
const SUBJECT_W = 5, BODY_W = 1, FLOOR = 4;

function norm(s) { return String(s || "").toLowerCase().replace(/['’`]/g, "").replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim(); }
function termsOf(s) { return norm(s).split(" ").filter((t) => t.length >= 3 && !STOP.has(t)); }
function load() {
  const out = [];
  try { for (const l of fs.readFileSync(STORE, "utf8").split(/\r?\n/)) { const s = l.trim(); if (s) { try { out.push(JSON.parse(s)); } catch (e) {} } } } catch (e) {}
  return out;
}

function doSearch(query, top) {
  const promptTerms = new Set(termsOf(query));
  if (!promptTerms.size) return "No saved gotchas relevant to that.";
  const facts = load();
  const scored = [];
  for (const f of facts) {
    const subjectHit = norm(f.subject).split(" ").some((w) => w.length >= 3 && promptTerms.has(w));
    const bodyTerms = new Set(norm((f.claim || "") + " " + (f.domain || "")).split(" "));
    let bodyHits = 0;
    for (const t of promptTerms) if (bodyTerms.has(t)) bodyHits++;
    const score = (subjectHit ? SUBJECT_W : 0) + bodyHits * BODY_W;
    if (score >= FLOOR) scored.push([score * (f.confidence || 0.6), f]);
  }
  if (!scored.length) return "No saved gotchas relevant to that.";
  scored.sort((a, b) => b[0] - a[0]);
  return "Relevant saved gotchas:\n" + scored.slice(0, top || 5).map(([, f]) => "- [" + (f.subject || "?") + "] " + f.claim).join("\n");
}

function doSave(a) {
  const claim = String(a.claim || "").trim(), subject = String(a.subject || "").trim();
  if (!claim || !subject) return "Need both a claim and a subject.";
  const blob = [claim, subject, a.domain || ""].join(" ");
  if (SCRUB.some((re) => re.test(blob))) return "HELD: looks like it contains a credential or a local path — make it a general fact and retry.";
  const facts = load();
  if (facts.some((f) => (f.claim || "").trim().toLowerCase() === claim.toLowerCase() && (f.subject || "") === subject)) return "Already saved.";
  const fact = { claim, subject, domain: a.domain || "", version: a.version || "", confidence: 0.65, corroborations: 1, added: new Date().toISOString().slice(0, 10) };
  try { fs.mkdirSync(path.dirname(STORE), { recursive: true }); fs.appendFileSync(STORE, JSON.stringify(fact) + "\n", "utf8"); }
  catch (e) { return "Could not write the store: " + e.message; }
  return "Saved a gotcha about '" + subject + "'. Store now has " + (facts.length + 1) + ".";
}

// ---------- MCP stdio plumbing (JSON-RPC 2.0, newline-delimited) ----------
const TOOLS = [
  {
    name: "search_gotchas",
    description: "Search the user's saved gotchas (hard-won fixes / tool quirks) for ones relevant to a task or question. Call this before tackling a tool/library the user works with, to avoid re-hitting a known wall.",
    inputSchema: { type: "object", properties: { query: { type: "string", description: "what you're about to do / the subject" }, top: { type: "number", description: "max results (default 5)" } }, required: ["query"] },
  },
  {
    name: "save_gotcha",
    description: "Save a new gotcha (a general, non-private fix/quirk about a public tool) so it surfaces next time. Use after discovering a non-obvious fix worth not re-learning.",
    inputSchema: { type: "object", properties: { claim: { type: "string", description: "the gotcha as a standalone sentence" }, subject: { type: "string", description: "the public tool/library/technique, e.g. renpy, ffmpeg" }, domain: { type: "string" }, version: { type: "string" } }, required: ["claim", "subject"] },
  },
];

function send(o) { process.stdout.write(JSON.stringify(o) + "\n"); }
function ok(id, result) { if (id !== undefined && id !== null) send({ jsonrpc: "2.0", id, result }); }
function fail(id, code, message) { if (id !== undefined && id !== null) send({ jsonrpc: "2.0", id, error: { code, message } }); }

function handle(msg) {
  if (!msg || msg.jsonrpc !== "2.0") return;
  const { id, method, params } = msg;
  switch (method) {
    case "initialize":
      return ok(id, { protocolVersion: (params && params.protocolVersion) || "2025-06-18", capabilities: { tools: {} }, serverInfo: { name: "gotcha-memory", version: "0.1.0" } });
    case "notifications/initialized":
    case "initialized":
      return; // notification — no reply
    case "ping":
      return ok(id, {});
    case "tools/list":
      return ok(id, { tools: TOOLS });
    case "tools/call": {
      const name = params && params.name;
      const args = (params && params.arguments) || {};
      let text;
      try {
        if (name === "search_gotchas") text = doSearch(args.query, args.top);
        else if (name === "save_gotcha") text = doSave(args);
        else return ok(id, { content: [{ type: "text", text: "Unknown tool: " + name }], isError: true });
      } catch (e) {
        return ok(id, { content: [{ type: "text", text: "error: " + e.message }], isError: true });
      }
      return ok(id, { content: [{ type: "text", text }] });
    }
    default:
      return fail(id, -32601, "Method not found: " + method);
  }
}

const rl = readline.createInterface({ input: process.stdin });
rl.on("line", (line) => {
  line = line.trim();
  if (!line) return;
  let msg;
  try { msg = JSON.parse(line); } catch (e) { return; }
  Array.isArray(msg) ? msg.forEach(handle) : handle(msg);
});
rl.on("close", () => process.exit(0));
