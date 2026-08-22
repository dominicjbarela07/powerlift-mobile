#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const read = (...parts) => fs.readFileSync(path.join(root, ...parts), 'utf8');

const wheel = read('components', 'workout-logger', 'logger-wheel-picker.tsx');
const logger = read('app', '(tabs)', 'workout', '[workoutId].tsx');
const workspace = read('components', 'coach-mobile', 'SessionEditingWorkspace.tsx');
const packageJson = JSON.parse(read('package.json'));

const sharedImport = /import \{ LoggerWheelPicker \} from '@\/components\/workout-logger\/logger-wheel-picker'/;
assert.match(logger, sharedImport, 'the canonical Session Logger must render through the shared wheel');
assert.match(workspace, sharedImport, 'the movement editor must render through the same shared wheel');
assert.equal((wheel.match(/function LoggerWheelColumn/g) || []).length, 1, 'there must be exactly one wheel-column implementation');
assert.equal((wheel.match(/snapToInterval=\{rowHeight\}/g) || []).length, 1, 'snapping must live only in the shared primitive');
assert.doesNotMatch(logger, /function WheelColumn|function LoggerWheelPicker|coreWheelSelectionPlane|coreWheelOptionText/);
assert.doesNotMatch(workspace, /NativeWheelField|nativeWheel|<Picker|snapToInterval/);
assert.equal(packageJson.dependencies['@react-native-picker/picker'], undefined, 'the duplicate third-party picker must stay removed');

assert.match(wheel, /LOGGER_WHEEL_ROW_HEIGHT = 44/);
assert.match(wheel, /LOGGER_WHEEL_VISIBLE_ROWS = 5/);
assert.match(wheel, /LOGGER_WHEEL_COMPACT_ROW_HEIGHT = 36/);
assert.match(wheel, /LOGGER_WHEEL_COMPACT_VISIBLE_ROWS = 3/);
assert.match(wheel, /LOGGER_WHEEL_SHEET_ROW_HEIGHT = 56/);
assert.match(wheel, /LOGGER_WHEEL_SHEET_VISIBLE_ROWS = 5/);
assert.match(wheel, /LOGGER_WHEEL_SHEET_LABEL_HEIGHT = 28/);
assert.match(wheel, /LoggerWheelDensity = 'standard' \| 'compact' \| 'sheet'/, 'the shared primitive owns a purpose-built sheet density without duplicating wheel behavior');
assert.match(wheel, /firstValidValue = column\.options\.find\(\(option\) => option !== ''\)[\s\S]*selectedValue = column\.value && column\.options\.includes\(column\.value\) \? column\.value : firstValidValue/);
assert.match(wheel, /next != null && next !== selectedValue/, 'programmatic alignment must not dirty an unset field');
assert.match(wheel, /decelerationRate="normal"/);
assert.match(wheel, /onScroll=\{\(event\) => \{[\s\S]*updateValue\(index\)/, 'draft callbacks must update live while a wheel moves');
assert.match(wheel, /onMomentumScrollEnd[\s\S]*settleToOffset/);
assert.match(wheel, /setTimeout\(\(\) => \{[\s\S]*settleToOffset\(offsetY\)[\s\S]*\}, 90\)/);
assert.match(wheel, /Haptics\.selectionAsync\(\)/, 'selection haptics must fire at the canonical settle point');
assert.match(wheel, /nestedScrollEnabled[\s\S]*directionalLockEnabled/, 'wheel gestures must remain isolated inside the workspace scroll view');
assert.match(wheel, /accessibilityRole="adjustable"/);
assert.match(wheel, /accessibilityActions=\{accessibilityActions\}/);
assert.match(wheel, /accessibilityValue=\{\{ text: spokenValue \}\}/);
assert.match(wheel, /scrollEnabled=\{!column\.disabled\}/);

assert.match(wheel, /optionText:[\s\S]*color: SLColors\.textMuted[\s\S]*opacity: 0\.3/);
assert.match(wheel, /optionTextActive:[\s\S]*color: SLColors\.textStrong[\s\S]*fontWeight: '900'[\s\S]*transform: \[\{ scale: 1\.1 \}\]/);
assert.match(wheel, /selectionPlane:[\s\S]*borderColor: SLColors\.borderSelected/);
assert.match(wheel, /density === 'compact' && \(grouped \? styles\.columnCompactGrouped : styles\.columnCompact\)/, 'compact workspace wheels keep independent cells by default and allow an explicit grouped surface');
assert.match(wheel, /columnCompact:[\s\S]*borderWidth: StyleSheet\.hairlineWidth[\s\S]*borderRadius: SLRadius\.md[\s\S]*backgroundColor: SLColors\.surfaceMedia/, 'each compact column cell must have an independent neutral boundary and surface');
assert.match(wheel, /grouped = false[\s\S]*grouped && styles\.columnsGrouped[\s\S]*columnCompactGrouped/, 'grouped wheel chrome is opt-in and does not change existing wheel surfaces');
assert.match(wheel, /\{column\.label \? <Text[\s\S]*\{column\.label\}<\/Text> : null\}/, 'empty grouped-column labels must not reserve hidden vertical space');
assert.match(wheel, /density !== 'standard' \? <View pointerEvents="none" style=\{\[styles\.columnSelectionPlane/, 'compact and sheet columns must own their selected-value plane');
assert.match(wheel, /columnSelectionPlane:[\s\S]*borderColor: SLColors\.borderHairline[\s\S]*backgroundColor: 'rgba\(255,255,255,0\.055\)'/, 'compact selection must use the approved neutral selected band instead of a purple-filled cell');
assert.match(wheel, /optionTextCompact:[\s\S]*fontSize: 15[\s\S]*opacity: 0\.56[\s\S]*optionTextActiveCompact:[\s\S]*fontSize: 22[\s\S]*opacity: 1[\s\S]*transform: \[\{ scale: 1 \}\]/, 'inline Training Lift wheels must remain compact while preserving readable neighbors and a dominant selected row');
assert.match(wheel, /optionTextSheet:[\s\S]*fontSize: 20[\s\S]*opacity: 0\.56[\s\S]*optionTextSheetNear:[\s\S]*fontSize: 22[\s\S]*opacity: 0\.76[\s\S]*optionTextSheetFar:[\s\S]*fontSize: 18[\s\S]*opacity: 0\.38/, 'sheet neighbors retain readable progressive depth around the selected plane');
assert.match(wheel, /optionTextActiveSheet:[\s\S]*fontSize: 32[\s\S]*lineHeight: 40[\s\S]*opacity: 1/, 'sheet selection typography must visibly command the control');
assert.match(wheel, /maxFontSizeMultiplier=\{density === 'sheet' \? 1\.25 : undefined\}/, 'sheet values support bounded Dynamic Type without losing their row geometry');
assert.match(wheel, /density === 'standard' \? <View pointerEvents="none" style=\{\[styles\.selectionPlane/, 'the shared selection plane must remain standard-density only');
assert.match(wheel, /separatorSelectedRow[\s\S]*top: framePadding \+ centerPadding[\s\S]*height: rowHeight/, 'a range separator must derive from the exact shared selected-row geometry');
assert.match(wheel, /separatorColumn:[\s\S]*width: 30[\s\S]*flexShrink: 0/, 'the fixed separator column leaves both wheel columns flexible at iPhone widths');

assert.equal((logger.match(/<LoggerWheelPicker columns=/g) || []).length, 4, 'all canonical set-entry surfaces must keep using the shared wheel');
assert.match(workspace, /function PrescriptionWorkBlock[\s\S]*<LoggerWheelPicker density="compact" columns=/, 'Top and Backdown work must share the compact canonical wheel');
assert.match(workspace, /function FullCustomSetEditor[\s\S]*<LoggerWheelPicker density="compact" columns=/, 'Full Custom must share the compact canonical wheel');
assert.ok((workspace.match(/<LoggerWheelPicker density="compact"/g) || []).length > 0, 'inline Training Lift prescription machinery remains on the shared compact density');
assert.equal((workspace.match(/<LoggerWheelPicker density="sheet"/g) || []).length, 4, 'Sets, Single Reps, Range Reps, and RIR use the dominant shared sheet density');
assert.match(workspace, /density="sheet" separator="—" columns=\{\[[\s\S]*key: 'sheet-min-reps'[\s\S]*key: 'sheet-max-reps'/, 'Accessory range bounds and the separator must share one canonical wheel row');
assert.doesNotMatch(workspace, /repRangeDash|top: 78/, 'the range separator must never return to screen-owned absolute positioning');
assert.match(workspace, /key: 'manual-target'[\s\S]*suffix: displayUnit[\s\S]*key: 'manual-margin'/, 'unit-aware target and margin wheels must stay shared');
assert.doesNotMatch(workspace, /NumericStepper|stepperButton|Decrease \$\{label\}|Increase \$\{label\}/);

console.log('[logger-wheel-picker] one canonical wheel powers logger and coach prescription entry');
