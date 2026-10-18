import assert from 'node:assert/strict';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
const backend = process.env.STRENGTH_LEDGER_BACKEND_ROOT || '/Users/dominic/powerlifting_app_dev';
const output = execFileSync(path.join(backend, 'venv/bin/python'), [
  '-m', 'unittest', 'tests.test_mobile_session_copy_backdowns.MobileSessionCopyBackdownsTest', '-q',
], { cwd: backend, env: { ...process.env, PYTHONDONTWRITEBYTECODE: '1' }, encoding: 'utf8', timeout: 25000, stdio: ['ignore', 'pipe', 'pipe'] });
assert.doesNotMatch(output, /FAILED/);
console.log('PASS: real HTTP Session Copy To, Reuse, saved template and Week Copy preserve the exact Top/Backdown graph and independent Straight work on both mobile contracts.');
