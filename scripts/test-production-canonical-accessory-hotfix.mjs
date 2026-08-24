#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (...parts) => fs.readFileSync(path.join(root, ...parts), 'utf8');
const picker = read('components', 'CanonicalAccessoryPicker.tsx');
const creator = read('app', '(tabs)', 'create-workout.tsx');
const workspace = read('app', '(tabs)', 'workout', 'session-workspace', '[workoutId].tsx');

assert.match(picker, /movement-definitions\/search\?\$\{params\.toString\(\)\}/, 'catalog search must use the governed backend');
assert.match(picker, /favorites_only[\s\S]*recent_only[\s\S]*custom_only/, 'picker modes must use the shared search contract');
assert.match(picker, /movement-definitions\/similarity/, 'custom names must pass through similarity review');
assert.match(picker, /matchesReviewed && !matches\.length[\s\S]*No possible matches found[\s\S]*matchesReviewed \?/, 'zero similarity matches must still allow governed custom authoring to continue');
assert.match(picker, /movement-definitions'[,\s\S]*confirm_similar: true/, 'custom identities must be persisted through the governed endpoint');
assert.match(picker, /existing_custom_movement \|\| json\.existing_movement/, 'an existing governed custom identity must be reused');
assert.match(picker, /custom-name[\s\S]*custom-primary[\s\S]*custom-secondary[\s\S]*custom-execution[\s\S]*custom-review[\s\S]*custom-created/, 'custom authoring must retain the five-step state machine');
assert.match(picker, /Confirm & Add to Session[\s\S]*Use This Movement/, 'catalog and custom selections must return a deliberate governed identity');

const addAccessory = creator.slice(creator.indexOf('const addAcc ='), creator.indexOf('const updateAccAt'));
assert.doesNotMatch(addAccessory, /movement:\s*''|movement_definition_id:\s*null/, 'Add Accessory must not create an anonymous placeholder row');
assert.match(addAccessory, /openMovementPicker\('accessory'/, 'Add Accessory must open the canonical picker first');
assert.match(creator, /CanonicalAccessoryPicker[\s\S]*onSelect=\{applyCanonicalAccessoryMovement\}/, 'the production creator must mount the canonical picker');
assert.match(creator, /governedIdentityFromSelection\(movement\)/, 'creator selections must validate the governed identity object');
assert.match(creator, /materializeGovernedAccessoryDraft[\s\S]*governedMovementDefinitionId/, 'creator drafts must retain and rematerialize governed identity');
assert.match(creator, /unresolvedAccessory[\s\S]*governedMovementDefinitionId\(item\)[\s\S]*canonicalAccessories[\s\S]*movement_definition_id:\s*a\.movement_definition_id/, 'creator saves must reject missing identity and serialize the governed identity id');

assert.match(workspace, /CanonicalAccessoryPicker[\s\S]*onSelect=\{chooseCanonicalMovement\}/, 'existing Session authoring must reuse the same canonical picker');
assert.match(workspace, /movementDefinitionId:\s*movement\.id/, 'workspace selections must retain the governed identity id');
assert.match(workspace, /Select a canonical movement before applying changes/, 'workspace writes must reject missing identity');
assert.match(workspace, /movement_definition_id:\s*setup\.movementDefinitionId/, 'workspace writes must send the governed identity id');

console.log('[production-canonical-accessory-hotfix] governed authoring contract checks passed');
