import assert from 'node:assert/strict';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
const backend=process.env.STRENGTH_LEDGER_BACKEND_ROOT||'/Users/dominic/powerlifting_app_dev';
// This deadline bounds the complete regression suite, not endpoint latency.
// A parallel export must not kill a correct multi-case suite at 25 seconds.
const result=spawnSync(path.join(backend,'venv/bin/python'),['-m','unittest','tests.test_accessory_rep_max_recognition','-q'],{cwd:backend,env:{...process.env,PYTHONDONTWRITEBYTECODE:'1'},encoding:'utf8',timeout:60000,maxBuffer:16*1024*1024});
assert.ifError(result.error);
assert.equal(result.status,0,(result.stderr||result.stdout).slice(-6000));
const completed = result.stderr.match(/Ran (\d+) tests[\s\S]*OK/);
assert.ok(completed && Number(completed[1]) >= 7, 'Run the complete current PR API suite, including manufacturer isolation and legacy-event replay protection.');
console.log('Accessory PR: real mobile save → exact free-weight/machine PR event → durable evidence API contracts PASS');
