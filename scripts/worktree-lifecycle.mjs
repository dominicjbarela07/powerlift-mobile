import path from 'node:path';
import {spawnSync} from 'node:child_process';
const backend=process.env.STRENGTH_LEDGER_BACKEND_ROOT||'/Users/dominic/powerlifting_app_dev';
const result=spawnSync('python3',[path.join(backend,'scripts/worktree_lifecycle.py'),...process.argv.slice(2)],{stdio:'inherit'});
if(result.error) console.error(result.error.message);
process.exitCode=result.status??1;
