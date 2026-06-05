# gotcha-memory

**Never re-debug the same wall twice.** Your personal, private memory of hard-won fixes —
and it surfaces the relevant ones *before* you hit the problem again.

## What it does
- **Proactive injection (automatic):** a `UserPromptSubmit` hook reads each prompt and, if
  you've saved a gotcha about the subject, drops it into Claude's context *before* it
  answers. You get warned about the pothole instead of falling in.
- **Capture (on demand):** the `remember-gotcha` skill saves a new fix — or run
  `node hooks/remember.js --claim "..." --subject "..."` yourself.
- **Ships with a starter set** of general gotchas so it's useful on day one (bootstrapped
  into your store on first run).

## Privacy
Everything lives in `~/.claude/gotcha-memory/gotchas.jsonl` — **local, private, never
transmitted.** `remember.js` blocks obvious credentials and local paths. Save *general*
facts about public tools, not anything proprietary.

## Why Node (not Python)
The hooks are Node because Claude Code guarantees Node on every machine; `python3` is not
reliably present (on Windows it's often a Microsoft-Store stub). So it just works after install.

## Roadmap
Smarter matching (semantic, not just keyword), per-subject version tracking so stale
gotchas age out, and a quicker one-key capture flow.
