import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  formatCalculatedWeightDeltaFromKg,
  formatCalculatedWeightFromKg,
  formatCalculatedWeightValue,
  formatWeightFromKg,
  roundCalculatedWeightForDisplay,
} from '../lib/display-units.ts';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

for (const [value, expected] of [
  [426.7, '426.5'],
  [426.76, '427'],
  [410, '410'],
  [410.5, '410.5'],
  [537.553133, '537.5'],
  [420.00265, '420'],
]) {
  assert.equal(formatCalculatedWeightValue(value, 'lb'), expected);
}

const preciseKg = 243.827186043;
assert.equal(roundCalculatedWeightForDisplay(preciseKg, 'kg'), preciseKg);
assert.equal(formatCalculatedWeightValue(preciseKg, 'kg'), '243.8');
assert.equal(formatCalculatedWeightDeltaFromKg(16.7 / 2.2046226218, 'lb', 'signed'), '+16.5 lb');

const sharedE10rmKg = 426.712813 / 2.2046226218;
assert.equal(formatCalculatedWeightFromKg(sharedE10rmKg, 'lb'), '426.5 lb');
assert.equal(formatWeightFromKg(320 / 2.2046226218, 'lb'), '320 lb');

const history = read('components/movement-history/CanonicalMovementHistoryScreen.tsx');
const chart = read('components/movement-history/AnalyticalHistoryChart.tsx');
const recap = read('components/coach-mobile/CompletedSessionRecap.tsx');
const manager = read('app/(tabs)/workout/index.tsx');
const home = read('components/home/AthleteHomeV3.tsx');
const progression = read('app/(tabs)/athlete-progression.tsx');
const ledger = read('components/ledger/experiences.tsx');
const trainingHub = read('components/training-hub/AthleteTrainingHubExperience.tsx');

assert.match(history, /EST\. STRENGTH[\s\S]*formatCalculatedWeightFromKg\(strength\.value_kg, unit\)/);
assert.match(history, /label="e10RM" value=\{formatCalculatedWeightFromKg\(exposure\.e10rm_kg, unit\)/);
assert.match(history, /formatCalculatedWeightFromKg\(detail\.e10rm_kg, unit\)/);
assert.match(history, /formatCalculatedWeightDeltaFromKg\(strength\.delta_kg, unit, 'signed'\)/);
assert.match(chart, /metric === 'e10rm'[\s\S]*formatCalculatedWeightValue/);
assert.match(recap, /PERFORMANCE PROJECTIONS[\s\S]*formatCalculatedWeightFromKg/);
assert.match(manager, /formatCalculatedWeightFromKg\(item\.suggested_tm, displayUnit\)/);
assert.match(home, /formatCalculatedWeightFromKg\(strength\.current_e1rm_kg, unit\)/);
assert.match(progression, /formatCalculatedWeightFromKg\(lift\.current_e1rm_kg, unit\)/);
assert.match(ledger, /HISTORICAL CONTEXT[\s\S]*formatCalculatedWeightValue\(Math\.min/);
assert.match(trainingHub, /isEstimated \? formatCalculatedWeightValue/);

console.log('Calculated-weight display precision contracts passed.');
