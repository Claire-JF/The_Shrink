# The Shrink

Cursor Hackathon Vancouver (May 2026) — Electron desktop layer for agent-ready prompting.

## Quick links

| Doc | Purpose |
|-----|---------|
| [**AGENT_CONTEXT.md**](AGENT_CONTEXT.md) | **Start here for development** — layout, IPC, hotkeys, contracts, gaps |
| [INTEGRATION_CONTRACT.md](INTEGRATION_CONTRACT.md) | Backend-2 API & JSON shapes |
| [SPEC_CLIPBOARD.md](SPEC_CLIPBOARD.md) | Product UX & demo beats (partially superseded naming) |
| [TECH_ARCHITECTURE.md](TECH_ARCHITECTURE.md) | Original team plan & risk register |

## Run

```bash
npm install
npm start
npm run verify
```

Windows-focused; selection capture uses PowerShell `SendKeys` + Electron clipboard APIs. Hover widget: **Ctrl+R**. Mock dual strip + orb: **Ctrl+Shift+W**.
