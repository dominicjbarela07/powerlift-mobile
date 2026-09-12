import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import * as core from '../lib/rest-timer-completion-core.ts';
import * as rounds from '../lib/superset-rounds.ts';
import { createDeadlineDisplayClock } from '../lib/deadline-display-clock.ts';
import { resolveRestTimerPickerInitialSeconds } from '../lib/rest-timer-preference-core.ts';
import { createCanonicalSetSubmissionController, logSheetHandoffPlan } from '../lib/logger-feedback.ts';

const read = p => fs.readFileSync(p, 'utf8');
function moduleAt(path, imports = {}, globals = {}) {
  const module = { exports: {} };
  const js = ts.transpileModule(read(path), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const require = key => { assert.ok(key in imports, `unexpected import ${key}`); return imports[key]; };
  vm.runInNewContext('(function(require,module,exports){'+js+'\n})', globals)(require, module, module.exports);
  return module.exports;
}
const { shouldOfferRestAfterAcceptedSet: offer } = moduleAt('lib/set-rest-handoff.ts', { './superset-rounds': rounds });
const { scheduleRestTimerEnd } = moduleAt('lib/rest-timer-notification-scheduling.ts');
let now = 10_000;
const database = new Map(), writes = [];
let holdWrites = false, releaseWrite;
const storage = {
  async getItem(key) { return database.get(key) ?? null; },
  async setItem(key, value) { writes.push(JSON.parse(value)); if (holdWrites) await new Promise(resolve => { releaseWrite = resolve; }); database.set(key,value); },
  async removeItem(key) { writes.push(null); database.delete(key); },
};
const runtime = () => moduleAt('lib/rest-timer-completion.ts', {
  '@react-native-async-storage/async-storage': { default: storage },
  '@/lib/rest-timer-completion-core': core,
  '@/lib/rest-timer-storage': { clearRestTimerExpiry: async () => {} },
}, { Date: class extends Date { static now() { return now; } } });
const store = runtime();
await store.hydrateRestTimerCompletion(now);
let notifications = 0;
const unsubscribe = store.subscribeRestTimerCompletion(() => notifications++);
const started = store.beginGlobalRestTimer({ workoutId: 41, ownerUserId: 12, endAtMs: now+120_000, nowMs: now });
let timer = store.getRestTimerCompletionState().active;
assert.equal(core.deriveRestTimerRemainingSeconds(timer,now),120);
now += 46_000;
assert.equal(core.deriveRestTimerRemainingSeconds(timer,now),74);
const extended = store.extendGlobalRestTimer(timer.timerId,30,now);
assert.equal(extended.timer.endAtMs,timer.endAtMs+30_000);
assert.equal(extended.timer.startedAtMs,timer.startedAtMs);
assert.equal(extended.timer.timerId,timer.timerId,'extension keeps the same rest period');
assert.equal(core.deriveRestTimerRemainingSeconds(extended.timer,now),104);
now += 1000;
assert.equal(core.deriveRestTimerRemainingSeconds(extended.timer,now),103,'continues after +30');
const twice = store.extendGlobalRestTimer(timer.timerId,30,now);
assert.equal(twice.timer.endAtMs,timer.endAtMs+60_000,'rapid presses read live deadline, not a render closure');
now += 35_000;
assert.equal(core.deriveRestTimerRemainingSeconds(twice.timer,now),98,'background time applies to extended deadline');
await store.attachGlobalRestTimerNotification(timer.timerId,'current-notification',twice.timer.endAtMs);
assert.equal(await store.attachGlobalRestTimerNotification(timer.timerId,'stale-notification',timer.endAtMs),false);
const restored = runtime();
await restored.hydrateRestTimerCompletion(now);
assert.equal(restored.getRestTimerCompletionState().active.endAtMs,twice.timer.endAtMs,'process restart preserves extended deadline');
assert.equal(core.deriveRestTimerRemainingSeconds(restored.getRestTimerCompletionState().active,now),98);
const stopped = store.stopGlobalRestTimer(timer.timerId);
assert.equal(store.getRestTimerCompletionState().active,null,'Skip clears visible authority synchronously before storage');
assert.equal(await stopped,'current-notification');
assert.equal((await store.reconcileGlobalRestTimerCompletion(now+500_000)).pending,null,'Skip cannot later expire');

// A single shared display pulse; unmount/remount and background never alter deadline.
let tick, foreground, scheduled = 0, cancelled = 0, pulseHandle = null;
const clock = createDeadlineDisplayClock({ now: () => now, schedule: fn => { assert.equal(pulseHandle,null); tick=fn; pulseHandle=++scheduled; return pulseHandle; }, cancel: handle => { assert.equal(handle,pulseHandle);pulseHandle=null;cancelled++; }, subscribeForeground: fn => {foreground=fn;return () => {foreground=null;};}, isForeground: () => true });
const reads=[];
const offA=clock.subscribe(() => reads.push(core.deriveRestTimerRemainingSeconds(twice.timer,clock.getNow())));
const offB=clock.subscribe(() => {});
assert.equal(scheduled,1,'multiple timer/elapsed displays share one pulse');
now+=1000;tick();assert.equal(reads.at(-1),97);
foreground(false);assert.equal(pulseHandle,null);
now+=35_000;foreground(true);assert.equal(reads.at(-1),62,'foreground rebases to wall clock');
offA();assert.notEqual(pulseHandle,null);offB();assert.equal(pulseHandle,null,'no hidden display interval after final unmount');
now+=10_000;const offC=clock.subscribe(() => {});assert.equal(core.deriveRestTimerRemainingSeconds(twice.timer,clock.getNow()),52);offC();

// Native schedules resolving after extension/Skip are cancelled rather than attached.
now=1_000_000;
store.beginGlobalRestTimer({workoutId:41,ownerUserId:12,endAtMs:now+120_000,nowMs:now});
timer=store.getRestTimerCompletionState().active;
const cancelledIds=[], pendingSchedules=[];
const deps={authorize:async()=>true,now:()=>now,readActive:()=>store.getRestTimerCompletionState().active,schedule:async t=>new Promise(resolve=>pendingSchedules.push({t,resolve})),attach:store.attachGlobalRestTimerNotification,cancel:id=>cancelledIds.push(id)};
const firstSchedule=scheduleRestTimerEnd(timer,deps);await new Promise(resolve=>setImmediate(resolve));
const changed=store.extendGlobalRestTimer(timer.timerId,30,now).timer;
const secondSchedule=scheduleRestTimerEnd(changed,deps);await new Promise(resolve=>setImmediate(resolve));
pendingSchedules[0].resolve('old-deadline');await firstSchedule;
assert.deepEqual(cancelledIds,['old-deadline']);
await store.stopGlobalRestTimer(timer.timerId);
pendingSchedules[1].resolve('after-skip');await secondSchedule;
assert.deepEqual(cancelledIds,['old-deadline','after-skip']);

// Storage completion order cannot restore an older timer over Skip or extension.
holdWrites=true;
store.beginGlobalRestTimer({workoutId:41,ownerUserId:12,endAtMs:now+120_000,nowMs:now});
await new Promise(resolve=>setImmediate(resolve));
timer=store.getRestTimerCompletionState().active;
store.extendGlobalRestTimer(timer.timerId,30,now);store.extendGlobalRestTimer(timer.timerId,30,now);
const skipPersistence=store.stopGlobalRestTimer(timer.timerId);
assert.equal(store.getRestTimerCompletionState().active,null);
holdWrites=false;releaseWrite();await skipPersistence;
assert.equal(database.size,0,'a slow older write cannot resurrect skipped rest');
const remounted=runtime();await remounted.hydrateRestTimerCompletion(now);assert.equal(remounted.getRestTimerCompletionState().active,null);
store.beginGlobalRestTimer({workoutId:41,ownerUserId:12,endAtMs:now+8000,nowMs:now});
timer=store.getRestTimerCompletionState().active;
store.extendGlobalRestTimer(timer.timerId,30,now);store.extendGlobalRestTimer(timer.timerId,30,now);
assert.equal(core.deriveRestTimerRemainingSeconds(store.getRestTimerCompletionState().active,now),68);
now+=68_000;await store.reconcileGlobalRestTimerCompletion(now);
assert.equal(store.getRestTimerCompletionState().active,null);assert.equal(store.getRestTimerCompletionState().pending.timerId,timer.timerId);
assert.equal(store.extendGlobalRestTimer(timer.timerId,30,now),null,'expired rest cannot be restarted by +30');
await store.stopGlobalRestTimer(timer.timerId);unsubscribe();
assert.ok(notifications>0);

const result={created:true,replayed:false,set:{id:7,item_id:1,set_index:1},completion_boundary:{authority:'canonical',session_final_set:false}};
for(const kind of ['straight','core','accessory','variant','TOP','backdown','custom']) assert.equal(offer({...result,kind},[]),true,kind);
assert.equal(offer({...result,created:false},[]),false,'edit/inspect are not new performance');
assert.equal(offer({...result,replayed:true},[]),false,'retry never opens another picker');
assert.equal(offer({...result,set:null},[]),false,'failed/cancelled request has no accepted SetLog');
assert.equal(offer({...result,completion_boundary:{authority:'canonical',session_final_set:true}},[]),false,'final Session Set completes without rest');
const groups=[{group:'A',items:[{id:1,sets:2,superset_pos:1,set_logs:[]},{id:2,sets:2,superset_pos:2,set_logs:[]}]}];
assert.equal(offer(result,groups),false,'A1 advances to paired A2');
const a1Done=[{...groups[0],items:[{...groups[0].items[0],set_logs:[{set_index:1}]},groups[0].items[1]]}];
assert.equal(offer({...result,set:{id:8,item_id:2,set_index:1}},a1Done),true,'A2 completes current round and offers rest');
assert.equal(offer({...result,set:{id:8,item_id:2,set_index:1},entries:[result,{set:{id:8,item_id:2,set_index:1}}]},groups),true,'atomic full-round response reconciles all saved members');
assert.equal(offer({...result,skipped_item_ids:[2]},groups),true,'explicit skipped member honors round choice');
const unequal=[{group:'A',items:[{id:1,sets:2,superset_pos:1,set_logs:[{set_index:1}]},{id:2,sets:1,superset_pos:2,set_logs:[{set_index:1}]}]}];
assert.equal(offer({...result,set:{id:9,item_id:1,set_index:2}},unequal),true,'unequal round has no nonexistent partner to wait for');
assert.equal(offer({...result,set:{id:10,item_id:1,set_index:3}},unequal),true,'extra grouped Set remains independently loggable');
assert.equal(resolveRestTimerPickerInitialSeconds({sessionSelectedSeconds:150,lastUsedSeconds:90}),150);
assert.equal(resolveRestTimerPickerInitialSeconds({lastUsedSeconds:180}),180);
assert.equal(store.getRestTimerCompletionState().active,null,'preselection does not start rest');

const submission=createCanonicalSetSubmissionController();let pickerOpens=0;
await submission.run({request:async()=>{throw Error('offline');},onStarted(){},onFailure(){},onAccepted:r=>{if(offer(r,[]))pickerOpens++;}});
assert.equal(pickerOpens,0);
await submission.run({request:async()=>result,onStarted(){},onFailure(){},onAccepted:r=>{assert.ok(r.set.id);if(offer(r,[]))pickerOpens++;}});
assert.equal(pickerOpens,1);
assert.equal(store.getRestTimerCompletionState().active,null,'successful new Set only opens choice');
assert.equal(logSheetHandoffPlan('persisted_new_set').openTimerPicker,true);
assert.equal(logSheetHandoffPlan('idempotent_replay').openTimerPicker,false);

const route=read('app/(tabs)/workout/[workoutId].tsx');
const handoff=route.slice(route.indexOf('const acceptedItemId = feedbackState.submission.activeItemId'),route.indexOf('if (!canPresentFinalSessionCompletion'));
assert.match(handoff,/openTimerPicker\(undefined, handoffIdentity\)/);
assert.doesNotMatch(handoff,/startRestTimer\(/,'successful saves must never silently start rest');
assert.match(route,/onAddRest=\{addRestTime\}/);
assert.match(route,/extendGlobalRestTimer\(timer.timerId, 30\)/);
assert.doesNotMatch(route,/setRestSeconds|setRestActive|restEndAtMsRef|restTimerRef|setSessionNowMs|setInterval\(/,'logger root owns no ticking time or duplicate countdown');
assert.match(route,/timerPickerChoiceRef.current = true/);
assert.match(route,/SchedulableTriggerInputTypes.DATE, date: new Date\(deadline.endAtMs\)/);
assert.match(route,/ownerUserId === restOwnerUserId/);
const picker=read('components/workout-logger/logger-modals.tsx');
assert.match(picker,/>Skip Rest</);assert.match(picker,/onSkip\?\.\(\); onClose\('dismissed'\)/);
assert.match(picker,/startRestTimer\(REST_TIMER_OPTIONS/);
console.log('Rest timer flow PASS — acceptance, preference, +30 continuity, shared clock, background/remount, storage/notification races, Skip/expiry and supersets.');
