# The Shrink

Electron desktop layer for agent-ready prompting — select text, **Ctrl+R** to score and improve with CLōD (or mock LLM).

## Documentation

| Doc | Purpose |
|-----|---------|
| [**AGENT_CONTEXT.md**](AGENT_CONTEXT.md) | **Start here** — layout, selection (UI Automation + clipboard), IPC, hotkeys, protected regions |
| [INTEGRATION_CONTRACT.md](INTEGRATION_CONTRACT.md) | Backend-2 API & JSON shapes (`optimize` + `protectedRegions`) |
| [SPEC_CLIPBOARD.md](SPEC_CLIPBOARD.md) | Older UX notes (schema names may drift) |
| [TECH_ARCHITECTURE.md](TECH_ARCHITECTURE.md) | Team background / risks (partially historical) |
| [temp/PROTECTED_REGIONS_SPEC.md](temp/PROTECTED_REGIONS_SPEC.md) | Protected-span behavior (reference) |

## Run

```bash
npm install
npm start
```

```bash
npm run verify          # Electron smoke (MOCK_SELECTION)
npm run test:mock       # Backend-2 mock shapes
npm run test:quick      # Short stability run (mock tiers without API key)
```

**Windows:** selection prefers **UI Automation** (`scripts/win-selection-uia.ps1`); falls back to **Ctrl+C** + clipboard restore. Set `DISABLE_UIA_SELECTION=1` to force clipboard-only.

**`.env`:** copy `.env.example` → `.env` beside `main.js`. Keys: `CLOD_API_KEY`, `LLM_*`, optional `MOCK_SELECTION`, `DEMO_MODE`, etc.

**Hotkeys:** **Ctrl+R** shrink trigger (or **Ctrl+Alt+R** / **Ctrl+Shift+R** if Ctrl+R is seized). **Ctrl+Shift+S** forced run. **Ctrl+Shift+D** demo mode.
