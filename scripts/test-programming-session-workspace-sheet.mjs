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
const athleteHub = read('components', 'coach-mobile', 'CoachAthleteHubSheet.tsx');
const sheet = read('components', 'sheets', 'StrengthLedgerBottomSheet.tsx');

assert.match(manager, /useState<ProgrammingWorkspaceSelection \| null>\(null\)/, 'Programming Manager must own the open workspace state.');
assert.match(manager, /setWorkspaceSelection\(\{ workoutId, context \}\)/, 'opening a Session must preserve its block, Week, and day context in-place.');
assert.match(manager, /<ScrollView[\s\S]*?<StrengthLedgerBottomSheet[\s\S]*?<MobileSessionWorkspaceContent/, 'the mounted Programming Map must remain behind the workspace sheet.');
assert.match(manager, /<MobileSessionWorkspaceContent[\s\S]*?embedded[\s\S]*?programmingBlockId=[\s\S]*?programmingWeek=[\s\S]*?programmingDay=/, 'the sheet must render the canonical workspace with its Programming context.');
assert.match(manager, /presentationBoundary="app-shell"/, 'the workspace sheet must begin below the authoritative app header.');
assert.doesNotMatch(manager, /function SessionAddModal[\s\S]*?router\.push\([\s\S]*?session-workspace/, 'template/adopt flows inside Programming Manager must not escape to a workspace route.');
assert.match(manager, /function SessionAddModal[\s\S]*?onOpenSession\(Number\(createdSessionId\)\)[\s\S]*?onOpenSession\(Number\(adoptedSessionId\)\)/, 'newly materialized Sessions must open in the same sheet.');

assert.match(route, /export function MobileSessionWorkspaceContent/, 'the canonical route content must be reusable without duplicating the editor.');
assert.match(route, /!props\.embedded && authReady/, 'embedded self-coached workspaces must remain in the Programming sheet.');
assert.match(route, /props\.onClose[\s\S]*?props\.onClose\(\)/, 'embedded close must dismiss rather than navigate.');
assert.match(route, /!props\.embedded \? <Tabs\.Screen/, 'only the standalone deep-link route may alter tab presentation.');
assert.match(route, /sheetPresentation=\{props\.embedded\}/, 'the canonical editor must receive sheet-safe positioning.');
assert.match(route, /registerDismissRequest=\{props\.registerDismissRequest\}/, 'sheet dismissal must pass through the editor dirty-state guard.');
assert.doesNotMatch(route, /programmingWeekContext|programmingWorkspaceSheet|programmingWorkspaceHandle/, 'the reusable workspace must not stack a second Week header or sheet inside the outer sheet.');

assert.match(editor, /registerDismissRequest\?\.\(\(\) => resolveDirty\(onCloseWorkspace\)\)/, 'backdrop, close, and drag dismissal must protect unsaved changes.');
assert.match(editor, /automaticallyAdjustKeyboardInsets/, 'workspace scrolling must continue to own keyboard adjustment.');
assert.match(editor, /keyboardShouldPersistTaps="handled"/, 'keyboard interaction must not steal workspace controls.');
assert.match(editor, /props\.sheetPresentation[\s\S]*?SLSpacing\.md/, 'the embedded floating toolkit must not reserve tab-bar space inside the sheet.');
assert.match(editor, /setSessionEditorOverlayOpen\(true\)/, 'the workspace must suppress competing navigation for its entire mounted lifecycle.');

for (const source of [manager, athleteHub]) {
  assert.match(source, /StrengthLedgerBottomSheet/, 'Programming Manager and Athlete Hub must share one sheet primitive.');
}
assert.match(sheet, /presentationStyle="overFullScreen"/, 'the primitive must present over mounted content.');
assert.match(sheet, /heightFraction = 0\.93[\s\S]*Math\.min\(0\.93, heightFraction\)/, 'the shared sheet must retain its near-full-height default while allowing compact contextual sheets.');
assert.match(sheet, /useSafeAreaInsets\(\)/, 'the shared sheet must respect device safe areas.');
assert.match(sheet, /STRENGTH_LEDGER_APP_HEADER\.contentHeight/, 'app-shell sheets must share the root header geometry rather than inventing another inset.');
assert.match(sheet, /PanResponder\.create/, 'the shared handle must support drag-down dismissal.');
assert.match(sheet, /DISMISS_DISTANCE|DISMISS_VELOCITY/, 'drag dismissal must use deliberate distance and velocity thresholds.');
assert.match(sheet, /Animated\.spring\(translateY/, 'entry and cancelled drags must use the established weighted spring.');
assert.match(sheet, /useSLReducedMotion\(\)/, 'sheet motion must respect reduced-motion settings.');
assert.match(sheet, /<View style=\{styles\.chrome\} \{\.\.\.dragResponder\.panHandlers\}>[\s\S]*?<View style=\{styles\.content\}>\{children\}<\/View>/, 'only sheet chrome may own the drag gesture; inner content owns vertical scrolling.');
assert.match(sheet, /Dismiss \$\{accessibilityLabel\}[\s\S]*?onPress=\{requestClose\}/, 'backdrop dismissal must use the same guarded close path.');

console.log('[programming-session-workspace-sheet] ok');
