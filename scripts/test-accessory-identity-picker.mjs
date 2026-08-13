import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const source = fs.readFileSync(path.join(here, '..', 'app', '(tabs)', 'workout', '[workoutId].tsx'), 'utf8');

assert.match(source, /const identityPickerRequestRef = useRef\(0\)/, 'picker requests must have a monotonic sequence');
assert.match(source, /requestId !== identityPickerRequestRef\.current/, 'stale picker responses must be ignored');
assert.match(source, /identityPickerQuery\.trim\(\) \? 220 : 0/, 'typed picker searches must be debounced');
assert.match(source, /Sets already logged keep their original equipment identity/, 'mid-session equipment changes must explain immutable prior sets');
assert.doesNotMatch(source, /`\$\{row\.comparison_policy\.confidence\} confidence`/, 'internal confidence tiers must not appear in athlete picker copy');
assert.match(
  source,
  /styles\.movementHistorySheet,[\s\S]*styles\.movementHistoryFullScreenSheet[\s\S]*paddingBottom: Math\.max\(insets\.bottom, 18\)/,
  'movement history must claim the viewport while respecting the device safe area',
);
assert.match(
  source,
  /movementHistoryFullScreenSheet:\s*\{[\s\S]*height: '94%'[\s\S]*maxHeight: '94%'/,
  'movement history must render as a near-full-screen workspace',
);
assert.match(
  source,
  /showsVerticalScrollIndicator=\{false\}[\s\S]*styles\.movementHistoryList,[\s\S]*styles\.movementHistoryExpandedList/,
  'history should use the remaining screen height before becoming scrollable',
);
assert.match(
  source,
  /accessibilityLabel="Close movement history"[\s\S]*setMovementHistoryItem\(null\)[\s\S]*name="close"/,
  'the full-screen history workspace must keep dismissal in its header',
);
assert.match(
  source,
  /styles\.movementHistorySheet,[\s\S]*styles\.equipmentPickerSheet[\s\S]*Choose Manufacturer[\s\S]*Which manufacturer(?:&apos;|')s machine are you using\?/,
  'live and Ideal State must share the dedicated tall equipment picker',
);
assert.match(
  source,
  /equipment-manufacturers[\s\S]*manufacturer_key:[\s\S]*equipment_type: equipmentVariant/,
  'live selection must use the manufacturer plus type production contract',
);
assert.match(
  source,
  /equipmentPickerSheet:\s*\{[\s\S]*height: '90%'[\s\S]*maxHeight: '90%'/,
  'the equipment picker must claim enough vertical space to expose its choices',
);
assert.match(
  source,
  /styles\.movementHistoryList, styles\.equipmentPickerList[\s\S]*equipmentPickerList:\s*\{[\s\S]*flex: 1[\s\S]*maxHeight: '100%'/,
  'the equipment results must expand into the available sheet height',
);
assert.match(
  source,
  /equipmentPickerHeaderAction:\s*\{[\s\S]*height: 40[\s\S]*width: 40/,
  'the equipment picker must use compact header dismissal instead of oversized footer actions',
);
assert.doesNotMatch(
  source,
  /equipmentPickerFooterButton|Clear current equipment/,
  'the simplified DEV picker must not reserve the sheet for large footer actions',
);
assert.match(
  source,
  /Which version are you using\?[\s\S]*MACHINE_EQUIPMENT_TYPES\.map/,
  'the second step must remain a lightweight variant list',
);
assert.match(
  source,
  /rememberedStatus === 'used_before'[\s\S]*'USED BEFORE'/,
  'server manufacturer usage status must drive the compact picker badge',
);
assert.doesNotMatch(
  source,
  /Which equipment are you using\?|No matching equipment identity|Clear equipment choice/,
  'the obsolete exact-identity picker branch must not remain in the production logger',
);
assert.match(
  source,
  /legacy_unresolved_history[\s\S]*Unknown equipment/,
  'legacy accessory sets must remain visible under an explicit unknown-equipment scope',
);
assert.match(
  source,
  /Legacy sets recorded before equipment tracking\. Reference only; loads may not be comparable to this machine\./,
  'legacy machine history must disclose that its loads are not exact-machine comparisons',
);
assert.match(
  source,
  /legacyRecent\.map[\s\S]*MovementHistoryExactCard/,
  'legacy unknown-equipment history must render its recorded sets',
);

console.log('Accessory identity picker checks passed.');
