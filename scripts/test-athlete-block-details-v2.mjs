import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const sheet = readFileSync(new URL('../components/training-hub/AthleteBlockDetailsSheet.tsx', import.meta.url), 'utf8');
const hub = readFileSync(new URL('../app/(tabs)/workout/index.tsx', import.meta.url), 'utf8');
const obsoletePage = readFileSync(new URL('../app/(tabs)/workout/block-details.tsx', import.meta.url), 'utf8');

assert.match(sheet, /<StrengthLedgerBottomSheet/);
assert.match(sheet, /heightFraction=\{0\.93\}/);
assert.match(sheet, /motionPreset="deliberate"/);
assert.match(sheet, /testID="block-week-seven-day-rail"/);
assert.match(sheet, /Array\.from\(\{ length: 7 \}/, 'every Week rail must materialize exactly seven day cells');
assert.match(sheet, /week\.is_current/);
assert.match(sheet, /setExpandedWeek\(week\.week\)/);
assert.match(sheet, /styles\.weekHeader/);
assert.match(sheet, /styles\.currentBadge/);
assert.doesNotMatch(sheet, /timelineIdentity/, 'Week metadata must not be crushed into a fixed left sidebar');
assert.doesNotMatch(sheet, /numberOfLines=\{1\} style=\{styles\.weekDates\}/, 'Week date ranges must not truncate');
assert.match(sheet, /ProgrammingMuscleRegionArt/);
assert.doesNotMatch(sheet, /MuscleMap/);
assert.match(sheet, /No Sessions planned/);
assert.match(sheet, /session\.preview\?\.muscle_focus\?\.primary/);
assert.match(sheet, /onOpenSession\(session\)/);

assert.match(hub, /setBlockDetailsVisible\(true\)/);
assert.match(hub, /<AthleteBlockDetailsSheet/);
assert.doesNotMatch(
  hub.slice(hub.indexOf('const openBlockDetails ='), hub.indexOf('const openSessionHistory =')),
  /router\.push/,
  'Training Hub must open Block Details in-place instead of navigating to the obsolete page',
);
assert.match(obsoletePage, /export default function BlockDetailsScreen/);

console.log('[athlete-block-details-v2] sheet presentation, timeline, one-week expansion, canonical region art, truthful empty weeks, and in-place Training Hub launch passed');
