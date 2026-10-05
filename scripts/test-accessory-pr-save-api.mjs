import assert from 'node:assert/strict';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
const backend=process.env.STRENGTH_LEDGER_BACKEND_ROOT||'/Users/dominic/powerlifting_app_dev';
const result=spawnSync(path.join(backend,'venv/bin/python'),['-m','unittest','tests.test_accessory_rep_max_recognition','-q'],{cwd:backend,env:{...process.env,PYTHONDONTWRITEBYTECODE:'1'},encoding:'utf8',timeout:25000,maxBuffer:16*1024*1024});
assert.equal(result.status,0,(result.stderr||result.stdout).slice(-6000));
assert.match(result.stderr,/Ran 4 tests[\s\S]*OK/);
console.log('Accessory PR: real mobile save → exact free-weight/machine PR event → durable evidence API contracts PASS');
