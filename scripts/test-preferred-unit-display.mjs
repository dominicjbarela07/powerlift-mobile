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
  normalizeDisplayWeightUnit,
  preferredUnitFromSettingsPayload,
  resolveDisplayWeightUnit,
} from '../lib/display-units.ts';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const hub = fs.readFileSync(path.join(root, 'components/training-hub/AthleteTrainingHubExperience.tsx'), 'utf8');
const sheet = fs.readFileSync(path.join(root, 'components/training-hub/TrainingHubSessionPreviewSheet.tsx'), 'utf8');
const route = fs.readFileSync(path.join(root, 'app/(tabs)/workout/index.tsx'), 'utf8');
const auth = fs.readFileSync(path.join(root, 'context/AuthContext.tsx'), 'utf8');
const settings = fs.readFileSync(path.join(root, 'app/(tabs)/settings.tsx'), 'utf8');
const dashboard = fs.readFileSync(path.join(root, 'app/(tabs)/athlete-dashboard.tsx'), 'utf8');
const ledgerExploration = fs.readFileSync(path.join(root, 'components/ledger/exploration-experiences.tsx'), 'utf8');
const coachAthleteSheet = fs.readFileSync(path.join(root, 'components/coach-mobile/CoachAthleteHubSheet.tsx'), 'utf8');
const coachHome = fs.readFileSync(path.join(root, 'components/coach-mobile/CoachActivityHome.tsx'), 'utf8');
const legacyCoachHome = fs.readFileSync(path.join(root, 'components/coach-mobile/CoachHomeV2.tsx'), 'utf8');
const coachAttention = fs.readFileSync(path.join(root, 'components/coach-mobile/CoachAttentionDetailV2.tsx'), 'utf8');
const coachHub = fs.readFileSync(path.join(root, 'components/coach-mobile/CoachAthleteHubV2.tsx'), 'utf8');
const videoPlayer = fs.readFileSync(path.join(root, 'components/SetVideoPlayerModal.tsx'), 'utf8');
const workspaceRoute = fs.readFileSync(path.join(root, 'app/(tabs)/workout/session-workspace/[workoutId].tsx'), 'utf8');
const loggerRoute = fs.readFileSync(path.join(root, 'app/(tabs)/workout/[workoutId].tsx'), 'utf8');
const videoArchive = fs.readFileSync(path.join(root, 'app/(tabs)/video-archive.tsx'), 'utf8');
const coachVideoArchive = fs.readFileSync(path.join(root, 'app/(tabs)/coach-video-archive.tsx'), 'utf8');
const ledgerArchive = fs.readFileSync(path.join(root, 'components/ledger/archive-foundation.tsx'), 'utf8');
const ledgerArchiveDetail = fs.readFileSync(path.join(root, 'components/ledger/archive-detail.tsx'), 'utf8');
const achievements = fs.readFileSync(path.join(root, 'components/ledger/AchievementsExperience.tsx'), 'utf8');
const journey = fs.readFileSync(path.join(root, 'components/ledger/journey-moments.ts'), 'utf8');
const meetPlan = fs.readFileSync(path.join(root, 'app/(tabs)/athlete-meet-plan.tsx'), 'utf8');
const legacyCalendar = fs.readFileSync(path.join(root, 'components/calendar/AthleteCalendarExperience.tsx'), 'utf8');

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
assert.equal(normalizeDisplayWeightUnit(undefined), 'lb');
assert.equal(formatWeightFromKg(90), '198.4 lb');
assert.equal(resolveDisplayWeightUnit({ viewerPreference: 'kg' }), 'kg');
assert.equal(resolveDisplayWeightUnit({ localOverride: 'lb', viewerPreference: 'kg' }), 'lb');
assert.equal(resolveDisplayWeightUnit({ localOverride: null, viewerPreference: null }), 'lb');
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
assert.equal(preferredUnitFromSettingsPayload({ user: { preferred_units: 'lbs' } }), 'lb');
assert.equal(preferredUnitFromSettingsPayload({ settings: { preferred_units: 'kg' } }), 'kg');
assert.deepEqual(
  ['lb', 'kg', 'lb'].map((unit) => formatTotalVolumeFromKg(15_826, unit)),
  ['34.9K lb Total Volume', '15.8K kg Total Volume', '34.9K lb Total Volume'],
);

assert.match(route, /preferredUnitFromSettingsPayload/);
assert.match(route, /trainingDisplayUnit/);
assert.doesNotMatch(route, /authoritativeDisplayUnit = parseDisplayWeightUnit\(responseHub\?\.athlete\?\.preferred_units\)/);
assert.match(auth, /preferred_units: preferredUnits \?\?/);
assert.match(settings, /json\.preferred_units\s*\|\|\s*json\.training_profile\?\.preferred_units/);
assert.match(settings, /fetchJson<any>\('\/mobile\/settings', \{\s*method: 'PATCH',\s*body: \{ preferred_units: units \}/s);
assert.match(hub, /formatSessionVolumeSummary/);
assert.match(hub, /formatTotalVolumeFromKg/);
assert.match(sheet, /formatTotalVolumeFromKg/);
assert.match(dashboard, /bodyweightKgToDisplay\(today\.athlete\?\.bodyweight_kg, bodyweightUnit\)/);
assert.match(ledgerExploration, /kilogramsToDisplayValue/);
assert.match(coachAthleteSheet, /normalizeDisplayWeightUnit\(user\?\.preferred_units\)/);
assert.doesNotMatch(coachAthleteSheet, /details\?\.athlete\.preferred_units \?\? athlete\.preferred_units/);
assert.match(coachHome, /displayUnit=\{viewerUnit\}/);
assert.doesNotMatch(coachHome, /formatCoach(?:Weight|Volume)\([^\n]*activity\.athlete\.preferred_units/);
assert.doesNotMatch(legacyCoachHome, /formatCoach(?:Weight|Volume)\([^\n]*athlete\.preferred_units/);
assert.match(legacyCoachHome, /viewerUnits=\{user\?\.preferred_units\}/);
assert.match(coachAttention, /formatCoachVolume\(lastSession\.total_volume_kg, user\?\.preferred_units\)/);
assert.match(coachHub, /const preferredUnits = user\?\.preferred_units/);
assert.match(videoPlayer, /defaultExportWeightUnit\(user\?\.preferred_units, context\)/);
assert.match(videoPlayer, /compactPrescriptionContext\(context, viewerDisplayUnit\)/);
assert.match(videoPlayer, /formatWeightFromKg\(prescription\.target_kg, unit\)/);
assert.doesNotMatch(videoPlayer, /const planLine = compactPrescriptionLabel\(context\?\.prescription_label\)/);
assert.match(videoPlayer, /return 'lbs';/);
assert.doesNotMatch(videoPlayer, /context\?\.preferred_units\) return/);
assert.match(workspaceRoute, /normalizeDisplayWeightUnit\(user\?\.preferred_units\)/);
assert.doesNotMatch(workspaceRoute, /preferred_units: plan\.metadataPatch\.displayUnit/);
assert.doesNotMatch(workspaceRoute, /payload\?\.athlete\?\.preferred_units/);
assert.match(loggerRoute, /normalizeReadinessUnit\(user\?\.preferred_units\)/);
assert.doesNotMatch(loggerRoute, /setUnit\(normalizeReadinessUnit\(payload\.athlete\?\.preferred_units\)\)/);
assert.match(coachAthleteSheet, /formatCompactVolumeValueFromKg\(volume, displayUnit\)/);
assert.match(coachAthleteSheet, /formatWeightFromKg\(latestBodyweight\?\.reported_bodyweight_kg, displayUnit\)/);
assert.doesNotMatch(coachAthleteSheet, /formatCoachWeight|formatCoachVolume/);
assert.doesNotMatch(ledgerExploration, /volume_kg \* 2\.2046226218/);
assert.doesNotMatch(hub, /\* 2\.2046226218/);
assert.doesNotMatch(sheet, /\* 2\.2046226218/);
assert.match(videoArchive, /formatWeightFromKg\(context\.actual_weight_kg, normalizeDisplayWeightUnit\(preferredUnits\)\)/);
assert.match(coachVideoArchive, /formatWeightFromKg\(context\.actual_weight_kg, normalizeDisplayWeightUnit\(preferredUnits\)\)/);
assert.match(ledgerArchive, /const displayUnit = normalizeDisplayWeightUnit\(user\?\.preferred_units\)/);
assert.match(ledgerArchive, /archiveFilterWeightKg\(filters\.weightMin, displayUnit\)/);
assert.match(ledgerArchiveDetail, /formatWeightFromKg\(value, unit, 2\)/);
assert.match(achievements, /normalizeDisplayWeightUnit\(user\?\.preferred_units\)/);
assert.match(achievements, /convertDisplayWeightValue\(item\.thresholdLb, 'lb', unit\)/);
assert.match(journey, /unit = 'lb'/);
assert.match(journey, /convertDisplayWeightValue\(total, 'kg', unit\)/);
assert.match(meetPlan, /const displayUnit = normalizeDisplayWeightUnit\(user\?\.preferred_units\)/);
assert.match(meetPlan, /displayMeetWeightToKg\(Number\(bodyweightText\), displayUnit\)/);
assert.match(meetPlan, /displayMeetWeightToKg\(actualWeightDisplay, displayUnit\)/);
assert.doesNotMatch(meetPlan, />kg</);
assert.match(legacyCalendar, /formatWeightFromKg\(value, displayUnit\)/);
assert.doesNotMatch(legacyCalendar, /`\$\{formatNumber\(value\)\} kg`/);

console.log('Preferred-unit display tests passed.');
