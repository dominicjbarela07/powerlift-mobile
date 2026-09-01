import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const manager = fs.readFileSync(path.join(root, 'app/(tabs)/workout/index.tsx'), 'utf8');
const moveSheet = fs.readFileSync(path.join(root, 'components/coach-mobile/ProgrammingSessionMoveModal.tsx'), 'utf8');
const workspace = fs.readFileSync(path.join(root, 'components/coach-mobile/SessionEditingWorkspace.tsx'), 'utf8');
const canonicalSheet = fs.readFileSync(path.join(root, 'components/sheets/StrengthLedgerBottomSheet.tsx'), 'utf8');

function functionSource(source, name, nextName) {
  const start = source.indexOf(`function ${name}`);
  assert.notEqual(start, -1, `${name} must exist`);
  const end = nextName ? source.indexOf(`function ${nextName}`, start + 1) : source.length;
  assert.notEqual(end, -1, `${nextName} must exist after ${name}`);
  return source.slice(start, end);
}

for (const [name, next] of [
  ['StoryboardSheet', 'MiniReadinessChart'],
  ['SessionAddModal', 'SessionAddChoice'],
  ['ProgramActionsModal', 'WeekActionPopout'],
  ['WeekActionPopout', 'BlockActionPopout'],
  ['BlockActionPopout', 'ActionGroup'],
  ['WeekActionModal', 'BlockActionModal'],
  ['BlockActionModal', 'weekActionLabel'],
]) {
  const source = functionSource(manager, name, next);
  assert.match(source, /ProgrammingManagerSheet/, `${name} must use the canonical Programming Manager sheet`);
  assert.doesNotMatch(source, /<Modal\b/, `${name} must not restore a raw React Native Modal`);
}

const weekAction = functionSource(manager, 'WeekActionModal', 'BlockActionModal');
assert.match(weekAction, /roadmapWeekIdentityKey\(candidate\) !== roadmapWeekIdentityKey\(state\.week\)/, 'the current week must be excluded from Copy From/To candidates');
assert.match(weekAction, /COPY INTO/);
assert.match(weekAction, /COPY FROM/);
assert.match(weekAction, /Select the populated week you want to copy/);
assert.match(weekAction, /Select the week you want to copy into/);
assert.match(weekAction, /Upcoming empty weeks/);
assert.match(weekAction, /Copying…/);
assert.match(weekAction, /Current Block/);
assert.match(weekAction, /Previous Block/);
assert.match(weekAction, /Earlier \/ Later/);
assert.match(weekAction, /storyboardWeekSessionCount\(candidate\)/, 'populated targets must be explicit');
assert.match(weekAction, /accessibilityRole="radio"/);
assert.match(weekAction, /Haptics\.selectionAsync/);
assert.match(weekAction, /Clear Objective/);
assert.match(weekAction, /keyboardAware=/);

const sessionActions = functionSource(manager, 'SessionActionsSheet', 'SessionActionRow');
assert.match(sessionActions, /Save as Session Template/);
assert.match(sessionActions, /Copy Session To/);
assert.match(sessionActions, /Move Session To/);
assert.match(sessionActions, /Delete this editable Session/);
assert.doesNotMatch(functionSource(manager, 'ActiveProgrammingRoadmap', 'ProgrammingStoryboard'), /Alert\.alert\(\s*sessionTitle\(session\)/, 'Session actions must not regress to a native Alert menu');

assert.match(moveSheet, /StrengthLedgerBottomSheet/);
assert.doesNotMatch(moveSheet, /<Modal\b/);
assert.match(moveSheet, /Haptics\.selectionAsync/);
assert.match(moveSheet, /busy \? busyLabel : actionLabel/);

for (const name of ['SessionRenameModal', 'SessionDatePickerModal']) {
  const source = functionSource(workspace, name, name === 'SessionRenameModal' ? 'SessionDatePickerModal' : 'IdentityMeta');
  assert.match(source, /StrengthLedgerBottomSheet/);
  assert.doesNotMatch(source, /<Modal\b/);
}

const workspacePrompt = functionSource(workspace, 'SessionWorkspacePromptSheet', 'SessionCompactIdentity');
assert.match(workspacePrompt, /StrengthLedgerBottomSheet/);
assert.match(workspacePrompt, /Unsaved Session changes/);
assert.match(workspacePrompt, /Add Movement/);
assert.match(workspacePrompt, /Remove movement\?/);
assert.match(workspacePrompt, /Discard/);
assert.doesNotMatch(workspace, /Alert\.alert/, 'Session Workspace actions and confirmations must not regress to native Alert overlays');

assert.match(canonicalSheet, /Swipe down to close/);
assert.match(canonicalSheet, /shouldDismissBottomSheet/);
assert.match(canonicalSheet, /Gesture\.Simultaneous\(createDismissGesture\(true, bodyDrag\), Gesture\.Native\(\)\)/);
assert.doesNotMatch(canonicalSheet, /PanResponder/);
assert.match(canonicalSheet, /paddingBottom: Math\.max\(insets\.bottom, 10\)/);

console.log('Programming Manager canonical overlay, copy workflow, tactile, and dismissal contracts passed.');
