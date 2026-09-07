import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  competitiveStanding,
  competitiveStandingSummary,
  resolveLedgerClubsRuntimeState,
  STRENGTH_KG_TO_LB,
  STRENGTH_STANDARD_VERSION,
  STRENGTH_TIER_LABELS,
  strengthReferenceCohort,
  totalStrengthClubName,
} from '../lib/ledger-rewards.ts';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');
const achievements = read('components/ledger/AchievementsExperience.tsx');
const strength = read('components/ledger/StrengthExperience.tsx');
const comparison = read('components/ledger/CompetitiveStandingCard.tsx');
const rewards = read('lib/ledger-rewards.ts');

assert.deepEqual(Array.from({ length: 7 }, (_, index) => totalStrengthClubName(index)), [
  'Steel', 'Bronze', 'Silver', 'Gold', 'Platinum', 'Diamond', 'Obsidian',
], 'Total must present the governed seven thresholds as named Strength Ledger clubs');
assert.match(achievements, /totalStrengthClubName\(/, 'Total cards and rails must consume the named club projection');
assert.match(achievements, /plateClubState/, 'Achievement lift cards must consume the plate-club projection');
assert.match(strength, /plateClubLabel\(/, 'Strength lift cards must consume plate-club language');
assert.match(comparison, /How this compares/, 'competitive standing must have a reachable plain-English detail');
assert.match(comparison, /out of every 100 competitors in this reference group recorded a lower/, 'comparison detail must explain percentile meaning without shorthand');
assert.match(comparison, /Reference group/, 'comparison detail must name the cohort');
assert.doesNotMatch(`${achievements}\n${strength}\n${comparison}`, /~P\$\{|~P\d|\bP\d{1,2}(?:\.\d+)?\b/, 'primary Strength and Achievement UI must not expose Pxx shorthand');
assert.doesNotMatch(`${achievements}\n${strength}`, />\s*Tier\s+(?:I|II|III|IV|V|VI|VII)\s*</, 'active Strength and Achievement UI must not render Tier I–VII identity');
assert.doesNotMatch(strength, /Steel Club|Bronze Club|Silver Club|Gold Club|Platinum Club|Diamond Club|Obsidian Club/, 'individual Strength lift presentation must not reuse Total club identities');

const thresholds = {
  M: { total: [430, 500, 545, 590, 655, 730, 825], squat: [150, 175, 195, 215, 240, 275, 315], bench: [100, 115, 130, 140, 160, 185, 210], deadlift: [180, 205, 225, 240, 265, 295, 330] },
  F: { total: [240, 280, 305, 335, 375, 430, 495], squat: [85, 100, 110, 125, 140, 165, 190], bench: [45, 55, 60, 70, 80, 95, 110], deadlift: [105, 125, 135, 145, 160, 185, 210] },
};
const actualPercentiles = {
  M: { total: [20.33, 40.47, 55.88, 70.23, 85.62, 95, 99.03], squat: [22.41, 40.22, 57.34, 72.88, 86.79, 96.01, 99.12], bench: [23.52, 40.62, 59.36, 70.16, 86.72, 95.95, 99.06], deadlift: [20.94, 40.02, 56.34, 70.39, 85.7, 95.41, 99.18] },
  F: { total: [21.92, 42.11, 56.01, 71.03, 85.6, 95.47, 99.04], squat: [23.81, 42.36, 55.76, 73.51, 85.79, 95.9, 98.99], bench: [20.82, 44.13, 56.18, 76.29, 88.41, 96.62, 99.04], deadlift: [20.8, 45.27, 57.32, 70.66, 84.96, 96.14, 99.24] },
};
const targets = [20, 40, 55, 70, 85, 95, 99];
const standard = (sex) => ({
  status: 'supported', version: STRENGTH_STANDARD_VERSION, canonical_unit: 'kg', display_conversion: STRENGTH_KG_TO_LB,
  sex, sex_label: sex === 'M' ? 'Male' : 'Female',
  dataset: {
    source_name: 'OpenPowerlifting', dataset_date: '2026-09-04', dataset_revision: 'b8b9bf6e', retrieved_at_utc: '2026-09-05T20:05:07Z',
    event: 'SBD', event_label: 'Full Power', equipment: 'Raw', eligible_date_min: '1965-09-04', eligible_date_max: '2026-08-30',
    male_lifters: 282522, female_lifters: 131906,
  },
  metrics: Object.fromEntries(Object.entries(thresholds[sex]).map(([metric, values]) => [metric, values.map((thresholdKg, index) => ({
    tier: index + 1, name: STRENGTH_TIER_LABELS[index], target_percentile: targets[index], actual_percentile: actualPercentiles[sex][metric][index], threshold_kg: thresholdKg, display_lb: Math.round(thresholdKg * STRENGTH_KG_TO_LB),
  }))])),
});
const best = (id, lift, pounds) => ({ projection_id: id, core_movement_key: `competition_${lift}`, movement_label: lift, metric: 'weight', best_value: pounds / STRENGTH_KG_TO_LB, unit: 'kg', event: { id, event_type: 'CORE_WEIGHT_PR', source_set_log_id: 1000 + id } });
const maleBests = [best(1, 'squat', 424), best(2, 'bench', 295), best(3, 'deadlift', 365)];
const maleLb = resolveLedgerClubsRuntimeState(maleBests, standard('M'), null, 'lb');
const maleKg = resolveLedgerClubsRuntimeState(maleBests, standard('M'), null, 'kg');

assert.deepEqual(maleLb.lifts.map((lift) => lift.plateClubState.earned?.value), [405, 275, 315]);
assert.deepEqual(maleLb.lifts.map((lift) => lift.plateClubState.next?.value), [455, 315, 405]);
assert.deepEqual(maleLb.lifts.map((lift) => lift.plateClubState.remaining), [31, 20, 40]);
assert.deepEqual(maleKg.lifts.map((lift) => lift.plateClubState.earned?.value), [150, 120, 150], 'KG clubs must be clean native milestones');
assert.ok(maleKg.lifts.every((lift) => lift.plateClubState.milestones.every((milestone) => Number.isInteger(milestone.value) && milestone.value % 10 === 0)), 'KG ladders must not contain awkward converted-pound artifacts');
assert.equal(competitiveStanding(maleLb.lifts[0].standingState, 'M').summary, 'Stronger than about 40% of comparable male competitors');
assert.equal(competitiveStandingSummary(maleLb.lifts[2].standingState, 'M'), 'Below the first governed reference point for comparable male competitors', 'valid evidence below the first percentile threshold must not be described as missing');
assert.equal(maleLb.lifts[0].standingState.earnedTierIndex, maleKg.lifts[0].standingState.earnedTierIndex, 'unit switching must not change competitive standing');

const femaleBests = [best(11, 'squat', 240), best(12, 'bench', 135), best(13, 'deadlift', 290)];
const femaleLb = resolveLedgerClubsRuntimeState(femaleBests, standard('F'), null, 'lb');
assert.equal(competitiveStanding(femaleLb.lifts[0].standingState, 'F').sexLabel, 'female', 'female athletes must use the female standard');
assert.notDeepEqual(femaleLb.totalState.thresholds, maleLb.totalState.thresholds, 'male and female Total routing must remain distinct');

const cohort = strengthReferenceCohort(maleLb.standard);
assert.equal(cohort.referenceGroupLabel, 'Male · Raw · Full Power · sanctioned competition results · all ages');
assert.equal(cohort.sampleSize, 282522);
assert.equal(cohort.dateRange, '1965-09-04 to 2026-08-30');
assert.match(cohort.selectionRule, /One best valid result per exact OpenPowerlifting lifter identity/);
assert.match(cohort.exclusions, /Tested status, bodyweight, age, country, and federation are not filters/);
assert.doesNotMatch(rewards, /TOTAL_CLUB_THRESHOLDS/, 'the retired arbitrary Total ladder must stay absent');

console.log('[strength achievement language convergence] named Total clubs, native lift clubs, plain competitive context, truthful cohort, unit stability, and sex routing passed');
