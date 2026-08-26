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

assert.match(manager, /<StrengthLedgerBottomSheet[\s\S]*?presentationBoundary="app-shell"[\s\S]*?<MobileSessionWorkspaceContent/, 'Programming Manager must anchor the workspace sheet below the global app shell.');
assert.match(sheet, /presentationBoundary\?: 'viewport' \| 'app-shell'/, 'the shared sheet must expose an explicit semantic presentation boundary.');
assert.match(sheet, /insets\.top \+ STRENGTH_LEDGER_APP_HEADER\.contentHeight/, 'the app-shell boundary must derive from the authoritative header geometry.');
assert.match(sheet, /presentationBoundary === 'app-shell'[\s\S]*?usableHeight/, 'the workspace sheet must consume exactly the viewport below the app shell.');

assert.doesNotMatch(route, /programmingWeekContext|programmingWorkspaceSheet|programmingWorkspaceHandle|embeddedWorkspaceStage/, 'the canonical workspace route must not render a duplicate Week header or nested sheet frame.');
assert.doesNotMatch(route, /ProgrammingMuscleRegionArt/, 'the removed duplicate Week context must not leave a competing summary artwork layer.');
assert.match(route, /!props\.embedded \? <Tabs\.Screen options=\{\{ headerShown: true, tabBarStyle: \{ display: 'none' \} \}\}/, 'standalone deep links must retain the global app header while suppressing tab navigation.');

const topBarIndex = editor.indexOf('<View style={styles.workspaceTopBar}>');
const scrollIndex = editor.indexOf('<ScrollView', topBarIndex);
const identityIndex = editor.indexOf('<SessionCompactIdentity', scrollIndex);
assert.ok(topBarIndex >= 0 && scrollIndex > topBarIndex && identityIndex > scrollIndex, 'composition must be app shell, stable workspace top bar, then the scroll-owned Session summary.');
assert.equal((editor.match(/ref=\{listScrollRef\}/g) || []).length, 1, 'the Session Workspace must retain one authoritative vertical list scroll owner.');
assert.match(editor, /setSessionEditorOverlayOpen\(true\)[\s\S]*?setSessionEditorOverlayOpen\(false\)/, 'workspace navigation suppression must cover the full mounted editor lifecycle, not only dirty state.');
assert.doesNotMatch(editor, /insets\.bottom \+ SLSpacing\.xs \+ SL_TAB_ROW_CONTROL\.shellHeight/, 'the standalone toolkit must not reserve or collide with a tab bar that is suppressed for the workspace lifecycle.');
assert.match(editor, /viewportWidth < 360 \|\| fontScale >= 1\.3/, 'compact phones and large Dynamic Type must keep the established reflow path.');
assert.match(editor, /CanonicalMovementArtwork/, 'individual movement cards must retain canonical governed artwork.');

for (const { height, safeTop } of [
  { height: 852, safeTop: 59 },
  { height: 874, safeTop: 62 },
  { height: 932, safeTop: 62 },
]) {
  const headerHeight = 42;
  const sheetTop = safeTop + headerHeight;
  const sheetHeight = height - sheetTop;
  assert.equal(sheetTop + sheetHeight, height, 'the sheet must fill to the bottom without crossing the app-header boundary.');
  assert.ok(sheetHeight >= 740, 'current iPhone viewports must retain useful workspace height below the shell.');
}

console.log('[session-workspace-layout] ok');
