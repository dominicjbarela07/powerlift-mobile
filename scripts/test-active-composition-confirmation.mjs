import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

// Exercise the real component callbacks with controlled hooks and transport.
const source = fs.readFileSync('components/workout-logger/active-composition-editor.tsx', 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: {
  module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true, target: ts.ScriptTarget.ES2022,
} }).outputText;
function harness() {
  const hooks = [], requests = [], saved = [];
  let cursor = 0, closed = 0, resolveRequest;
  const react = {
    createElement: (type, props, ...children) => ({ type, props: { ...props, children } }),
    useState(initial) {
      const index = cursor++;
      if (!(index in hooks)) hooks[index] = initial;
      return [hooks[index], value => { hooks[index] = typeof value === 'function' ? value(hooks[index]) : value; }];
    },
    useRef(initial) { const index = cursor++; return hooks[index] ??= { current: initial }; },
    useEffect() {},
  };
  const mocks = {
    react,
    'react-native': { ActivityIndicator: 'ActivityIndicator', Pressable: 'Pressable', View: 'View', StyleSheet: { create: value => value, hairlineWidth: 1 } },
    '@/components/keyboard/KeyboardSurface': { KeyboardScrollView: 'ScrollView' },
    '@/components/ui/sl-text': { Text: 'Text', TextInput: 'TextInput' },
    '@/components/ui/sl-confirmation-modal': { SLConfirmationModal: 'Confirmation' },
    '@/components/sheets/StrengthLedgerBottomSheet': { StrengthLedgerBottomSheet: 'Sheet' },
    '@/components/movement/GovernedAccessoryPickerModal': {},
    '@/components/coach-mobile/SessionEditingWorkspace': {},
    '@/lib/active-session-composition': {},
    '@/constants/theme': { SLColors: {}, SLFontFamilies: {} },
    '@/lib/api': { fetchJson: (url, options) => { requests.push({ url, ...options }); return new Promise(resolve => { resolveRequest = resolve; }); } },
  };
  const exports = {};
  vm.runInNewContext(compiled, { exports, require: name => { assert.ok(name in mocks, name); return mocks[name]; } });
  const props = { mode: 'remove', workoutId: 7, athlete: { id: 2 }, unit: 'kg',
    composition: { item_ids: [11, 12], items: [
      { id: 11, movement: 'Front Squat', variant: 'STRAIGHT', can_remove: true, set_log_count: 0 },
      { id: 12, movement: 'Bench Press', variant: 'STRAIGHT', can_remove: false, set_log_count: 1 },
    ] }, onSaved: value => saved.push(value), onClose: () => { closed++; } };
  const render = () => { cursor = 0; return exports.ActiveCompositionEditor(props); };
  return { props, render, requests, saved, finish: value => resolveRequest(value), closed: () => closed };
}
function find(node, predicate) {
  if (!node) return;
  if (Array.isArray(node)) return node.map(child => find(child, predicate)).find(Boolean);
  if (predicate(node)) return node;
  return find(node.props?.children, predicate);
}
const confirmation = tree => find(tree, node => node.type === 'Confirmation').props;
const remove = tree => find(tree, node => node.props?.accessibilityLabel === 'Remove Front Squat').props;
const h = harness();
let tree = h.render();
assert.equal(confirmation(tree).visible, false);
assert.equal(find(tree, node => node.props?.accessibilityLabel === 'Remove Bench Press').props.disabled, true);
remove(tree).onPress(); tree = h.render();
assert.equal(confirmation(tree).visible, true);
assert.match(confirmation(tree).body, /Front Squat/);
assert.equal(h.requests.length, 0, 'Selecting a movement must not delete it');
confirmation(tree).onCancel(); tree = h.render();
assert.equal(confirmation(tree).visible, false);
assert.equal(h.requests.length, 0, 'Cancel must never send a mutation');
assert.equal(h.closed(), 0, 'Cancel returns to the movement list');
remove(tree).onPress(); tree = h.render();
confirmation(tree).onConfirm(); confirmation(tree).onConfirm();
assert.equal(h.requests.length, 1, 'Repeated confirmation sends only one request');
assert.match(h.requests[0].url, /\/7\/composition\/items\/11\?history=summary$/);
assert.equal(h.requests[0].method, 'DELETE');
assert.deepEqual(JSON.parse(h.requests[0].body), { expected_item_ids: [11, 12] });
h.finish({ ok: true, json: { ok: true } }); await new Promise(setImmediate);
assert.equal(h.saved.length, 1); assert.equal(h.closed(), 1);
const stale = harness(); remove(stale.render()).onPress();
stale.props.composition.items[0].can_remove = false;
confirmation(stale.render()).onConfirm();
assert.equal(stale.requests.length, 0, 'Newly logged evidence blocks a pending removal');
console.log('PASS active removal confirmation: select, cancel, exact item, duplicate tap, saved response, and changed eligibility');
