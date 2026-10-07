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
}, isValidElement: node => !!node && typeof node === 'object' && 'props' in node,
useState: () => [0, () => {}], useCallback: fn => fn };
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
let movementSwaps = 0;
const movementAction = react.createElement('Text', { accessibilityLabel: 'Swap movement', onPress() { movementSwaps++; } }, 'Swap');
const inlineTitle = nodes(SessionV3MovementLayout({ ...props, movementAction }))
  .find(n => n.children.includes(movementAction));
assert.equal(inlineTitle.type, 'Text', 'movement Swap must flow after title text, never reserve a column');
assert.ok(text(inlineTitle).startsWith(props.title));
inlineTitle.props.onAccessibilityAction({ nativeEvent: { actionName: 'swap' } });
assert.equal(movementSwaps, 1, 'inline title retains accessible canonical Swap action');
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
assert.ok(nodes(tree).some(n => n.type === 'Brand'), 'selected equipment retains its manufacturer mark');
assert.equal(nodes(SessionEquipmentContext({ selected: false, onSwapEquipment() {} })).some(n => n.props.accessibilityLabel === 'Swap equipment'), false,
  'unselected equipment offers Select rather than Swap in the existing equipment area');
let selections = 0;
for (const domain of ['machine', 'cable']) {
  const unselected = SessionEquipmentContext({ selected: false, domain, onSwapEquipment() { selections++; } });
  const select = nodes(unselected).find(n => n.props.accessibilityLabel === 'Select equipment');
  assert.ok(select, `${domain}: unresolved equipment must expose Select`);
  assert.equal(nodes(unselected).some(n => n.type === 'Brand'), false, 'unresolved equipment has no unknown manufacturer placeholder');
  assert.equal(/history comparable|identify your cable station/.test(text(unselected)), false, 'unresolved equipment has no explanatory helper text');
  assert.equal(text(select), 'Select');
  select.props.onPress();
  assert.equal(select.props.style({ pressed: false }).some(s => s?.backgroundColor || s?.borderWidth), false,
    'Select remains a flat action like the approved Swap control');
}
assert.equal(selections, 2, 'Select must invoke the canonical picker callback');
assert.equal(nodes(SessionEquipmentContext({ selected: false })).some(n => n.props.accessibilityRole === 'button'), false,
  'read-only equipment has no Select control without its permission-bound callback');
assert.equal(nodes(SessionEquipmentContext({ selected: true })).some(n => n.props.accessibilityLabel === 'Swap equipment'), false);
const logger = fs.readFileSync('app/(tabs)/workout/[workoutId].tsx', 'utf8');
const accessory = logger.slice(logger.indexOf('const renderAccessoryMovement'), logger.indexOf('const coreWheelSubmitAction'));
assert.doesNotMatch(accessory, /auxAction=|accessoryInlineAction/);
assert.match(accessory, /onSwapEquipment=\{!isCoachAthletePreview && canConfigureMachineEquipment\(it\)/);
assert.match(accessory, /const hideEquipmentDetails = !askForEquipmentDetails \|\| isUnspecifiedEquipmentIdentity\(currentEquipment\)/);
assert.match(accessory, /expandedIdentityContext=\{accessoryIsExpanded && machineAccessory && !hideEquipmentDetails \?/,
  'opt-out/unspecified equipment must hide the entire equipment area, including Select');
assert.match(accessory, /movementAction=\{!isCoachAthletePreview && swapLabel/);
assert.match(accessory, /onPress=\{savingItemId === it.id \? undefined : \(\) => openSwapAcc\(it\)\}/);
assert.match(logger, /onEditPrescription=\{canEditPrescription \? openPrescription/,
  'superset editor entry point remains permission-bound');
console.log('PASS compact Logger actions: real edit/equipment callbacks, completed/permission/collapsed behavior, no accessory action row, canonical swap gates and superset entry point retained.');
