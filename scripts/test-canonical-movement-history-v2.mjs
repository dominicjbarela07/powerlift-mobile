import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { samePrimaryHistoryObservation } from '../lib/canonical-movement-history-contract.ts';
import {
  buildLoadRepProfileLayout,
  loadRepProfileAccessibilityLabel,
} from '../lib/load-rep-profile.ts';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

const primary = {
  exposure_id: '41:9',
  workout_id: 41,
  date: '2026-08-21',
  set_log_id: 801,
  weight_kg: 49.895,
  reps: 9,
  rir: 1,
  e10rm_kg: 64.12,
};
assert.equal(samePrimaryHistoryObservation(primary, { ...primary }), true);
assert.equal(samePrimaryHistoryObservation(primary, { ...primary, set_log_id: 802 }), false);
assert.equal(samePrimaryHistoryObservation(primary, { ...primary, reps: 12 }), false);

const KG_TO_LB = 2.2046226218;
const performedSet = (id, pounds, reps, date, exposureId = `exposure:${id}`, extra = {}) => ({
  id,
  exposure_id: exposureId,
  date,
  weight_kg: pounds / KG_TO_LB,
  reps,
  ...extra,
});
const profileEvidence = [
  performedSet(1, 250, 15, '2026-05-10'),
  performedSet(2, 275, 12, '2026-06-12'),
  performedSet(3, 300, 10, '2026-07-01', 'prime:3', { rir: 1 }),
  performedSet(4, 300, 8, '2026-07-08', 'matrix:4'),
  performedSet(5, 320, 10, '2026-08-16', 'newtech:5', { rir: 0 }),
  performedSet(6, 300, 10, '2026-07-15', 'prime:6', { rir: 2 }),
  performedSet(7, 300, 10, '2026-07-22', 'resolved-legacy:7', { rir: 1 }),
  performedSet(8, 285, 11, '2026-07-29', 'unknown:8'),
];
const profileLayout = buildLoadRepProfileLayout({
  observations: profileEvidence,
  unit: 'lb',
  plotLeft: 48,
  plotRight: 328,
  plotTop: 24,
  plotBottom: 190,
});
assert.equal(profileLayout.observationCount, 8);
assert.ok(profileLayout.xDomain[0] > 0, 'rep domain must not default to zero');
assert.ok(profileLayout.yDomain[0] > 0, 'load domain must not default to zero');
assert.ok(profileLayout.xTicks.every((tick) => tick >= profileLayout.xDomain[0] && tick <= profileLayout.xDomain[1]));
assert.ok(profileLayout.yTicks.every((tick) => tick >= profileLayout.yDomain[0] && tick <= profileLayout.yDomain[1]));

const coordinateFor = (reps, load) => profileLayout.coordinates.find((point) => point.reps === reps && Math.abs(point.load - load) < 0.0001);
const threeHundredByTen = coordinateFor(10, 300);
const threeHundredByEight = coordinateFor(8, 300);
const threeTwentyByTen = coordinateFor(10, 320);
assert.ok(threeHundredByTen && threeHundredByEight && threeTwentyByTen);
assert.equal(threeHundredByTen.observations.length, 3, 'identical coordinates retain all performed-set evidence');
assert.equal(threeHundredByTen.y, threeHundredByEight.y, 'equal loads share an exact Y coordinate');
assert.equal(threeHundredByTen.x, threeTwentyByTen.x, 'equal reps share an exact X coordinate');
assert.ok(threeHundredByEight.x < threeHundredByTen.x, 'fewer reps plot to the left');
assert.ok(threeTwentyByTen.y < threeHundredByTen.y, 'heavier loads plot higher');
assert.ok(threeHundredByTen.radius > coordinateFor(8, 300).radius, 'repeat density increases point size without coordinate jitter');
assert.match(loadRepProfileAccessibilityLabel(threeHundredByTen, 'lb', 'Prime Fitness · Plate Loaded'), /300 pounds for 10 reps, 1 RIR[\s\S]*3 performed sets/);

const kgProfile = buildLoadRepProfileLayout({
  observations: profileEvidence,
  unit: 'kg',
  plotLeft: 48,
  plotRight: 328,
  plotTop: 24,
  plotBottom: 190,
});
assert.ok(Math.abs(kgProfile.coordinates.find((point) => point.reps === 10 && point.observations.length === 3).load - (300 / KG_TO_LB)) < 0.0001);
for (const sparse of [profileEvidence.slice(0, 1), profileEvidence.slice(0, 2)]) {
  const sparseLayout = buildLoadRepProfileLayout({ observations: sparse, unit: 'lb', plotLeft: 48, plotRight: 328, plotTop: 24, plotBottom: 190 });
  assert.equal(sparseLayout.observationCount, sparse.length);
  assert.ok(sparseLayout.coordinates.every((point) => Number.isFinite(point.x) && Number.isFinite(point.y)));
}

const api = read('lib/canonical-movement-history.ts');
const screen = read('components/movement-history/CanonicalMovementHistoryScreen.tsx');
const chart = read('components/movement-history/AnalyticalHistoryChart.tsx');
const logger = read('app/(tabs)/workout/[workoutId].tsx');
const ledgerRoute = read('app/(tabs)/ledger/movement/[movementId].tsx');
const historyRoute = read('app/(tabs)/workout/movement-history.tsx');
const programmingRoute = read('app/(tabs)/workout/session-workspace/[workoutId].tsx');
const recap = read('components/coach-mobile/CompletedSessionRecap.tsx');
const coachReview = read('app/(tabs)/coach-session-review.tsx');
const sheetRoute = read('app/movement-history-sheet.tsx');
const rootLayout = read('app/_layout.tsx');
const ledgerExperiences = read('components/ledger/exploration-experiences.tsx');
const sheetPrimitive = read('components/sheets/StrengthLedgerBottomSheet.tsx');
const launch = read('lib/movement-history-launch.ts');

assert.match(api, /view: 'v2'/);
assert.match(api, /analytics_cursor/);
assert.match(api, /equipment_context_definition_id/);
assert.match(api, /equipment_not_recorded/);
assert.match(api, /movement-history\/exposures\/\$\{encodeURIComponent\(exposureId\)\}/);
assert.match(api, /favorite\?athlete_id=\$\{athleteId\}/);

assert.match(screen, /EQUIPMENT BREAKDOWN[\s\S]*PERFORMANCE TREND[\s\S]*LOAD PROGRESSION[\s\S]*KEY STATISTICS[\s\S]*EXPOSURE HISTORY/);
assert.match(screen, /fetchCanonicalMovementExposure\(query, exposureId\)/);
assert.match(screen, /StrengthLedgerBottomSheet[\s\S]*Exposure Details/);
assert.match(screen, /All History/);
assert.match(screen, /Every resolved exposure/);
assert.match(screen, /No canonical exposures in this filter\./);
assert.match(screen, /Equipment was not recorded/);
assert.match(screen, /recorded_unknown_equipment/);
assert.match(screen, /Unknown exposure/);
assert.match(screen, /never mixed with named equipment/);
assert.match(screen, /function compactSetLoad/);
assert.match(screen, /function compactSetEffort/);
assert.match(screen, /function compactEquipmentLabel/);
assert.match(screen, /exposureHeaderRow[\s\S]*exposureMetrics[\s\S]*ExposureMetric/);
assert.match(screen, /numberOfLines=\{1\} adjustsFontSizeToFit minimumFontScale=\{0\.8\}/);
assert.doesNotMatch(screen, /resolvedDefaultEquipment/);
assert.match(screen, /kilogramsToDisplayValue/);
assert.match(screen, /AccessoryMuscleRegionMedallion/);
assert.match(screen, /canonicalAccessoryMuscleRegionKey\(history\?\.movement\.primary_muscle_group\)/);
assert.doesNotMatch(screen, /MuscleMap/);
assert.match(screen, /ManufacturerBrandMark/);
assert.match(screen, /View Full Session/);
assert.doesNotMatch(screen, /Rest Timer" value="Session evidence/);
assert.doesNotMatch(screen, /RIR Scaling" value="Canonical/);
assert.match(screen, /buildLoadRepProfileLayout/);
assert.match(screen, /layout\.xTicks\.map/);
assert.match(screen, /layout\.yTicks\.map/);
assert.match(screen, /loadRepProfileAccessibilityLabel/);
assert.match(screen, /performed set/);
assert.match(screen, /Unknown equipment/);
assert.doesNotMatch(screen, /index >= plotted\.length/);

assert.match(chart, /Canvas/);
assert.match(chart, /Skia\.Path\.Make/);
assert.match(chart, /onResponderMove/);
assert.match(chart, /new Date\(point\.performed_at \|\| `\$\{point\.date\}T12:00:00`\)\.getTime\(\)/);
assert.match(chart, /point\.reps/);
assert.doesNotMatch(chart, /Polyline|MiniTrend|Sparkline/);

assert.match(historyRoute, /Redirect[\s\S]*movementHistorySheetRouteForCanonicalIdentity/);
assert.match(ledgerRoute, /Redirect[\s\S]*movementHistorySheetRouteForCanonicalIdentity/);
assert.match(sheetRoute, /StrengthLedgerBottomSheet/);
assert.match(sheetRoute, /CanonicalMovementHistoryScreen/);
assert.match(sheetRoute, /presentation="sheet"/);
assert.match(sheetRoute, /motionPreset="deliberate"/);
assert.match(sheetPrimitive, /duration: 440/);
assert.match(sheetPrimitive, /duration: deliberateMotion \? 320 : 180/);
assert.match(rootLayout, /name="movement-history-sheet"[\s\S]*presentation: 'transparentModal'/);
assert.match(logger, /movementHistorySheetRoute/);
assert.doesNotMatch(logger, /pathname: '\/\(tabs\)\/workout\/movement-history'/);
assert.match(logger, /resolveMovementHistoryLaunchForItem/);
assert.match(launch, /performed_core_movement\?\.id \|\| item\.core_movement\?\.id/);
assert.match(launch, /coreMovementId/);
assert.match(sheetRoute, /params\.coreMovementId/);
assert.match(screen, /CoreVariantBadge/);
assert.match(screen, /ledgerCoreLiftAsset/);
assert.match(launch, /performed_canonical_movement_identity\?\.id[\s\S]*movement_identity\?\.id[\s\S]*effective_movement_identity\?\.id[\s\S]*effective_movement_definition_id/);
assert.match(launch, /activeEquipmentIdentity/);
assert.match(launch, /canonical_identity_missing/);
assert.match(programmingRoute, /onOpenMovementHistory/);
assert.match(programmingRoute, /movementDefinitionId/);
assert.match(recap, /Canonical exact-movement evidence/);
assert.match(recap, /measurement\?\.canonical_identity_id/);
assert.doesNotMatch(recap, /movement\.kind === 'accessory' && movement\.measurement\?\.canonical_identity_id/);
assert.match(coachReview, /onOpenMovementHistory/);
assert.match(coachReview, /movementHistorySheetRoute/);
assert.match(programmingRoute, /movementHistorySheetRoute/);
assert.match(ledgerExperiences, /movementHistorySheetRouteForCanonicalIdentity/);

for (const source of [screen, chart]) {
  const sizes = [...source.matchAll(/fontSize:\s*([0-9]+(?:\.[0-9]+)?)/g)].map((match) => Number(match[1]));
  assert.ok(sizes.length > 0);
  assert.ok(Math.min(...sizes) >= 10, `Movement History typography dropped below 10pt: ${Math.min(...sizes)}`);
}

console.log('[movement-history-v2] canonical surface, analytics charts, shared detail, units, and entry-point contracts passed');
