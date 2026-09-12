import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import {
  MOVEMENT_STATUS_COLUMN_WIDTH,
  MOVEMENT_STATUS_MIN_WIDTH,
  movementHeaderTitleWidth,
} from '../lib/movement-lifecycle-status-layout.ts';
import { coreLoggerMovementStateLabel } from '../lib/core-logger-header.ts';

const root = process.cwd();
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');
const core = read('components/workout-logger/core-loggers.tsx');
const statusPrimitive = read('components/workout-logger/movement-lifecycle-status-label.tsx');
const superset = read('components/workout-logger/superset-round-workspace.tsx');
const route = read('app/(tabs)/workout/[workoutId].tsx');

assert.deepEqual(
  ['not_started', 'logged', 'complete'].map((state) => coreLoggerMovementStateLabel(state).toUpperCase()),
  ['NOT STARTED', 'IN PROGRESS', 'COMPLETED'],
  'the canonical lifecycle vocabulary must remain exact',
);
assert.ok(MOVEMENT_STATUS_MIN_WIDTH >= 84, 'the fixed semantic label must own sufficient minimum width');
assert.ok(MOVEMENT_STATUS_COLUMN_WIDTH >= MOVEMENT_STATUS_MIN_WIDTH, 'the action column must contain the complete label width');

for (const viewportWidth of [320, 375, 390, 430]) {
  const compact = viewportWidth < 390;
  for (const [kind, artworkWidth] of [
    ['core', compact ? 86 : 100],
    ['accessory', compact ? 60 : 72],
  ]) {
    const titleWidth = movementHeaderTitleWidth({ viewportWidth, artworkWidth, compact });
    assert.ok(titleWidth >= 100, `${kind} title must retain a readable truncation region at ${viewportWidth}px`);
  }
}

assert.match(statusPrimitive, /numberOfLines=\{1\}/, 'lifecycle labels must explicitly prohibit wrapping');
assert.match(statusPrimitive, /minWidth:\s*MOVEMENT_STATUS_MIN_WIDTH/, 'the shared status primitive must reserve semantic width');
assert.match(statusPrimitive, /flexShrink:\s*0/, 'the fixed semantic label may not yield width to the movement title');
assert.doesNotMatch(statusPrimitive, /minimumFontScale|adjustsFontSizeToFit/, 'the fix must not depend on making lifecycle text tiny');

assert.match(core, /<MovementLifecycleStatusLabel[\s\S]*?label=\{stateLabel\}/, 'core and standalone accessory cards must consume the shared status primitive');
assert.match(core, /activeMovementActions:\s*\{[\s\S]*?width:\s*MOVEMENT_STATUS_COLUMN_WIDTH[\s\S]*?flexShrink:\s*0/, 'canonical card actions must own fixed lifecycle width');
assert.match(fs.readFileSync(path.join(root, 'components/workout-logger/session-v3-movement.tsx'), 'utf8'), /numberOfLines=\{0\} style=\{s\.title\}/, 'canonical Logger movement titles must grow while legacy cards retain a bounded fallback');
assert.doesNotMatch(core, /ellipsizeMode="tail"[\s\S]{0,160}?style=\{styles\.activeMovementTitle\}/, 'canonical Logger movement titles must not be deliberately ellipsized');
assert.match(core, /ledgerHeaderActions:\s*\{[\s\S]*?minWidth:\s*MOVEMENT_STATUS_COLUMN_WIDTH[\s\S]*?flexShrink:\s*0/, 'legacy collapsed/expanded cards must retain the same fixed status width');

assert.match(superset, /roundLabel/);
assert.match(superset, /rounds complete/);
assert.match(superset, /header: \{[^}]*flexWrap: 'wrap'/, 'round status wraps at narrow phone widths');
assert.match(superset, /<Text numberOfLines=\{0\} style=\{\[s\.title,/, 'member names are never clipped');

assert.match(route, /const accessoryKind = machineAccessory[\s\S]*?<CoreMovementLedgerRow/, 'machine, free-weight, and bodyweight accessories must share the canonical movement card');
assert.match(route, /<CoreMovementLedgerRow[\s\S]*?title=\{resolveLoggerMovementIdentity\(core\)\.displayName\}/, 'Core, TOP, and backdown work must share the canonical movement card');
assert.match(route, /<SupersetRoundWorkspace/, 'superset status remains covered through its shared workspace');

console.log('Movement lifecycle status no-wrap, narrow-width, long-name, card-variant, and lifecycle contracts PASS');
