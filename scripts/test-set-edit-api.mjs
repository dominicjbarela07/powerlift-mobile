import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
const backend = process.env.STRENGTH_LEDGER_BACKEND_ROOT || '/Users/dominic/powerlifting_app_dev';
const result = spawnSync(path.join(backend, 'venv/bin/python'), ['-m', 'unittest', 'tests.test_set_edit_performance', '-q'], {
  cwd: backend, encoding: 'utf8', timeout: 28000,
  env: { ...process.env, VIDEO_STORAGE_BACKEND: 'local', STORAGE_BACKEND: 'local', PYTHONDONTWRITEBYTECODE: '1' },
});
assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
assert.match(result.stderr, /Ran 4 tests/);
for (const line of result.stdout.split('\n').filter(line => line.startsWith('EDIT_PERFORMANCE '))) console.log(line);
console.log('PASS actual Set edit API: Core/Accessory long history, latency budget, immutable evidence, no-op retry, atomic rollback and deliberate per-Set query failure.');
