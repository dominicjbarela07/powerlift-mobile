import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import {
  OTHER_MILESTONE_VISIBLE_COUNT,
  otherMilestoneWindow,
  progressBetweenMilestones,
  remainingToMilestone,
} from '../lib/milestones-layout.ts';

const root = resolve(import.meta.dirname, '..');
const screen = readFileSync(resolve(root, 'app/(tabs)/dev-mocks/milestones.tsx'), 'utf8');
const otherStart = screen.indexOf('const OTHER =');
const otherEnd = screen.indexOf('const STREAK_PRESENTATIONS =');
const otherData = screen.slice(otherStart, otherEnd);
const otherComponentStart = screen.indexOf('function OtherRow');
const otherComponentEnd = screen.indexOf('const styles = StyleSheet.create');
const otherComponent = screen.slice(otherComponentStart, otherComponentEnd);

assert.equal(OTHER_MILESTONE_VISIBLE_COUNT, 5);
assert.deepEqual(otherMilestoneWindow([10, 25, 50, 100, 250, 500, 1000], 163), [50, 100, 250, 500, 1000]);
assert.deepEqual(otherMilestoneWindow([1, 2, 3, 5, 10, 15], 2.4), [1, 2, 3, 5, 10]);
assert.deepEqual(otherMilestoneWindow([1, 2, 3, 5, 10], 2), [1, 2, 3, 5, 10]);
assert.deepEqual(otherMilestoneWindow([25, 50, 100, 250, 500], 36), [25, 50, 100, 250, 500]);

assert.equal(remainingToMilestone(163, 250), 87);
assert.equal(remainingToMilestone(2.4, 3), 0.6);
assert.equal(remainingToMilestone(2, 3), 1);
assert.equal(remainingToMilestone(36, 50), 14);

assert.equal(progressBetweenMilestones(163, [10, 25, 50, 100, 250, 500, 1000], 250), 63 / 150);
assert.ok(Math.abs(progressBetweenMilestones(2.4, [1, 2, 3, 5, 10, 15], 3) - 0.4) < Number.EPSILON * 4);
assert.equal(progressBetweenMilestones(2, [1, 2, 3, 5, 10], 3), 0);
assert.equal(progressBetweenMilestones(36, [25, 50, 100, 250, 500], 50), 11 / 25);

for (const category of ['Sessions Completed', 'Training Age']) {
  assert.match(otherData, new RegExp(`name: '${category}'`), `${category} must remain as a source-backed milestone family`);
}
assert.equal((otherData.match(/name: '/g) ?? []).length, 2, 'only milestone families backed by canonical progression fields may render');
assert.doesNotMatch(otherData, /current:/, 'presentation policy must not embed current athlete values');
assert.match(screen, /const liveOther = OTHER\.flatMap/, 'current values must bind from the canonical progression response');
assert.doesNotMatch(otherData, /soon/i, 'Other Milestones must not retain SOON state');

assert.match(otherComponent, /otherMilestoneWindow\(row\.thresholds, row\.current\)/, 'the rail must use the fixed five-marker window');
assert.match(otherComponent, /style=\{styles\.otherRail\}/, 'the milestone rail must be an in-flow fixed-width view');
assert.doesNotMatch(otherComponent, /ScrollView|horizontal/, 'Other Milestones must not scroll horizontally');
assert.doesNotMatch(otherComponent, /ArtifactDisc|Image|require\(/, 'Other Milestones must not render medal assets');
assert.doesNotMatch(otherComponent, /LinearGradient|RadialGradient|ConicGradient/, 'Other Milestones must remain gradient-free');
assert.match(otherComponent, /typographyRole="heroNumeric"/, 'current numeric values must use Michroma');
assert.match(otherComponent, /typographyRole="milestoneThreshold"/, 'remaining and threshold numbers must use Michroma');
assert.match(otherComponent, /typographyRole="shortTechnicalLabel"/, 'all word labels must use Exo 2');
assert.match(otherComponent, /accessibilityLabel=.*percent complete/, 'active progress must expose its exact percentage');
assert.equal((otherComponent.match(/testID=\{`other-milestone-\$\{row\.id\}-marker`\}/g) ?? []).length, 1, 'each data row must map every visible threshold to a test-addressable marker');

console.log('[other-milestones] canonical values, fixed five-cell rails, semantics, math, typography, and presentation guards passed');
