import assert from 'node:assert/strict';
import { fetchRecentSessionSetHistory } from '../lib/recent-session-set-history.ts';

const exposure = (sessionId, equipmentId, setCount, date) => ({
  id: `${sessionId}:${equipmentId}`,
  workout_id: sessionId,
  date,
  session_title: `Session ${sessionId}`,
  set_count: setCount,
  equipment: equipmentId ? { id: equipmentId, label: `Equipment ${equipmentId}` } : null,
});
const evidence = [
  exposure(50, 10, 1, '2026-09-29'), // Current active Session: never "last time".
  exposure(49, 20, 2, '2026-09-22'),
  exposure(49, 10, 3, '2026-09-22'),
  exposure(48, 10, 4, '2026-09-15'),
];
const details = new Map(evidence.map((row) => [row.id, {
  ...row,
  session: { id: row.workout_id, label: row.session_title, date: row.date },
  sets: Array.from({ length: row.set_count }, (_, index) => ({
    id: row.workout_id * 100 + row.equipment?.id * 10 + index,
    set_index: index + 1,
    weight_kg: 40 + index,
    reps: 20 - index,
    rir: index === 0 ? 1 : 0,
  })),
}]));
const queried = [];
const readHistory = async (query) => {
  queried.push(query);
  const scoped = query.equipmentDefinitionId
    ? evidence.filter((row) => row.equipment?.id === query.equipmentDefinitionId)
    : evidence;
  const offset = query.cursor ? Number(query.cursor.split(':')[1]) : 0;
  const page = scoped.slice(offset, offset + 2);
  return { exposures: page, has_more: offset + 2 < scoped.length, next_cursor: `offset:${offset + 2}` };
};
const readExposure = async (query, id) => {
  assert.equal(query.range, 'all');
  assert.equal(query.rirMax, undefined);
  return details.get(id);
};

const base = {
  athleteId: 7,
  movementDefinitionId: 101,
  currentSessionId: 50,
  fetchHistory: readHistory,
  fetchExposure: readExposure,
};
const all = await fetchRecentSessionSetHistory(base);
assert.equal(all.sessionId, 49);
assert.deepEqual(all.exposures.map((row) => row.id), ['49:20', '49:10']);
assert.equal(all.exposures.reduce((sum, row) => sum + row.sets.length, 0), 5);
assert.equal(all.exposures[1].sets[2].reps, 18);
assert.ok(queried.every((query) => query.movementDefinitionId === 101 && query.coreMovementId === undefined));
assert.ok(queried.every((query) => query.athleteId === 7));

const known = await fetchRecentSessionSetHistory({ ...base, equipmentDefinitionId: 10 });
assert.deepEqual(known.exposures.map((row) => row.id), ['49:10']);
assert.equal(known.exposures[0].sets.length, 3);

const otherManufacturer = await fetchRecentSessionSetHistory({ ...base, equipmentDefinitionId: 20 });
assert.deepEqual(otherManufacturer.exposures.map((row) => row.id), ['49:20']);

const noneForEquipment = await fetchRecentSessionSetHistory({ ...base, equipmentDefinitionId: 30 });
assert.equal(noneForEquipment, null, 'unknown scope does not fall back to a different machine');

const unknown = exposure(47, 0, 3, '2026-09-08');
const unknownResult = await fetchRecentSessionSetHistory({
  ...base,
  equipmentDefinitionId: 0,
  fetchHistory: async (query) => {
    assert.equal(query.equipmentDefinitionId, 0, 'Unknown remains an explicit historical scope');
    return { exposures: [unknown], has_more: false };
  },
  fetchExposure: async (_query, id) => ({ ...unknown, session: { id: 47 }, sets: [1, 2, 3].map((id) => ({ id, set_index: id })) }),
});
assert.equal(unknownResult.exposures[0].equipment, null);
assert.equal(unknownResult.exposures[0].sets.length, 3);

const similarNewer = exposure(51, 10, 1, '2026-09-30');
const exact = await fetchRecentSessionSetHistory({
  ...base,
  fetchHistory: async (query) => {
    assert.equal(query.movementDefinitionId, 101);
    return { exposures: [evidence[1]], has_more: false };
  },
  fetchExposure: readExposure,
});
assert.equal(exact.sessionId, 49);
assert.notEqual(exact.sessionId, similarNewer.workout_id);

await assert.rejects(fetchRecentSessionSetHistory({
  ...base,
  fetchHistory: async () => ({ exposures: [evidence[1]], has_more: false }),
  fetchExposure: async () => ({ ...details.get('49:20'), workout_id: 48 }),
}), /canonical Session/);

console.log('Recent Session full Set history: seeded cases passed.');
