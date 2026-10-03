import assert from 'node:assert/strict';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
const backend=process.env.STRENGTH_LEDGER_BACKEND_ROOT||'/Users/dominic/powerlifting_app_dev';
const result=spawnSync('python3',['-m','unittest','tests/test_worktree_lifecycle.py','-v'],{cwd:backend,encoding:'utf8',timeout:60000});
assert.equal(result.status,0,result.stdout+result.stderr);
console.log('Worktree lifecycle: actual stranded-fix closeout exits 1; untracked asset/ignored evidence/active ownership/stale sync block removal; dirty DEV preserved; exact successful closeout removes its temporary checkout. Lifecycle contracts PASS, including the governed publisher closeout integration.');
