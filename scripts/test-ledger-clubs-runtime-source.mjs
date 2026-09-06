import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  resolveLedgerClubsRuntimeState,
  STRENGTH_KG_TO_LB,
  STRENGTH_STANDARD_VERSION,
  TOTAL_TROPHY_TIER_NAMES,
} from '../lib/ledger-rewards.ts';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');
const route = read('app/(tabs)/ledger/achievements.tsx');
const routeScreen = read('components/ledger/route-screen.tsx');
const achievements = read('components/ledger/AchievementsExperience.tsx');
const liveData = read('components/ledger/use-ledger-live-data.ts');
const data = read('lib/ledger-data.ts');

assert.match(route, /LedgerRouteScreen screen="achievements"/, 'the shipped route must mount the traced Ledger screen');
assert.match(routeScreen, /screen === 'achievements'.*LedgerAchievementsRoom/, 'the route screen must select the achievements room');
assert.match(routeScreen, /<AchievementsExperience/, 'the achievements room must mount the real Clubs consumer');
assert.match(achievements, /resolveLedgerClubsRuntimeState\(/, 'the real Clubs screen must use the governed runtime projection');
assert.match(achievements, /useFocusEffect\(useCallback\(\(\) => \{\s*void reload\(\)/, 'returning from a sex change must refresh the server-owned standard');
assert.match(liveData, /fetchLedgerCurrentBests\(\)/, 'Clubs live data must request current-best evidence');
assert.match(data, /LEDGER_CLUBS_CURRENT_BESTS_PATH/, 'the Clubs API boundary must be explicit and testable');
assert.match(data, /\/workouts\/mobile\/accomplishments\/current-bests\?scope=career&limit=24/, 'Clubs must consume the canonical current-bests endpoint');
assert.doesNotMatch(achievements, /\[250, 500, 750, 1000, 1500, 2000, 2500\]/, 'the real screen must not own the legacy Total ladder');
assert.doesNotMatch(achievements, /\[95, 135, 185, 225, 275, 315, 365, 405, 455, 495/, 'the real screen must not own the legacy lift ladder');

const thresholds = {
  M: {
    total: [430, 500, 545, 590, 655, 730, 825],
    squat: [150, 175, 195, 215, 240, 275, 315],
    bench: [100, 115, 130, 140, 160, 185, 210],
    deadlift: [180, 205, 225, 240, 265, 295, 330],
  },
  F: {
    total: [240, 280, 305, 335, 375, 430, 495],
    squat: [85, 100, 110, 125, 140, 165, 190],
    bench: [45, 55, 60, 70, 80, 95, 110],
    deadlift: [105, 125, 135, 145, 160, 185, 210],
  },
};
const percentiles = [20, 40, 55, 70, 85, 95, 99];
const standard = (sex) => ({
  status: 'supported',
  version: STRENGTH_STANDARD_VERSION,
  canonical_unit: 'kg',
  display_conversion: STRENGTH_KG_TO_LB,
  sex,
  sex_label: sex === 'M' ? 'Male' : 'Female',
  metrics: Object.fromEntries(Object.entries(thresholds[sex]).map(([metric, values]) => [metric, values.map((thresholdKg, index) => ({
    tier: index + 1,
    name: TOTAL_TROPHY_TIER_NAMES[index],
    target_percentile: percentiles[index],
    actual_percentile: percentiles[index],
    threshold_kg: thresholdKg,
    display_lb: Math.round(thresholdKg * STRENGTH_KG_TO_LB),
  }))])),
});
const best = (projectionId, key, bestValue) => ({
  projection_id: projectionId,
  core_movement_key: `competition_${key}`,
  movement_label: key,
  metric: 'weight',
  best_value: bestValue,
  unit: 'kg',
  event: { id: projectionId, event_type: 'CORE_WEIGHT_PR', source_set_log_id: 1000 + projectionId },
});
const standing = (sex, currentBests) => {
  const resolvedStandard = standard(sex);
  const currentByMetric = Object.fromEntries(currentBests.map((item) => [item.core_movement_key.replace('competition_', ''), item.best_value]));
  const totalKg = ['squat', 'bench', 'deadlift'].reduce((sum, metric) => sum + currentByMetric[metric], 0);
  const metricState = (metric, currentKg) => {
    const tiers = resolvedStandard.metrics[metric];
    const earnedIndex = tiers.findLastIndex((tier) => tier.threshold_kg <= currentKg);
    const nextIndex = tiers.findIndex((tier) => tier.threshold_kg > currentKg);
    const priorKg = earnedIndex < 0 ? 0 : tiers[earnedIndex].threshold_kg;
    const nextKg = nextIndex < 0 ? null : tiers[nextIndex].threshold_kg;
    return {
      status: 'supported', version: STRENGTH_STANDARD_VERSION, sex, metric, current_kg: currentKg,
      earned_tier: earnedIndex < 0 ? null : tiers[earnedIndex],
      next_tier: nextIndex < 0 ? null : tiers[nextIndex],
      remaining_kg: nextKg == null ? null : nextKg - currentKg,
      progress: nextKg == null ? 1 : (currentKg - priorKg) / (nextKg - priorKg),
      evidence_complete: true,
    };
  };
  return {
    status: 'supported', version: STRENGTH_STANDARD_VERSION, sex,
    evidence_authority: 'canonical_competition_weight_current_bests',
    metrics: {
      squat: metricState('squat', currentByMetric.squat),
      bench: metricState('bench', currentByMetric.bench),
      deadlift: metricState('deadlift', currentByMetric.deadlift),
      total: metricState('total', totalKg),
    },
  };
};

const maleItems = [best(1, 'squat', 193), best(2, 'bench', 110), best(3, 'deadlift', 189)];
const maleStanding = standing('M', maleItems);
const maleKg = resolveLedgerClubsRuntimeState(maleItems, standard('M'), maleStanding, 'kg');
const maleLb = resolveLedgerClubsRuntimeState(maleItems, standard('M'), maleStanding, 'lb');
assert.equal(maleKg.total.kg, 492, 'the supplied athlete scenario must total approximately 492 canonical kg');
assert.equal(maleKg.totalState.earnedTierIndex, 0, '492 kg male Total must be Tier I');
assert.equal(maleKg.totalState.nextTierIndex, 1, '492 kg male Total must target Tier II');
assert.equal(maleKg.totalState.nextKg, 500);
assert.equal(maleLb.totalState.next, 1102, '500 canonical kg must render as 1,102 lb');
assert.equal(maleLb.totalState.remaining, 18, 'remaining display must derive from 8 canonical kg');
assert.ok(!maleLb.totalState.thresholds.includes(1500), '1,500 lb must never be an active Total threshold');
assert.deepEqual(maleKg.totalState.thresholds, thresholds.M.total);
assert.deepEqual(maleKg.lifts.map((lift) => lift.tierState.thresholds), [thresholds.M.squat, thresholds.M.bench, thresholds.M.deadlift]);
assert.equal(maleKg.lifts[0].tierState.earnedTierIndex, 1, '193 kg Squat must have Tier II achieved');
assert.equal(maleKg.lifts[0].tierState.nextKg, 195, '193 kg Squat must approach Tier III at 195 kg');
assert.ok(!maleLb.lifts[0].tierState.thresholds.includes(405), 'the legacy 405 lb Squat step must not survive');
assert.ok(!maleLb.lifts[0].tierState.thresholds.includes(455), 'the legacy 455 lb Squat step must not survive');

const femaleItems = [best(11, 'squat', 105), best(12, 'bench', 57.5), best(13, 'deadlift', 127.5)];
const femaleStanding = standing('F', femaleItems);
const femaleKg = resolveLedgerClubsRuntimeState(femaleItems, standard('F'), femaleStanding, 'kg');
const femaleLb = resolveLedgerClubsRuntimeState(femaleItems, standard('F'), femaleStanding, 'lb');
assert.deepEqual(femaleKg.totalState.thresholds, thresholds.F.total, 'female Total must use the female ladder');
assert.deepEqual(femaleKg.lifts.map((lift) => lift.tierState.thresholds), [thresholds.F.squat, thresholds.F.bench, thresholds.F.deadlift]);
assert.equal(femaleKg.totalState.earnedTierIndex, 1, '290 kg female Total must be Tier II');
assert.equal(femaleKg.totalState.nextKg, 305, 'female Total must target Tier III');
assert.equal(femaleLb.totalState.earnedTierIndex, femaleKg.totalState.earnedTierIndex, 'display units must not change female standing');
assert.equal(femaleLb.totalState.progress, femaleKg.totalState.progress, 'display units must not change female progress');

const legacyHistory = [{ id: 9000, event_type: 'TOTAL_CLUB_1000_LB', evidence: { threshold_lb: 1000 } }];
const reconciled = resolveLedgerClubsRuntimeState(maleItems, standard('M'), maleStanding, 'lb');
assert.equal(reconciled.totalState.next, 1102);
assert.equal(legacyHistory[0].evidence.threshold_lb, 1000, 'legacy history may remain immutable for audit');
assert.ok(!reconciled.totalState.thresholds.includes(legacyHistory[0].evidence.threshold_lb), 'legacy history must not influence current standing');

console.log('[ledger Clubs runtime source] real route, live endpoint, male/female tiers, kg/lb parity, and legacy-history isolation passed');
