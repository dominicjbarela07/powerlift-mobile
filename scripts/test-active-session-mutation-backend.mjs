import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const backendRoot = process.env.STRENGTH_LEDGER_BACKEND_ROOT || '/Users/dominic/powerlifting_app_dev';
const sharedRoot = backendRoot.includes(`${path.sep}.worktrees${path.sep}`)
  ? backendRoot.split(`${path.sep}.worktrees${path.sep}`)[0] : backendRoot;
const python = path.join(sharedRoot, 'venv', 'bin', 'python');
assert.ok(fs.existsSync(python), 'the canonical backend test runtime is required');
const suites = [
  'tests.test_live_swap_copy_final_composition',
  'tests.test_in_session_accessory_canonical_swap',
  'tests.test_active_session_composition',
  'tests.test_active_session_prescription',
];
const result = spawnSync(python, ['-m', 'unittest', ...suites, '-q'], {
  cwd: backendRoot,
  env: { ...process.env, PYTHONDONTWRITEBYTECODE: '1', PYTHONWARNINGS: 'ignore' },
  encoding: 'utf8',
  maxBuffer: 32 * 1024 * 1024,
  timeout: 120_000,
});
if (result.status !== 0) {
  console.error((result.stderr || result.stdout || result.error?.message || '').slice(-8000));
  process.exit(1);
}
const summary = (result.stderr || '').match(/Ran \d+ tests in [\d.]+s\s+OK/);
assert.ok(summary, 'backend mutation suite did not report successful persistence checks');
console.log(`PASS active Session mutation backend: ${summary[0].replace(/\s+/g, ' ')}`);
