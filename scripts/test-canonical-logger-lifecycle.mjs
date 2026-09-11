import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { sessionExecutionCapabilities } from '../lib/session-logger-lifecycle.ts';
import { sessionLoggerSharedHeaderShown } from '../lib/session-logger-shell.ts';
for (const status of ['draft','assigned','tardy','in_progress','completed','cancelled']) {
  const normal = sessionExecutionCapabilities({ status, canLog: true, previewRequested: false });
  assert.equal(normal.canBegin, ['assigned','tardy'].includes(status));
  assert.equal(normal.canLogSet, status === 'in_progress');
  assert.equal(normal.canComplete, status === 'in_progress');
  assert.equal(normal.canCorrect, status === 'completed');
  for (const authority of [{canLog:false,previewRequested:false}, {canLog:true,previewRequested:true}, {canLog:true,previewRequested:false,viewOnly:true}]) {
    const restricted = sessionExecutionCapabilities({ status, ...authority });
    assert.equal(Object.values(restricted).some(Boolean), false, `${status} cannot bypass execution authority`);
  }
}
for (const mode of ['pre_session','active_session','finished_session']) assert.equal(sessionLoggerSharedHeaderShown({mode,hasCompletedRecap:mode==='finished_session'}),false);
const source = readFileSync(new URL('../app/(tabs)/workout/[workoutId].tsx', import.meta.url),'utf8');
const movement = readFileSync(new URL('../components/workout-logger/core-loggers.tsx', import.meta.url),'utf8');
assert.match(source, /sessionExecutionCapabilities\(/);
assert.equal((source.match(/<SessionV3Footer/g)||[]).length,1,'one primary action owns the Session');
assert.equal((source.match(/sessionLifecycle=\{screenMode\}/g)||[]).length,2,'core and accessory share the same canonical lifecycle renderer');
assert.match(source, /<SessionV3PlanHero/);
assert.match(source, /<SessionMovementNavigator/);
assert.match(source, /registerFocusedSession/);
assert.match(movement, /<SessionV3Movement/);
assert.match(movement, /const lifecycleDetailRows = isPreSessionCard[\s\S]*state: 'locked' as const[\s\S]*onLogSet: undefined/);
assert.match(source, /disabled=\{isCoachAthletePreview/,'preview cannot activate the footer');
assert.match(source, /coachPreviewRequested \|\| !workoutId \|\| String\(data\?\.workout\?\.status/,'preview cannot resume execution timing');
console.log('Logger V3 lifecycle, capability matrix, shared renderer and focused shell: PASS');
