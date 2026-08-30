import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const route = fs.readFileSync(path.join(root, 'app/(tabs)/athlete-meet-plan.tsx'), 'utf8');
const experience = fs.readFileSync(path.join(root, 'components/meet-packet/AthleteMeetPacketV2.tsx'), 'utf8');
const sheet = fs.readFileSync(path.join(root, 'components/sheets/StrengthLedgerBottomSheet.tsx'), 'utf8');
const bagAsset = path.join(root, 'assets/images/meet-packet-v2/meet-bag-v1.png');

assert.match(route, /<AthleteMeetPacketV2/);
assert.match(route, /mobile\/athlete\/current\/start/);
assert.match(route, /mobile\/athlete\/current\/finish/);
assert.match(route, /mobile\/athlete\/warmups\/\$\{warmup\.id\}\/completion/);
assert.match(route, /mobile\/athlete\/current\/meet-bag/);

for (const lifecycle of ['PRE-MEET', 'MEET DAY · LIVE', 'COMPETITION RECORD']) {
  assert.ok(experience.includes(lifecycle), `${lifecycle} lifecycle must remain explicit`);
}
for (const destination of ['Overview', 'Warmups', 'Attempts', 'Bag', 'More']) {
  assert.ok(experience.includes(destination), `${destination} meet navigation must remain reachable`);
}
for (const focusedEditor of ['Meet Details', 'Attempts', 'Warmups', 'Platform Setup', 'Meet-Day Focus']) {
  assert.ok(experience.includes(focusedEditor), `${focusedEditor} must remain a focused meet tool`);
}

assert.match(experience, /resolvePlateStackRender/);
assert.match(experience, /formatWeightFromKg/);
assert.match(experience, /onUnitChange\(unit === 'lb' \? 'kg' : 'lb'\)/);
assert.match(experience, /Complete Warmup/);
assert.match(experience, /useMeetCountdown/);
assert.match(experience, /NEXT WARMUP \{countdown\.due \? 'DUE' : 'IN'\}/);
assert.match(route, /Good Lift/);
assert.match(route, /No Lift/);
assert.match(experience, /Start Meet Day/);
assert.match(experience, /Finish Meet/);
assert.match(experience, /checked_items/);
assert.doesNotMatch(experience, /disabled=!meet\.can_start_meet/);

assert.match(sheet, /PanResponder/);
assert.match(sheet, /DISMISS_DISTANCE/);
assert.match(sheet, /Drag to dismiss/);
assert.ok(fs.existsSync(bagAsset), 'generated meet bag asset must ship with the route');
const stat = fs.statSync(bagAsset);
assert.ok(stat.size > 100_000, 'meet bag must be a real raster render rather than a placeholder');

console.log('[athlete-meet-packet-v2] lifecycle, durable actions, focused sheets, unit control, and competition assets passed');
