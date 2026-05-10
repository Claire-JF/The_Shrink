/**
 * Smoke-test Backend-1 + Electron bootstrap without manual hotkeys.
 * Uses MOCK_SELECTION=1 and exits shortly after app ready.
 */
const { spawnSync } = require('child_process');
const path = require('path');

const root = path.join(__dirname, '..');
const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';

const r = spawnSync(
  npmCmd,
  ['exec', '--', 'electron', '.'],
  {
    cwd: root,
    env: {
      ...process.env,
      VERIFY_BACKEND1: '1',
      MOCK_SELECTION: '1',
    },
    stdio: 'inherit',
    shell: process.platform === 'win32',
  }
);

const code = r.status === null ? 1 : r.status;
if (code !== 0) {
  console.error(`verify-backend1: electron exited with code ${code}`);
}
process.exit(code);
