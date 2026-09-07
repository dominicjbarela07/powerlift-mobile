import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');
const modal = read('components/workout-logger/logger-modals.tsx');
const sharedSheet = read('components/sheets/StrengthLedgerBottomSheet.tsx');

assert.match(modal, /<StrengthLedgerBottomSheet[\s\S]*accessibilityLabel="Rest Timer"/);
assert.match(modal, /testID="rest-timer-picker-material"/);
assert.doesNotMatch(
  modal,
  /styles\.(?:coreWheelSheet|restTimerPickerSheet|timerWheelWrap|timerWheelCenterIndicator)/,
  'Rest Timer must not rebuild a legacy wheel sheet inside the governed bottom sheet',
);
assert.doesNotMatch(
  modal,
  /rgba\((?:9,\s*14,\s*25|10,\s*14,\s*28)/,
  'Rest Timer must not introduce the retired blue/navy inner material',
);
assert.match(modal, /surface:\s*\{[\s\S]*?flex:\s*1,[\s\S]*?paddingHorizontal:\s*20/);
assert.match(modal, /centerIndicator:\s*\{[\s\S]*?rgba\(170, 98, 255, 0\.10\)[\s\S]*?StyleSheet\.hairlineWidth/);
assert.match(modal, /wheelTextSelected:\s*\{[\s\S]*?color:\s*SLColors\.textPrimary[\s\S]*?fontWeight:\s*'900'/);
assert.match(modal, /cancelButton:\s*\{[\s\S]*?backgroundColor:\s*SLColors\.surfaceInset/);
assert.match(modal, /style=\{\[styles\.actionButton, styles\.actionPrimary, restTimerPickerStyles\.startButton\]\}/);

assert.match(modal, /contentSwipeEnabled=\{false\}/, 'wheel gestures must remain isolated from sheet dismissal');
assert.match(modal, /onRequestClose=\{\(\) => onClose\('dismissed'\)\}/);
assert.match(modal, /startRestTimer\(REST_TIMER_OPTIONS\[nearestRestTimerIndex\(timerPickerValue\)\]\)/);
assert.match(modal, /onClose\('selected'\)/);

assert.match(sharedSheet, /backgroundColor:\s*SLColors\.canvasRaised/);
assert.match(sharedSheet, /paddingBottom:\s*Math\.max\(insets\.bottom, 10\)/);
assert.match(sharedSheet, /Swipe down to close \$\{accessibilityLabel\}/);
assert.match(sharedSheet, /Close \$\{accessibilityLabel\}/);

console.log('Rest Timer cohesive-material visual and interaction contract passed.');
