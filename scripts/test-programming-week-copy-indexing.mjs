import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  canonicalBlockRelativeWeeks,
  canonicalProgramWeekDestinations,
  canonicalProgrammingWeekKey,
} from '../lib/programming-week-identity.ts';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const manager = fs.readFileSync(path.join(root, 'app/(tabs)/workout/index.tsx'), 'utf8');

const maintenance = {
  id: 10,
  name: 'Maintenance',
  order_idx: 1,
  start_date: '2026-07-20',
  end_date: '2026-08-23',
  total_weeks: 5,
  weeks: Array.from({ length: 5 }, (_, offset) => ({
    block_id: 10,
    block_week_index: offset + 1,
    label: `Week ${offset + 1}`,
    week_start: ['2026-07-20', '2026-07-27', '2026-08-03', '2026-08-10', '2026-08-17'][offset],
    week_end: ['2026-07-26', '2026-08-02', '2026-08-09', '2026-08-16', '2026-08-23'][offset],
  })),
};
const surplus = {
  id: 20,
  name: 'Surplus',
  order_idx: 2,
  start_date: '2026-08-24',
  end_date: '2026-10-18',
  total_weeks: 8,
  weeks: Array.from({ length: 8 }, (_, offset) => {
    const starts = ['2026-08-24', '2026-08-31', '2026-09-07', '2026-09-14', '2026-09-21', '2026-09-28', '2026-10-05', '2026-10-12'];
    const ends = ['2026-08-30', '2026-09-06', '2026-09-13', '2026-09-20', '2026-09-27', '2026-10-04', '2026-10-11', '2026-10-18'];
    return {
      block_id: 20,
      block_week_index: offset + 1,
      label: `Week ${offset + 1}`,
      week_start: starts[offset],
      week_end: ends[offset],
    };
  }),
};

const maintenanceWeeks = canonicalBlockRelativeWeeks(maintenance);
const surplusWeeks = canonicalBlockRelativeWeeks(surplus);
assert.equal(maintenanceWeeks.at(-1)?.blockWeekIndex, 5);
assert.equal(surplusWeeks[0].blockWeekIndex, 1, 'A new Block must reset to Week 1');
assert.deepEqual(
  surplusWeeks.slice(0, 3).map((week) => [week.blockWeekIndex, week.weekStart, week.weekEnd]),
  [
    [1, '2026-08-24', '2026-08-30'],
    [2, '2026-08-31', '2026-09-06'],
    [3, '2026-09-07', '2026-09-13'],
  ],
);

const allWeeks = canonicalProgramWeekDestinations([surplus, maintenance]);
assert.equal(allWeeks.length, 13);
assert.deepEqual(
  allWeeks.map((week) => [week.blockName, week.blockWeekIndex]).slice(4, 7),
  [['Maintenance', 5], ['Surplus', 1], ['Surplus', 2]],
);
assert.notEqual(
  canonicalProgrammingWeekKey(maintenanceWeeks[0]),
  canonicalProgrammingWeekKey(surplusWeeks[0]),
  'Week 1 identities from different Blocks must never collide',
);

const legacyServerBlock = {
  id: 30,
  name: 'Legacy API Block',
  order_idx: 3,
  start_date: '2026-11-02',
  end_date: '2026-11-15',
  total_weeks: 2,
};
assert.deepEqual(
  canonicalBlockRelativeWeeks(legacyServerBlock).map((week) => [week.blockWeekIndex, week.weekStart, week.source]),
  [[1, '2026-11-02', 'legacy-block-dates'], [2, '2026-11-09', 'legacy-block-dates']],
  'The OTA fallback must remain block-relative against server-owned dates',
);

assert.match(manager, /weeks\?: ServerProgrammingBlockWeek\[\]/);
assert.match(manager, /canonicalBlockRelativeWeeks\(block\)/);
assert.match(manager, /programActionWeeks/);
assert.match(manager, /target_block_id = selectedWeek\.blockId/);
assert.match(manager, /source_block_id = selectedWeek\?\.blockId/);
assert.match(manager, /target_block_week_index = selectedWeek\.index/);
assert.match(manager, /source_block_week_index = selectedWeek\?\.index/);
assert.match(manager, /\{candidate\.blockName\} · Week \{candidate\.index\}/);
assert.match(manager, /\{candidate\.rangeLabel\}<\/Text>/);
assert.match(manager, /COPY INTO/);
assert.match(manager, /COPY FROM/);
assert.match(manager, /Select the populated week you want to copy/);
assert.match(manager, /Select the week you want to copy into/);

console.log('Programming Week copy indexing parity checks passed.');
