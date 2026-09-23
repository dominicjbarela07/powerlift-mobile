import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { createHash } from 'node:crypto';
import ts from 'typescript';
import {
  VOLUME_ACHIEVEMENT_MILESTONES as milestones,
  VOLUME_ACHIEVEMENT_THRESHOLDS_LB as thresholds,
  deriveVolumeAchievement, deriveVolumeComparisonPresentation,
  volumeMilestonesForContext, volumeComparisonForContext, formatCompactVolumeLb,
  poundsToDisplayValue, volumeSharePercent, volumeStepPercent,
} from '../lib/volume-achievements.ts';

const legacy = [100_000, 250_000, 500_000, 1_000_000, 2_000_000, 5_000_000, 10_000_000];
const expanded = [...legacy, 25_000_000, 50_000_000, 75_000_000, 100_000_000, 150_000_000, 250_000_000, 500_000_000, 750_000_000, 1_000_000_000];
assert.deepEqual(thresholds, expanded);
assert.equal(createHash('sha256').update(JSON.stringify(milestones.slice(0, 7))).digest('hex'), 'dc05d4983e9a84f87d92cd7cbb1529576c2f27ee98a111ee5e88b3fc18b65147', 'preserve every existing threshold, comparison, source and earned identity');
for (let index = 0; index < thresholds.length; index++) {
  const threshold = thresholds[index];
  const milestone = milestones[index];
  const prior = thresholds[index - 1] ?? 0;
  const below = deriveVolumeAchievement(threshold - 1);
  const exact = deriveVolumeAchievement(threshold);
  assert.equal(below.next?.thresholdLb, threshold);
  assert.equal(below.remainingLb, 1);
  assert.equal(exact.achieved?.thresholdLb, threshold);
  assert.equal(exact.next?.thresholdLb ?? null, thresholds[index + 1] ?? null);
  assert.equal(exact.segmentProgress, index === thresholds.length - 1 ? 1 : 0);
  assert.ok(exact.milestones.slice(0, index + 1).every(m => m.state === 'achieved'), 'all previously earned landmarks remain earned');
  const midpoint = deriveVolumeAchievement((prior + threshold) / 2);
  assert.equal(midpoint.segmentProgress, 0.5);
  assert.equal(midpoint.remainingLb, (threshold - prior) / 2);
  const locked = deriveVolumeComparisonPresentation(milestone, 'total', threshold - 1);
  assert.equal(locked.visibleImage, null);
  assert.equal(locked.visibleFunFact, null);
  assert.equal(locked.visibleDetailAccess, false);
  const earned = deriveVolumeComparisonPresentation(milestone, 'total', threshold);
  assert.equal(earned.isUnlocked, true);
  assert.ok(earned.visibleImage && earned.visibleTitle && earned.visibleFunFact && earned.visibleDetailAccess);
  assert.ok(earned.comparison.source.url.startsWith('https://'));
  if (milestone.completeOnly) {
    assert.equal(milestone.comparisons.length, 1);
    assert.match(earned.comparison.description, /equivalents/);
    assert.ok(Math.abs(earned.comparison.approximateWeightLb / threshold - 1) < 0.1, 'scale equivalents stay within 10%');
  } else {
    const comparisons = ['total', 'squat', 'bench', 'deadlift'].map(c => volumeComparisonForContext(milestone, c));
    assert.equal(new Set(comparisons.map(c => c.id)).size, 4, 'legacy per-lift storytelling remains independent');
  }
}
assert.equal(deriveVolumeAchievement(10_000_000).next.thresholdLb, 25_000_000);
assert.equal(volumeStepPercent(deriveVolumeAchievement(999_999_999)), 99);
assert.equal(volumeStepPercent(deriveVolumeAchievement(1_000_000_000)), 100);
assert.equal(deriveVolumeAchievement(17_500_000).segmentProgress, 0.5);
assert.equal(deriveVolumeAchievement(875_000_000).segmentProgress, 0.5);
assert.equal(deriveVolumeAchievement(1_250_000_000).currentLb, 1_250_000_000);
assert.equal(deriveVolumeAchievement(1_250_000_000).remainingLb, 0);
for (const context of ['squat', 'bench', 'deadlift']) {
  assert.deepEqual(volumeMilestonesForContext(context).map(m => m.thresholdLb), legacy);
  assert.equal(deriveVolumeAchievement(10_000_000, context).next, null);
  assert.equal(deriveVolumeAchievement(750_000, context).segmentProgress, 0.5);
}
for (const invalid of [undefined, null, NaN, Infinity, -1]) {
  assert.equal(deriveVolumeAchievement(invalid).currentLb, 0);
  assert.equal(deriveVolumeAchievement(invalid).next.thresholdLb, legacy[0]);
}
assert.equal(formatCompactVolumeLb(1_000_000_000, 'lb'), '1B');
assert.equal(formatCompactVolumeLb(1_000_000_000, 'kg'), '453.59M');
assert.equal(poundsToDisplayValue(1_000_000_000, 'kg'), 453_592_370);
assert.equal(volumeSharePercent(250_000_000, 1_000_000_000), 25);
const read = p => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const screen = read('components/ledger/AchievementsExperience.tsx');
assert.match(screen, /PRIMARY_ACHIEVEMENT_SECTIONS = \['hub', 'volume', 'milestones', 'clubs', 'trophies', 'medallions'\]/);
assert.match(screen, /volume: 'Training Volume'/);
assert.equal((screen.match(/<VolumeAchievementExperience /g) ?? []).length, 1, 'detailed volume has one destination');
assert.match(screen, /section === 'volume'[^\n]*<VolumeAchievementExperience data=\{volumeDataset\}/);
assert.match(read('components/ui/sl-contextual-header.tsx'), /<ScrollView[\s\S]*accessibilityRole="tablist"[\s\S]*horizontal/);
const experience = read('components/volume-achievements/VolumeAchievementExperience.tsx');
assert.match(experience, /<ScrollView ref=\{railRef\} horizontal/);
assert.match(experience, /width: progress\.milestones\.length \* 76/, 'expanded labels retain readable cells at every viewport width');
assert.match(experience, /deriveVolumeAchievement\(currentLb, entry\.id\)/, 'each scope uses its governed ladder');
assert.match(experience, /testID="competition-total-volume"/);
assert.match(experience, /data\.lifts\.map/);
assert.match(experience, /minimumFontScale=\{safeVolumeLb\(currentLb\) >= 100_000_000 \? 0\.5 : 0\.78\}/, 'billion-scale totals retain the full value in the existing hero');
assert.match(experience, /largeCompetitionTotal && styles\.competitionTotalValueLarge/, 'large competition totals receive full card width');
assert.match(experience, /maxHeight: viewportHeight \* 0\.9/, 'expanded stories and revealed facts remain scrollable on short iPhones');
assert.match(experience, /adjustsFontSizeToFit minimumFontScale=\{0\.5\} numberOfLines=\{1\} style=\{styles\.detailThreshold\}/, 'detail thresholds fit at 1B');
assert.doesNotMatch(screen + experience, /['"`]workout/i);
// Execute the shipping projection with distinct broad/competition/lift totals.
const projectionBlock = screen.slice(screen.indexOf('  const volumePoints ='), screen.indexOf('  const canonicalStrengthTotal ='));
const projectSource = ts.transpileModule(`function project(progression) { ${projectionBlock} return volumeDataset; }`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
const scope = {
  VOLUME_PRESENTATION: { total: { id: 'total' }, lifts: ['squat', 'bench', 'deadlift'].map(id => ({ id })) },
  kilogramsToDisplayValue: (kg, unit) => unit === 'lb' ? kg / 0.45359237 : kg,
};
vm.runInNewContext(projectSource, scope);
const projected = scope.project({ metric_trends: { volume: {
  complete_training_volume_kg: 1000000000 * 0.45359237,
  competition_total_volume_kg: 400000000 * 0.45359237,
  competition_by_lift_kg: { squat: 100000000 * 0.45359237, bench: 50000000 * 0.45359237, deadlift: 250000000 * 0.45359237 },
  points: [{ value_kg: 1 }], by_lift_kg: { squat: 2 },
} } });
assert.equal(projected.total.current.lb, 1000000000);
assert.equal(projected.total.current.kg, 453592370);
assert.equal(projected.competitionTotal.current.lb, 400000000);
assert.deepEqual(Array.from(projected.lifts, lift => lift.current.lb), [100000000, 50000000, 250000000]);
const fallback = scope.project({ metric_trends: { volume: { points: [{ value_kg: 100 }, { value_kg: 50 }], by_lift_kg: { squat: 10, deadlift: 20 } } } });
assert.equal(fallback.total.current.kg, 150);
assert.equal(fallback.competitionTotal.current.kg, 30);
assert.deepEqual(Array.from(fallback.lifts, lift => lift.current.kg), [10, null, 20]);
console.log('PASS: unchanged Complete/Competition/lift projection, independent missing-lift state, old-contract fallbacks.');
console.log('PASS: 16 threshold boundaries/midpoints, 1B math, earned/reveal states, three unchanged lift ladders, direct navigation and bounded scroll rail.');

// The adjacent ceremony keeps its existing medallion rail and reads future goals
// from the same canonical ladder, including legacy 10M events with a null next.
const recognition = read('components/workout-logger/major-volume-milestone-recognition.tsx');
assert.match(recognition, /MAJOR_VOLUME_MEDALLION_THRESHOLDS_LB\.map/);
assert.doesNotMatch(recognition, /VOLUME_ACHIEVEMENT_THRESHOLDS_LB/);
const presentationFunction = recognition.slice(recognition.indexOf('function milestonePresentation('), recognition.indexOf('const LIFT_ACCENT'));
const eventScope = { deriveVolumeAchievement, KG_PER_LB: 0.45359237 };
vm.runInNewContext(ts.transpileModule(presentationFunction, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText, eventScope);
assert.equal(eventScope.milestonePresentation({ evidence: { threshold_lb: 10000000, milestone_scope: 'total', next_threshold_lb: null } }).nextThresholdLb, 25000000);
assert.equal(eventScope.milestonePresentation({ evidence: { threshold_lb: 10000000, milestone_scope: 'lift', lift_family: 'squat', next_threshold_lb: null } }).nextThresholdLb, null);
console.log('PASS: legacy 10M total recognition continues to 25M; earned medallions and per-lift recognition remain unchanged.');
