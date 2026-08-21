import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { compactProgrammingWeekdayLabel } from '../lib/programming-weekday-label.ts';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const manager = fs.readFileSync(path.join(root, 'app/(tabs)/workout/index.tsx'), 'utf8');
const workspace = fs.readFileSync(path.join(root, 'app/(tabs)/workout/session-workspace/[workoutId].tsx'), 'utf8');

const tuesdayJuly28 = new Date(2026, 6, 28);
assert.deepEqual(Array.from({ length: 7 }, (_, index) => {
  const date = new Date(tuesdayJuly28);
  date.setDate(date.getDate() + index);
  return compactProgrammingWeekdayLabel(date, index);
}), ['T', 'W', 'Th', 'F', 'Sa', 'Su', 'M']);

for (const endpoint of [
  '/workouts/mobile/programming/week-actions',
  '/workouts/mobile/programming/block-actions',
  '/workouts/mobile/programming/session-actions',
  '/adopt-session',
]) assert.ok(manager.includes(endpoint), `missing live mutation path: ${endpoint}`);

for (const action of [
  'Create Training Program',
  'Apply Block Template...',
  'Save Block Template...',
  'Assign All Draft Sessions',
  'Clear Block Sessions...',
  'Edit Week Objective...',
  'Copy To...',
  'Shift Week...',
  'Add Session',
  'Open Athlete Workspace',
]) assert.ok(manager.includes(action), `missing reachable Programming Manager action: ${action}`);

assert.match(manager, /const isProgrammingManager = isIndividual \|\| !!rosterAthleteId/, 'coach and self-coached modes must share the manager');
assert.match(manager, /coachMode=\{Boolean\(rosterAthleteId\)\}/, 'coach mode must remain capability-driven');
assert.match(manager, /managedAthleteAvatarUrl/, 'coach mode must preserve athlete identity');
assert.match(manager, /router\.replace\(\{ pathname: '\/\(tabs\)\/workout', params: \{ athleteId: String\(id\) \} \}/, 'athlete switching must stay inside Programming Manager');

assert.match(manager, /'PROGRAMMING\\nMANAGER'/, 'the page header must follow the supplied two-line reference');
assert.doesNotMatch(manager, /Overview Map/, 'the rejected subtitle must not return');
assert.match(manager, /topbarCopy: \{[^\n]*alignItems: 'flex-start'/, 'the page title must align left');
assert.match(manager, /topbarTitle: \{[^\n]*fontFamily: SLFontFamilies\.display/, 'the page title must share Calendar typography');
assert.match(manager, /programArtworkFrame: \{[^\n]*width: '64%'/, 'program environment artwork must occupy the integrated right/background field');
assert.match(manager, /resizeMode="cover" source=\{programArtwork\}/, 'program artwork must remain full-bleed and atmospheric');
assert.doesNotMatch(manager, /blockChip:/, 'Block navigation must not become a card wall');
assert.match(manager, /blockDivider:[\s\S]*blockNavItem:/, 'Block states must breathe on the canvas with subtle separators');
assert.match(manager, /onLongPress=\{\(\) => \{ storyboardSelectionFeedback\(\); onBlockActions\(block\); \}\}/, 'de-cardifying Block navigation must not remove Block actions');

assert.match(manager, /<ProgrammingIntelligenceStrip[\s\S]*coverage=\{coverage\}[\s\S]*displayUnit=\{displayUnit\}/, 'the analytical strip must consume canonical coverage and preferred units');
assert.match(manager, /<HomeTrendPlot[\s\S]*points=\{readinessPoints\}/, 'readiness must use the real chronological plot');
assert.match(manager, /formatWeightFromKg\(suggestion\?\.current_tm, displayUnit\)/, 'TM Review must honor preferred units');

assert.match(manager, /storyboardWeekSessionCount\(week\)/, 'Week counts must derive from canonical Week Sessions');
assert.match(manager, /weekPillCount[\s\S]*storyboardStateColor\(state\)/, 'Week counts must carry semantic state color');
assert.doesNotMatch(manager, /weekPillEvidence|statusDot/, 'Week counts must not be subordinated to dots');
assert.match(manager, /\{day\.sessions\.length\}<\/Text>[\s\S]*dayStatusRail/, 'day cells must expose their Session counts');
assert.doesNotMatch(manager, /<ProgrammingMuscleRegionArt level="week"/, 'Week headers must remain anatomy-free');
assert.match(manager, /<ProgrammingMuscleRegionArt level="session" primary=\{focus\.primary\}/, 'Session rows must use canonical region artwork');
assert.match(manager, /storyboardSessionEvidence\(session, displayUnit\)/, 'Session rows must use real compact evidence');

assert.match(manager, /SLMotionPressable/, 'tactile controls must use the reduced-motion-aware primitive');
assert.match(manager, /Haptics\.selectionAsync\(\)/, 'Block, Week, day, and Session selection must retain restrained feedback');
assert.match(manager, /<StrengthLedgerBottomSheet[\s\S]*?<MobileSessionWorkspaceContent/, 'Session Workspace must open over the mounted Programming Manager');
assert.match(manager, /<MobileSessionWorkspaceContent[\s\S]*?embedded[\s\S]*?athleteId=\{managedAthleteId \|\| hub\?\.athlete\?\.id \|\| null\}/, 'the in-place workspace must preserve the managed athlete');
assert.match(workspace, /<ProgrammingMuscleRegionArt level="session" primary=\{workspaceFocus\.primary\}/, 'Session Workspace must preserve Session-level region artwork');

for (const asset of [
  'assets/images/gym_vibe.jpg',
  'assets/images/journey-gym-rack.png',
  'assets/images/ledger-index-v2/ledger-core-squat-rack-v1.png',
  'assets/images/lift-icons/achievement-material-v2/squat.png',
  'assets/images/lift-icons/achievement-material-v2/bench.png',
  'assets/images/lift-icons/achievement-material-v2/deadlift.png',
  'assets/images/muscle-regions/back-region.png',
  'assets/images/muscle-regions/quads.png',
]) assert.ok(fs.existsSync(path.join(root, asset)), `missing governed Programming Manager asset: ${asset}`);

console.log('Mobile Programming Manager high-fidelity family contracts passed.');
