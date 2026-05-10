# The Shrink

Electron desktop layer for agent-ready prompting — select text, **Ctrl+R** to score and improve with CLōD (or mock LLM).

**Default product UI (branch `Zoe`):** a **cat companion** shell — draggable orb + glass panel (`renderer/index.html`, `app.js`, `styles.css`, `renderer/cats/`). It talks to the main process via **`preload.js`** (`window.shrink`). Score dimensions: **clarity**, **emotionalBalance**, **safety** (see [INTEGRATION_CONTRACT.md](INTEGRATION_CONTRACT.md)).

## Documentation

| Doc | Purpose |
|-----|---------|
| [**AGENT_CONTEXT.md**](AGENT_CONTEXT.md) | **Start here** — UI, layout, selection (UI Automation + clipboard), IPC, hotkeys, protected regions |
| [INTEGRATION_CONTRACT.md](INTEGRATION_CONTRACT.md) | Backend-2 API & JSON shapes (`optimize` + `protectedRegions`) |
| [SPEC_CLIPBOARD.md](SPEC_CLIPBOARD.md) | Older UX notes (schema names may drift) |
| [TECH_ARCHITECTURE.md](TECH_ARCHITECTURE.md) | Team background / risks (partially historical) |
| [design.md](design.md) | UI design notes (cat + panel; companion text) |
| [temp/PROTECTED_REGIONS_SPEC.md](temp/PROTECTED_REGIONS_SPEC.md) | Protected-span behavior (reference) |

## Run

From the **repository root** (directory that contains `package.json`):

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

### Git branch `Zoe`

The integrated Electron + cat UI lives on **`Zoe`** (remote: **`origin/Zoe`** — capital **Z**). After `git fetch`, use:

```bash
git checkout Zoe
git pull origin Zoe
```

If `package.json` is missing, you are on the wrong branch or an incomplete checkout; fix branch/remote before `npm install`.

### Windows (PowerShell) tips

- **PowerShell 5.x** does not support `&&`. Chain commands with **`;`** or run them on separate lines, e.g. `npm install; npm start`.
- **`npm install` ENOENT for `package.json`:** run commands from the repo root; confirm with `dir package.json` (Windows) or `Test-Path .\package.json`.
- **`EBUSY` during install (often `electron`):** close all Electron/Cursor instances using this repo; pause **OneDrive** sync on the folder or move the clone outside **Documents** (e.g. `C:\dev\The_Shrink`); then delete `node_modules` and run `npm install` again.
