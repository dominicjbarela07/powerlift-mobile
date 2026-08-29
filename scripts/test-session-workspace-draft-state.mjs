#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (...parts) => fs.readFileSync(path.join(root, ...parts), 'utf8');
const workspace = read('components', 'coach-mobile', 'SessionEditingWorkspace.tsx');
const route = read('app', '(tabs)', 'workout', 'session-workspace', '[workoutId].tsx');

assert.match(workspace, /type SessionWorkspaceDraft = \{[\s\S]*title: string[\s\S]*athleteId[\s\S]*scheduledDate[\s\S]*notes[\s\S]*items[\s\S]*movements[\s\S]*coreOrder[\s\S]*accessoryOrder/, 'one Session draft owns every editable persisted Session concept');
assert.doesNotMatch(workspace.match(/type SessionWorkspaceDraft = \{[\s\S]*?\n\};/)?.[0] || '', /displayUnit/, 'presentation-only display unit must remain outside the persisted Session draft');
assert.match(workspace, /const \[persistedSession, setPersistedSession\][\s\S]*const \[sessionDraft, setSessionDraft\][\s\S]*const \[selectedId, setSelectedId\]/, 'the persisted snapshot, authoritative draft, and presentation-only expansion state are separate');
assert.match(workspace, /const sessionDirty = sessionWorkspaceDraftIsDirty\(sessionDraft, persistedSession\)/, 'one semantic comparison owns Session dirtiness');
assert.match(workspace, /function sessionWorkspaceDraftIsDirty[\s\S]*sessionWorkspaceMetadataIsDirty[\s\S]*coreOrder[\s\S]*accessoryOrder[\s\S]*movementDraftIsDirty/, 'persisted metadata, order, and all movement programming participate in dirtiness');

const openMovement = workspace.match(/const openMovement = useCallback[\s\S]*?\n  \}, \[[^\]]*\]\);/)?.[0] || '';
assert.match(openMovement, /selectedId === item\.id \? null : item\.id/, 'tapping an expanded movement collapses it and tapping another switches directly');
assert.doesNotMatch(openMovement, /resolveDirty|Alert\.alert|setSessionDraft|setPersistedSession/, 'movement expansion never saves, discards, guards, or resets the Session draft');
const collapseMovement = workspace.match(/const collapseMovement = useCallback[\s\S]*?\n  \}, \[[^\]]*\]\);/)?.[0] || '';
assert.match(collapseMovement, /setSelectedId\(null\)/, 'collapse changes only presentation state');
assert.doesNotMatch(collapseMovement, /resolveDirty|setSessionDraft|setPersistedSession/, 'collapse never mutates persistence state');

assert.match(workspace, /items\.map\(\(item\) => item\.id === selectedId[\s\S]*<InlineMovementWorkspace[\s\S]*<VisualMovementRow/, 'exactly one movement expands inline while the remaining movement cards stay collapsed');
assert.match(workspace, /movementItemWithDraft\(item, sessionDraft\.movements\[item\.id\]/, 'collapsed cards reflect unsaved draft programming');
assert.match(workspace, /\{sessionDirty \? \([\s\S]*<MovementActionBar[\s\S]*onSave=\{\(\) => \{ void saveWorkspaceChanges\(\); \}\}[\s\S]*onDiscard=\{discardWorkspaceChanges\}/, 'sticky Save and Discard apply to the entire Session regardless of expansion state');
assert.match(workspace, /const discardWorkspaceChanges[\s\S]*setSessionDraft\(cloneSessionWorkspaceDraft\(persistedSession\)\)/, 'Discard restores the entire persisted Session snapshot');
assert.match(workspace, /const saveWorkspaceChanges[\s\S]*onSaveSession\(buildSessionWorkspaceSavePlan\(sessionDraft, persistedSession, draftStorageUnit\)\)[\s\S]*if \(!success\)[\s\S]*return false[\s\S]*setPersistedSession/, 'failed saves retain the draft and successful saves establish a clean snapshot');
assert.match(workspace, /function buildSessionWorkspaceSavePlan[\s\S]*movementUpdates[\s\S]*movementCreates[\s\S]*deletedMovementIds[\s\S]*orderChanged/, 'the Session save plan covers edits, additions, deletions, and reorder operations');

assert.match(workspace, /const resolveDirty[\s\S]*Unsaved Session changes/, 'Session-boundary navigation retains a unified dirty guard');
assert.match(workspace, /onAthleteView=\{\(\) => \{[\s\S]*setToolkitExpanded\(false\)[\s\S]*resolveDirty\(props\.onOpenAthleteView\)/, 'Athlete View closes the toolkit and remains guarded at the Session boundary');
assert.match(workspace, /renderLifecycleActions\(guardLifecycle, sessionDirty\)/, 'lifecycle transitions are guarded and restricted at the Session boundary');
assert.match(workspace, /restricted=\{sessionDirty\}/, 'dirty state restricts the floating toolkit');
assert.match(route, /renderLifecycleActions=\{\(guard, restricted\)[\s\S]*onlyDelete=\{restricted\}/, 'dirty toolkit keeps only the destructive Session action');
assert.match(workspace, /!restricted && canRename[\s\S]*!restricted && canChangeDate[\s\S]*canAddMovement \? <ToolkitAction icon="add-circle-outline" label="Add Movement"/, 'dirty toolkit keeps Add Movement while hiding Rename Session and Change Date');
assert.match(workspace, /\(canAthleteView \|\| canReorder\)[\s\S]*canAthleteView \? <ToolkitAction[^>]*label="Athlete View"[\s\S]*canReorder \? <ToolkitAction[^>]*label="Reorder Movements"/, 'Reorder remains a visible editing action in both clean and dirty Session states');
assert.doesNotMatch(workspace, /!restricted && canReorder|restricted \?[^\n]*Reorder Movements/, 'Session dirtiness never gates Reorder availability');
assert.doesNotMatch(workspace, /onReorder=\{\(\) => resolveDirty|resolveDirty\(\(\) => props\.onDeleteMovement|resolveDirty\(open\)/, 'internal Session editing actions never trigger persistence guards');

assert.match(route, /onSaveSession=\{saveSessionDraft\}/, 'the route receives one Session save command');
assert.match(route, /const saveSessionDraft = async[\s\S]*\/rename[\s\S]*\/setup[\s\S]*\/programming-notes[\s\S]*deletedMovementIds[\s\S]*movementUpdates[\s\S]*movementCreates[\s\S]*items\/reorder[\s\S]*loadSession\(true\)/, 'the route orchestrates granular canonical mutations and refetches only after success');
assert.match(route, /catch \(err: any\) \{[\s\S]*Could not save Session[\s\S]*return false/, 'partial failure returns one Session-level error without clearing local edits');
assert.match(route, /addCoreCompletionRef[\s\S]*nextDraftMovementIdRef[\s\S]*addAccessoryCompletionRef/, 'new movements enter local temporary Session state before save');
assert.match(workspace, /coreItems: currentCoreItems\.map[\s\S]*accessoryItems: currentAccessoryItems\.map[\s\S]*movementItemWithDraft/, 'Reorder receives the complete current in-memory draft, including unsaved movement presentation and newly added movements');
assert.match(route, /reorderCompletionRef[\s\S]*reorderCompletionRef\.current\(nextOrder\)/, 'reorder changes return to the local Session draft before save');
assert.match(route, /const cancelReorderEditor[\s\S]*reorderCompletionRef\.current = null[\s\S]*setReorderEditor\(null\)/, 'Cancel closes Reorder without applying or reconstructing the Session draft');
assert.match(route, /loadedWorkoutIdRef[\s\S]*sessionChanged[\s\S]*setPayload\(null\)[\s\S]*addAccessoryCompletionRef\.current = null/, 'changing Sessions clears every prior workspace and picker reference before hydration');
assert.match(route, /method: 'POST'[\s\S]*body: \{ confirm: true \}[\s\S]*\+\+loadRequestRevisionRef\.current[\s\S]*setPayload\(null\)[\s\S]*closeToProgrammingHome/, 'deletion invalidates late requests and clears the deleted Session before navigation');
assert.match(route, /normalizeDisplayWeightUnit\(user\?\.preferred_units\)/, 'the signed-in viewer preference initializes the presentation-only workspace unit');
assert.doesNotMatch(route, /payload\?\.athlete\?\.preferred_units \|\| user\?\.preferred_units/, 'the programmed athlete preference must not overwrite the viewer presentation unit');

console.log('[session-workspace-draft-state] authoritative Session draft invariants verified');
