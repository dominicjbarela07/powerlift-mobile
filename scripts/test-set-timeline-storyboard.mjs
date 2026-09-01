import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import {
  compactTimelineScrollOffset,
  toggleCompletedSetSelection,
} from '../lib/compact-set-timeline.ts';
import { coreSetTimelineLabel } from '../lib/core-logger-timeline.ts';

const root = process.cwd();
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');
const timeline = read('components/workout-logger/compact-set-timeline.tsx');
const coreLogger = read('components/workout-logger/core-loggers.tsx');
const superset = read('components/workout-logger/superset-round-workspace.tsx');

const completedOne = { key: 'set-1', state: 'completed' };
const completedTwo = { key: 'set-2', state: 'completed' };
const activeThree = { key: 'set-3', state: 'active' };

assert.equal(toggleCompletedSetSelection(null, completedOne), 'set-1');
assert.equal(toggleCompletedSetSelection('set-1', completedTwo), 'set-2');
assert.equal(toggleCompletedSetSelection('set-2', completedTwo), null);
assert.equal(
  toggleCompletedSetSelection('set-1', activeThree),
  'set-1',
  'current/future nodes may not replace completed SetLog inspection state',
);

assert.equal(compactTimelineScrollOffset(0), 0);
assert.equal(compactTimelineScrollOffset(1), 0);
assert.equal(compactTimelineScrollOffset(6), 350);

assert.equal(coreSetTimelineLabel('top', 1, 1), 'TOP');
assert.equal(coreSetTimelineLabel('top', 1, 2), 'TOP 1');
assert.equal(coreSetTimelineLabel('backdown', 2, 3), 'BD 2');

assert.match(timeline, /<ScrollView[\s\S]*?horizontal/);
assert.match(timeline, /rows\.length > 5/);
assert.match(timeline, /scrollRef\.current\?\.scrollTo/);
assert.match(timeline, /name="checkmark"/);
assert.match(timeline, /isActive && styles\.nodeActive/);
assert.match(timeline, /accessibilityLabel=\{`\$\{spokenLabel\(row\.label\)\}, \$\{stateLabel\}`\}/);
assert.match(timeline, /selectedRow\.resultText/);
assert.match(timeline, /onPress=\{selectedRow\.onEdit\}/);
assert.match(timeline, /onPress=\{selectedRow\.onRemove\}/);
assert.match(timeline, /setSelectedCompletedKey\(null\)/);
assert.match(timeline, /pressScale=\{reduceMotion \? 1 : 0\.94\}/);

assert.match(
  coreLogger,
  /if \(compact\) \{[\s\S]*?<CompactSetTimeline[\s\S]*?timelineLabel[\s\S]*?onEdit:[\s\S]*?onRemove:/,
  'Core straight, Top + Backdown, Core Variant, and ordinary Accessory rows must converge on the shared rail',
);
assert.match(
  superset,
  /model\.movements\.map[\s\S]*?<CompactSetTimeline[\s\S]*?movement\.requiredSets[\s\S]*?movement\.nextSetIndex/,
  'each superset movement must preserve its own progression while using the same compact rail',
);
assert.match(superset, /onEditSet\(movement\.item, persistedLog\)/);
assert.match(superset, /onDeleteSet\(movement\.item, persistedLog\)/);

console.log('Set Timeline storyboard convergence contracts passed.');
