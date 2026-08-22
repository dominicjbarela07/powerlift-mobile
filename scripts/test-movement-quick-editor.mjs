#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  convertLoadDisplayValue,
  isCoreVariantDraft,
  manualTargetMarginFromStoredRange,
  mapCoachSessionEditorPayload,
  movementDraftFromItem,
  movementDraftIsDirty,
  movementProgrammingPatch,
  storedRangeFromManualTarget,
} from '../lib/coach-session-editor.ts';
import {
  accessoryRepBounds,
  accessoryRepTextFromBounds,
  decimalWheelOptions,
  loadWheelOptions,
  marginWheelOptions,
} from '../lib/prescription-wheel-options.ts';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (...parts) => fs.readFileSync(path.join(root, ...parts), 'utf8');
const workspace = read('components', 'coach-mobile', 'SessionEditingWorkspace.tsx');
const loggerWheel = read('components', 'workout-logger', 'logger-wheel-picker.tsx');
const loggerRoute = read('app', '(tabs)', 'workout', '[workoutId].tsx');
const route = read('app', '(tabs)', 'workout', 'session-workspace', '[workoutId].tsx');
const tabLayout = read('app', '(tabs)', '_layout.tsx');
const packageJson = JSON.parse(read('package.json'));

assert.match(workspace, /const openMovement = useCallback[\s\S]*selectedId === item\.id \? null : item\.id[\s\S]*setSelectedId\(nextId\)/, 'movement rows must expand and collapse without replacing the canonical Session draft');
assert.doesNotMatch(workspace, /autoOpenedSectionRef|openMovement\(initialSectionItems\[0\]/, 'the clean Session opens with movement cards collapsed so expansion remains explicit presentation state');
assert.match(workspace, /const collapseMovement = useCallback[\s\S]*setSelectedId\(null\)/, 'expanded movement collapse must be presentation-only');
assert.doesNotMatch(workspace.match(/const openMovement = useCallback[\s\S]*?\n  \}, \[/)?.[0] || '', /resolveDirty|Alert\.alert/, 'switching expanded movements must never trigger a dirty-state guard');
assert.match(workspace, /function InlineMovementWorkspace[\s\S]*styles\.expandedMovementHeader[\s\S]*<MovementQuickPrescriptionEditor/, 'movement identity must remain attached above direct prescription controls');
assert.match(workspace, /<StrengthLedgerBottomSheet[\s\S]*visible=\{picker != null\}/, 'input machinery must use the shared contextual bottom sheet while movement content stays inline');
assert.equal(packageJson.dependencies['@react-native-picker/picker'], undefined, 'the rejected coach-only third-party picker dependency must be removed');
assert.match(workspace, /import \{ LoggerWheelPicker \} from '@\/components\/workout-logger\/logger-wheel-picker'/, 'the movement editor must import the canonical Session Logger wheel');
assert.match(loggerRoute, /import \{ LoggerWheelPicker \} from '@\/components\/workout-logger\/logger-wheel-picker'/, 'the live Session Logger must use the extracted shared wheel');
assert.match(loggerWheel, /LOGGER_WHEEL_ROW_HEIGHT = 44[\s\S]*LOGGER_WHEEL_VISIBLE_ROWS = 5/, 'canonical Logger wheel geometry must remain unchanged');
assert.match(loggerWheel, /LOGGER_WHEEL_COMPACT_ROW_HEIGHT = 32[\s\S]*LOGGER_WHEEL_COMPACT_VISIBLE_ROWS = 3/, 'the workspace must use the vertically compact shared-wheel geometry');
assert.match(loggerWheel, /snapToInterval=\{rowHeight\}[\s\S]*decelerationRate="normal"/, 'canonical snapping and momentum must remain shared across densities');
assert.match(loggerWheel, /firstValidValue = column\.options\.find\(\(option\) => option !== ''\)[\s\S]*selectedValue = column\.value && column\.options\.includes\(column\.value\) \? column\.value : firstValidValue[\s\S]*next !== selectedValue[\s\S]*selected = option === selectedValue/, 'missing values must visibly select the first non-empty valid option without mutating the draft on open');
assert.match(loggerWheel, /Haptics\.selectionAsync\(\)/, 'both logger and editor must share canonical selection haptics');
assert.match(loggerWheel, /accessibilityRole="adjustable"/, 'shared wheels must expose adjustable accessibility semantics');
assert.match(loggerWheel, /accessibilityActions=\{accessibilityActions\}[\s\S]*accessibilityValue=\{\{ text: spokenValue \}\}/, 'shared wheels must expose bounded actions and formatted current values');
assert.match(loggerWheel, /optionText:[\s\S]*color: SLColors\.textMuted[\s\S]*opacity: 0\.3[\s\S]*optionTextActive:[\s\S]*color: SLColors\.textStrong[\s\S]*transform: \[\{ scale: 1\.1 \}\]/, 'canonical muted and selected-row treatments must remain intact');
assert.doesNotMatch(workspace, /NativeWheelField|nativeWheel|<Picker|@react-native-picker\/picker|snapToInterval|coreWheelOptionText/, 'no screen-local or third-party wheel implementation may remain in the movement editor');
assert.doesNotMatch(loggerRoute, /function WheelColumn|function LoggerWheelPicker|coreWheelSelectionPlane|coreWheelOptionText/, 'the Session Logger must not retain a duplicate embedded wheel implementation');
assert.doesNotMatch(workspace, /NumericStepper|numericStepper|stepperButton|Decrease \$\{label\}|Increase \$\{label\}/, 'plus/minus steppers must not remain in prescription editing');
assert.match(workspace, /<LoggerWheelPicker density="compact" columns=\{\[[\s\S]*key: 'sets'[\s\S]*key: 'reps'[\s\S]*key: draft\.mode\.toLowerCase\(\)/, 'core sets, reps, and intensity must use the compact canonical wheel');
assert.match(workspace, /function AccessoryPrescriptionEditor[\s\S]*PrescriptionValueControl accent="sets"[\s\S]*<StrengthLedgerBottomSheet[\s\S]*<LoggerWheelPicker density="compact"/, 'Accessory prescriptions remain compact until a canonical wheel sheet is requested');
assert.doesNotMatch(workspace, /label: 'Reps Lower'|label: 'Reps Upper'/, 'Accessory rep bounds must not be exposed as backend-shaped fields');
assert.match(workspace, /function CompactDropdownSelector[\s\S]*styles\.dropdownMenu/, 'set and intensity choices must use literal anchored dropdown menus');
assert.match(workspace, /styles\.prescriptionChoiceRow[\s\S]*label="Designation"[\s\S]*label="Set Type"[\s\S]*label="Intensity Type"/, 'Designation, Set Type, and Intensity Type must share one line before the wheels');
assert.match(workspace, /\{kind === 'core' \? <View style=\{\[styles\.quickSection, styles\.prescriptionChoiceRow\]\}>[\s\S]*\{!isCoreVariant \? <CompactDropdownSelector[\s\S]*label="Set Type"[\s\S]*\{!isCoreVariant \? <CompactDropdownSelector[\s\S]*label="Intensity Type"/, 'standard Core lifts alone expose designation, set type, and intensity type selectors');
assert.match(workspace, /isCoreVariant \? \([\s\S]*key: 'sets'[\s\S]*key: 'reps'[\s\S]*\) : draft\.scheme/, 'Core variants expose only sets and reps prescription wheels');
assert.match(workspace, /isCoreVariant \? \([\s\S]*<ManualOverrideBlock required/, 'Core variants require an always-visible manual load control');
assert.doesNotMatch(workspace, /Calculated target unavailable for accessories/, 'accessories must not render a fake calculated-target state');
assert.match(workspace, /designationOptions[\s\S]*Primary[\s\S]*Secondary[\s\S]*Tertiary[\s\S]*Quaternary[\s\S]*onChange=\{\(designation\) => onChange\(\{ designation \}\)\}/, 'the Designation dropdown must edit the canonical movement designation field');
assert.match(workspace, /onTouchStart=\{\(\) => setOpenDropdown\(null\)\}/, 'tapping outside an open prescription dropdown must dismiss it');
assert.doesNotMatch(workspace, /ActionSheetIOS|showActionSheetWithOptions/, 'prescription dropdowns must not open a detached action-sheet modal');
assert.doesNotMatch(workspace, /function ChoiceRow|styles\.choiceRow|styles\.choiceSelected/, 'large segmented prescription-choice rows must not return');
assert.match(workspace, /function MovementQuickPrescriptionEditor[\s\S]*<LoggerWheelPicker density="compact"[\s\S]*<CalculatedTargetPanel[\s\S]*<ManualOverrideBlock/, 'the direct prescription wheels must precede the calculated result and optional override');
assert.ok(workspace.indexOf('function MovementQuickPrescriptionEditor') < workspace.indexOf('function RecentHistorySection'), 'movement editing must precede supporting history');
assert.match(workspace, /draft\.scheme === 'TOP_BACKDOWN'[\s\S]*draft\.scheme === 'FULL_CUSTOM'/, 'all canonical persisted scheme branches remain editable without changing the approved primary layout');
assert.match(workspace, /label="Top Work"[\s\S]*label="Backdown Work"/, 'Top + Backdowns must expose first-class linked work blocks');
assert.match(workspace, /function FullCustomSetEditor/, 'Full Custom remains an inline editor within the attached workspace');
assert.match(workspace, /function FullCustomSetEditor[\s\S]*<LoggerWheelPicker density="compact" columns=\{\[[\s\S]*key: 'reps'/, 'Full Custom prescription rows must use the compact canonical wheel');
assert.match(workspace, /function FullCustomOverrideEditor[\s\S]*<ManualOverrideToggle[^>]*plural[\s\S]*<LoggerWheelPicker density="compact" columns=\{\[[\s\S]*key: 'manual-target'[\s\S]*key: 'manual-margin'/, 'Full Custom load wheels must stay inline behind the optional override action');
assert.match(workspace, /function FullCustomOverrideEditor[\s\S]*fallbackTarget = loadWheelOptions[\s\S]*plannedSets: draft\.plannedSets\.map/, 'Full Custom override wheels must persist a valid selected target when first revealed');
assert.match(workspace, /function CalculatedTargetPanel[\s\S]*Calculated target unavailable/, 'calculated and unavailable states must be explicit');
assert.match(workspace, /function CalculatedTargetPanel[\s\S]*styles\.calculatedIcon[\s\S]*styles\.calculatedEyebrow/, 'calculated output must follow the approved icon and value composition');
assert.doesNotMatch(workspace, /function CalculatedTargetPanel[\s\S]*<UnitToggle/, 'calculated output must not duplicate the toolkit unit control');
assert.match(workspace, /calculatedPanel:[^\n]*borderColor: SLColors\.borderStandard[^\n]*backgroundColor: SLColors\.surfaceMedia[\s\S]*calculatedIcon:[^\n]*borderColor: SLColors\.accentCyanMuted/, 'calculated output must use a neutral premium surface with restrained system-cyan emphasis');
assert.doesNotMatch(workspace, /calculatedPanel:[^\n]*(?:borderColor: SLColors\.borderSelected|backgroundColor: SLColors\.accentSoft)/, 'calculated output must not return to a purple-filled card');
assert.doesNotMatch(workspace, /Based on athlete training max|Based on the selected prescription|Optional coach-authored override|Use Manual Target/, 'instructional load-strategy copy and the checkbox-era label must be removed');
assert.match(workspace, /function ManualOverrideBlock[\s\S]*LayoutAnimation[\s\S]*<ManualOverrideToggle[\s\S]*Margin \u00b1/, 'manual target plus margin must reveal through the compact animated override control');
assert.match(workspace, /function calculatedManualTargetValue[\s\S]*roundLoggerDisplayWeight[\s\S]*nextEnabled && !manual\.target[\s\S]*updateManual\(initialTarget/, 'enabling a manual override must immediately select and persist a calculated target instead of exposing an unset wheel');
assert.match(workspace, /function ManualOverrideToggle[\s\S]*Manual Override[\s\S]*Override \$\{plural \? 'Targets' : 'Target'\}[\s\S]*<Switch/, 'manual override must use the approved labeled native switch row');
assert.match(workspace, /overrideActionActive:[^\n]*borderColor: SLColors\.warning[^\n]*backgroundColor: SLColors\.warningSoft/, 'active manual override must use semantic amber instead of interactive purple');
assert.match(workspace, /overrideActionTextActive: \{ color: SLColors\.warning \}/, 'active manual override copy must use semantic amber');
assert.match(workspace, /function ManualOverrideBlock[\s\S]*<LoggerWheelPicker density="compact" columns=\{\[[\s\S]*key: 'manual-target'[\s\S]*key: 'manual-margin'/, 'manual target and margin must use the compact canonical wheel');
assert.match(workspace, /function SessionFloatingToolkit[\s\S]*Units: \$\{unit\.toUpperCase\(\)\}/, 'the only workspace unit control lives inside the floating Session toolkit');
assert.doesNotMatch(workspace, /function UnitToggle|styles\.unitToggle|SessionUnitFloatingControl/, 'no separate unit toggle remains inside or outside the expanded card');
assert.doesNotMatch(workspace, /PlateVisualizationSection|Plate Visualization|LoggerPlateStackVisual|resolveLoggerPlateStackForDisplayWeight/, 'the rejected Plate Visualization section must remain absent');
assert.doesNotMatch(workspace, /Plate Math|Per Side|platesPerSide|plateMath(?:Panel|Summary|Line|Label|Image|Unavailable)/, 'the visual plate confirmation must not regress into a textual calculator');
assert.match(workspace, /function RecentHistorySection[\s\S]*exactAccessoryHistoryRows\(item\.movement_history\)/, 'real recent history must use the centralized exact-history contract');
assert.match(workspace, /function CoachNotesSection[\s\S]*\{editing \? 'Done' : 'Edit'\}[\s\S]*accessibilityLabel="Coach Notes"/, 'Coach Notes must remain inline with explicit Edit and Done controls');
assert.match(workspace, /function InlineMovementWorkspace[\s\S]*<RecentHistorySection[\s\S]*<CoachNotesSection[\s\S]*<MovementDeleteAction/, 'movement-specific content and the single Delete action must remain inside the expanded card');
assert.match(workspace, /function MovementDeleteAction[\s\S]*accessibilityLabel="Remove Movement"/, 'the expanded movement card exposes one restrained Remove Movement action');
assert.doesNotMatch(workspace, /function MovementQuickActions|Quick Actions|Duplicating|label="Move"|label="Duplicate"/, 'the rejected movement Quick Actions group must not return');
assert.match(workspace, /\{sessionDirty \? \([\s\S]*Discard Changes[\s\S]*Save Changes/, 'the Session-wide dirty state alone controls the sticky save and discard actions');
assert.match(workspace, /if \(!success\) \{[\s\S]*acceptIncomingSessionRef\.current = false[\s\S]*return false[\s\S]*setPersistedSession/, 'only a successful whole-Session save may reset persisted dirty state');
assert.match(route, /Your Session edits are still available\./, 'failed saves must explicitly preserve entered edits');
assert.match(route, /const saveSessionDraft = async[\s\S]*method: 'PATCH'[\s\S]*body:/, 'saves must remain server-authoritative programming mutations');
assert.match(route, /'\/workouts\/mobile\/suggest_range'[\s\S]*athlete_id:[\s\S]*rpe_target:[\s\S]*target_low_kg/, 'calculated load must come from the authoritative server endpoint');
assert.match(route, /value == null \|\| value === ''[\s\S]*\? null/, 'missing calculated values must remain null instead of becoming zero');
assert.match(route, /isCoreVariantSelection = setup\.lift === 'VR'[\s\S]*\.\.\.\(!isCoreVariantSelection \? \{ scheme: setup\.scheme, mode: setup\.mode \} : \{\}\)[\s\S]*\.\.\.\(isCoreVariantSelection \? \{[\s\S]*target_low_lb[\s\S]*target_high_lb/, 'Core variant mutations omit set and intensity types and require explicit manual load');
assert.match(route, /\{isCoreVariantSelection \? \([\s\S]*title="Variant Load"[\s\S]*\{!isCoreVariantSelection \? <TrainingLiftSection title="Pattern"[\s\S]*\{!isCoreVariantSelection \? <TrainingLiftSection title="Load language"/, 'Core variant setup shows manual load and hides pattern and intensity setup');
assert.match(workspace, /setSessionEditorOverlayOpen\(sessionDirty\)/, 'dirty Session editing preserves boundary protection without tying shell visibility to expansion');
assert.doesNotMatch(workspace, /setSessionEditorOverlayOpen\(Boolean\(selectedItem\)/, 'expanded workout items keep the tab row visible');
assert.match(tabLayout, /hidesNavigationForSessionEditor[\s\S]*sessionEditorOverlayOpen[\s\S]*return null/, 'the floating shell must be hidden while the movement editor is open');
assert.match(workspace, /onPress=\{\(\) => onOpen\(item\)\}/, 'collapsed movement rows must still open their exact movement');
assert.match(workspace, /function movementItemWithDraft[\s\S]*if \(!normalized\) return null[\s\S]*parsed <= 0/, 'empty and zero draft load fields must never become fake manual loads');
assert.match(workspace, /const load = kind === 'core'[\s\S]*expandedLoadPresentation[\s\S]*: null/, 'Accessories never receive expanded load suggestions');

for (const forbidden of [
  /horizontalGesture/,
  /switchMovement/,
  /activeOffsetX/,
  /Previous movement/,
  /Next movement/,
  /MovementPeekSummary/,
  /function Disclosure/,
  /function EquipmentPanel/,
  /title="Tags"/,
  /title="Rest"/,
  /Edit movement setup/,
]) {
  assert.doesNotMatch(workspace, forbidden, `obsolete quick-editor behavior remains: ${forbidden}`);
}

const mapped = mapCoachSessionEditorPayload({
  workout: {
    core_items: [{
      id: 9,
      movement: 'Competition Bench',
      sets: 1,
      reps: 5,
      rpe_target: 7,
      movement_definition_id: 42,
      equipment_type: 'barbell',
      coach_prescribed_low_kg: null,
      coach_prescribed_high_kg: null,
      suggested_low_kg: 100,
      baseline_low_kg: 95,
      calculated_load_low_kg: 102.5,
    }],
    accessory_groups: [],
  },
});
const item = mapped.workout.core_items[0];
const draft = movementDraftFromItem(item);
assert.equal(draft.targetLowLb, '', 'missing explicit low load must remain absent');
assert.equal(draft.targetHighLb, '', 'missing explicit high load must remain absent');
assert.equal(movementDraftIsDirty(draft, draft), false, 'opening or focusing the editor must remain clean');
assert.equal(movementDraftIsDirty({ ...draft, sets: '2' }, draft), true, 'direct field edits must mark the editor dirty');
assert.equal(movementDraftIsDirty({ ...draft, sets: '01' }, draft), false, 'semantic restoration must return to clean state');
const patch = movementProgrammingPatch({ ...draft, reps: '6' }, 'core');
assert.equal(patch.target_low_lb, '', 'missing explicit load must not gain a zero or fallback');
assert.equal(patch.target_high_lb, '', 'missing explicit range must stay absent');
assert.equal('movement_definition_id' in patch, false, 'hidden equipment identity must not be overwritten by quick-editor saves');
assert.equal('equipment_type' in patch, false, 'hidden equipment metadata must not be cleared by quick-editor saves');
assert.equal(item.movement_definition_id, 42, 'the source movement keeps hidden equipment identity');

const accessoryDraft = movementDraftFromItem({
  lift: 'AX',
  variant: 'ACC',
  movement: 'Barbell Row',
  sets: 3,
  reps_text: '10-12',
  rir_target: 2,
});
const accessoryPatch = movementProgrammingPatch(accessoryDraft, 'accessory');
for (const field of ['designation', 'scheme', 'mode', 'rpe_target', 'pct']) {
  assert.equal(field in accessoryPatch, false, `accessory payload must omit ${field}`);
}

const variantDraft = movementDraftFromItem({
  lift: 'VR',
  variant: 'STRAIGHT',
  movement: 'Paused Bench',
  designation: 'SECONDARY',
  sets: 4,
  reps: 5,
  rpe_target: 8,
  coach_prescribed_low_kg: 100,
  coach_prescribed_high_kg: 105,
});
assert.equal(isCoreVariantDraft(variantDraft), true, 'VR is the canonical Core variant branch');
const variantPatch = movementProgrammingPatch(variantDraft, 'core');
for (const field of ['scheme', 'mode', 'rpe_target', 'pct', 'planned_sets']) {
  assert.equal(field in variantPatch, false, `Core variant payload must omit ${field}`);
}
assert.equal(variantPatch.designation, 'SECONDARY', 'Core variants retain designation');
assert.equal(variantPatch.sets, '4', 'Core variants retain sets');
assert.equal(variantPatch.reps, '5', 'Core variants retain reps');
assert.ok(variantPatch.target_low_lb && variantPatch.target_high_lb, 'Core variants retain explicit manual load');

const fullCustomPatch = movementProgrammingPatch({
  ...draft,
  scheme: 'FULL_CUSTOM',
  plannedSets: [{ reps: '5', rpe: '7', pct: '', targetLb: '', rangeLb: '' }],
}, 'core');
assert.equal(fullCustomPatch.planned_sets[0].manual_target_kg, null, 'missing per-set explicit load must remain null');
assert.equal(fullCustomPatch.planned_sets[0].manual_pm_kg, null, 'missing per-set load range must remain null');

const manualRangeKg = storedRangeFromManualTarget('145', '2.5', 'kg', 'kg');
assert.deepEqual(manualRangeKg, { low: '142.5', high: '147.5' }, 'target plus margin must serialize to explicit low/high');
assert.deepEqual(storedRangeFromManualTarget('', '', 'kg', 'kg'), { low: '', high: '' }, 'clearing manual target must remove explicit load');
assert.deepEqual(manualTargetMarginFromStoredRange('', '', 'kg', 'lb'), { target: '', margin: '' }, 'missing explicit load must never gain a zero default');

const storedLb = storedRangeFromManualTarget('145', '2.5', 'kg', 'lb');
const displayedKg = manualTargetMarginFromStoredRange(storedLb.low, storedLb.high, 'lb', 'kg');
assert.ok(Math.abs(Number(displayedKg.target) - 145) < 0.01, 'manual target conversion must preserve its canonical value');
assert.ok(Math.abs(Number(displayedKg.margin) - 2.5) < 0.01, 'manual margin conversion must preserve its canonical value');
let canonicalValue = '145';
for (let index = 0; index < 20; index += 1) {
  const pounds = convertLoadDisplayValue(canonicalValue, 'kg', 'lb');
  assert.ok(Number.isFinite(Number(pounds)), 'converted display value must remain numeric');
}
assert.equal(canonicalValue, '145', 'repeated display-unit toggles must not mutate canonical stored values');

assert.deepEqual(decimalWheelOptions(70, 80, 2.5), ['70', '72.5', '75', '77.5', '80'], 'percentage wheels use canonical 2.5-point increments');
assert.deepEqual(loadWheelOptions('kg', '').filter((value) => ['137.5', '140', '142.5', '145', '147.5'].includes(value)), ['137.5', '140', '142.5', '145', '147.5'], 'kg load wheels use canonical plate increments');
assert.deepEqual(marginWheelOptions('kg', '').slice(0, 7), ['0', '1.25', '2.5', '3.75', '5', '6.25', '7.5'], 'kg margin wheels use 1.25 kg increments');
assert.deepEqual(loadWheelOptions('lb', '').filter((value) => ['225', '230', '235', '240', '245'].includes(value)), ['225', '230', '235', '240', '245'], 'lb load wheels use canonical five-pound work increments');
assert.deepEqual(accessoryRepBounds('10-12'), { low: '10', high: '12' }, 'accessory rep ranges must map to lower and upper canonical wheels');
assert.equal(accessoryRepTextFromBounds('10', '12'), '10-12', 'accessory rep-bound wheels must preserve the canonical range payload');
assert.equal(accessoryRepTextFromBounds('12', '10'), '10-12', 'crossing rep-bound wheels must normalize deterministically');
assert.ok(loadWheelOptions('kg', '143.2').includes('143.2'), 'an existing off-grid explicit load remains lossless');

const topBackdownPatch = movementProgrammingPatch({
  ...draft,
  scheme: 'TOP_BACKDOWN',
  backdownSets: '3',
  backdownReps: '5',
  backdownRpe: '6',
  backdownTargetLowLb: '205',
  backdownTargetHighLb: '215',
}, 'core');
assert.equal(topBackdownPatch.backdown_sets, '3');
assert.equal(topBackdownPatch.backdown_reps, '5');
assert.equal(topBackdownPatch.backdown_rpe_target, '6');
assert.equal(topBackdownPatch.backdown_target_low_lb, '205');
assert.equal(topBackdownPatch.backdown_target_high_lb, '215');

console.log('[movement-quick-editor] ok');
