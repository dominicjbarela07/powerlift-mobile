import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';

export const establishedIncidentIds = [
  'unauthorized-testflight-subtraction', 'dev-testflight-divergence',
  'approved-product-state-disappearance', 'canonical-session-identity-composition',
  'critical-active-session-mutation', 'production-runtime-2-0-2-shared-backend',
];
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const within = (root, relative) => {
  assert.ok(typeof relative === 'string' && !path.isAbsolute(relative), 'Evidence/protection path must be repository relative');
  const file = path.resolve(root, relative);
  assert.ok(file.startsWith(path.resolve(root) + path.sep), 'Evidence/protection path escapes repository');
  return file;
};
export function validateIncidentRegister(register, backendRoot) {
  assert.equal(register.schemaVersion, 1);
  assert.equal(register.classification, 'OWNER NON-RECURRENCE DIRECTIVE');
  assert.ok(Array.isArray(register.incidents), 'Permanent incident register missing');
  const ids = register.incidents.map(i => i.id);
  assert.equal(new Set(ids).size, ids.length, 'Duplicate incident identity');
  for (const id of establishedIncidentIds) assert.ok(ids.includes(id), `Owner-designated incident disappeared: ${id}`);
  for (const incident of register.incidents) {
    assert.equal(incident.classification, 'OWNER NON-RECURRENCE DIRECTIVE');
    for (const field of ['failureClass', 'cause', 'blastRadius', 'protectionStatus', 'ownerDesignationBasis'])
      assert.ok(typeof incident[field] === 'string' && incident[field].trim(), `${incident.id}: missing ${field}`);
    assert.equal(hash(fs.readFileSync(within(backendRoot, incident.ownerDesignationEvidence))), incident.ownerDesignationEvidenceSha256, `${incident.id}: exact owner evidence changed`);
    for (const category of ['protections', 'negativeTests', 'evidence']) {
      assert.ok(Array.isArray(incident[category]) && incident[category].length, `${incident.id}: missing ${category}`);
      for (const relative of incident[category]) assert.ok(fs.statSync(within(backendRoot, relative)).isFile(), `${incident.id}: protection/evidence disappeared: ${relative}`);
    }
    assert.ok(Array.isArray(incident.gaps), `${incident.id}: protection gaps must be explicit`);
    assert.ok(['OPEN', 'CLOSED'].includes(incident.status), `${incident.id}: invalid closure state`);
    if (incident.status === 'OPEN') continue;
    const closeout = incident.closeout;
    assert.ok(closeout, `${incident.id}: CLOSED requires all seven closeout fields`);
    for (const field of ['Immediate failure fixed', 'Blast radius audited', 'Permanent regression/invariant protection added', 'Protection failure-tested'])
      assert.equal(closeout[field], 'YES', `${incident.id}: incomplete ${field}`);
    assert.equal(closeout['Failure class identified'], incident.failureClass);
    assert.equal(closeout['Equivalent known failures remaining'], 0, `${incident.id}: equivalent failures/unknown count prohibit closure`);
    assert.equal(closeout['Owner decision required'], 'NO');
    assert.equal(incident.gaps.length, 0, `${incident.id}: protection gaps prohibit closure`);
    for (const kind of ['positive', 'negative']) {
      const proof = incident.closureEvidence?.[kind];
      assert.ok(proof?.path && /^[a-f0-9]{64}$/.test(proof.sha256 || ''), `${incident.id}: ${kind} proof missing`);
      assert.equal(hash(fs.readFileSync(within(backendRoot, proof.path))), proof.sha256, `${incident.id}: ${kind} proof changed`);
      // A hashed document alone is not proof of executing the actual condition.
      const result = JSON.parse(fs.readFileSync(within(backendRoot, proof.path), 'utf8'));
      assert.equal(result.incidentId, incident.id);
      assert.equal(result.result, 'PASS');
      assert.equal(result.proofKind, kind);
      for (const field of ['backendSourceSha', 'mobileSourceSha']) assert.match(result[field] || '', /^[a-f0-9]{40}$/);
      for (const field of ['backendProductFingerprint', 'productFingerprint']) assert.match(result[field] || '', /^[a-f0-9]{64}$/);
      assert.ok(result.evidence?.length && result.observedCondition, `${incident.id}: actual observation absent`);
      if (kind === 'negative') assert.ok(Number.isInteger(result.gateExitStatus) && result.gateExitStatus > 0, `${incident.id}: protection did not fail`);
      for (const evidence of result.evidence) assert.equal(hash(fs.readFileSync(within(backendRoot, evidence.path))), evidence.sha256, `${incident.id}: observation evidence changed`);
    }
  }
  return { incidents: ids.length, open: register.incidents.filter(i => i.status === 'OPEN').length };
}
export function assertOwnerNonRecurrenceGovernance({ root = process.cwd(), backendRoot = process.env.STRENGTH_LEDGER_BACKEND_ROOT || '/Users/dominic/powerlifting_app_dev' } = {}) {
  const baseline = JSON.parse(fs.readFileSync(path.join(root, 'config/testflight-release-integrity.json')));
  const policy = baseline.ownerNonRecurrenceGovernance;
  assert.ok(policy, 'Owner non-recurrence governance protection disappeared');
  const evidence = fs.readFileSync(within(root, policy.ownerEvidencePath));
  assert.equal(hash(evidence), policy.ownerEvidenceSha256, 'Owner non-recurrence authorization changed');
  assert.ok(evidence.toString().includes(policy.ownerInstruction));
  for (const record of policy.canonicalFiles) assert.equal(hash(fs.readFileSync(within(backendRoot, record.path))), record.sha256, `Owner non-recurrence record changed without reviewed protection: ${record.path}`);
  const constitution = fs.readFileSync(path.join(backendRoot, 'docs/RELEASE_INVARIANTS.md'), 'utf8');
  assert.ok(constitution.includes('OWNER NON-RECURRENCE DIRECTIVE') && constitution.includes('I should never encounter that CLASS OF FAILURE again.'), 'Owner meaning disappeared');
  for (const file of [path.join(backendRoot, 'AGENTS.md'), path.join(root, 'AGENTS.md'), path.join(root, 'docs/RELEASE_INVARIANTS.md')])
    assert.ok(fs.readFileSync(file, 'utf8').includes('OWNER NON-RECURRENCE DIRECTIVE'), `Mandatory owner-directive guidance disappeared: ${file}`);
  return validateIncidentRegister(JSON.parse(fs.readFileSync(path.join(backendRoot, 'docs/OWNER_NON_RECURRENCE_INCIDENTS.json'))), backendRoot);
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try { console.log(JSON.stringify({ result: 'PASS', ...assertOwnerNonRecurrenceGovernance() })); }
  catch (error) { console.error(`OWNER NON-RECURRENCE GOVERNANCE BLOCKED: ${error.message}`); process.exitCode = 1; }
}
