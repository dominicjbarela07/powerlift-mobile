import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { canonicalBlockRelativeWeeks, canonicalProgramWeekDestinations, canonicalProgrammingWeekKey } from '../lib/programming-week-identity.ts';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const manager = fs.readFileSync(path.join(root, 'app/(tabs)/workout/index.tsx'), 'utf8');
const maintenance = { id: 10, name: 'Maintenance', order_idx: 1, start_date: '2026-07-20', end_date: '2026-08-23', total_weeks: 5 };
const surplus = {
  id: 20, name: 'Surplus', order_idx: 2, start_date: '2026-08-24', end_date: '2026-10-18', total_weeks: 8,
  weeks: Array.from({ length: 8 }, (_, offset) => ({
    block_id: 20, block_week_index: offset + 1, label: `Week ${offset + 1}`,
    week_start: ['2026-08-24', '2026-08-31', '2026-09-07', '2026-09-14', '2026-09-21', '2026-09-28', '2026-10-05', '2026-10-12'][offset],
    week_end: ['2026-08-30', '2026-09-06', '2026-09-13', '2026-09-20', '2026-09-27', '2026-10-04', '2026-10-11', '2026-10-18'][offset],
  })),
};
const maintenanceWeeks = canonicalBlockRelativeWeeks(maintenance);
const surplusWeeks = canonicalBlockRelativeWeeks(surplus);
assert.equal(maintenanceWeeks.at(-1)?.blockWeekIndex, 5);
assert.deepEqual(surplusWeeks.slice(0, 3).map((week) => [week.blockWeekIndex, week.weekStart, week.weekEnd]), [[1, '2026-08-24', '2026-08-30'], [2, '2026-08-31', '2026-09-06'], [3, '2026-09-07', '2026-09-13']]);
assert.equal(canonicalProgramWeekDestinations([surplus, maintenance]).length, 13);
assert.notEqual(canonicalProgrammingWeekKey(maintenanceWeeks[0]), canonicalProgrammingWeekKey(surplusWeeks[0]));
assert.deepEqual(canonicalBlockRelativeWeeks({ id: 30, start_date: '2026-11-02', end_date: '2026-11-15', total_weeks: 2 }).map((week) => [week.blockWeekIndex, week.weekStart, week.source]), [[1, '2026-11-02', 'legacy-block-dates'], [2, '2026-11-09', 'legacy-block-dates']]);
assert.match(manager, /weeks\?: ServerProgrammingBlockWeek\[\]/);
assert.match(manager, /canonicalBlockRelativeWeeks\(block\)/);
assert.match(manager, /programActionWeeks/);
assert.match(manager, /target_block_id = selectedWeek\.blockId/);
assert.match(manager, /source_block_id = selectedWeek\?\.blockId/);
assert.match(manager, />\{candidate\.blockName\}<\/Text>/);
console.log('Programming Week copy indexing parity checks passed.');
