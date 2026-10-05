import assert from 'node:assert/strict';

export const OPTION_E_PATHS = [
  'components/workout-logger/session-clock-text.tsx',
  'components/workout-logger/session-history-peek.tsx',
  'components/workout-logger/session-v3-movement.tsx',
  'components/workout-logger/session-v3-shell.tsx',
  'lib/rest-timer-progress.ts',
];
export const OPTION_E_FLOWS = [
  'logger.option-e.bodyweight', 'logger.option-e.free-weight',
  'logger.option-e.machine', 'logger.option-e.cable',
  'logger.option-e.timer-progress', 'logger.option-e.second-pass',
];

/** Only the owner's presentation-only task. Actual simulator proof is mandatory;
 * the default three-role release policy remains unchanged for other changes. */
export function assertLoggerVisualScope(scope, fingerprint, delta, text, receipt) {
  assert.equal(scope?.scope, 'canonical-logger-option-e-20261005');
  assert.equal(scope.productFingerprint, fingerprint, 'visual proof cannot cover changed product source');
  assert.equal(scope.validation, 'ACTUAL_SIMULATOR_VISUAL_CONVERGENCE');
  assert.ok(text.includes(scope.ownerInstruction));
  assert.ok(text.includes('Perform real simulator visual validation against the supplied Option E reference.'));
  assert.ok(text.includes('Do NOT change Rest Timer timing behavior.'));
  assert.deepEqual(delta.subtractions, [], 'visual refinement cannot subtract product state');
  assert.deepEqual([...delta.modifications.map(row => row.path), ...delta.additions].sort(), [...OPTION_E_PATHS].sort(), 'visual refinement cannot include unrelated product changes');
  assert.deepEqual(Object.keys(scope.changedProductFiles).sort(), [...OPTION_E_PATHS].sort());
  for (const row of delta.modifications) assert.equal(row.after, scope.changedProductFiles[row.path], 'visual source changed');
  assert.equal(receipt.scope, scope.scope);
  assert.equal(receipt.referenceSha256, scope.referenceSha256, 'visual proof must compare the exact owner reference');
  assert.ok(receipt.visualConvergence?.firstPass?.length >= 4, 'all four movement classes need a first screenshot pass');
  assert.ok(receipt.visualConvergence?.secondPass?.length >= 4, 'all four movement classes need a second screenshot pass');
  assert.equal(receipt.visualConvergence.weakestAreas?.length, 3);
  assert.equal(receipt.visualConvergence.corrected, true, 'correct the three visual weaknesses before release');
  for (const pass of ['firstPass','secondPass']) {
    assert.deepEqual(receipt.visualConvergence[pass].map(row => row.kind).sort(), ['bodyweight','cable','free-weight','machine']);
    for (const row of receipt.visualConvergence[pass]) assert.ok(row.path?.endsWith('.png') && /^[a-f0-9]{64}$/.test(row.sha256), 'retain actual screenshot identities');
  }
  assert.deepEqual(scope.requiredRuntimeFlows, OPTION_E_FLOWS);
  assert.deepEqual(scope.requiredRuntimeRoles, ['self-coach']);
}
