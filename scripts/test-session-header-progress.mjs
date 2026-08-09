import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const source = fs.readFileSync(
  path.join(process.cwd(), 'components/workout-logger/session-shell.tsx'),
  'utf8',
);

assert.match(source, /function SessionProgressRing/);
assert.match(source, /progressRingCompleted:\s*\{[\s\S]*?fontSize: 22,[\s\S]*?lineHeight: 26,/);
assert.match(source, /progressRingTotal:\s*\{[\s\S]*?fontSize: 17,[\s\S]*?lineHeight: 22,/);
assert.match(source, /progressRingWrap:\s*\{[\s\S]*?width: 88,[\s\S]*?height: 88,/);
assert.match(source, /const size = 80;/);

console.log('Session header progress typography regression checks passed.');
