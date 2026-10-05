import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
const backend = process.env.STRENGTH_LEDGER_BACKEND_ROOT || '/Users/dominic/powerlifting_app_dev';
const result = spawnSync(path.join(backend, 'venv/bin/python'), ['-m', 'unittest', 'tests.test_zero_load_edit_set'], {
  cwd: backend, encoding: 'utf8', timeout: 25000,
  env: { ...process.env, VIDEO_STORAGE_BACKEND: 'local', STORAGE_BACKEND: 'local', PYTHONDONTWRITEBYTECODE: '1' },
});
assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
assert.match(result.stderr, /Ran 1 test/);
console.log('Canonical zero-load API: actual edit POST + Session GET, three bodyweight/added-load movements, in-place persistence, immutable identity, no-op replay, negative rejection PASS');
