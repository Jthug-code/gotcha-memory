# gotcha-memory (Claude Code plugin)

Never re-debug the same wall twice. A private, local memory of your hard-won fixes that
**proactively surfaces** the relevant one before you hit the problem again.

→ Plugin details: [`plugins/gotcha-memory/README.md`](plugins/gotcha-memory/README.md)

## Install
```bash
claude plugin marketplace add Jthug-code/gotcha-memory
claude plugin install gotcha-memory@gotcha-memory
```
Restart Claude Code, then mention a tool you've saved a gotcha about and watch the
relevant one surface. Save new gotchas with the `remember-gotcha` skill.

## Develop locally
```bash
git clone https://github.com/Jthug-code/gotcha-memory
claude plugin marketplace add ./gotcha-memory
claude plugin install gotcha-memory@gotcha-memory
```

## How it works
- A `UserPromptSubmit` hook reads each prompt and injects your saved gotchas about the
  subject into context **before** Claude answers.
- The `remember-gotcha` skill (or `node hooks/remember.js`) saves new ones.
- Everything lives in `~/.claude/gotcha-memory/gotchas.jsonl` — local and private.

## Layout
```
.claude-plugin/marketplace.json        marketplace manifest (this repo)
plugins/gotcha-memory/
  .claude-plugin/plugin.json           plugin manifest
  hooks/hooks.json                     registers the UserPromptSubmit hook
  hooks/inject_gotchas.js              proactive injection (the value)
  hooks/remember.js                    capture a gotcha
  skills/remember-gotcha/SKILL.md      "save this gotcha" skill
  seed/gotchas.jsonl                   starter gotchas
```

MIT licensed — see LICENSE.
