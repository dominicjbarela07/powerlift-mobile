#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const workspace = fs.readFileSync(path.join(root, 'components', 'coach-mobile', 'SessionEditingWorkspace.tsx'), 'utf8');
const route = fs.readFileSync(path.join(root, 'app', '(tabs)', 'workout', 'session-workspace', '[workoutId].tsx'), 'utf8');

const toolkit = workspace.match(/function SessionFloatingToolkit[\s\S]*?\n}\n\nfunction ToolkitSectionHeader/)?.[0] || '';
assert.match(toolkit, /\(canAthleteView \|\| canReorder\)/, 'the Workspace section remains present when Reorder is the only available action');
assert.match(toolkit, /\{canReorder \? <ToolkitAction[^>]*label="Reorder Movements"[^>]*onPress=\{onReorder\}/, 'authorized Reorder is rendered independently of Session dirtiness');
assert.doesNotMatch(toolkit, /!restricted && canReorder|canReorder && !restricted|\{restricted \?[^\n]*Reorder Movements/, 'dirty/restricted lifecycle state never disables or hides Reorder');
assert.match(workspace, /function ToolkitAction[\s\S]*style=\{\(\{ pressed \}\)[\s\S]*pressed && styles\.pressed/, 'Reorder uses the tactile toolkit action primitive');
assert.match(workspace, /canReorder=\{!!capabilities\.can_reorder\}/, 'backend-authoritative Workspace capability controls Reorder for every authorized role');

const openReorder = workspace.match(/const openReorder = useCallback[\s\S]*?\n  \}, \[[^\]]*\]\);/)?.[0] || '';
assert.doesNotMatch(openReorder, /isIndividual|selfCoach|teamCoach|user\?\.role/, 'self-coach and team-coach Reorder share one capability-gated draft transaction');
assert.match(openReorder, /coreIds: sessionDraft\.coreOrder/, 'Reorder starts from the live Core order');
assert.match(openReorder, /accessoryIds: sessionDraft\.accessoryOrder/, 'Reorder starts from the live Accessory order');
assert.match(openReorder, /coreItems: currentCoreItems\.map[\s\S]*movementItemWithDraft/, 'Reorder receives unsaved Core prescription/title presentation');
assert.match(openReorder, /accessoryItems: currentAccessoryItems\.map[\s\S]*movementItemWithDraft/, 'Reorder receives unsaved and newly-added Accessory draft items');
assert.match(openReorder, /setSessionDraft\(\(current\) => \(\{ \.\.\.current, coreOrder: order\.coreIds, accessoryOrder: order\.accessoryIds \}\)\)/, 'Done mutates only order inside the same Session draft');
assert.doesNotMatch(openReorder, /onSaveSession|loadSession|fetchJson|setPersistedSession/, 'opening/applying Reorder never autosaves or reconstructs from the server');

assert.match(route, /type ReorderEditorState = \{[\s\S]*coreIds[\s\S]*accessoryIds[\s\S]*coreItems[\s\S]*accessoryItems/, 'the Reorder editor owns a snapshot of the current draft items as well as their order');
assert.match(route, /const openReorderEditor[\s\S]*coreItems: order\.coreItems[\s\S]*accessoryItems: order\.accessoryItems/, 'the route preserves the current draft snapshot when opening Reorder');
assert.match(route, /const cancelReorderEditor[\s\S]*reorderCompletionRef\.current = null[\s\S]*setReorderEditor\(null\)/, 'Cancel drops only the transient Reorder editor');
assert.doesNotMatch(route.match(/const cancelReorderEditor[\s\S]*?\n  };/)?.[0] || '', /loadSession|setPayload|fetchJson/, 'Cancel cannot overwrite pre-existing dirty state');

assert.match(workspace, /const sessionDirty = sessionWorkspaceDraftIsDirty\(sessionDraft, persistedSession\)/, 'one coherent Session draft controls dirty state');
assert.match(workspace, /function sessionWorkspaceDraftIsDirty[\s\S]*sessionWorkspaceMetadataIsDirty[\s\S]*coreOrder[\s\S]*accessoryOrder[\s\S]*movementDraftIsDirty/, 'title/date/notes, order, prescriptions, Accessory additions, and superset edits remain part of the same dirty comparison');
assert.match(workspace, /function buildSessionWorkspaceSavePlan[\s\S]*metadataPatch[\s\S]*movementUpdates[\s\S]*movementCreates[\s\S]*deletedMovementIds[\s\S]*orderChanged/, 'Save builds one combined transaction plan for every pending mutation');
assert.match(workspace, /const discardWorkspaceChanges[\s\S]*cloneSessionWorkspaceDraft\(persistedSession\)/, 'Discard restores metadata, movements, groups, and order from one persisted snapshot');
assert.match(route, /const saveSessionDraft = async[\s\S]*metadataPatch[\s\S]*movementUpdates[\s\S]*movementCreates[\s\S]*items\/reorder[\s\S]*loadSession\(true\)/, 'the route persists the combined draft before authoritative reload');
assert.match(workspace, /supersetGroup[\s\S]*supersetPosition/, 'superset membership and position remain movement-draft state during Reorder');

// User-story state matrix: Reorder applies only an order delta and therefore cannot
// erase any prior dirty concept. This mirrors the component callback above and fails
// loudly if a future refactor replaces the draft instead of merging it.
const persisted = {
  title: 'W4 Back', notes: '', coreOrder: [1], accessoryOrder: [2, 3],
  movements: { 1: { reps: '5' }, 2: { reps: '10', supersetGroup: '' }, 3: { reps: '12', supersetGroup: '' } },
};
const dirtyCases = [
  ['title', { ...persisted, title: 'W4 Pull' }],
  ['prescription', { ...persisted, movements: { ...persisted.movements, 2: { ...persisted.movements[2], reps: '15' } } }],
  ['accessory addition', { ...persisted, accessoryOrder: [2, 3, -1], movements: { ...persisted.movements, [-1]: { reps: '8', supersetGroup: '' } } }],
  ['superset', { ...persisted, movements: { ...persisted.movements, 2: { ...persisted.movements[2], supersetGroup: 'A' }, 3: { ...persisted.movements[3], supersetGroup: 'A' } } }],
];
for (const [name, draft] of dirtyCases) {
  const reordered = { ...draft, accessoryOrder: [...draft.accessoryOrder].reverse() };
  assert.equal(reordered.title, draft.title, `${name}: title survives Reorder`);
  assert.deepEqual(reordered.movements, draft.movements, `${name}: movement/superset draft survives Reorder`);
  assert.notDeepEqual(reordered.accessoryOrder, persisted.accessoryOrder, `${name}: reordered state remains dirty`);
}
const cancelled = dirtyCases[0][1];
assert.deepEqual(cancelled.accessoryOrder, persisted.accessoryOrder, 'Cancel does not apply a transient order change');
assert.notEqual(cancelled.title, persisted.title, 'Cancel preserves pre-existing dirty state');
const discarded = structuredClone(persisted);
assert.deepEqual(discarded, persisted, 'Session-level Discard restores every persisted field including order');

console.log('[session-workspace-dirty-reorder] dirty title/prescription/accessory/superset reorder, Cancel, Save-plan, and Discard contracts verified');
