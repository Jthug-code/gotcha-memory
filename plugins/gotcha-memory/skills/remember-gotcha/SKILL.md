---
name: remember-gotcha
description: >-
  Save a hard-won fix or gotcha to the user's personal gotcha-memory so it surfaces
  automatically next time. Use when the user says "remember this", "save that gotcha",
  or has just discovered a non-obvious fix / workaround / tool quirk worth not
  re-learning — especially a correction to something that didn't work the obvious way.
---

# Remember a gotcha

When the user has just discovered something worth not re-learning — a tool quirk, a
version surprise, a "the docs say X but Y works" correction, a workaround — offer to
save it (or do it when they ask). It will then be **proactively surfaced** the next time
a prompt is relevant, so they never re-hit the same wall.

## How to save one
Turn it into a **general fact about a public subject** (not anything private/proprietary)
and run:

```bash
node "${CLAUDE_PLUGIN_ROOT}/hooks/remember.js" \
  --claim "<the gotcha, as a standalone sentence a stranger could use>" \
  --subject "<the public tool/library/technique, e.g. renpy, blender, ffmpeg>" \
  --domain "<optional, e.g. game-dev/renpy>" \
  --version "<optional, e.g. 8.x>"
```

## Shape it so it surfaces only when relevant
The injector matches the **subject word by word** and counts claim words that the prompt shares.
- **Subject = ONE canonical, distinctive token** that a prompt about this would contain: `renpy`, `illugen`, `bg3`, `dpi`, `ffmpeg`.
  - Never use a phrase of common words. `baldurs-gate-3` matched every prompt about "gates"; `build pipelines / shell scripting` matched every "build".
  - Reuse the existing spelling: one name per thing. `remember.js` folds the Baldur's Gate variants to `bg3`.
- **Claim under ~300 characters**, leading with the trigger terms (tool, API, error text) and then the fix.
  - Long claims match unrelated prompts by chance. Put the full story in a memory or notes file and point to it.
- **Domain** is a short path such as `game-modding/bg3` or `game-dev/renpy`; its words count as supporting terms.
- **Check it:** a prompt that should surface it does (`echo '{"prompt":"..."}' | node hooks/inject_gotchas.js`), and a long unrelated prompt stays silent.

## What makes a good gotcha
- **Generalizes to a stranger** — still true/useful to someone who doesn't know this project.
- **Reveals nothing private** — no people, clients, paths, credentials, or proprietary IP.
  (remember.js blocks obvious paths/credentials, but use judgment.)
- **Corrective / current / niche** — the stuff the base model gets wrong or doesn't know.

If it's project-specific or proprietary, don't save it here — keep it in your private notes.

## Where it lives
`~/.claude/gotcha-memory/gotchas.jsonl` — local, private, never transmitted.
