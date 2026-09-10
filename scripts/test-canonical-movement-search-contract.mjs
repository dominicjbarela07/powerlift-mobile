#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  CANONICAL_MOVEMENT_SEARCH_DEBOUNCE_MS,
  canonicalMovementSearchEmptyCopy,
  normalizeCanonicalMovementSearchTokens,
  rankCanonicalMovementChoices,
} from '../lib/canonical-movement-search.ts';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const backendRoot = process.env.STRENGTH_LEDGER_BACKEND_ROOT
  ? path.resolve(process.env.STRENGTH_LEDGER_BACKEND_ROOT)
  : path.resolve(root, '..');
const read = (...parts) => fs.readFileSync(path.join(root, ...parts), 'utf8');
const governedPicker = read('components', 'movement', 'GovernedAccessoryPickerModal.tsx');
const sessionWorkspace = read('app', '(tabs)', 'workout', 'session-workspace', '[workoutId].tsx');
const webProgrammingManager = fs.readFileSync(
  path.resolve(backendRoot, 'app', 'templates', 'programming_manager_dev.html'),
  'utf8',
);

assert.deepEqual(normalizeCanonicalMovementSearchTokens(' TRICEP--Press '), ['triceps', 'press']);
assert.deepEqual(normalizeCanonicalMovementSearchTokens('DB row'), ['dumbbell', 'row']);
assert.deepEqual(normalizeCanonicalMovementSearchTokens('pull-down'), ['pulldown']);
assert.deepEqual(normalizeCanonicalMovementSearchTokens('one arm row'), ['single', 'arm', 'row']);

const choices = [
  { id: 101, text: 'Competition Barbell Squat' },
  { id: 202, text: 'Chest-Supported Dumbbell Row' },
  { id: 303, text: 'Machine Lat Pulldown' },
  { id: 404, text: 'Cable Triceps Pressdown' },
];

for (const [query, expectedId] of [
  ['db row', 202],
  ['row dumbbell', 202],
  ['pulldwon', 303],
  ['tricep press', 404],
  ['presdown', 404],
]) {
  const ranked = rankCanonicalMovementChoices(choices, query, (choice) => choice.text);
  assert.equal(ranked[0]?.id, expectedId, `${query} must preserve and rank the exact governed choice`);
}
assert.deepEqual(rankCanonicalMovementChoices(choices, 'zxqv nonsense', (choice) => choice.text), []);
assert.equal(CANONICAL_MOVEMENT_SEARCH_DEBOUNCE_MS, 200);
assert.equal(
  canonicalMovementSearchEmptyCopy('tricep press'),
  'No matching movements yet. Try another familiar term.',
);

for (const [source, label] of [
  [governedPicker, 'Swap and Logger substitution picker'],
  [sessionWorkspace, 'Programming Session Workspace picker'],
  [webProgrammingManager, 'web Programming Manager picker'],
]) {
  assert.match(source, /movement-definitions\/search|workspaceMovementIdentityRequest\('\/search'/, `${label} must use canonical backend search`);
}
assert.match(governedPicker, /CANONICAL_MOVEMENT_SEARCH_DEBOUNCE_MS/, 'shared Swap picker must use the canonical debounce');
assert.match(governedPicker, /requestId !== requestRef\.current/, 'shared Swap picker must suppress stale responses');
assert.match(sessionWorkspace, /CANONICAL_MOVEMENT_SEARCH_DEBOUNCE_MS/, 'mobile programming picker must use the canonical debounce');
assert.match(sessionWorkspace, /requestId !== searchRequestRef\.current/, 'mobile programming picker must suppress stale responses');
assert.match(sessionWorkspace, /rankCanonicalMovementChoices/, 'local core-variant discovery must use the shared normalized ranker');
assert.match(webProgrammingManager, /context\.identityRevision !== revision/, 'web programming search must suppress stale responses');
assert.match(webProgrammingManager, /}, 180\);/, 'web programming search must stay debounced');
assert.doesNotMatch(governedPicker, /Type a movement name or governed taxonomy term\./, 'empty state must not blame the athlete for search vocabulary');

console.log('[canonical-movement-search] normalization, ranking, identity, debounce, stale-response, and consumer contracts passed');
