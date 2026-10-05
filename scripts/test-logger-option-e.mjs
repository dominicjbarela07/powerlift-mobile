import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import * as timerCore from '../lib/rest-timer-completion-core.ts';
import { restTimerRemainingFraction } from '../lib/rest-timer-progress.ts';

let now = 1_000_000;
const timer = timerCore.createActiveRestTimer({ timerId: 'ring', workoutId: 1, ownerUserId: 1, startedAtMs: now, endAtMs: now + 60_000 });
const read = file => fs.readFileSync(file, 'utf8');
const treeText = node => node == null || node === false ? '' : typeof node === 'object' ? node.children.map(treeText).join('') : String(node);
const nodes = node => node && typeof node === 'object' ? [node, ...node.children.flatMap(nodes)] : [];
const cues = [];
const react = { createElement: (type, props, ...children) => ({ type, props: props || {}, children }), useEffect: fn => fn(), useSyncExternalStore: (_, snapshot) => snapshot() };
const deps = { react, 'react-native': { AppState: { currentState: 'active', addEventListener() { return { remove() {} }; } }, StyleSheet: { create: x => x, absoluteFillObject: { position: 'absolute' } }, View: 'View' },
  'react-native-svg': { default: 'Svg', Circle: 'Circle' }, '@/components/ui/sl-text': { Text: 'Text' },
  '@/lib/rest-timer-progress': { restTimerRemainingFraction }, '@/lib/rest-timer-completion-core': timerCore,
  '@/lib/session-header-metrics': {}, '@/lib/deadline-display-clock': { createDeadlineDisplayClock: () => ({ subscribe() {}, getNow: () => now }) } };
const module = { exports: {} };
vm.runInNewContext(ts.transpileModule(read('components/workout-logger/session-clock-text.tsx'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true } }).outputText,
  { module, exports: module.exports, require: key => { assert.ok(key in deps, key); return deps[key]; }, setInterval, clearInterval });
const render = t => module.exports.RestTimerClockText({ timer: t, ring: true, onSecond: n => cues.push(n) });
const activeArc = tree => nodes(tree).find(n => n.type === 'Circle' && n.props.stroke === '#18e0e7').props;
let tree = render(timer);
assert.equal(treeText(tree), '1:00'); assert.equal(activeArc(tree).strokeDashoffset, 0);
now += 30_000; tree = render(timer);
const circumference = Number(activeArc(tree).strokeDasharray.split(' ')[0]);
assert.equal(treeText(tree), '0:30'); assert.equal(activeArc(tree).strokeDashoffset, circumference / 2);
const state = { active: timer, pending: null };
const extended = timerCore.extendRestTimerState(state, timer.timerId, 30, now).state.active;
assert.equal(extended.startedAtMs, timer.startedAtMs); assert.equal(extended.timerId, timer.timerId);
tree = render(extended); assert.equal(treeText(tree), '1:00');
assert.ok(Math.abs(activeArc(tree).strokeDashoffset / circumference - 1 / 3) < 1e-10, '+30 reflects the extended 90s period, without resetting its start');
now = extended.endAtMs; tree = render(extended);
assert.equal(treeText(tree), '0:00'); assert.equal(activeArc(tree).strokeDashoffset, circumference); assert.equal(activeArc(tree).opacity, 0, 'zero must have no cyan cap left');
assert.equal(timerCore.stopRestTimerState({ active: extended, pending: null }).state.active, null);
assert.deepEqual(cues, [60, 30, 60, 0], 'the existing completion-cue callback still receives actual remaining seconds');
for (const seconds of [-1, NaN, Infinity]) assert.equal(restTimerRemainingFraction(timer, seconds), 0);
assert.equal(restTimerRemainingFraction(timer, 999), 1);
assert.equal(restTimerRemainingFraction({ ...timer, endAtMs: timer.startedAtMs }, 20), 0);
const peek = read('components/workout-logger/session-history-peek.tsx');
assert.doesNotMatch(peek, /content\?\.context|all sets & progression|Representative set/);
assert.match(peek, /const contextLine = content\?\.equipmentLabel/);
assert.match(peek, /onPress=\{onOpen\}/); assert.match(peek, /chevron-forward/);
assert.match(peek, /backgroundColor: '#080b0e'/);
const shell = read('components/workout-logger/session-v3-shell.tsx');
assert.match(shell, /timer=\{rest\} ring/); assert.match(shell, /onPress=\{onAddRest\}/); assert.match(shell, /onPress=\{onSkip\}/);
assert.match(shell, /backgroundColor: '#080b0e'/); assert.doesNotMatch(shell, /#0f2025/);
assert.match(shell, /green: \{ color: '#8cdab8' \}/);
console.log('Option E PASS: actual countdown TSX full/half/depleted ring; shared deadline/extension/cues/Skip retained; compact near-black History with equipment evidence and working affordance.');
