import assert from 'node:assert/strict';
import fs from 'node:fs';
import { filterRetiredMovementLibraryResponse as filter, isSelectableLibraryMovement as selectable } from '../lib/retired-movement-discovery.ts';

const read = file => JSON.parse(fs.readFileSync(file));
const retired = read('config/governed-movement-retirements.json').retired_keys;
const catalog = read('config/governed-movement-art-taxonomy.json').movements;
const path = '/workouts/mobile/movement-definitions/search';
const active = { id: 9001, key: 'accessory_cable_curl', ownership_scope: 'global', identity_status: 'canonical' };
const gone = { id: 9999, key: 'accessory_cross_bench_cable_pulldown', ownership_scope: 'global', identity_status: 'canonical' };
const custom = { ...gone, id: 9002, ownership_scope: 'athlete', library_scope: 'my_movement' };
const serverRetired = { ...active, id: 9003, key: 'future_server_retirement', identity_status: 'retired' };
for (const key of retired) {
  assert.equal(selectable({ ...gone, key }), false, `old backend must not revive ${key}`);
  assert.equal(selectable({ ...custom, key }), true, 'private custom identities are distinct');
}
assert.equal(selectable(serverRetired), false);
assert.equal(selectable({ ...active, retired_at: '2026-09-24T00:00:00Z' }), false);
assert.equal(selectable({ ...active, display_name: 'Cross-Bench Cable Pulldown' }), true, 'labels cannot establish retirement');
const payload = { ok: true, items: [gone, active, custom, serverRetired], next_cursor: '49',
  result_groups: { selected_muscle_group: 'lats',
    primary: { items: [gone, active], total_count: 2, next_cursor: null },
    secondary: { items: [custom, serverRetired], total_count: 56, next_cursor: '49' } } };
const original = structuredClone(payload);
for (const query of ['', '?q=pulldown', '?favorites_only=1', '?recent_only=1', '?include_secondary=1', '?cursor=49']) {
  const result = filter(path + query, payload);
  assert.deepEqual(result.items, [active, custom]);
  assert.deepEqual(result.result_groups.primary.items, [active]);
  assert.deepEqual(result.result_groups.secondary.items, [custom]);
  assert.equal(result.result_groups.primary.total_count, 1);
  assert.equal(result.next_cursor, '49');
  assert.equal(result.result_groups.secondary.next_cursor, '49');
}
assert.deepEqual(payload, original, 'do not mutate cached responses');
const retiredCustom = { ...custom, identity_status: 'retired' };
assert.deepEqual(filter(path, { items: [retiredCustom] }).items, []);
assert.deepEqual(filter(path + '?include_retired=1&custom_only=1', { items: [retiredCustom, gone] }).items, [retiredCustom], 'keep explicit custom restoration available');
const presets = { accessories: { definitions: [active, gone] }, core_variants: { categories: ['unchanged'] } };
assert.deepEqual(filter('/workouts/mobile/movement_presets', presets).accessories.definitions, [active]);
for (const route of ['/workouts/mobile/1507', '/workouts/mobile/movement-definitions/9999/history', '/workouts/mobile/movement-definitions/9999', '/workouts/mobile/1507/items/25/swap']) {
  assert.equal(filter(route, payload), payload, 'saved identities and historical evidence must survive');
}
assert.match(fs.readFileSync('lib/api.ts', 'utf8'), /if \(res.ok && method === 'GET'\) json = filterRetiredMovementLibraryResponse\(path, json\)/);
const remaining = catalog.filter(selectable);
assert.equal(remaining.length, 498, 'DEV and release must expose the same 498 active built-in definitions');
console.log(JSON.stringify({ retired_keys_blocked: retired.length, selectable_catalog: remaining.length, removed_from_catalog_projection: catalog.length - remaining.length, history_and_custom_preserved: true }));
