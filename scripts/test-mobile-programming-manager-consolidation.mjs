import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const manager = fs.readFileSync(path.join(root, 'app/(tabs)/workout/index.tsx'), 'utf8');
const moveModal = fs.readFileSync(path.join(root, 'components/coach-mobile/ProgrammingSessionMoveModal.tsx'), 'utf8');
const swipeRow = fs.readFileSync(path.join(root, 'components/gestures/SwipeActionRow.tsx'), 'utf8');

assert.doesNotMatch(manager, /useState<'overview' \| 'week'>/, 'the duplicate Week navigation state must stay retired');
assert.doesNotMatch(manager, /weekOpenControl|Open Week/, 'the main Week workspace must not expose a redundant open control');
assert.match(manager, /function selectWeekInPlace|const selectWeekInPlace/, 'Week selection must update the mounted Programming Manager');
assert.match(manager, /selectedWeek\.days\.flatMap\(\(day\) => day\.sessions\.map/, 'all Sessions, including multiple on one day, must render in place');
assert.match(manager, /accessibilityLabel=\{`Add Session on \$\{formatLongDate\(selectedDay\.date\)\}`\}/, 'empty and populated days must expose in-place creation');
assert.match(manager, /function SessionAddModal[\s\S]*?fetchJson<any>\('\/workouts\/mobile\/new'/, 'Build New must create a server-backed draft');
assert.doesNotMatch(manager, /function SessionAddModal[\s\S]*?pathname: '\/\(tabs\)\/create-workout'/, 'Build New must not route through the deprecated creator');
assert.match(manager, /<StrengthLedgerBottomSheet[\s\S]*?<MobileSessionWorkspaceContent/, 'Session tap must open the canonical embedded workspace');
assert.match(manager, /accessibilityLabel=\{`Week \$\{selectedWeek\.index\} actions`\}/, 'Week actions must remain on the main workspace');
assert.match(manager, /<SwipeActionRow[\s\S]*?onAction=\{runSwipeAction\}/, 'Session rows must use the canonical swipe primitive');
assert.match(manager, /Copy Session To…/);
assert.match(manager, /Move Session To…/);
assert.match(manager, /Save as Session Template/);
assert.match(manager, /Delete Session…/);
assert.match(manager, /canonicalBlockRelativeWeeks/);
assert.match(manager, /canonicalProgrammingWeekKey/);
assert.match(manager, /programmingBlockId[\s\S]*?programmingWeek[\s\S]*?programmingDay/, 'deep-link context must focus the canonical Programming Manager');

assert.match(moveModal, /action\?: 'copy' \| 'move'/);
assert.match(moveModal, /action === 'copy' \? 'Copy Session' : 'Move Session'/);
assert.match(swipeRow, /\.minPointers\(1\)/);
assert.match(swipeRow, /\.maxPointers\(1\)/);
assert.match(swipeRow, /\.failOffsetY\(\[-SWIPE_VERTICAL_FAILURE_DISTANCE, SWIPE_VERTICAL_FAILURE_DISTANCE\]\)/);

console.log('Mobile Programming Manager consolidation contracts passed.');
