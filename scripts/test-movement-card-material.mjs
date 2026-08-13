import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import {
  resolveMovementCardMaterial,
} from '../lib/movement-card-material.ts';

const root = path.resolve(import.meta.dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');
const primitive = read('components/workout-logger/movement-card-material.tsx');
const movementCard = read('components/workout-logger/core-loggers.tsx');
const superset = read('components/workout-logger/superset-round-workspace.tsx');
const tokens = read('constants/movement-card-material.ts');

const notStarted = resolveMovementCardMaterial({ state: 'not_started' });
const active = resolveMovementCardMaterial({ state: 'in_progress' });
const complete = resolveMovementCardMaterial({ state: 'complete' });
const skipped = resolveMovementCardMaterial({ state: 'skipped' });
const failed = resolveMovementCardMaterial({ state: 'failed' });
const expandedActive = resolveMovementCardMaterial({
  expanded: true,
  state: 'in_progress',
});
const disabledActive = resolveMovementCardMaterial({
  disabled: true,
  state: 'in_progress',
});

assert.ok(active.edgeStrength > notStarted.edgeStrength);
assert.ok(active.tintStrength > complete.tintStrength);
assert.ok(skipped.edgeStrength < notStarted.edgeStrength);
assert.ok(failed.edgeStrength > complete.edgeStrength);
assert.ok(expandedActive.tintStrength < active.tintStrength);
assert.ok(disabledActive.opacity < 1);
assert.equal(notStarted.accentColor, '#E83D9A');
assert.equal(active.accentColor, '#C8AB72');
assert.equal(complete.accentColor, '#8FB29A');

assert.match(tokens, /export const SLMovementCardMaterial = \{[\s\S]*base: '#070709'/);
assert.match(
  tokens,
  /stateAccent:\s*\{[\s\S]*not_started: '#E83D9A'[\s\S]*in_progress: '#C8AB72'[\s\S]*complete: '#8FB29A'/,
  'not started, in progress, and complete must use the canonical state palette',
);
assert.doesNotMatch(
  primitive,
  /\bTEXTURE\b|<Svg\b|<Line\b|\bPattern\b|\bnoise\b/i,
  'movement cards must not procedurally fake brushed metal with lines, patterns, or noise',
);
assert.match(
  primitive,
  /styles\.topEdge[\s\S]*styles\.leftEdge[\s\S]*styles\.bottomEdge[\s\S]*styles\.rightEdge/,
  'edge illumination must be selective instead of one uniform neon outline',
);
assert.match(
  movementCard,
  /<MovementCardMaterial[\s\S]*state=\{cardMaterialState\}/,
);
assert.doesNotMatch(
  movementCard,
  /<MovementCardMaterial[^>]*accentColor=/,
  'movement identity must not control the canonical card material color',
);
assert.match(
  movementCard,
  /cardStateAccent = movementCardStateAccent\(cardMaterialState\)[\s\S]*color: cardStateAccent/,
  'status text and disclosure controls must use the same state color as the card',
);
assert.doesNotMatch(
  movementCard,
  /activeMovementCardGlow/,
  'canonical movement cards must not retain the old broad tinted-gradient implementation',
);
assert.match(
  movementCard,
  /activeMovementMetadataAnodized:[\s\S]*color: SLColors\.textSecondary[\s\S]*activeMovementPrescriptionAnodized:[\s\S]*color: SLColors\.textStrong/,
  'the material must keep scheme and prescription typography neutral',
);
assert.match(
  superset,
  /stateAccent = movementCardStateAccent\(materialState\)[\s\S]*<MovementCardMaterial[\s\S]*state=\{materialState\}/,
  'the unified superset workspace must use the same group-level material primitive',
);
assert.doesNotMatch(
  superset,
  /<LinearGradient/,
  'the superset workspace must not retain a separate legacy surface treatment',
);

console.log(
  '[movement-card-material] state mapping, clean black surface, no procedural texture, selective edge light, neutral typography, and superset parity passed',
);
