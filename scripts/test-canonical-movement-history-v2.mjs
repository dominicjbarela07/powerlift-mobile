import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { samePrimaryHistoryObservation } from '../lib/canonical-movement-history-contract.ts';

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
assert.match(screen, /CanonicalMovementArtwork movement=\{\{ \.\.\.history\.movement, kind: 'accessory' \}\}/);
assert.doesNotMatch(screen, /MuscleMap/);
assert.match(screen, /ManufacturerBrandMark/);
assert.match(screen, /View Full Session/);
assert.doesNotMatch(screen, /Rest Timer" value="Session evidence/);
assert.doesNotMatch(screen, /RIR Scaling" value="Canonical/);

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
assert.match(launch, /resolveLoggerMovementIdentity/);
assert.match(launch, /normalized\.effective\?\.id/);
assert.match(launch, /normalized\.equipment\?\.id/);
assert.match(launch, /canonical_identity_missing/);
assert.match(programmingRoute, /onOpenMovementHistory/);
assert.match(programmingRoute, /movementDefinitionId/);
assert.match(recap, /Canonical exact-movement evidence/);
assert.match(recap, /measurement\?\.canonical_identity_id/);
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
