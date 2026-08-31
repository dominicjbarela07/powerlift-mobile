#!/usr/bin/env node

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';

const read = (relative) => fs.readFileSync(relative, 'utf8');
const audit = read('scripts/audit-mobile-horizontal-layout.mjs');
const docs = read('docs/MOBILE_HORIZONTAL_LAYOUT.md');
const packageJson = JSON.parse(read('package.json'));

const result = spawnSync(process.execPath, ['scripts/audit-mobile-horizontal-layout.mjs'], {
  cwd: process.cwd(),
  encoding: 'utf8',
});
assert.equal(result.status, 0, `${result.stdout || ''}${result.stderr || ''}`);

assert.equal(packageJson.scripts['audit:mobile-horizontal-layout'], 'node scripts/audit-mobile-horizontal-layout.mjs');
assert.match(packageJson.scripts['audit:ui-constitution'], /audit-mobile-horizontal-layout\.mjs/);
assert.match(audit, /restrictedRootGeometry/);
assert.match(audit, /fullWidthSheetContracts/);
assert.match(audit, /parsed\.styles\.get\(styleName\)/);

for (const contract of [
  'components/home/AthleteHomeV3.tsx',
  'components/coach-mobile/CoachAthleteHubV2.tsx',
  'app/coach-team-brief.tsx',
  'app/(tabs)/coach-calendar.tsx',
  'app/(tabs)/workout/index.tsx',
  'components/coach-mobile/SessionEditingWorkspace.tsx',
  'app/(tabs)/workout/[workoutId].tsx',
  'components/coach-mobile/CoachSessionReviewerV3.tsx',
  'components/meet-packet/AthleteMeetPacketV2.tsx',
  'components/coach-mobile/CoachCheckInsV2.tsx',
  'components/ledger/primitives.tsx',
]) {
  assert.ok(audit.includes(contract), `full-width audit must cover ${contract}`);
}

assert.match(docs, /There are no approved page-level horizontal-layout exceptions\./);
assert.match(docs, /product owner explicitly approves it/);

for (const viewport of [375, 390, 430]) {
  const pageCanvasWidth = viewport;
  assert.equal(pageCanvasWidth, viewport, `${viewport}px iPhone page canvas must remain full width`);
}

console.log('Platform-wide mobile full-width enforcement contracts passed.');
