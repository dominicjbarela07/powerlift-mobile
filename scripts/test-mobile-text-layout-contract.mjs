import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import {
  guardedMobileLineHeight,
  MOBILE_TEXT_STRESS_FIXTURES,
} from '../lib/mobile-text-layout-core.ts';
import { convertLoggerPrescriptionUnit } from '../lib/logger-prescription-unit.ts';

const root = process.cwd();
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');

assert.equal(guardedMobileLineHeight(33, 28), 39, 'legacy responsive titles must not crop vertically');
assert.equal(guardedMobileLineHeight(34, 30), 41, 'large-width legacy titles must not crop vertically');
assert.equal(guardedMobileLineHeight(16, 22), undefined, 'valid deliberate line height must remain unchanged');
assert.equal(guardedMobileLineHeight(16, undefined), undefined, 'missing line height must remain natural');
assert.equal(
  convertLoggerPrescriptionUnit('Prescribed: 415 lb – 435 lb × 5 @7', 'kg'),
  'Prescribed: 187.5 kg – 197.5 kg × 5 @7',
  'Set-sheet supporting copy must follow the kg picker state',
);
assert.equal(
  convertLoggerPrescriptionUnit('Prescribed: 187.5 kg – 197.5 kg × 5 @7', 'lb'),
  'Prescribed: 415 lb – 435 lb × 5 @7',
  'Set-sheet supporting copy must return to pounds without stale labels',
);

const theme = read('constants/theme.ts');
const roleSource = theme.slice(theme.indexOf('export const SLTypographyRoles'), theme.indexOf('export function getSLDeviceTypographySize'));
for (const role of ['screenTitle', 'pageTitle', 'movementName', 'modalTitle', 'longButtonLabel']) {
  const roleMatch = roleSource.match(new RegExp(`\\n  ${role}: \\{([\\s\\S]*?)\\n  \\},`));
  assert.ok(roleMatch, `${role} typography role is missing`);
  const sizeMatch = roleMatch[1].match(/fontSize: \{ compact: ([\d.]+), standard: ([\d.]+), large: ([\d.]+) \}/);
  const lineMatch = roleMatch[1].match(/lineHeight: \{ compact: ([\d.]+), standard: ([\d.]+), large: ([\d.]+) \}/);
  assert.ok(sizeMatch && lineMatch, `${role} must define compact, standard, and large metrics`);
  for (let index = 1; index <= 3; index += 1) {
    assert.ok(Number(lineMatch[index]) >= Number(sizeMatch[index]), `${role} must preserve full glyph height for device class ${index}`);
  }
}
for (const role of ['pageTitle', 'movementName', 'modalTitle', 'longButtonLabel']) {
  assert.match(theme, new RegExp(`${role}: twoLineText`), `${role} must preserve a two-line wrapping contract`);
}

assert.deepEqual(MOBILE_TEXT_STRESS_FIXTURES.movementTitles, [
  'Single-Arm Plate-Loaded Iso-Lateral High Row',
  'Competition Bench Press — 3ct Pause',
  'Chest-Supported Dumbbell Row',
  'Neutral-Grip Lat Pulldown',
]);
for (const fixture of [
  MOBILE_TEXT_STRESS_FIXTURES.sessionTitle,
  MOBILE_TEXT_STRESS_FIXTURES.programTitle,
  MOBILE_TEXT_STRESS_FIXTURES.blockTitle,
  MOBILE_TEXT_STRESS_FIXTURES.athleteName,
  MOBILE_TEXT_STRESS_FIXTURES.equipmentIdentity,
  MOBILE_TEXT_STRESS_FIXTURES.loggerTitle,
  MOBILE_TEXT_STRESS_FIXTURES.prescribedLoad,
  MOBILE_TEXT_STRESS_FIXTURES.decimalLbValue,
  MOBILE_TEXT_STRESS_FIXTURES.fourDigitLbValue,
  MOBILE_TEXT_STRESS_FIXTURES.decimalKgValue,
  MOBILE_TEXT_STRESS_FIXTURES.dateRange,
  MOBILE_TEXT_STRESS_FIXTURES.status,
]) {
  assert.ok(fixture.length >= 8, `stress fixture is unexpectedly weak: ${fixture}`);
}

const sharedText = read('components/ui/sl-text.tsx');
assert.match(sharedText, /guardedMobileLineHeight\(flattenedStyle\?\.fontSize, flattenedStyle\?\.lineHeight\)/);
assert.doesNotMatch(sharedText, /allowFontScaling=\{false\}/);

const stressLabPath = 'app/(tabs)/dev-mocks/text-layout.tsx';
if (fs.existsSync(path.join(root, stressLabPath))) {
  const stressLab = read(stressLabPath);
  assert.match(stressLab, /MOBILE_TEXT_STRESS_FIXTURES/);
  assert.match(stressLab, /<LoggerSheetHeader/);
  assert.match(stressLab, /unit === 'kg'/);
  assert.match(stressLab, /<SLContextualHeader/);
  assert.match(stressLab, /<SLListRow/);
  assert.match(stressLab, /<SLQueueRow/);
  assert.match(stressLab, /iconRightPosition="edge"/);
} else {
  const appConfig = JSON.parse(read('app.json'));
  assert.equal(
    appConfig.expo?.extra?.releaseTrack,
    'testflight',
    'the text stress lab may only be absent from the governed TestFlight release projection',
  );
}

const loggerPrimitives = read('components/workout-logger/logger-primitives.tsx');
assert.match(loggerPrimitives, /export function LoggerSheetHeader/);
assert.match(loggerPrimitives, /numberOfLines=\{0\}[\s\S]*typographyRole="pageTitle"/);
assert.match(loggerPrimitives, /loggerSheetSupportRow:[\s\S]*flexDirection: 'row'[\s\S]*minWidth: 0/);
assert.match(loggerPrimitives, /loggerSheetSupporting:[\s\S]*flex: 1[\s\S]*minWidth: 0/);
assert.match(loggerPrimitives, /loggerSheetUnitControl:[\s\S]*flexShrink: 0/);

const loggerRoute = read('app/(tabs)/workout/[workoutId].tsx');
const coreLoggers = read('components/workout-logger/core-loggers.tsx');
const supersetWorkspace = read('components/workout-logger/superset-round-workspace.tsx');
assert.equal(
  loggerRoute.match(/<LoggerSheetHeader/g)?.length,
  3,
  'core, accessory, and edit Set sheets must share the collision-safe header',
);
assert.doesNotMatch(
  loggerRoute.slice(loggerRoute.indexOf('visible={!!coreWheel?.visible}'), loggerRoute.indexOf('<LoggerWheelPicker', loggerRoute.indexOf('visible={!!coreWheel?.visible}'))),
  /coreWheelHeaderRow/,
  'the core Set title must not share its row with the unit control',
);
assert.match(read('components/workout-logger/session-v3-movement.tsx'), /numberOfLines=\{0\} style=\{s\.title\}/, 'canonical Session Logger movement names must grow instead of ellipsizing');
assert.match(supersetWorkspace, /<Text numberOfLines=\{0\} style=\{\[s\.title,/, 'superset movement names must grow instead of ellipsizing');

const contextualHeader = read('components/ui/sl-contextual-header.tsx');
assert.match(contextualHeader, /<Text numberOfLines=\{0\} style=\{styles\.title\}>\{title\}<\/Text>/);
assert.match(contextualHeader, /<Text numberOfLines=\{0\} style=\{styles\.atmosphericTitle\}>\{title\}<\/Text>/);
assert.doesNotMatch(contextualHeader, /adjustsFontSizeToFit/);

const listRow = read('components/ui/sl-list-row.tsx');
const queueRow = read('components/ui/sl-queue-row.tsx');
const button = read('components/ui/sl-button.tsx');
const trainingHub = read('components/training-hub/AthleteTrainingHubExperience.tsx');
const strengthExperience = read('components/ledger/StrengthExperience.tsx');
const achievementsExperience = read('components/ledger/AchievementsExperience.tsx');
assert.match(listRow, /numberOfLines=\{2\} typographyRole="bodyStrong"/);
assert.match(queueRow, /numberOfLines=\{2\} typographyRole="bodyStrong"/);
assert.match(button, /labelWithEdgeIcon/);
assert.match(button, /flexShrink: 1/);
assert.match(trainingHub, /evidenceVolume:[\s\S]*flexShrink: 1[\s\S]*textAlign: 'right'/, 'the Training Hub volume summary must wrap inside its footer');
assert.doesNotMatch(strengthExperience, /liftOverviewCard:[^\n]*\bheight: 252\b/, 'Strength lift cards must grow with competitive-standing copy');
assert.match(strengthExperience, /liftOverviewCard:[^\n]*\bminHeight: 252\b/);
assert.doesNotMatch(achievementsExperience, /overviewLiftCard:[^\n]*\bheight: 214\b/, 'Achievement lift cards must grow with competitive-standing copy');
assert.match(achievementsExperience, /overviewLiftCard:[^\n]*\bminHeight: 214\b/);
assert.match(achievementsExperience, /typographyRole="caption" numberOfLines=\{0\} style=\{styles\.overviewLiftPercentile\}/, 'competitive-standing copy must remain complete');

const activeSurfaceInventory = [
  'app/(tabs)/athlete-dashboard.tsx',
  'app/(tabs)/workout/index.tsx',
  'app/(tabs)/athlete-calendar.tsx',
  'app/(tabs)/workout/[workoutId].tsx',
  'app/(tabs)/workout/create-program.tsx',
  'app/(tabs)/workout/session-workspace/[workoutId].tsx',
  'app/(tabs)/coach-dashboard.tsx',
  'app/(tabs)/coach-session-review.tsx',
  'components/coach-mobile/CoachActivityHome.tsx',
  'components/coach-mobile/CoachSessionReviewerV3.tsx',
  'app/(tabs)/ledger/index.tsx',
  'app/(tabs)/ledger/journey.tsx',
  'app/(tabs)/ledger/strength.tsx',
  'app/(tabs)/ledger/achievements.tsx',
  'app/(tabs)/ledger/accessories.tsx',
  'app/(tabs)/ledger/variants.tsx',
  'app/(tabs)/ledger/archive.tsx',
  'app/(tabs)/ledger/movement/[movementId].tsx',
  'app/(tabs)/ledger/muscle-groups/[region].tsx',
  'app/(tabs)/settings.tsx',
  'components/workout-logger/logger-modals.tsx',
  'components/workout-logger/smart-warmup-sheet.tsx',
  'components/workout-logger/superset-round-workspace.tsx',
  'components/workout-logger/post-session-surfaces.tsx',
  'components/coach-mobile/CompletedSessionRecap.tsx',
  'components/ui/sl-confirmation-modal.tsx',
  'components/ui/sl-state.tsx',
  'components/ui/floating-control-coordinator.tsx',
];
for (const relative of activeSurfaceInventory) {
  const source = read(relative);
  if (/<(?:Text|ThemedText)\b/.test(source)) {
    assert.match(source, /components\/ui\/sl-text|themed-text|from ['"]\.\/sl-text['"]|from ['"]\.\.\/ui\/sl-text['"]/, `${relative} must use the shared text safety layer`);
  }
  assert.doesNotMatch(source, /allowFontScaling=\{false\}/, `${relative} disables Dynamic Type`);
}

console.log(`[mobile-text-layout-contract] PASS — ${activeSurfaceInventory.length} active surfaces, 3 phone classes, lb/kg stress values, shared title/action primitives`);
