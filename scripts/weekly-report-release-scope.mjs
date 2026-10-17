import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
export const weeklyReportPaths = ['app/(tabs)/_layout.tsx', 'app/(tabs)/athlete-calendar.tsx', 'app/(tabs)/training-week-report.tsx', 'components/calendar/AthleteCalendarStoryboardV2.tsx', 'lib/training-week-report.ts'];
export function assertWeeklyReportBaseline({root, scope, state, files}) {
  assert.equal(scope.scope, 'weekly-training-report-20261017');
  assert.equal(scope.baselineUpdateId, state.currentTestFlight.id);
  assert.equal(scope.baselineSourceSha, state.currentTestFlight.gitCommitHash);
  const read = entry => {
    const bytes = fs.readFileSync(path.resolve(root, entry.path));
    assert.equal(sha(bytes), entry.sha256, 'Weekly report baseline proof changed');
    return JSON.parse(bytes);
  };
  const continuation = scope.verifiedWeeklyReportContinuation === true;
  if (continuation) assert.equal(scope.ownerInstruction, "So I guess TestFlight is now just whatever the production is. That's fine. Fucking upload a 3.0.");
  const proof = continuation ? state.verifiedWeeklyTrainingReport.publishedProof : state.verifiedNavigationLoading.publishedProof;
  const gate = read(proof.gateC), audit = read(proof.assetAudit);
  assert.equal(gate.pass, true); assert.deepEqual(gate.missing, []);
  assert.equal(gate.published.id, scope.baselineUpdateId);
  assert.equal(gate.published.gitCommitHash, scope.baselineSourceSha);
  assert.equal(audit.pass, true); assert.equal(audit.missingOrCorrupt, 0);
  assert.equal(audit.updateId, gate.published.id);
  assert.equal(audit.servedLaunchSha256, gate.published.servedBundleSha256);
  const baseline = read(scope.baselineFiles);
  assert.equal(sha(JSON.stringify(Object.entries(baseline).sort(([a],[b]) => a.localeCompare(b)))), gate.candidateProductFingerprint);
  assert.equal(gate.candidateProductFingerprint, scope.baselineProductFingerprint);
  assert.deepEqual(Object.keys(baseline).filter(file => !files[file]), [], 'Weekly report cannot remove published files');
  const changes = Object.entries(files).filter(([file,hash]) => baseline[file] !== hash).map(([path,after]) => ({path,after}));
  assert.deepEqual(changes.map(row => row.path).sort(), continuation ? [] : [...weeklyReportPaths].sort(), 'Weekly report cannot include unrelated changes');
  return changes;
}
export function assertWeeklyReportDeployment({root, scope}) {
  const bytes = fs.readFileSync(path.resolve(root, scope.backendDeploymentReceipt.path));
  assert.equal(sha(bytes), scope.backendDeploymentReceipt.sha256);
  const deployment = JSON.parse(bytes);
  assert.equal(deployment.sourceSha, scope.backendSourceSha);
  assert.equal(deployment.liveVerified, true);
  assert.equal(deployment.gate.pass, true);
  assert.equal(deployment.weeklyReportTests.pass, true);
  assert.equal(deployment.weeklyReportTests.candidateSha, scope.backendSourceSha);
  assert.equal(deployment.weeklyReportTests.cases, 11);
  const live = JSON.parse(execFileSync('/usr/bin/curl', ['--fail','--silent','--show-error','--max-time','20','https://app.strengthledger.fit/health/recognition'], {encoding:'utf8'}));
  assert.equal(live.source_sha, scope.backendSourceSha, 'Weekly report backend must be live before its mobile entrypoint');
  assert.equal(live.ready, true);
}
