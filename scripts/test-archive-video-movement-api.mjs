import assert from 'node:assert/strict';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
const backend=process.env.STRENGTH_LEDGER_BACKEND_ROOT || '/Users/dominic/powerlifting_app_dev';
const output=execFileSync(path.join(backend,'venv/bin/python'),['scripts/shared_backend_archive_probe.py','--candidate-root',backend],{cwd:backend,encoding:'utf8',timeout:25000});
assert.doesNotMatch(output,/FAILED/);
console.log('PASS: 14 independent Archive cases include complete movement facets, immutable performed membership, cursor/subject/privacy controls and fresh signed native video/thumbnail streams.');
