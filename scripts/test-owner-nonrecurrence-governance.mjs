import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { assertOwnerNonRecurrenceGovernance, validateIncidentRegister, establishedIncidentIds } from './owner-nonrecurrence-governance.mjs';
const root = process.cwd();
const backendRoot = process.env.STRENGTH_LEDGER_BACKEND_ROOT || '/Users/dominic/powerlifting_app_dev';
const original = JSON.parse(fs.readFileSync(path.join(backendRoot, 'docs/OWNER_NON_RECURRENCE_INCIDENTS.json')));
assert.equal(assertOwnerNonRecurrenceGovernance({root,backendRoot}).incidents, original.incidents.length);
for (const id of establishedIncidentIds) {
  const removed = structuredClone(original);
  removed.incidents = removed.incidents.filter(i => i.id !== id);
  assert.throws(() => validateIncidentRegister(removed,backendRoot), /Owner-designated incident disappeared/);
}
const noProtection = structuredClone(original);
noProtection.incidents[0].protections.push('scripts/DELIBERATELY_MISSING_PROTECTION.mjs');
assert.throws(() => validateIncidentRegister(noProtection,backendRoot), /ENOENT|protection\/evidence disappeared/);
const closed = structuredClone(original);
const incident = closed.incidents[0];
incident.status = 'CLOSED';
assert.throws(() => validateIncidentRegister(closed,backendRoot), /all seven closeout fields/);
incident.closeout = {
  'Immediate failure fixed':'YES', 'Failure class identified':incident.failureClass,
  'Blast radius audited':'YES', 'Permanent regression/invariant protection added':'YES',
  'Protection failure-tested':'YES', 'Equivalent known failures remaining':1, 'Owner decision required':'NO',
};
assert.throws(() => validateIncidentRegister(closed,backendRoot), /equivalent failures\/unknown count/);
incident.closeout['Equivalent known failures remaining'] = 'UNKNOWN';
assert.throws(() => validateIncidentRegister(closed,backendRoot), /equivalent failures\/unknown count/);
incident.closeout['Equivalent known failures remaining'] = 0;
assert.throws(() => validateIncidentRegister(closed,backendRoot), /protection gaps prohibit closure/);
incident.gaps = [];
assert.throws(() => validateIncidentRegister(closed,backendRoot), /positive proof missing/);
// Exercise actual nonzero CLI behavior against a disposable backend view.
// Only docs and AGENTS are copied. Protection sources are read-only symlinks;
// fixture mutations never target the owner's canonical files.
const fixture = fs.mkdtempSync(path.join(os.tmpdir(),'sl-nonrecurrence-'));
const results = [];
try {
  fs.mkdirSync(path.join(fixture,'docs'));
  for (const file of ['AGENTS.md','docs/RELEASE_INVARIANTS.md','docs/OWNER_NON_RECURRENCE_INCIDENTS.md','docs/OWNER_NON_RECURRENCE_INCIDENTS.json'])
    fs.copyFileSync(path.join(backendRoot,file),path.join(fixture,file));
  // Required existing document evidence remains read-only.
  for (const name of fs.readdirSync(path.join(backendRoot,'docs')))
    if (!fs.existsSync(path.join(fixture,'docs',name))) fs.symlinkSync(path.join(backendRoot,'docs',name),path.join(fixture,'docs',name));
  for (const name of ['app','scripts','tests','powerlift_mobile']) fs.symlinkSync(path.join(backendRoot,name),path.join(fixture,name));
  const run = () => spawnSync(process.execPath,['scripts/owner-nonrecurrence-governance.mjs'],{
    cwd:root,env:{...process.env,STRENGTH_LEDGER_BACKEND_ROOT:fixture},encoding:'utf8',timeout:10000,
  });
  assert.equal(run().status,0,'Valid retained governance must pass');
  for (const name of ['OWNER_NON_RECURRENCE_INCIDENTS.md','OWNER_NON_RECURRENCE_INCIDENTS.json']) {
    const file = path.join(fixture,'docs',name);const bytes=fs.readFileSync(file);fs.unlinkSync(file);
    const result=run();assert.equal(result.status,1);assert.match(result.stderr,/GOVERNANCE BLOCKED/);
    results.push({condition:`missing ${name}`,exitStatus:result.status});fs.writeFileSync(file,bytes);
  }
  const file=path.join(fixture,'AGENTS.md');fs.writeFileSync(file,'Directive deliberately removed');
  const result=run();assert.equal(result.status,1);results.push({condition:'owner directive removed from canonical agent guide',exitStatus:result.status});
} finally {fs.rmSync(fixture,{recursive:true,force:true});}
const verifier=fs.readFileSync('scripts/verify-testflight-release-integrity.mjs','utf8');
assert.match(verifier,/assertOwnerNonRecurrenceGovernance\(\{root,backendRoot\}\)/,'Gate A must retain governance enforcement');
const critical=fs.readFileSync('scripts/test-release-critical-invariants.mjs','utf8');
assert.ok(critical.includes('scripts/test-owner-nonrecurrence-governance.mjs'));
console.log(`PASS owner non-recurrence: six lost-record failures, missing protection, incomplete/known-failure/unknown/gap/unproved closure, actual CLI failures ${JSON.stringify(results)}`);
