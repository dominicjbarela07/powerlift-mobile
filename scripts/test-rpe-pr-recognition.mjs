import assert from 'node:assert/strict';
import fs from 'node:fs';

import { recognitionPresentation, selectCelebrationEvents } from '../lib/logger-feedback.ts';
import { isValidStoredRecognitionEvent } from '../lib/logger-feedback-storage-core.ts';
import { RPE_VALIDATION_FIXTURES, recognitionScenario } from '../dev-mocks/animation-library/mock-data.ts';
import { ANIMATION_LIBRARY } from '../dev-mocks/animation-library/registry.ts';

const preview = fs.readFileSync(new URL('../dev-mocks/animation-library/preview-card.tsx', import.meta.url), 'utf8');
const surface = fs.readFileSync(new URL('../components/workout-logger/logger-feedback.tsx', import.meta.url), 'utf8');

const rpe = recognitionScenario('rpe', 7001);
assert.equal(rpe.event_type, 'CORE_RPE_PR');
assert.equal(rpe.priority, 25);
assert.equal(rpe.current_value, 8);
assert.equal(rpe.prior_value, 9);
assert.equal(rpe.delta, -1);
assert.equal(isValidStoredRecognitionEvent(rpe), true, 'RPE recognition must survive pending-delivery storage');

const presentation = recognitionPresentation(rpe, 'kg');
assert.equal(presentation?.eyebrow, 'MORE EFFICIENT');
assert.equal(presentation?.workload, '180 kg × 5');
assert.equal(presentation?.progression, '@9 → @8');
assert.equal(presentation?.delta, '-1.0 RPE');

const collisionRepMax = recognitionScenario('rep', 7002);
const collision = selectCelebrationEvents([
  {
    ...rpe,
    id: 7003,
    source_set_log_id: collisionRepMax.source_set_log_id,
    transient_delivery_id: 'animation-library:7003',
  },
  collisionRepMax,
]);
assert.equal(collision.length, 1);
assert.equal(collision[0].event_type, 'CORE_REP_MAX_PR');
assert.equal(collision[0].secondary_highlight_count, 1);

const entries = new Map(ANIMATION_LIBRARY.map((entry) => [entry.id, entry]));
assert.ok(entries.has('rpe-pr'), 'the parameterized Movement Efficiency family must remain');
for (const id of ['rpe-pr-small-change', 'rpe-pr-weight-mismatch', 'rpe-pr-reps-mismatch', 'rpe-pr-correction', 'rpe-pr-with-rep-max', 'rpe-pr-reduced']) {
  assert.equal(entries.has(id), false, `${id} belongs in fixtures/tests rather than the Animation Library`);
}

assert.match(surface, /RpeEfficiencyHero/, 'logger feedback must use the shared Movement Efficiency choreography');
assert.match(surface, /SLTrophy size=\{32\}/, 'Movement Efficiency must use the canonical shared trophy component');
assert.match(surface, /1 · Former effort[\s\S]*2 · New attempt[\s\S]*3 · Better execution takes over[\s\S]*4 · More efficient[\s\S]*5 · Victory hold[\s\S]*6 · Evidence transition[\s\S]*7 · Final evidence[\s\S]*8 · Complete/s, 'all eight storyboard phases must remain in order');
assert.match(surface, /if \(reduceMotion\)[\s\S]*heroOpacity\.setValue\(0\)[\s\S]*atmosphereOpacity\.setValue\(0\)[\s\S]*evidenceOpacity\.setValue\(1\)/s, 'Reduced Motion must remove travel and atmosphere and reveal static evidence');
assert.match(surface, /MOVEMENT EFFICIENCY[\s\S]*rpeEvidenceWorkload[\s\S]*rpeComparison[\s\S]*rpeDelta/s, 'final evidence must keep workload, RPE comparison, and delta together');
const rpeStyleBlock = surface.match(/rpeBody:\s*\{[\s\S]*?rpeEvidenceMovement:\s*\{[^}]*\}/)?.[0] || '';
assert.doesNotMatch(rpeStyleBlock, /#(?:79D68A|66D67D|62CF78|78DB8A|6DD783)|rgba\((?:71,\s*176,\s*93|94,\s*205,\s*115|91,\s*210,\s*113|106,\s*210,\s*122)/i, 'Movement Efficiency must not retain the green visual system');
assert.match(rpeStyleBlock, /backgroundColor: '#000000'/, 'Movement Efficiency must use the true-black recognition background');
assert.match(rpeStyleBlock, /#BDA0F4[\s\S]*#A64CFF[\s\S]*#FAF7FF[\s\S]*#C89BFF/, 'Movement Efficiency must use the shared violet, purple-light, white, and soft-magenta recognition palette');
assert.equal(RPE_VALIDATION_FIXTURES.smallChange.result, 'suppressed');
assert.match(RPE_VALIDATION_FIXTURES.smallChange.reason, /below the 1\.0 RPE threshold/);
assert.match(RPE_VALIDATION_FIXTURES.weightChanged.reason, /Canonical weight changed/);
assert.match(RPE_VALIDATION_FIXTURES.repsChanged.reason, /Completed reps changed/);
assert.equal(RPE_VALIDATION_FIXTURES.correction.result, 'invalidated');
assert.match(RPE_VALIDATION_FIXTURES.correction.reason, /recognition is invalidated/);
assert.match(preview, /accessibilityLabel="Movement Efficiency weight"/);
assert.match(preview, /accessibilityLabel="Movement Efficiency reps"/);
assert.match(preview, /accessibilityLabel="Previous RPE"/);
assert.match(preview, /accessibilityLabel="New RPE"/);

console.log('[rpe-pr-recognition] exact-workload presentation, priority, storage, storyboard, scenarios, and Reduced Motion checks passed');
