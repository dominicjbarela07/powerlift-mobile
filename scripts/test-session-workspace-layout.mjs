#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (...parts) => fs.readFileSync(path.join(root, ...parts), 'utf8');

const manager = read('app', '(tabs)', 'workout', 'index.tsx');
const route = read('app', '(tabs)', 'workout', 'session-workspace', '[workoutId].tsx');
const editor = read('components', 'coach-mobile', 'SessionEditingWorkspace.tsx');
const sheet = read('components', 'sheets', 'StrengthLedgerBottomSheet.tsx');

const focused = read('components', 'coach-mobile', 'FocusedSessionAuthoring.tsx');
assert.match(manager, /<FocusedSessionAuthoring[\s\S]*?<MobileSessionWorkspaceContent/, 'manager retains one focused editor and the underlying week');
assert.match(focused, /SafeAreaProvider[\s\S]*SafeAreaView/, 'the native modal owns its safe-area context');
assert.match(focused, /presentationStyle="fullScreen"/, 'authoring uses the full device height');

assert.doesNotMatch(route, /programmingWeekContext|programmingWorkspaceSheet|programmingWorkspaceHandle|embeddedWorkspaceStage/, 'the canonical workspace route must not render a duplicate Week header or nested sheet frame.');
assert.doesNotMatch(route, /ProgrammingMuscleRegionArt/, 'the removed duplicate Week context must not leave a competing summary artwork layer.');
assert.match(route, /!props\.embedded \? <Tabs\.Screen options=\{\{ headerShown: true, tabBarStyle: \{ display: 'none' \} \}\}/, 'standalone deep links must retain the global app header while suppressing tab navigation.');

const topBarIndex = editor.indexOf('<View style={authorStyles.topbar}>');
const scrollIndex = editor.indexOf('<ScrollView', topBarIndex);
const identityIndex = editor.indexOf('authorStyles.identity', scrollIndex);
assert.ok(topBarIndex >= 0 && scrollIndex > topBarIndex && identityIndex > scrollIndex, 'stable Back/save state precedes scroll-owned metadata and movements');
assert.equal((editor.match(/ref=\{listScrollRef\}/g) || []).length, 1, 'the Session Workspace must retain one authoritative vertical list scroll owner.');
assert.match(editor, /setSessionEditorOverlayOpen\(true\)[\s\S]*?setSessionEditorOverlayOpen\(false\)/, 'workspace navigation suppression must cover the full mounted editor lifecycle, not only dirty state.');
assert.doesNotMatch(editor, /insets\.bottom \+ SLSpacing\.xs \+ SL_TAB_ROW_CONTROL\.shellHeight/, 'the standalone toolkit must not reserve or collide with a tab bar that is suppressed for the workspace lifecycle.');
assert.match(editor, /viewportWidth < 360 \|\| fontScale >= 1\.3/, 'compact phones and large Dynamic Type must keep the established reflow path.');
assert.match(editor, /CanonicalMovementArtwork/, 'individual movement cards must retain canonical governed artwork.');

console.log('[session-workspace-layout] ok');
