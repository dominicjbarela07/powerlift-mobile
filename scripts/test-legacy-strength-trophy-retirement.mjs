import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  STRENGTH_KG_TO_LB,
  STRENGTH_STANDARD_VERSION,
  STRENGTH_TIER_LABELS,
  strengthTierState,
  supportedStrengthStandard,
} from '../lib/ledger-rewards.ts';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const activeRuntimeFiles = [
  'lib/ledger-rewards.ts',
  'lib/ledger-data.ts',
  'lib/milestones-layout.ts',
  'components/ledger/AchievementsExperience.tsx',
  'components/ledger/StrengthExperience.tsx',
  'components/ledger/index-experience.tsx',
  'components/ledger/routing.ts',
  'components/ledger/use-ledger-live-data.ts',
  'dev-mocks/fixtures/strength-tier.ts',
];
const legacyTotalLadder = /\[\s*250\s*,\s*500\s*,\s*750\s*,\s*(?:1000|1_000)\s*,\s*(?:1500|1_500)\s*,\s*(?:2000|2_000)\s*,\s*(?:2500|2_500)\s*\]/;
const legacyVisiblePoundTarget = /(?:250|500|750|1,?000|1,?500|2,?000|2,?500)\s*(?:LB|lb)\s*(?:Club|club|milestone|target)?/;

for (const relativePath of activeRuntimeFiles) {
  const source = fs.readFileSync(path.join(root, relativePath), 'utf8');
  assert.doesNotMatch(source, legacyTotalLadder, `${relativePath} cannot own the legacy pound Total ladder`);
  assert.doesNotMatch(source, legacyVisiblePoundTarget, `${relativePath} cannot expose a legacy pound-club target`);
}

const achievements = fs.readFileSync(path.join(root, 'components/ledger/AchievementsExperience.tsx'), 'utf8');
const rewards = fs.readFileSync(path.join(root, 'lib/ledger-rewards.ts'), 'utf8');
assert.match(achievements, /STRENGTH CLUB CABINET/, 'Trophies must present the named Total club cabinet');
assert.match(achievements, /totalStrengthClubName/, 'Total club names must project over the governed threshold rows');
assert.match(achievements, /plateClubState/, 'individual lift achievement surfaces must use plate clubs');
assert.match(rewards, /'Steel'[\s\S]*'Bronze'[\s\S]*'Silver'[\s\S]*'Gold'[\s\S]*'Platinum'[\s\S]*'Diamond'[\s\S]*'Obsidian'/, 'the seven Total club identities must remain ordered');
assert.doesNotMatch(achievements, /NEXT MILESTONE[^\n]*(?:1,?500|1500)/, 'Clubs cannot restore the legacy 1,500 lb target');

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
    name: STRENGTH_TIER_LABELS[index],
    target_percentile: percentiles[index],
    actual_percentile: percentiles[index],
    threshold_kg: thresholdKg,
    display_lb: Math.round(thresholdKg * STRENGTH_KG_TO_LB),
  }))])),
});

const forbiddenLegacyTotalPoundSteps = new Set([250, 500, 750, 1000, 1500, 2000, 2500]);
for (const sex of ['M', 'F']) {
  const projection = supportedStrengthStandard(standard(sex));
  assert.ok(projection, `${sex} projection must be supported`);
  for (const metric of ['total', 'squat', 'bench', 'deadlift']) {
    assert.deepEqual(projection.metrics[metric].map((tier) => tier.name), STRENGTH_TIER_LABELS);
    if (metric === 'total') assert.equal(projection.metrics[metric].some((tier) => forbiddenLegacyTotalPoundSteps.has(tier.display_lb)), false);
    const evidenceKg = thresholds[sex][metric][2] - 1;
    const kg = strengthTierState(evidenceKg, metric, projection, 'kg');
    const lb = strengthTierState(evidenceKg, metric, projection, 'lb');
    assert.equal(lb.earnedTierIndex, kg.earnedTierIndex);
    assert.equal(lb.nextTierIndex, kg.nextTierIndex);
    assert.equal(lb.progress, kg.progress);
  }
}

assert.notDeepEqual(thresholds.M.total, thresholds.F.total, 'male and female Total standards must remain distinct');
console.log('[legacy strength trophy retirement] named Total clubs, no arbitrary Total ladder, native lift plate clubs, sex routing, and unit parity passed');
