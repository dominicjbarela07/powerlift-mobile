import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const source = fs.readFileSync(
  path.join(process.cwd(), 'components/workout-logger/session-shell.tsx'),
  'utf8',
);

assert.match(source, /function SessionProgressRing/);
assert.match(source, /\{loggedSets\}\/\{plannedSets \|\| '—'\}/);
assert.match(source, /progressRingFraction:\s*\{[\s\S]*?fontSize: 25,[\s\S]*?lineHeight: 29,[\s\S]*?fontWeight: '600'/);
assert.doesNotMatch(source, /progressRingCompleted|progressRingTotal/);
assert.match(source, /progressRingWrap:\s*\{[\s\S]*?width: 96,[\s\S]*?height: 96,/);
assert.match(source, /progressRingMetric:\s*\{[\s\S]*?width: 78,/);
assert.match(source, /minimumFontScale=\{0\.68\}/);
assert.match(source, /const size = 92;/);

console.log('Session header progress typography regression checks passed.');
