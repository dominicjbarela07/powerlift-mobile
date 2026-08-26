#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  movementDraftFromItem,
  movementDraftIsDirty,
  storedRangeFromManualTarget,
} from '../lib/coach-session-editor.ts';
import {
  buildSessionWorkspaceMetadataPatch,
  sessionWorkspaceMetadataIsDirty,
} from '../lib/session-workspace-persistence.ts';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const workspace = fs.readFileSync(path.join(root, 'components/coach-mobile/SessionEditingWorkspace.tsx'), 'utf8');
const route = fs.readFileSync(path.join(root, 'app/(tabs)/workout/session-workspace/[workoutId].tsx'), 'utf8');

const persistedMetadata = {
  title: 'W4 Back',
  athleteId: 3,
  scheduledDate: '2026-08-21',
  notes: 'Keep the eccentric controlled.',
};

const withPresentationUnit = (displayUnit) => ({ ...persistedMetadata, displayUnit });
assert.equal(sessionWorkspaceMetadataIsDirty(withPresentationUnit('lb'), persistedMetadata), false, 'lb presentation must keep a clean Session clean');
assert.equal(sessionWorkspaceMetadataIsDirty(withPresentationUnit('kg'), persistedMetadata), false, 'kg presentation must keep a clean Session clean');
assert.equal(sessionWorkspaceMetadataIsDirty(withPresentationUnit('lb'), withPresentationUnit('kg')), false, 'lb -> kg -> lb is outside persisted comparison');
assert.deepEqual(buildSessionWorkspaceMetadataPatch(withPresentationUnit('kg'), persistedMetadata), {}, 'unit-only changes must produce no Session metadata payload');

const persistedMovement = movementDraftFromItem({
  id: 17,
  lift: 'VR',
  movement: 'Paused Bench Press',
  sets: 3,
  reps: 5,
  coach_prescribed_low_kg: 100,
  coach_prescribed_high_kg: 100,
}, 'lb');
const untouchedAfterUnitToggle = structuredClone(persistedMovement);
assert.equal(movementDraftIsDirty(untouchedAfterUnitToggle, persistedMovement), false, 'viewing the same canonical load in another unit must not mutate the draft');

const editedKgRangeStoredAsLb = storedRangeFromManualTarget('105', '0', 'kg', 'lb');
const editedMovement = {
  ...untouchedAfterUnitToggle,
  targetLowLb: editedKgRangeStoredAsLb.low,
  targetHighLb: editedKgRangeStoredAsLb.high,
};
assert.equal(movementDraftIsDirty(editedMovement, persistedMovement), true, 'editing the underlying load after a unit toggle must remain a real dirty change');
assert.equal(movementDraftIsDirty(structuredClone(persistedMovement), persistedMovement), false, 'discard restores the persisted programming while unit selection remains presentation-only');

const draftType = workspace.match(/type SessionWorkspaceDraft = \{[\s\S]*?\n\};/)?.[0] || '';
const savePlanType = workspace.match(/export type SessionWorkspaceSavePlan = \{[\s\S]*?\n\};/)?.[0] || '';
const unitHandler = workspace.match(/const changeEditorDisplayUnit = useCallback[\s\S]*?\n  \}, \[[^\]]*\]\);/)?.[0] || '';
assert.doesNotMatch(draftType, /displayUnit/, 'displayUnit must not enter the Session draft');
assert.doesNotMatch(savePlanType, /displayUnit/, 'displayUnit must not enter the Session save plan');
assert.match(unitHandler, /props\.onDisplayUnitChange\(unit\)/, 'the unit control updates only the presentation owner');
assert.doesNotMatch(unitHandler, /setSessionDraft|convertMovementDraftUnit/, 'the unit control must not mutate or convert persisted Session draft values');
assert.doesNotMatch(route, /preferred_units: plan\.metadataPatch\.displayUnit/, 'unit-only interaction must not call the Session setup persistence path');
assert.match(route, /onDisplayUnitChange=\{setWorkspaceDisplayUnit\}/, 'the route owns local presentation state explicitly');

console.log('[session-workspace-unit-presentation] clean toggle, round trip, real edit, discard, and empty payload verified');
