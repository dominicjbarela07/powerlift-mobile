#!/usr/bin/env node

import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const helperSource = fs.readFileSync(path.join(root, 'lib', 'governedAccessoryDraft.ts'), 'utf8');
const helperJs = ts.transpileModule(helperSource, {
  compilerOptions: {
    module: ts.ModuleKind.ES2022,
    target: ts.ScriptTarget.ES2022,
  },
}).outputText;
const helper = await import(`data:text/javascript;base64,${Buffer.from(helperJs).toString('base64')}`);

const cablePullover = { id: 172, display_name: 'Cable Pullover' };
const identity = helper.governedIdentityFromSelection(cablePullover);
const selectedDraft = helper.materializeGovernedAccessoryDraft({
  movement: '',
  sets: 3,
  reps_text: '10-12',
  rir_target: 2,
}, identity);

assert.equal(selectedDraft.movement_definition_id, 172);
assert.deepEqual(selectedDraft.movement_identity, cablePullover);
assert.equal(selectedDraft.movement, 'Cable Pullover');

const editedDraft = { ...selectedDraft, sets: 4, reps_text: '12-15', rir_target: 1 };
assert.equal(helper.governedMovementDefinitionId(editedDraft), 172);

// A server/template hydration shape may retain the authoritative identity object
// while omitting the convenience scalar. Saving must rematerialize the scalar.
const identityOnlyDraft = { ...editedDraft, movement_definition_id: null };
const saveDraft = helper.materializeGovernedAccessoryDraft(identityOnlyDraft);
assert.equal(saveDraft.movement_definition_id, 172);
assert.equal(saveDraft.movement, 'Cable Pullover');

assert.throws(
  () => helper.governedIdentityFromSelection({ id: 0, display_name: 'Broken catalog row' }),
  /Invalid governed movement catalog row/,
);
assert.throws(
  () => helper.materializeGovernedAccessoryDraft({ movement: 'Historical name only' }),
  /does not contain a governed movement identity/,
);
assert.throws(
  () => helper.materializeGovernedAccessoryDraft({
    movement: 'Conflicting row',
    movement_definition_id: 172,
    movement_identity: { id: 173, display_name: 'Single-Arm Cable Pullover' },
  }),
  /conflicting governed movement identities/,
);

const newGovernedDrafts = [selectedDraft, editedDraft, saveDraft];
const unresolvedCount = newGovernedDrafts.filter(
  (draft) => !helper.governedMovementDefinitionId(draft),
).length;
assert.equal(unresolvedCount, 0);

console.log(`NEW_GOVERNED_CATALOG_SELECTION_UNRESOLVED_COUNT = ${unresolvedCount}`);
console.log('[catalog-canonical-identity-gate] selection, edit, hydration, save, invalid-row, unresolved, and conflict contracts passed');
