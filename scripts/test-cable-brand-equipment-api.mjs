import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import path from 'node:path';
const backend=process.env.STRENGTH_LEDGER_BACKEND_ROOT || '/Users/dominic/powerlifting_app_dev';
const result=spawnSync(path.join(backend,'venv/bin/python'),['-m','unittest','tests.test_cable_brand_equipment'],{
 cwd:backend,encoding:'utf8',timeout:25000,env:{...process.env,VIDEO_STORAGE_BACKEND:'local',STORAGE_BACKEND:'local'},
});
assert.equal(result.status,0,`${result.stdout}\n${result.stderr}`);
assert.match(result.stderr,/Ran 3 tests/);
console.log('Cable brand-only API: canonical movement + brand, old typed history/Last Comparable Exposure/PR, immutable evidence, non-cable and frozen 2.0.2 contracts PASS');
