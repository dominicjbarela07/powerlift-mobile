#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { moveSessionItemIds } from '../lib/session-reorder.ts';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const route = fs.readFileSync(
  path.join(root, 'app', '(tabs)', 'workout', 'session-workspace', '[workoutId].tsx'),
  'utf8',
);
const reorderModal = route.slice(route.indexOf('function ReorderEditorModal'), route.indexOf('function CompactSessionActions'));

const longAccessoryOrder = Array.from({ length: 24 }, (_, index) => index + 101);
const movedNearBottom = moveSessionItemIds(longAccessoryOrder, 123, 18);
assert.equal(movedNearBottom[18], 123, 'an item near the bottom can move while the list is scrolled');
assert.equal(new Set(movedNearBottom).size, longAccessoryOrder.length, 'reorder cannot duplicate an item');
assert.deepEqual([...movedNearBottom].sort((a, b) => a - b), longAccessoryOrder, 'reorder cannot lose an item');

const mixedSession = { coreIds: [1, 2, 3], accessoryIds: longAccessoryOrder };
const mixedReordered = {
  ...mixedSession,
  accessoryIds: moveSessionItemIds(mixedSession.accessoryIds, 124, 0),
};
assert.deepEqual(mixedReordered.coreIds, mixedSession.coreIds, 'accessory reorder cannot alter Core order');
assert.equal(mixedReordered.accessoryIds[0], 124, 'bottom-most accessory can reach the top');
const persisted = structuredClone(mixedReordered);
const reopened = structuredClone(persisted);
assert.deepEqual(reopened, persisted, 'reopening Reorder presents the exact applied draft order');
const cancelledAttempt = moveSessionItemIds(reopened.accessoryIds, 124, 12);
assert.notDeepEqual(cancelledAttempt, reopened.accessoryIds, 'the Cancel scenario exercises a real transient reorder');
assert.deepEqual(reopened, persisted, 'Cancel leaves the applied canonical draft order unchanged');

assert.match(route, /testID="reorder-session-scroll"/, 'long Sessions must have one explicit scroll owner');
assert.match(route, /flex:\s*1,[\s\S]*minHeight:\s*0/, 'the reorder ScrollView must receive bounded flex height');
assert.match(
  route,
  /paddingBottom:\s*footerHeight \+ SLSpacing\.md/,
  'scroll content must clear the measured sticky footer instead of using a fixed guess',
);
assert.match(route, /onLayout=\{\(event\) => setFooterHeight/, 'the sticky footer must report its actual rendered height');
assert.match(route, /paddingBottom:\s*Math\.max\(insets\.bottom, 12\)/, 'footer geometry must include the live safe-area inset');
assert.match(route, /scrollIndicatorInsets=\{\{ bottom: footerHeight \}\}/, 'the scroll indicator must remain visible above the footer');
assert.match(
  route,
  /<Animated\.View style=\{\[styles\.reorderRow, animatedStyle\]\}[\s\S]*?<GestureDetector gesture=\{gesture\}>[\s\S]*?style=\{styles\.reorderHandle\}/,
  'drag recognition must be scoped to the grip instead of intercepting vertical swipes across the row',
);
const draggableRow = route.slice(route.indexOf('function DraggableReorderRow'), route.indexOf('function CompactSessionActions'));
assert.doesNotMatch(draggableRow, /return \(\s*<GestureDetector/, 'the entire reorder row must never own the pan recognizer');
assert.match(route, /<Text style=\{styles\.reorderRowTitle\}>\{name\}<\/Text>/, 'long movement names must remain wrap-capable');
assert.match(route, /reorderRowTextWrap:\s*\{[\s\S]*?minWidth:\s*0/, 'movement copy must yield cleanly to reorder controls');
assert.match(route, /reorderButtonGroup:\s*\{\s*gap:/, 'up/down controls must use the narrow vertical control rail');
assert.match(route, /No \{title\.toLowerCase\(\)\} in this session/, 'zero-Core Sessions retain a compact explicit empty state');
assert.match(route, /<Text style=\{styles\.reorderEditorTitle\}>Reorder Session<\/Text>/, 'utility header must use the compact current title');
assert.doesNotMatch(reorderModal, />Workspace edit</, 'dated oversized Reorder eyebrow must remain removed');
assert.match(route, /backgroundColor:\s*SLColors\.canvas/, 'Reorder must use the canonical OLED material');

console.log('[session-reorder-long-list] scrolling, footer clearance, drag isolation, long-list ordering, Apply/reopen, Cancel, mixed, empty, and layout contracts passed');
