import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import {
  DEFAULT_MEET_MODE_RETURN_PATH,
  resolveMeetModeReturnPath,
} from '../lib/meet-mode-navigation.ts';
const root = process.cwd();
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');
const tabs = read('app/(tabs)/_layout.tsx');
const route = read('app/(tabs)/athlete-meet-plan.tsx');
const experience = read('components/meet-packet/AthleteMeetPacketV2.tsx');
const floatingControls = read('components/ui/floating-control-coordinator.tsx');
const header = read('components/navigation/MeetModeHeader.tsx');
const dashboard = read('app/(tabs)/athlete-dashboard.tsx');
const calendar = read('app/(tabs)/athlete-calendar.tsx');

assert.match(tabs, /isImmersiveMeetMode[\s\S]*if \(isImmersiveMeetMode\) return null;/, 'the global tab row must be absent inside Meet Mode');
assert.match(tabs, /name="athlete-meet-plan"[\s\S]*headerShown: false/, 'the global app header must yield to the immersive Meet header');
assert.match(tabs, /isMeetModeRoute[\s\S]*params: \{ returnTo: normalizedPathname \}/, 'global Meet entry must carry its prior app context');

assert.match(route, /resolveMeetModeReturnPath\(returnTo\)/);
assert.match(route, /router\.replace\(restoredPath/);
assert.match(route, /router\.canGoBack\(\)[\s\S]*router\.back\(\)/);
assert.match(route, /focusedTaskActive=\{attemptDraft != null\}/, 'attempt entry must suppress the Meet shell controls');
assert.match(dashboard, /athlete-meet-plan[\s\S]*returnTo: '\/athlete-dashboard'/);
assert.match(calendar, /athlete-meet-plan[\s\S]*returnTo: '\/athlete-calendar'/);

assert.match(header, /accessibilityLabel="Return to Strength Ledger"/);
assert.match(experience, /useState<MeetPacketTab>\('overview'\)/, 'Meet Packet tab state must remain in the mounted workspace');
assert.match(experience, /if \(value === 'more'\) setSheet\('menu'\);[\s\S]*else setTab\(value\);/, 'packet tabs must switch content without route remounts');
assert.match(experience, /testID="meet-mode-navigation"/);
assert.match(experience, /FloatingControlStack context="meet-screen"/, 'Meet utilities must use the governed floating rail');
assert.match(experience, /focusedSurfaceOwnsViewport = focusedTaskActive \|\| sheet !== null/);
assert.doesNotMatch(experience, /unitControlWrap|bottom: 83/, 'Meet utilities must not return to independent magic offsets');

for (const destination of ['Overview', 'Warmups', 'Attempts', 'Bag', 'More']) {
  assert.ok(experience.includes(destination), `${destination} must remain in the sole Meet navigation`);
}

assert.equal(resolveMeetModeReturnPath('/athlete-calendar'), '/athlete-calendar');
assert.equal(resolveMeetModeReturnPath('/ledger/strength'), '/ledger/strength');
assert.equal(resolveMeetModeReturnPath('/athlete-meet-plan'), null);
assert.equal(resolveMeetModeReturnPath('https://example.com'), null);
assert.equal(resolveMeetModeReturnPath('//example.com'), null);
assert.equal(resolveMeetModeReturnPath('/../login'), null);
assert.equal(DEFAULT_MEET_MODE_RETURN_PATH, '/(tabs)/athlete-dashboard');

assert.match(floatingControls, /FloatingControlContext = 'tab-screen' \| 'meet-screen' \| 'screen' \| 'sheet'/);
assert.match(floatingControls, /meetModeNavigationClearance\(safeBottom\)[\s\S]*SL_MEET_MODE_NAVIGATION\.contentGap/, 'Meet floating tools must clear the active navigation shell automatically');
assert.match(floatingControls, /Math\.max\(0, safeAreaBottom\)[\s\S]*SL_MEET_MODE_NAVIGATION\.bottomInset[\s\S]*SL_MEET_MODE_NAVIGATION\.height/);

console.log('[immersive-meet-mode-shell] sole navigation, contextual return, state retention, focused-task suppression, and floating-toolkit clearance passed');
