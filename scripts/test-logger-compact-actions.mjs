import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const nodes = node => node && typeof node === 'object'
  ? [node, ...node.children.flat(Infinity).flatMap(nodes)] : [];
const text = node => node == null || node === false ? '' : typeof node === 'object'
  ? node.children.flat(Infinity).map(text).join('') : String(node);
const react = { createElement(type, props, ...children) {
  return typeof type === 'function' ? type({ ...props, children }) : { type, props: props || {}, children };
}, useState: () => [0, () => {}], useCallback: fn => fn };
const deps = { react, 'react-native': { Pressable: 'Pressable', View: 'View', StyleSheet: { create: x => x } },
  '@expo/vector-icons': { Ionicons: 'Icon' }, '@/components/ui/sl-text': { Text: 'Text' },
  '@/lib/approved-art-runtime': { approvedArtRuntimeEnabled: () => false },
  '@/components/movement/CanonicalMovementArtwork': { CanonicalMovementArtwork: 'Artwork' },
  '@/components/movement/MovementArtworkHero': { MovementArtworkHero: 'Hero' },
  '@/lib/movement-artwork-hero': { resolveMovementArtworkPresentation: () => ({ hero: null }) },
  './logger-primitives': { LoggerPlateStackVisual: 'Plates' },
  './manufacturer-brand-mark': { ManufacturerBrandMark: 'Brand' },
  '@/constants/theme': { SLColors: {}, SLFontFamilies: {}, SLTypography: { micro: {}, label: {}, caption: {} } } };
function load(file) {
  const module = { exports: {} };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true },
  }).outputText, { module, exports: module.exports, require(key) { assert.ok(key in deps, key); return deps[key]; } });
  return module.exports;
}
const { SessionV3MovementLayout } = load('components/workout-logger/session-v3-movement.tsx');
const { SessionEquipmentContext } = load('components/workout-logger/session-equipment-context.tsx');
let edits = 0, swaps = 0;
const props = { title: 'EZ-Bar Curl', index: 1, expanded: true, complete: false, onOpen() {},
  focus: { currentSetRepsLabel: '8-12 reps', currentSetEffortLabel: '1 RIR' }, onEditPrescription() { edits++; } };
let tree = SessionV3MovementLayout(props);
const edit = nodes(tree).find(n => n.props.accessibilityLabel === 'Edit Prescription for EZ-Bar Curl');
assert.ok(edit, 'real expanded workspace must expose the prescription editor');
assert.ok(nodes(tree).some(n => n.children.includes(edit) && text(n).includes('PRESCRIBED')),
  'the edit affordance belongs beside the prescription label');
edit.props.onPress(); assert.equal(edits, 1);
assert.equal(nodes(SessionV3MovementLayout({ ...props, onEditPrescription: undefined })).some(n => /Edit Prescription/.test(n.props.accessibilityLabel)), false,
  'no edit control without the permission-bound callback');
assert.ok(nodes(SessionV3MovementLayout({ ...props, complete: true })).some(n => n.props.accessibilityLabel === edit.props.accessibilityLabel),
  'completed movement remains editable within a legally active Session');
assert.equal(nodes(SessionV3MovementLayout({ ...props, expanded: false })).some(n => n.props.accessibilityLabel === edit.props.accessibilityLabel), false);
tree = SessionEquipmentContext({ selected: true, manufacturer: 'Hammer Strength', name: 'Hammer Strength', variant: 'Plate Loaded', onSwapEquipment() { swaps++; } });
const swap = nodes(tree).find(n => n.props.accessibilityLabel === 'Swap equipment');
assert.ok(swap); swap.props.onPress(); assert.equal(swaps, 1);
assert.equal(text(tree).split('Hammer Strength').length - 1, 1, 'retain manufacturer once with useful configuration');
assert.ok(text(tree).includes('Plate Loaded'));
assert.equal(nodes(SessionEquipmentContext({ selected: false, onSwapEquipment() {} })).some(n => n.props.accessibilityLabel === 'Swap equipment'), false,
  'automatic first-log equipment selection does not need a separate action row');
assert.equal(nodes(SessionEquipmentContext({ selected: true })).some(n => n.props.accessibilityLabel === 'Swap equipment'), false);
const logger = fs.readFileSync('app/(tabs)/workout/[workoutId].tsx', 'utf8');
const accessory = logger.slice(logger.indexOf('const renderAccessoryMovement'), logger.indexOf('const coreWheelSubmitAction'));
assert.doesNotMatch(accessory, /auxAction=|accessoryInlineAction/);
assert.match(accessory, /onSwapEquipment=\{!isCoachAthletePreview && canConfigureMachineEquipment\(it\)/);
assert.match(accessory, /movementAction=\{!isCoachAthletePreview && swapLabel/);
assert.match(accessory, /onPress=\{\(\) => openSwapAcc\(it\)\}/);
assert.match(logger, /onEditPrescription=\{canEditPrescription \? openPrescription/,
  'superset editor entry point remains permission-bound');
console.log('PASS compact Logger actions: real edit/equipment callbacks, completed/permission/collapsed behavior, no accessory action row, canonical swap gates and superset entry point retained.');
