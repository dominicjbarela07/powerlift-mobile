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
assert.match(wheel, /LOGGER_WHEEL_COMPACT_ROW_HEIGHT = 32/);
assert.match(wheel, /LOGGER_WHEEL_COMPACT_VISIBLE_ROWS = 3/);
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
assert.match(wheel, /density === 'compact' \? <View pointerEvents="none" style=\{\[styles\.columnSelectionPlane/, 'each compact column must own its selected-value cell');
assert.match(wheel, /columnSelectionPlane:[\s\S]*borderColor: SLColors\.borderHairline[\s\S]*backgroundColor: 'rgba\(255,255,255,0\.055\)'/, 'compact selection must use the approved neutral selected band instead of a purple-filled cell');
assert.match(wheel, /optionTextCompact:[\s\S]*fontSize: 13[\s\S]*optionTextActiveCompact:[\s\S]*fontSize: 18[\s\S]*transform: \[\{ scale: 1 \}\]/, 'compact wheel typography must stay readable while remaining smaller than the canonical Logger density');
assert.match(wheel, /density === 'standard' \? <View pointerEvents="none" style=\{\[styles\.selectionPlane/, 'the shared selection plane must remain standard-density only');

assert.equal((logger.match(/<LoggerWheelPicker columns=/g) || []).length, 4, 'all canonical set-entry surfaces must keep using the shared wheel');
assert.match(workspace, /function PrescriptionWorkBlock[\s\S]*<LoggerWheelPicker density="compact" columns=/, 'Top and Backdown work must share the compact canonical wheel');
assert.match(workspace, /function FullCustomSetEditor[\s\S]*<LoggerWheelPicker density="compact" columns=/, 'Full Custom must share the compact canonical wheel');
assert.equal((workspace.match(/<LoggerWheelPicker density="compact"/g) || []).length, (workspace.match(/<LoggerWheelPicker/g) || []).length, 'every workspace wheel group must use compact density');
assert.match(workspace, /key: 'accessory-range-low'[\s\S]*key: 'accessory-range-high'/, 'grouped Accessory range bounds must share the canonical wheel');
assert.match(workspace, /key: 'manual-target'[\s\S]*suffix: displayUnit[\s\S]*key: 'manual-margin'/, 'unit-aware target and margin wheels must stay shared');
assert.doesNotMatch(workspace, /NumericStepper|stepperButton|Decrease \$\{label\}|Increase \$\{label\}/);

console.log('[logger-wheel-picker] one canonical wheel powers logger and coach prescription entry');
