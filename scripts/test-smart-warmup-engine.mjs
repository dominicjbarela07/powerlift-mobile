import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const route = fs.readFileSync(path.join(root, 'app/(tabs)/workout/[workoutId].tsx'), 'utf8');
const row = fs.readFileSync(path.join(root, 'components/workout-logger/core-loggers.tsx'), 'utf8');
const sheet = fs.readFileSync(path.join(root, 'components/workout-logger/smart-warmup-sheet.tsx'), 'utf8');
const plateStackSource = fs.readFileSync(path.join(root, 'lib/barbell/plate-stack-render-resolver.ts'), 'utf8');
const plateMetadataSource = fs.readFileSync(path.join(root, 'lib/barbell/plate-metadata.ts'), 'utf8');
const barConfigurationAssetSource = fs.readFileSync(path.join(root, 'lib/barbell/bar-configuration-assets.ts'), 'utf8');
const loggerVisualSource = fs.readFileSync(path.join(root, 'lib/logger-visual-context.ts'), 'utf8');
const functionalSmoke = fs.readFileSync(path.join(root, '.maestro/smart-warmup-functional-smoke.yaml'), 'utf8');
const undoSmoke = fs.readFileSync(path.join(root, '.maestro/smart-warmup-completion-undo-smoke.yaml'), 'utf8');
const skipSmoke = fs.readFileSync(path.join(root, '.maestro/smart-warmup-skip-smoke.yaml'), 'utf8');
const prescribed = await import(path.join(root, 'lib/logger-prescribed-weight.ts'));
const smartWarmup = await import(path.join(root, 'lib/smart-warmup.ts'));
const warmupEquipmentAssets = [
  ...['35lb', '45lb', '55lb', 'custom'].flatMap((bar) => [
    `assets/images/warmup-configuration/bars/bar-${bar}-none.png`,
    `assets/images/warmup-configuration/bars/bar-${bar}-competition.png`,
    `assets/images/warmup-configuration/bars/bar-${bar}-custom-collars.png`,
  ]),
  'assets/images/barbell_collar.png',
];

for (const asset of warmupEquipmentAssets) {
  const assetPath = path.join(root, asset);
  assert.equal(fs.existsSync(assetPath), true, `missing warmup configuration asset: ${asset}`);
  if (asset.includes('/bars/')) {
    const png = fs.readFileSync(assetPath);
    assert.equal(png.readUInt32BE(16), 2304, `${asset} must use the canonical Retina width`);
    assert.equal(png.readUInt32BE(20), 768, `${asset} must use the canonical Retina height`);
    assert.equal([4, 6].includes(png[25]), true, `${asset} must retain an alpha channel`);
  }
}

assert.match(route, /core\.smart_warmup\?\.eligible/);
assert.match(route, /!hasAnyLogs/);
assert.match(route, /core\.smart_warmup\?\.session\?\.status === 'completed'/);
assert.match(route, /<SmartWarmupSheet/);
assert.doesNotMatch(route, /Adaptive · plate-aware · working range protected/);
assert.match(route, /formatWarmupPhysicalConfiguration\(core\.smart_warmup\.session\.loading_configuration, unit\)/);
assert.match(route, /const cancelWorkout = async \(\) =>[\s\S]*setWarmupItemId\(null\);[\s\S]*await finishSessionTiming\(wkId\);[\s\S]*await fetchWorkout\(\);/);
assert.match(route, /if \(status === 'in_progress'\) return;[\s\S]*clearRestTimerExpiry\(workoutId\)/);
assert.match(route, /onOpenRestTimerPicker=\{openTimerPicker\}/);
assert.match(row, /warmupAction \? \([\s\S]*?<View style=\{\[[\s\S]*?styles\.coreWarmupAction/);
assert.match(sheet, /SessionUnitFloatingControl/);
assert.match(sheet, /style=\{styles\.activeFooter\}[\s\S]*<SessionUnitFloatingControl bottom=\{2\}/);
assert.doesNotMatch(sheet, /unitControlDock/);
assert.doesNotMatch(sheet, /SurfaceWeightUnitToggle/);
assert.match(sheet, /const nextWarmup = item\?\.smart_warmup\?\.session \|\| null/);
assert.match(sheet, /setWarmup\(nextWarmup\)/);
assert.match(sheet, /if \(nextWarmup\) \{\s*setBusy\(false\)/);
assert.match(sheet, /const steps = warmup\?\.progression\?\.steps \|\| EMPTY_WARMUP_STEPS/);
assert.match(sheet, /const suppliedWarmup = item\?\.smart_warmup\?\.session \|\| null/);
assert.match(sheet, /if \(!visible \|\| !itemId \|\| suppliedWarmup \|\| warmup \|\| error\) return/);
assert.match(sheet, /setBusy\(false\);\s*setWarmup\(json\.warmup\?\.session \|\| null\)/);
assert.doesNotMatch(sheet, /\.finally\(\(\) => current && setBusy\(false\)\)/);
assert.doesNotMatch(sheet, /AsyncStorage|RATIO_LADDERS|warmupRatios|target\s*\*\s*0\.[0-9]+/);
assert.match(sheet, /WARMUP SETS/);
assert.match(sheet, /accessibilityLabel="Warmup progression"/);
assert.match(sheet, /horizontal/);
assert.match(sheet, /snapToInterval=\{progressionStride\}/);
assert.match(sheet, /progressionRef\.current\?\.scrollTo/);
assert.match(sheet, /animated: !reduceMotion/);
assert.match(sheet, /<WarmupCarouselCard/);
assert.match(sheet, /<ActiveWarmupWorkspace/);
assert.match(sheet, /next=\{warmup\.status === 'active' && index === activeStepIndex \+ 1\}/);
assert.match(sheet, /resolvePhysicalPlateStackRender\(step\)/);
const carouselCard = sheet.match(/function WarmupCarouselCard[\s\S]*?function CompletedWarmupWorkspace/)?.[0] || '';
assert.doesNotMatch(carouselCard, />ACTIVE<|>NEXT<|>VIEWING</, 'progression cards must communicate state through material and color, not status tags');
assert.match(carouselCard, /carouselCardTop[\s\S]*stepCircle[\s\S]*carouselCardMetrics[\s\S]*carouselWeight[\s\S]*carouselReps/, 'set identity must remain top-left while load and reps occupy the top-right metric stack');
assert.match(carouselCard, /carouselPlateStage[\s\S]*carouselPlateStack/, 'the physical stack must own a dedicated dominant card stage');
assert.match(sheet, /carouselPlateStack: \{ width: '100%', height: 68 \}/, 'progression plate stacks must be substantially larger than the retired 42-point render');
assert.match(sheet, /carouselCardActive:[\s\S]*carouselCardComplete:[\s\S]*carouselCardSelected:[\s\S]*carouselCardNext:[\s\S]*carouselCardFuture:/, 'active, next, future, completed, and inspection states must remain visually distinct');
assert.match(carouselCard, /Inspect completed warmup \$\{step\.sequence\}/, 'completed cards must remain inspectable for undo');
assert.doesNotMatch(sheet, /WarmupTimelineRow|phaseHeading|phaseGroup/);
assert.doesNotMatch(sheet, />PREPARE<|>RAMP<|>ASSESS</);
assert.match(sheet, /Edit warmup configuration/);
assert.match(sheet, /testID="smart-warmup-edit-configuration"/);
assert.match(sheet, /Warmup Configuration/);
assert.doesNotMatch(sheet, /Completed sets stay unchanged\. Remaining sets regenerate\./);
assert.match(sheet, /STYLE_STOPS = \{ minimal: 3, standard: 4, gradual: 5 \}/);
assert.match(sheet, /<ProgressionGlyph preference=\{preference\} selected=\{selected\} \/>/);
assert.match(sheet, /Fewer sets\\nbigger jumps/);
assert.match(sheet, /standard: 'Balanced\\nprogression'/);
assert.match(sheet, /More sets\\nsmaller jumps/);
assert.match(sheet, /progressionStep/);
assert.match(sheet, /Today&apos;s progression:[\s\S]*warmup\.progression\.steps\.length\} sets/);
assert.match(sheet, /\['minimal', 'standard', 'gradual'\]/);
assert.match(sheet, /testID=\{`smart-warmup-style-\$\{preference\}`\}/);
assert.doesNotMatch(sheet, /testID="smart-warmup-collars-light"/);
assert.doesNotMatch(sheet, />Light Collars</);
assert.match(sheet, /smart-warmup-collars-none/);
assert.match(sheet, /smart-warmup-collars-competition/);
assert.match(sheet, /smart-warmup-collars-custom/);
assert.match(sheet, /COLLAR_ASSET = require\('@\/assets\/images\/barbell_collar\.png'\)/);
assert.match(sheet, /resolveBarConfigurationAsset\(config\.bar_key, config\.collar_key\)/);
assert.match(sheet, /resolveBarConfigurationAsset\(barKey, 'none'\)/);
assert.doesNotMatch(sheet, /BAR_SLEEVE_ASSETS|resolveBarSleeveAsset|previewShaft|previewSleeve|previewCollar/);
assert.match(barConfigurationAssetSource, /export function resolveBarConfigurationAsset/);
assert.match(barConfigurationAssetSource, /barKey === 'kg_15' \|\| barKey === 'lb_35'/);
assert.match(barConfigurationAssetSource, /barKey === 'kg_20' \|\| barKey === 'lb_45'/);
assert.match(barConfigurationAssetSource, /barKey === 'kg_25' \|\| barKey === 'lb_55'/);
assert.match(barConfigurationAssetSource, /collarKey === 'competition'/);
assert.match(barConfigurationAssetSource, /return 'custom'/);
assert.doesNotMatch(sheet, /name="barbell-outline"/);
assert.match(sheet, /5 kg pair · ≈11 lb/);
assert.match(sheet, /Both collars combined/);
assert.match(sheet, /\['custom', 'light'\]\.includes/);
assert.match(sheet, /remaining warmup\$\{remaining === 1 \? '' : 's'\} updated/);
assert.match(sheet, /custom_collar_weight: value/);
assert.match(sheet, /custom_collar_weight_unit: displayUnit/);
assert.match(sheet, /custom_bar_weight_unit: displayUnit/);
assert.match(sheet, /const changeDisplayUnit = \(nextUnit:[\s\S]*setDisplayUnit\(nextUnit\);\s*\};/);
assert.doesNotMatch(sheet, /const changeDisplayUnit = \(nextUnit:[^}]*configure\(/);
assert.match(sheet, /BAR_PRESETS\[displayUnit\]\.map/);
assert.match(sheet, /configure\(\{ loading_unit: displayUnit, bar_key: barKey \}\)/);
assert.match(sheet, /setCustomBarEditing\(true\)/);
assert.match(sheet, /testID=\{`smart-warmup-custom-\$\{kind\}-editor`\}/);
assert.match(sheet, /testID=\{`smart-warmup-custom-\$\{kind\}-save`\}/);
assert.match(sheet, /testID="smart-warmup-configuration-preview"/);
assert.match(sheet, /testID="smart-warmup-config-close"/);
assert.doesNotMatch(sheet, /carouselProgress/);
assert.match(sheet, /onPressIn=\{\(\) => \{ if \(!disabled\) void Haptics\.selectionAsync/);
assert.doesNotMatch(sheet, /setCustomBarDraft\(String\(initial\)\)/);
assert.doesNotMatch(sheet, /setCustomCollarEditing\(config\.collar_key === 'custom'\)/);
assert.doesNotMatch(sheet, /AVAILABLE PLATES/);
assert.doesNotMatch(sheet, /PLATE SYSTEM/);
assert.doesNotMatch(sheet, /togglePlate|availableDenominations|plateChoice/);
assert.match(sheet, /Custom bar weight/);
assert.match(sheet, /onOpenRestTimerPicker\(step\.rest_seconds\)/);
assert.match(sheet, /testID="smart-warmup-rest-timer"/);
assert.match(sheet, /testID="smart-warmup-rest-timer-stop"/);
assert.match(route, /restTimerActive=\{restActive\}/);
assert.match(route, /restTimerSeconds=\{restSeconds\}/);
assert.match(route, /onStopRestTimer=\{stopRestTimer\}/);
assert.doesNotMatch(sheet, /onStartRestTimer/);
assert.match(route, /embedded/);
assert.doesNotMatch(plateStackSource, /lb:\s*new Set\(\[45,\s*35/);
assert.match(plateMetadataSource, /PLATE_DENOMINATIONS_DESCENDING[^\n]+\[45, 25, 10, 5, 2\.5\]/);
assert.match(sheet, /complete_step/);
assert.match(sheet, /testID="smart-warmup-complete-set"/);
assert.match(sheet, /mutationInFlightRef\.current/);
assert.match(sheet, /if \(!item \|\| mutationInFlightRef\.current\) return false/);
assert.match(sheet, /pendingAction === 'complete_step'/);
assert.match(sheet, /style=\{\(\{ pressed \}\) => \[/);
assert.match(sheet, /pressed && styles\.primaryButtonPressed/);
assert.match(sheet, /pressed && !reduceMotion && styles\.primaryButtonPressedMotion/);
assert.match(sheet, /Haptics\.selectionAsync\(\)/);
assert.match(sheet, /<ActivityIndicator color="#FFFFFF" size="small" \/>/);
assert.match(sheet, />Completing…</);
assert.match(sheet, /accessibilityState=\{\{ busy: completing, disabled: busy \|\| completing \}\}/);
assert.match(sheet, /disabled=\{busy \|\| completing\}/);
assert.match(sheet, /finally \{\s*mutationInFlightRef\.current = false;\s*setPendingAction\(null\);\s*setBusy\(false\)/);
assert.match(sheet, /testID=\{`smart-warmup-feedback-\$\{feedback\}`\}/);
assert.match(sheet, /testID="smart-warmup-skip"/);
assert.match(sheet, /How did that move\?/);
assert.match(sheet, /Suggested starting load/);
assert.match(sheet, /smart-warmup-return-to-logger/);
assert.match(sheet, /const \[inspectedSequence, setInspectedSequence\] = useState<number \| null>\(null\)/);
assert.match(sheet, /Inspect completed warmup \$\{step\.sequence\}/);
assert.match(sheet, /selected=\{inspectedSequence === step\.sequence\}/);
assert.match(sheet, /<CompletedWarmupWorkspace/);
assert.match(sheet, /WARMUP SET \{step\.sequence\} — COMPLETED/);
assert.match(sheet, />Undo Completion</);
assert.match(sheet, />Undoing…</);
assert.match(sheet, /testID=\{`smart-warmup-undo-\$\{step\.sequence\}`\}/);
assert.match(sheet, /testID="smart-warmup-return-to-active"/);
assert.match(sheet, />Return to Active Set</);
assert.match(sheet, /if \(restTimerActive\) onStopRestTimer\?\.\(\)/);
assert.match(sheet, /last_completed_sequence/);
assert.match(sheet, /action: 'undo_last_step', expected_sequence: lastCompletedSequence/);
assert.match(sheet, /const undoLastStep = \(\) => \{[\s\S]*if \(!warmup \|\| busy \|\| lastCompletedSequence == null\) return;[\s\S]*if \(restTimerActive\) onStopRestTimer\?\.\(\);/);
assert.match(sheet, /testID="smart-warmup-undo-last"/);
assert.match(sheet, /Undo Last Warmup/);
assert.match(sheet, /pendingAction === 'undo_last_step'/);
assert.match(sheet, /accessibilityState=\{\{ busy: undoing, disabled: busy \|\| undoing \}\}/);
assert.match(sheet, /undoing \? <ActivityIndicator/);
assert.match(sheet, /action: 'undo_step'/);
assert.doesNotMatch(sheet, /Choose Another Load|CHOOSE ANOTHER LOAD/);
assert.doesNotMatch(sheet, /action: 'select_target'/);
assert.doesNotMatch(sheet, /Use \{weightLabel\(recommendation/);
assert.doesNotMatch(sheet, /SetLog|log_straight|log_top/);
assert.match(plateStackSource, /resolvePhysicalPlateStackRender/);
assert.match(plateStackSource, /plate_stack_known === false/);
assert.match(plateStackSource, /lookupPlateStackRenderCatalogAsset/);
assert.doesNotMatch(loggerVisualSource, /selected_target_kg/);
assert.match(loggerVisualSource, /resolveLoggerPhysicalLoading\(warmup\.allowed_working_loads, endpoint\)/);
assert.match(loggerVisualSource, /physicalLoading === undefined/);
assert.match(functionalSmoke, /smart-warmup-edit-configuration/);
assert.match(functionalSmoke, /smart-warmup-rest-timer/);
assert.match(functionalSmoke, /pressKey: HOME[\s\S]*openLink: \$\{EXPO_DEV_URL\}/);
assert.match(functionalSmoke, /smart-warmup-complete-set/);
assert.match(functionalSmoke, /smart-warmup-feedback-expected/);
assert.match(functionalSmoke, /Suggested starting load/);
assert.match(functionalSmoke, /smart-warmup-return-to-logger/);
assert.match(undoSmoke, /smart-warmup-undo-/);
assert.match(undoSmoke, /Undo Completion/);
assert.match(undoSmoke, /smart-warmup-undo-last/);
assert.match(undoSmoke, /assertNotVisible: "Suggested starting load"/);
assert.match(undoSmoke, /smart-warmup-feedback-expected/);
assert.match(undoSmoke, /415 lb\.\*435 lb/);
assert.match(skipSmoke, /smart-warmup-skip/);
assert.match(skipSmoke, /assertNotVisible: "Competition Squat warmup"/);

const untouched = prescribed.resolveLoggerPrescribedWeight({
  item: { target_low_kg: 150, target_high_kg: 180 },
  unit: 'kg',
});
assert.equal(untouched.source, 'item_target');
assert.equal(untouched.resolution, 'range');
assert.equal(untouched.endpoints.length, 2);

const completedWarmupDoesNotOverridePrescription = prescribed.resolveLoggerPrescribedWeight({
  item: {
    target_low_kg: 187.5,
    target_high_kg: 197.5,
    smart_warmup: { session: { selected_target_kg: 192.5, recommended_target_kg: 192.5 } },
  },
  unit: 'lb',
});
assert.equal(completedWarmupDoesNotOverridePrescription.source, 'item_target');
assert.equal(completedWarmupDoesNotOverridePrescription.resolution, 'range');
assert.equal(completedWarmupDoesNotOverridePrescription.endpoints.length, 2);

const loadingConfig = (overrides = {}) => ({
  unit: 'lb',
  bar_key: 'lb_45',
  bar_weight_kg: 45 * 0.45359237,
  collar_key: 'none',
  collar_weight_kg: 0,
  plates: [45, 25, 10, 5, 2.5],
  ...overrides,
});
assert.equal(smartWarmup.formatWarmupPhysicalConfiguration(loadingConfig()), '45 lb Bar · No Collars');
assert.equal(smartWarmup.formatWarmupPhysicalConfiguration(loadingConfig(), 'kg'), '20.41 kg Bar · No Collars');
assert.equal(smartWarmup.formatWarmupPhysicalConfiguration(loadingConfig({
  bar_key: 'lb_55',
  bar_weight_kg: 55 * 0.45359237,
  collar_key: 'competition',
  collar_weight_kg: 5,
})), '55 lb Bar · Competition Collars (5 kg)');
assert.equal(smartWarmup.formatWarmupPhysicalConfiguration(loadingConfig({
  unit: 'kg',
  bar_key: 'kg_20',
  bar_weight_kg: 20,
  collar_key: 'light',
  collar_weight_kg: 0.5,
})), '20 kg Bar · Collars (0.5 kg pair)');
assert.equal(smartWarmup.formatWarmupPhysicalConfiguration(loadingConfig({
  bar_key: 'custom',
  bar_weight_kg: 50 * 0.45359237,
})), '50 lb Bar · No Collars');
assert.equal(smartWarmup.formatWarmupPhysicalConfiguration(loadingConfig({
  collar_key: 'custom',
  collar_weight_kg: 4 * 0.45359237,
})), '45 lb Bar · Custom Collars (4 lb pair)');
assert.equal(smartWarmup.formatWarmupCollarWeight('competition', 5, 'kg'), '5 kg total · 2.5 kg each');
assert.equal(smartWarmup.formatWarmupCollarWeight('competition', 5, 'lb'), '11.02 lb total · 5.51 lb each · 5 kg pair');
assert.equal(smartWarmup.formatWarmupCollarWeight('light', 0.5, 'lb'), '1.1 lb total · 0.55 lb each');
assert.equal(smartWarmup.warmupStyleDescription('minimal'), 'Fewer warmup sets · larger jumps.');
assert.equal(smartWarmup.warmupStyleDescription('standard'), 'Balanced progression with familiar gym jumps.');
assert.equal(smartWarmup.warmupStyleDescription('gradual'), 'More warmup sets · smaller jumps.');

for (const testCase of [
  { item: { target_low_kg: 187.5, target_high_kg: 197.5 }, unit: 'lb', shape: 'range' },
  { item: { target_low_kg: 100, target_high_kg: 105 }, unit: 'kg', shape: 'range' },
  { item: { target_low_kg: 100, target_high_kg: 101 }, unit: 'kg', shape: 'range' },
  { item: { target_low_kg: 80, target_high_kg: 120 }, unit: 'kg', shape: 'range' },
  { item: { target_low_kg: 183.7, target_high_kg: 183.7 }, unit: 'lb', shape: 'exact' },
]) {
  const result = prescribed.resolveLoggerPrescribedWeight({ item: testCase.item, unit: testCase.unit });
  assert.equal(result.resolution, testCase.shape);
}

console.log('smart warmup mobile contracts: PASS');
