import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const source = fs.readFileSync('components/workout-logger/session-actions-sheet.tsx', 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: {
  module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true,
} }).outputText;
function harness(overrides = {}) {
  const hooks = [], events = [], timers = [];
  let cursor = 0;
  const react = { createElement: (type, props, ...children) => ({ type, props: { ...props, children } }),
    useRef(value) { return hooks[cursor++] ??= { current: value }; },
    useState(initial) { const index = cursor++; hooks[index] ??= initial; return [hooks[index], value => { hooks[index] = value; }]; } };
  const mocks = {
    react,
    'react-native': { View: 'View', StyleSheet: { create: value => value, hairlineWidth: 1 },
      useWindowDimensions: () => ({ height: 852, fontScale: 1 }) },
    '@expo/vector-icons': { Ionicons: 'Icon' },
    'react-native-safe-area-context': { useSafeAreaInsets: () => ({ bottom: 34 }) },
    '@/lib/bottom-sheet-gesture': { BOTTOM_SHEET_DRAG_REGION_HEIGHT: 44 },
    '@/components/sheets/StrengthLedgerBottomSheet': { StrengthLedgerBottomSheet: 'Sheet' },
    '@/components/keyboard/KeyboardSurface': { KeyboardScrollView: 'Scroll' },
    '@/components/ui/sl-motion': { SLMotionPressable: 'Pressable' },
    '@/components/ui/sl-text': { Text: 'Text' },
    '@/constants/theme': { SLColors: {}, SLFontFamilies: {} },
  };
  const exports = {};
  vm.runInNewContext(compiled, { exports, require: name => {
    assert.ok(name in mocks, name); return mocks[name];
  }, setTimeout: callback => timers.push(callback) });
  const props = { visible: true, canEditComposition: true, onDismiss: () => events.push('dismiss'),
    ...Object.fromEntries(['Add', 'Remove', 'Rest', 'Finish', 'Cancel'].map(action => [`on${action}`, () => events.push(action)])), ...overrides };
  function render() {
    cursor = 0;
    const tree = exports.SessionActionsSheet(props);
    tree.props.ref.current = { dismiss: () => events.push('animate-close') };
    return tree;
  }
  return { props, render, events, flush: () => { while (timers.length) timers.shift()(); } };
}
function nodes(node) {
  if (!node) return [];
  if (Array.isArray(node)) return node.flatMap(nodes);
  return [node, ...nodes(node.props?.children)];
}
const rows = tree => nodes(tree).filter(node => typeof node.type === 'function');
const row = (tree, label) => rows(tree).find(node => node.props.label === label);
const labels = tree => rows(tree).map(node => node.props.label);
const h = harness();
let tree = h.render();
assert.deepEqual(labels(tree), ['Add Movement', 'Remove Movement', 'Rest Timer', 'Finish Session', 'Cancel Session']);
assert.equal(tree.type, 'Sheet');
assert.equal(tree.props.onRequestClose, undefined, 'X/backdrop/swipe retain canonical dismissal');
assert.equal(tree.props.showCloseButton, undefined, 'Canonical X remains enabled');
assert.deepEqual(nodes(tree).filter(node => node.props?.accessibilityRole === 'header').map(node => node.props.children[0]),
  ['Session actions', 'SESSION', 'COMPLETION', 'DANGER ZONE']);
assert.equal(row(tree, 'Finish Session').props.tone, 'completion');
assert.equal(row(tree, 'Cancel Session').props.tone, 'danger');
assert.equal(row(tree, 'Cancel Session').props.description, 'Discards this Session and its logged Sets.');
tree.props.onDismiss(); h.flush();
assert.deepEqual(h.events, ['dismiss'], 'Safe dismissal invokes no Session operation');

for (const [label, event] of [['Add Movement', 'Add'], ['Remove Movement', 'Remove'], ['Rest Timer', 'Rest'], ['Finish Session', 'Finish'], ['Cancel Session', 'Cancel']]) {
  const test = harness(); const surface = test.render();
  row(surface, label).props.onPress(); row(surface, label).props.onPress();
  assert.deepEqual(test.events, ['animate-close'], 'Repeated taps cannot dispatch or queue two operations');
  surface.props.onDismiss();
  assert.deepEqual(test.events, ['animate-close', 'dismiss'], 'Action waits for the sheet to close');
  test.flush();
  assert.deepEqual(test.events, ['animate-close', 'dismiss', event]);
}
const coached = harness({ canEditComposition: false });
assert.deepEqual(labels(coached.render()), ['Rest Timer', 'Finish Session', 'Cancel Session']);
const blocked = harness({ removeUnavailableReason: 'All movements have logged Sets.' });
tree = blocked.render();
const disabledRow = row(tree, 'Remove Movement');
const renderedRow = disabledRow.type(disabledRow.props);
assert.equal(renderedRow.props.disabled, true);
assert.equal(renderedRow.props.accessibilityState.disabled, true);
assert.equal(renderedRow.props.accessibilityHint, 'All movements have logged Sets.');
assert.ok(nodes(renderedRow).some(node => node.props?.children?.includes('All movements have logged Sets.')));
disabledRow.props.onPress(); blocked.flush();
assert.deepEqual(blocked.events, [], 'Unavailable removal cannot start an action');

const logger = fs.readFileSync('app/(tabs)/workout/[workoutId].tsx', 'utf8');
assert.match(logger, /visible=\{sessionActionsVisible && canLog\}/);
assert.match(logger, /item\.can_remove && item\.set_log_count === 0/);
assert.match(logger, /!acceptedSetEvidenceItemIds\.has\(item\.id\)/);
assert.match(logger, /onRest=\{openTimerPicker\} onFinish=\{requestCompleteWorkout\} onCancel=\{\(\) => setCancelConfirmVisible\(true\)\}/);
assert.doesNotMatch(source, /cancelWorkout|fetchJson|AsyncStorage|Close<\/Text>/);
const modals = fs.readFileSync('components/workout-logger/logger-modals.tsx', 'utf8');
assert.match(modals, /confirmTone=\{resuming \? 'primary' : 'danger'\}/);
assert.match(modals, /cancelLabel="Keep Session"/);
console.log('PASS Session actions: semantic groups, unchanged handlers, safe dismissal, deferred single dispatch, self-coach eligibility, disabled removal, and cancellation confirmation wiring');
