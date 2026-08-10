import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { scopeProgrammingPayload } from '../lib/programming-program-scope.ts';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const programmingHubSource = fs.readFileSync(path.join(root, 'app/(tabs)/workout/index.tsx'), 'utf8');
assert.match(programmingHubSource, /scopeProgrammingPayload<ProgramBlockPayload, HubSession/);
assert.match(programmingHubSource, /setProgramBlocks\(scoped\.blocks\)/);
assert.match(programmingHubSource, /current_block: scoped\.currentBlock/);
assert.doesNotMatch(programmingHubSource, /blocksWithProgramIdentity\.length[\s\S]*\?[^:]+:[^;]+blocks/);

const block = (id, programId) => ({ id, training_program_id: programId, name: `Block ${id}` });
const session = (id, blockId) => ({ id, training_block_id: blockId });

const singleProgram = scopeProgrammingPayload({
  activeProgramId: 10,
  blocks: [block(1, 10), block(2, 10), block(3, 10), block(4, 10)],
  pendingMap: {
    1: [session(101, 1)],
    2: [session(102, 2)],
    3: [session(103, 3)],
    4: [session(104, 4)],
  },
  completedMap: {},
  currentBlock: { id: 2 },
});
assert.deepEqual(singleProgram.blocks.map((row) => row.id), [1, 2, 3, 4]);
assert.equal(singleProgram.currentBlock?.id, 2);

const mixedResponse = {
  blocks: [block(1, 10), block(2, 10), block(11, 20), block(12, 20), block(99, null)],
  pendingMap: {
    1: [session(101, 1), session(999, 11)],
    2: [session(102, 2)],
    11: [session(201, 11)],
    12: [session(202, 12)],
    99: [session(909, 99)],
  },
  completedMap: {
    1: [session(111, 1)],
    11: [session(211, 11)],
  },
};

const programA = scopeProgrammingPayload({
  activeProgramId: 10,
  ...mixedResponse,
  currentBlock: { id: 1 },
});
assert.deepEqual(programA.blocks.map((row) => row.id), [1, 2]);
assert.deepEqual(Object.keys(programA.pendingMap), ['1', '2']);
assert.deepEqual(programA.pendingMap['1'].map((row) => row.id), [101]);
assert.deepEqual(Object.keys(programA.completedMap), ['1', '2']);

const programB = scopeProgrammingPayload({
  activeProgramId: 20,
  ...mixedResponse,
  currentBlock: { id: 11 },
});
assert.deepEqual(programB.blocks.map((row) => row.id), [11, 12]);
assert.deepEqual(Object.keys(programB.pendingMap), ['11', '12']);
assert.equal(programB.pendingMap['1'], undefined);

const switchedBack = scopeProgrammingPayload({
  activeProgramId: 10,
  ...mixedResponse,
  currentBlock: { id: 1 },
});
assert.deepEqual(switchedBack.blocks.map((row) => row.id), [1, 2]);
assert.equal(switchedBack.pendingMap['11'], undefined);

const athleteB = scopeProgrammingPayload({
  activeProgramId: 30,
  blocks: [block(31, 30)],
  pendingMap: { 31: [session(301, 31)] },
  completedMap: {},
  currentBlock: { id: 31 },
});
assert.deepEqual(athleteB.blocks.map((row) => row.id), [31]);
assert.equal(athleteB.pendingMap['1'], undefined);

const emptyProgram = scopeProgrammingPayload({
  activeProgramId: 40,
  blocks: [block(1, 10), block(11, 20)],
  pendingMap: mixedResponse.pendingMap,
  completedMap: mixedResponse.completedMap,
  currentBlock: { id: 1 },
});
assert.deepEqual(emptyProgram.blocks, []);
assert.deepEqual(emptyProgram.pendingMap, {});
assert.deepEqual(emptyProgram.completedMap, {});
assert.equal(emptyProgram.currentBlock, null);

const mismatchedCurrentBlock = scopeProgrammingPayload({
  activeProgramId: 10,
  ...mixedResponse,
  currentBlock: { id: 11 },
});
assert.equal(mismatchedCurrentBlock.currentBlock, null);

const noActiveProgram = scopeProgrammingPayload({
  activeProgramId: null,
  ...mixedResponse,
  currentBlock: { id: 1 },
});
assert.deepEqual(noActiveProgram.blocks, []);
assert.deepEqual(noActiveProgram.pendingMap, {});
assert.equal(noActiveProgram.currentBlock, null);

console.log('Programming Hub program scoping regression checks passed.');
