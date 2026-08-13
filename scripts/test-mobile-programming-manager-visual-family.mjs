import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { compactProgrammingWeekdayLabel } from '../lib/programming-weekday-label.ts';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const managerPath = path.join(root, 'app/(tabs)/workout/index.tsx');
const loggerPath = path.join(root, 'app/(tabs)/workout/[workoutId].tsx');
const workspacePath = path.join(root, 'app/(tabs)/workout/session-workspace/[workoutId].tsx');
const hubPath = path.join(root, 'components/training-hub/AthleteTrainingHubExperience.tsx');
const surfacePath = path.join(root, 'components/training-hub/training-hub-material-surface.tsx');

const manager = fs.readFileSync(managerPath, 'utf8');
const logger = fs.readFileSync(loggerPath, 'utf8');
const workspace = fs.readFileSync(workspacePath, 'utf8');
const hub = fs.readFileSync(hubPath, 'utf8');
const surface = fs.readFileSync(surfacePath, 'utf8');

const tuesdayJuly28 = new Date(2026, 6, 28);
const july28WeekLabels = Array.from({ length: 7 }, (_, index) => {
  const date = new Date(tuesdayJuly28);
  date.setDate(date.getDate() + index);
  return compactProgrammingWeekdayLabel(date, index);
});
assert.deepEqual(
  july28WeekLabels,
  ['T', 'W', 'Th', 'F', 'Sa', 'Su', 'M'],
  'weekday labels must follow the actual dates when a block week starts on Tuesday',
);
assert.match(
  manager,
  /const label = compactProgrammingWeekdayLabel\(day, index\)/,
  'the production week strip must derive each label from its displayed date',
);

function styleBody(source, styleName) {
  const match = source.match(new RegExp(`\\n\\s{2}${styleName}: \\{([\\s\\S]*?)\\n\\s{2}\\},`));
  assert.ok(match, `Expected ${styleName} style`);
  return match[1];
}

assert.match(surface, /MovementCardMaterial/, 'shared surface must use the canonical material');
assert.match(hub, /TrainingHubMaterialSurface/, 'athlete Training Hub must use the shared surface');
assert.ok(
  (manager.match(/TrainingHubMaterialSurface/g) || []).length >= 4,
  'manager must use the shared Training Hub material family throughout its hierarchy'
);
assert.doesNotMatch(manager, /skewX/, 'manager must not retain the stale skewed tab treatment');

for (const action of [
  'Create Training Program',
  'Edit Block...',
  'Archive',
  'Delete',
  'Apply Block Template...',
  'Save Block Template...',
  'Assign All Draft Sessions',
  'Revert All Assigned Sessions',
  'Clear Block Sessions...',
  'Edit Week Objective...',
  'Set Week Focus...',
  'Copy To...',
  'Copy From...',
  'Shift Week...',
  'Clear Week...',
  'Add Session',
  'Edit ',
  'Ath View',
]) {
  assert.ok(manager.includes(action), `Expected reachable manager action: ${action}`);
}

for (const endpoint of [
  '/workouts/mobile/programming/week-actions',
  '/workouts/mobile/programming/block-actions',
  '/workouts/mobile/programming/session-actions',
  '/adopt-session',
]) {
  assert.ok(manager.includes(endpoint), `Expected live mutation path: ${endpoint}`);
}

for (const workspaceAction of [
  'Revert to Draft',
  'Copy Session To',
  'Save as Template',
  'Move Session',
  "key: 'delete', label: 'Delete'",
]) {
  assert.ok(workspace.includes(workspaceAction), `Expected Session workspace action: ${workspaceAction}`);
}

assert.match(manager, /const isProgrammingManager = isIndividual \|\| !!rosterAthleteId/, 'coach and self-coached modes must share the manager');
assert.match(manager, /coachMode=\{Boolean\(rosterAthleteId\)\}/, 'coach mode must be capability-driven');
assert.match(manager, /managedAthleteAvatarUrl/, 'coach mode must retain athlete identity');
assert.match(
  manager,
  /pathname: ['"]\/workout\/session-workspace\/\[workoutId\]['"][\s\S]*?\.\.\.\(rosterAthleteId \? \{ athleteId: rosterAthleteId \} : \{\}\)/,
  'Programming Manager must pass the managed athlete into the Session workspace'
);
assert.match(
  workspace,
  /athleteId\?: string \| string\[\][\s\S]*?const programmingAthleteId = firstParam\(params\.athleteId\)/,
  'Session workspace must retain the Programming Manager athlete context'
);
assert.match(
  workspace,
  /pathname: ['"]\/\(tabs\)\/workout['"][\s\S]*?\.\.\.\(programmingAthleteId \? \{ athleteId: programmingAthleteId \} : \{\}\)/,
  'Session workspace close must return to the Programming Manager for the same athlete'
);
assert.match(
  manager,
  /router\.replace\(\{\s*pathname: ['"]\/\(tabs\)\/coach-athlete\/\[athleteId\]['"][\s\S]*?athleteId: String\(managedAthleteId\)/,
  'Programming Manager exit must replace the route with the currently managed athlete workspace'
);
assert.match(
  manager,
  /onExitAthleteWorkspace=\{coachMode && managedAthleteId \? handleExitToAthleteWorkspace : undefined\}/,
  'the athlete workspace exit must only be enabled with a resolved coach-managed athlete'
);
assert.match(
  manager,
  /<Pressable[\s\S]*?accessibilityLabel=\{`Open \$\{managedAthleteName \|\| 'athlete'\} workspace`\}[\s\S]*?styles\.programCoachIdentity[\s\S]*?<Text style=\{styles\.programCoachIdentityLabel\}>PROGRAMMING FOR<\/Text>[\s\S]*?\{managedAthleteName \|\| 'Athlete'\}[\s\S]*?Athlete Workspace[\s\S]*?<SLProfileAvatar[\s\S]*?profilePhotoUrl=\{managedAthleteAvatarUrl\}/,
  'coach mode must integrate the workspace exit into the managed-athlete identity header'
);
assert.match(
  manager,
  /<View style=\{styles\.programCoachDetails\}>[\s\S]*?<Text style=\{styles\.programCoachDetailsLabel\}>TRAINING PROGRAM<\/Text>[\s\S]*?\{activeProgram\.name \|\| 'Training Program'\}/,
  'Training Program details must follow the prominent coach-mode athlete identity'
);
assert.doesNotMatch(
  manager,
  /name="ellipsis-horizontal"/,
  'Programming Manager controls must use explicit action labels instead of ambiguous ellipses'
);
assert.match(
  manager,
  /style=\{styles\.programActionsButtonText\}>Actions<\/Text>/,
  'Training Program menu must use an explicit Actions label'
);
assert.match(
  manager,
  /style=\{styles\.blockActionsButtonText\}>Actions<\/Text>/,
  'Training Block menu must use an explicit Actions label'
);
const programCoachIdentityCopy = styleBody(manager, 'programCoachIdentityCopy');
assert.match(programCoachIdentityCopy, /flex: 1/, 'athlete identity copy must expand so the avatar remains top-right');
assert.match(manager, /accessibilityState=\{\{ expanded \}\}/, 'week expansion state must be exposed');
assert.match(
  manager,
  /import \{ Swipeable \} from ['"]react-native-gesture-handler['"]/,
  'Session rows must use the established swipe primitive'
);
assert.match(manager, /renderRightActions=/, 'Session rows must expose a swipe action');
assert.match(
  manager,
  /renderRightActions=\{\(progress,\s*dragX\)\s*=>/,
  'Session swipe actions must animate from live gesture progress',
);
assert.match(
  manager,
  /const revealTranslateX = dragX\.interpolate\(/,
  'Session swipe actions must translate in proportion to the drag distance',
);
assert.match(
  manager,
  /transform:\s*\[\{ translateX: revealTranslateX \}\]/,
  'Session swipe actions must be progressively uncovered instead of appearing immediately',
);
assert.match(
  manager,
  /Swipe left for Edit or athlete view\./,
  'both Session swipe actions must be discoverable to assistive technology'
);
assert.match(
  manager,
  /accessibilityLabel=\{`Open \$\{preview\.code\} athlete view`\}/,
  'the athlete-view swipe action must be labeled'
);
assert.match(manager, /\{ name: 'edit', label: 'Edit Session' \}/);
assert.match(manager, /\{ name: 'view', label: 'Open athlete view' \}/);
assert.match(manager, /onViewSession=\{openWorkout\}/, 'Ath View must use the canonical production Session Logger route');
assert.match(
  manager,
  /pathname: ['"]\/workout\/\[workoutId\]['"]/,
  'Ath View must resolve through the canonical production Session Logger pathname'
);
assert.match(
  logger,
  /const isCoachView = isCoachAthletePreview \|\| \(!!data\.permissions\?\.can_coach && !canLogFromServer\);/,
  'the canonical Session Logger must retain server-authorized coach view-only behavior'
);
assert.match(
  manager,
  /rosterAthleteId \? \{\s*athleteView: 'coach-preview'/,
  'coach Athlete View must request the explicit server-authorized preview mode'
);
assert.doesNotMatch(
  manager,
  /accessibilityLabel=\{`Open \$\{preview\.code\} Session actions`\}/,
  'Session rows must not retain an ellipsis action button'
);
assert.match(manager, /estimated_duration_minutes/, 'Session rows must consume the live duration estimate');
assert.match(manager, /About \$\{session\.estimated_duration_minutes\} min/, 'Session duration must be visible');
assert.match(manager, /SLMotionEntrance/, 'existing motion and reduced-motion-aware primitive must remain');
assert.equal(
  (manager.match(/<Text style=\{styles\.addSessionButtonText\}>Add Session<\/Text>/g) || []).length,
  1,
  'the expanded week must expose one shared Add Session control regardless of whether the selected day is populated'
);
assert.match(
  manager,
  /\{selectedDay\?\.date \? \(\s*<Pressable[\s\S]*?styles\.weekAddSessionButton[\s\S]*?>Add Session<\/Text>/,
  'the expanded week Add Session control must be driven by the selected date, not by the empty-session branch'
);
assert.doesNotMatch(
  manager,
  /programmingSessionTitleLine/,
  'Session status must not remain inline with the variable-width title'
);
assert.match(
  manager,
  /<View style=\{styles\.programmingSessionStatusColumn\}>[\s\S]*?\{preview\.status\}/,
  'Session status must render in its own right-side column'
);

const sessionStatusColumn = styleBody(manager, 'programmingSessionStatusColumn');
assert.match(sessionStatusColumn, /alignItems: 'flex-end'/, 'Session status column must align to the right');
const sessionStatusLabel = styleBody(manager, 'sessionStatusLabel');
assert.match(sessionStatusLabel, /textAlign: 'right'/, 'Session status text must remain right-aligned');

const blockActionsButton = styleBody(manager, 'blockActionsButton');
assert.match(blockActionsButton, /minHeight: 32/, 'blockActionsButton must remain compact');
assert.match(blockActionsButton, /paddingHorizontal: 5/, 'blockActionsButton must use restrained horizontal padding');

const weekActionsButton = styleBody(manager, 'weekActionsButton');
assert.match(weekActionsButton, /minHeight: 30/, 'weekActionsButton must remain compact');
assert.match(manager, /<Text style=\{styles\.weekActionsText\}>Actions<\/Text>/);
assert.doesNotMatch(manager, /weekSessionCount/, 'redundant week Session counts must not render');
assert.match(manager, /function WeekActionPopout\(/, 'Week actions must render as an anchored popout');
assert.match(manager, /function BlockActionPopout\(/, 'Block actions must render as an anchored popout');
assert.doesNotMatch(manager, /function WeekActionMenu\(/, 'the Week bottom-sheet menu must be removed');
assert.doesNotMatch(manager, /function BlockActionMenu\(/, 'the Block bottom-sheet menu must be removed');
assert.match(
  manager,
  /anchorY: event\.nativeEvent\.pageY/,
  'action popouts must retain the vertical position of their triggering control'
);
assert.match(
  manager,
  /style=\{\[styles\.actionPopover, \{ maxHeight: estimatedHeight, top \}\]\}/,
  'action popouts must be positioned inside the viewport near their trigger'
);
assert.match(
  manager,
  /backgroundColor: 'rgba\(0, 0, 0, 0\.34\)'/,
  'action popouts must use a restrained scrim that preserves Program Manager context'
);

assert.doesNotMatch(manager, /\n\s{2}sessionOverflowButton: \{/, 'Session ellipsis styling must be removed');
assert.doesNotMatch(manager, /\n\s{2}sessionEditButton: \{/, 'large Session Edit buttons must be removed');
assert.doesNotMatch(
  manager,
  /\n\s{2}programmingSessionActions: \{/,
  'the large Session action stack must be removed'
);

for (const styleName of ['programmingScroll', 'roadmap', 'blockTabs', 'weekCardList']) {
  const body = styleBody(manager, styleName);
  assert.doesNotMatch(
    body,
    /paddingHorizontal|paddingLeft|paddingRight|marginHorizontal/,
    `${styleName} must not apply a second page-level horizontal gutter`
  );
}

for (const source of [manager, hub, surface]) {
  assert.doesNotMatch(source, /from ['"].*dev-mocks|fixtureData|mockProgramming/i, 'live surface must not import mock fixtures');
}

assert.doesNotMatch(manager, /programSummaryCard|programmingActiveCard/, 'stale generic program-card styles must be removed');
assert.match(manager, /Loading Programming/);
assert.match(manager, /Programming unavailable/);
assert.match(manager, /No active Training Program/);
assert.match(
  manager,
  /function ProgrammingEmptyState[\s\S]*TrainingHubMaterialSurface[\s\S]*No active Training Program[\s\S]*Create a program to get started\.[\s\S]*<SLButton[\s\S]*label="Program"[\s\S]*All Training Programs[\s\S]*Getting Started[\s\S]*Follow these steps to build your first program\./,
  'the empty Programming Manager must preserve the approved hero, CTA, program-library row, and Getting Started hierarchy',
);
assert.match(
  manager,
  /const GETTING_STARTED_STEPS = \[[\s\S]*Create a training program[\s\S]*Add your first block[\s\S]*Build your first session[\s\S]*Schedule training[\s\S]*\] as const/,
  'the approved four-step onboarding order must remain intact',
);
assert.match(manager, /variant="primary"/, 'the empty-state CTA must use the modern shared primary-action treatment');
assert.match(manager, /accentColor=\{tone\}[\s\S]*styles\.gettingStartedCard/, 'each Getting Started card must use the shared Logger material with a restrained semantic accent');
for (const requiredEmptyStyle of ['emptyProgramHeroTop', 'emptyProgramLibrary', 'gettingStartedHeading', 'gettingStartedCard', 'gettingStartedRow']) {
  styleBody(manager, requiredEmptyStyle);
}
assert.match(styleBody(manager, 'emptyProgramHeroTop'), /flexDirection: 'row'/, 'the hero must keep its approved icon-copy-CTA row composition');
assert.match(styleBody(manager, 'gettingStartedList'), /gap: 7/, 'Getting Started cards must retain the approved compact vertical rhythm');
assert.match(styleBody(manager, 'gettingStartedRow'), /minHeight: 72/, 'Getting Started cards must retain their approved proportions');
assert.doesNotMatch(manager, /programmingEmptyRow|programmingAddButton|gettingStartedText/, 'the retired empty-state rows and outlined CTA must not return');

console.log('mobile programming manager visual-family contract: PASS');
