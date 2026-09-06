# gotcha-memory MCP server

The **engine**: one zero-dependency MCP server that lets *any* MCP client (Claude Code,
Cursor, Cline, Zed, …) search and save your gotchas. Build the engine once; the
per-platform plugins are just thin wrappers that point a client at this server.

Two tools:
- `search_gotchas(query, top?)` — your saved gotchas relevant to a task
- `save_gotcha(claim, subject, domain?, version?)` — persist a new one (scrubs credentials/paths)

It reads/writes one JSONL store (`GOTCHA_STORE`, default `~/.claude/gotcha-memory/gotchas.jsonl`)
— the **same** store the Claude injection hook uses, so on-demand (any client) and proactive
(Claude) share one brain. Point `GOTCHA_STORE` at a path on a shared box (e.g. a Raspberry Pi)
to make it the central server for all your tools.

## Run
```bash
node server.js          # an MCP stdio server; clients spawn it
```

## Wire it up

**Claude Code** — registers the tools alongside the auto-injection hook:
```bash
claude mcp add gotcha-memory -- node /ABSOLUTE/PATH/TO/mcp-server/server.js
```

**Cursor** — add to `~/.cursor/mcp.json` (global) or `.cursor/mcp.json` (per project);
see `cursor-mcp.example.json`:
```json
{ "mcpServers": { "gotcha-memory": { "command": "node",
  "args": ["/ABSOLUTE/PATH/TO/mcp-server/server.js"] } } }
```

Restart the client after wiring. In Claude you get auto-injection (hook) **plus** the tools;
in Cursor (no prompt hook) the model calls `search_gotchas` on demand — still a big win.

## Central / shared store (e.g. on a Pi)
Set `GOTCHA_STORE=/path/on/pi/gotchas.jsonl` (an env var the server and the hook both honor),
or run this server on the Pi and have each client connect to it. Featherweight: it's text —
millions of gotchas fit in a few GB.

No dependencies on purpose — runs with bare `node`, trivial to host or bundle. MIT.
