import assert from 'node:assert/strict';
import fs from 'node:fs';

const achievements = fs.readFileSync(new URL('../components/ledger/AchievementsExperience.tsx', import.meta.url), 'utf8');
const volumeExperience = fs.readFileSync(new URL('../components/volume-achievements/VolumeAchievementExperience.tsx', import.meta.url), 'utf8');
const ledgerIndex = fs.readFileSync(new URL('../components/ledger/index-experience.tsx', import.meta.url), 'utf8');
const impactSummary = fs.readFileSync(new URL('../components/workout-logger/stage5-impact-summary.tsx', import.meta.url), 'utf8');
const ledgerData = fs.readFileSync(new URL('../lib/ledger-data.ts', import.meta.url), 'utf8');

assert.match(achievements, /label: 'Complete Training Volume'/, 'broad career volume must use the finalized product term');
assert.match(achievements, /label: 'Competition Total Volume'/, 'governed competition volume must use the finalized product term');
assert.match(achievements, /complete_training_volume_kg \?\? pointDerivedCompleteVolumeKg/, 'Complete Training Volume must use the broad backend field');
assert.match(achievements, /competition_by_lift_kg \?\? volumeTrend\?\.by_lift_kg/, 'competition lift volume must use the governed backend field with old-client fallback');
assert.match(achievements, /Object\.values\(byLiftKg\)\.reduce/, 'Competition Total Volume must sum whichever governed lifts have data');
assert.match(achievements, /LIFT_PRESENTATIONS\.map\(\(lift\): Lift =>/, 'PR rows must retain all three independent lift surfaces');
assert.doesNotMatch(achievements, /LIFT_PRESENTATIONS\.flatMap\(\(lift\): Lift\[\] =>/, 'missing evidence for one lift must not remove its independent row');
assert.match(achievements, /liveLifts\.map\(\(lift\) => <LiftRow/, 'every independent lift row must render');
assert.match(achievements, /VOLUME_PRESENTATION\.lifts\.map/, 'every independent lift-volume row must render');
assert.match(achievements, /current: \{ kg: null, lb: null \}/, 'missing lift volume must become only that lift\'s empty state');
assert.match(achievements, /hasCompleteStrengthTotal \? <View/, 'only the combined strength-total hero may require complete SBD coverage');
assert.match(volumeExperience, /testID={`\$\{entry\.id\}-volume-empty-state`}/, 'each missing lift must render its own bounded empty state');
assert.match(volumeExperience, /NO VOLUME YET/, 'per-lift volume empty state must be explicit');
assert.match(ledgerIndex, /volumeTrend\?\.complete_training_volume_kg/, 'Ledger home lifetime volume must use the broad metric');
assert.doesNotMatch(ledgerIndex, /Object\.values\(progression\?\.metric_trends\?\.volume\?\.by_lift_kg/, 'Ledger home must not mislabel SBD-only volume as complete volume');
assert.match(ledgerIndex, /Complete Training Volume/, 'Ledger home must display the finalized broad-volume product term');
assert.match(impactSummary, /label="Complete Training Volume"/, 'post-session impact must display the finalized broad-volume product term');
assert.match(ledgerData, /complete_training_volume_kg\?: number/, 'mobile contract must expose broad volume additively');
assert.match(ledgerData, /competition_total_volume_kg\?: number/, 'mobile contract must expose competition total additively');
assert.match(ledgerData, /competition_by_lift_kg\?: Partial<Record<'squat' \| 'bench' \| 'deadlift', number>>/, 'mobile contract must expose independent governed lift totals');

console.log('Volume taxonomy and per-lift independence regression checks passed.');
