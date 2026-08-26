#!/usr/bin/env node

import { spawnSync } from 'node:child_process';

const userStories = [
  ['Athlete Training Hub Program Timeline', 'scripts/test-program-timeline-v2.mjs'],
  ['Coach Home Coming Up exact Session', 'scripts/test-coach-home-coming-up-direct-open.mjs'],
  ['Training Hub Session preview/open/return', 'scripts/test-training-hub-session-preview-sheet.mjs'],
  ['Movement History launch', 'scripts/test-movement-history-launch.mjs'],
  ['Programming Manager Session swipe actions', 'scripts/test-programming-session-swipe-hotfix.mjs'],
  ['Coach Queue swipe actions', 'scripts/test-coach-queue-swipe-gesture.mjs'],
  ['Immediate account-mode transition', 'scripts/test-mobile-mode-transition.mjs'],
];

const failures = [];
for (const [story, script] of userStories) {
  const result = spawnSync(process.execPath, ['--import', 'tsx', script], {
    cwd: process.cwd(),
    env: { ...process.env, CI: '1' },
    encoding: 'utf8',
    stdio: 'pipe',
    timeout: 30_000,
  });
  if (result.status !== 0) failures.push({ story, script, output: `${result.stdout || ''}${result.stderr || ''}`.trim() });
  console.log(`[visible-control-actions] ${result.status === 0 ? 'PASS' : 'FAIL'} — ${story}`);
}

if (failures.length) {
  for (const failure of failures) console.error(`\n${failure.story}: ${failure.script}\n${failure.output}`);
  process.exit(1);
}

console.log(`[visible-control-actions] PASS — ${userStories.length}/${userStories.length} enabled control stories reach their canonical actions`);
