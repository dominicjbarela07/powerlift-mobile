import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  formatCompactWeightFromKg,
  formatCompactVolumeValueFromKg,
  formatSessionVolumeSummary,
  formatTotalVolumeFromKg,
  formatWeightDeltaFromKg,
  formatWeightFromKg,
  convertDisplayWeightValue,
  kilogramsToDisplayValue,
  preferredUnitFromSettingsPayload,
} from '../lib/display-units.ts';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const hub = fs.readFileSync(path.join(root, 'components/training-hub/AthleteTrainingHubExperience.tsx'), 'utf8');
const sheet = fs.readFileSync(path.join(root, 'components/training-hub/TrainingHubSessionPreviewSheet.tsx'), 'utf8');
const route = fs.readFileSync(path.join(root, 'app/(tabs)/workout/index.tsx'), 'utf8');
const auth = fs.readFileSync(path.join(root, 'context/AuthContext.tsx'), 'utf8');
const dashboard = fs.readFileSync(path.join(root, 'app/(tabs)/athlete-dashboard.tsx'), 'utf8');
const ledgerExploration = fs.readFileSync(path.join(root, 'components/ledger/exploration-experiences.tsx'), 'utf8');
const coachAthleteSheet = fs.readFileSync(path.join(root, 'components/coach-mobile/CoachAthleteHubSheet.tsx'), 'utf8');

assert.equal(kilogramsToDisplayValue(10_600, 'lb').toFixed(4), '23368.9998');
assert.equal(convertDisplayWeightValue(100, 'kg', 'lb').toFixed(6), '220.462262');
assert.equal(convertDisplayWeightValue(220.46226218, 'lb', 'kg').toFixed(6), '100.000000');
assert.equal(formatCompactWeightFromKg(10_600, 'lb'), '23.4K lb');
assert.equal(formatCompactWeightFromKg(10_600, 'kg'), '10.6K kg');
assert.equal(formatCompactWeightFromKg(4_388.50618, 'lb'), '9,675 lb');
assert.equal(formatCompactWeightFromKg(11_800, 'lb'), '26.0K lb');
assert.equal(formatCompactWeightFromKg(10_550, 'lb'), '23.3K lb');
assert.equal(formatCompactWeightFromKg(15_826, 'lb'), '34.9K lb');
assert.equal(formatCompactWeightFromKg(15_826, 'kg'), '15.8K kg');
assert.equal(formatCompactVolumeValueFromKg(8_410, 'lb'), '18.5K lb');
assert.equal(formatCompactVolumeValueFromKg(8_410, 'kg'), '8.4K kg');
assert.equal(formatWeightFromKg(90, 'lb'), '198.4 lb');
assert.equal(formatWeightFromKg(90, 'kg'), '90 kg');
assert.equal(formatWeightFromKg(0, 'lb'), null);
assert.equal(formatWeightDeltaFromKg(-0.544, 'lb'), '↓ 1.2 lb');
assert.equal(formatTotalVolumeFromKg(10_600, 'lb'), '23.4K lb Total Volume');
assert.equal(formatTotalVolumeFromKg(10_600, 'kg'), '10.6K kg Total Volume');
assert.equal(
  formatSessionVolumeSummary({ loggedSetCount: 21, totalVolumeKg: 10_600, unit: 'lb' }),
  '21 sets · 23.4K lb Total Volume',
);
assert.equal(preferredUnitFromSettingsPayload({ training_profile: { preferred_units: 'lbs' } }), 'lb');
assert.equal(preferredUnitFromSettingsPayload({ training_profile: { context: { preferred_units: 'kg' } } }), 'kg');
assert.deepEqual(
  ['lb', 'kg', 'lb'].map((unit) => formatTotalVolumeFromKg(15_826, unit)),
  ['34.9K lb Total Volume', '15.8K kg Total Volume', '34.9K lb Total Volume'],
);

assert.match(route, /preferredUnitFromSettingsPayload/);
assert.match(route, /trainingDisplayUnit/);
assert.match(route, /responseHub\?\.athlete\?\.preferred_units/);
assert.match(auth, /preferred_units: preferredUnits \?\?/);
assert.match(hub, /formatSessionVolumeSummary/);
assert.match(hub, /formatTotalVolumeFromKg/);
assert.match(sheet, /formatTotalVolumeFromKg/);
assert.match(dashboard, /bodyweightKgToDisplay\(today\.athlete\?\.bodyweight_kg, bodyweightUnit\)/);
assert.match(ledgerExploration, /kilogramsToDisplayValue/);
assert.match(coachAthleteSheet, /details\?\.athlete\.preferred_units \?\? athlete\.preferred_units/);
assert.match(coachAthleteSheet, /formatCompactVolumeValueFromKg\(volume, displayUnit\)/);
assert.match(coachAthleteSheet, /formatWeightFromKg\(latestBodyweight\?\.reported_bodyweight_kg, displayUnit\)/);
assert.doesNotMatch(coachAthleteSheet, /formatCoachWeight|formatCoachVolume/);
assert.doesNotMatch(ledgerExploration, /volume_kg \* 2\.2046226218/);
assert.doesNotMatch(hub, /\* 2\.2046226218/);
assert.doesNotMatch(sheet, /\* 2\.2046226218/);

console.log('Preferred-unit display tests passed.');
