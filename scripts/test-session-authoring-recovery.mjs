import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const storage = new Map();
let failChunk = false;
const secure = {
  WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'device-only',
  getItemAsync: async (key) => storage.get(key) ?? null,
  setItemAsync: async (key, value, options) => {
    assert.equal(options.keychainAccessible, 'device-only');
    if (failChunk && /\.1$/.test(key)) { failChunk = false; throw Error('simulated interrupted write'); }
    storage.set(key, value);
  },
  deleteItemAsync: async (key) => { storage.delete(key); },
};
function load(file, imports) {
  const module = { exports: {} };
  const js = ts.transpileModule(fs.readFileSync(new URL(file, import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(js, { exports: module.exports, module, require: (name) => { if (!(name in imports)) throw Error(name); return imports[name]; }, Date, Math, Map, Promise, JSON });
  return module.exports;
}
const command = load('../lib/session-authoring-command.ts', {});
const journal = load('../lib/session-authoring-journal.ts', { 'expo-secure-store': secure, './session-authoring-command': command });
const { readAuthoringJournal: read, writeAuthoringJournal: write, clearAuthoringJournal: clear, purgeAuthoringJournals: purge } = journal;
const identity = 'viewer-1:athlete-12:session-9';
await write(identity, 'generation-1', { draft: 'unauthorized' });
assert.equal(storage.size, 0, 'unverified subject cannot start recovery storage');
assert.equal(await read(identity, 'generation-1'), null);
await write(identity, 'generation-1', { draft: 'local work', movementId: -1, selectedId: -1, scrollY: 215 });
assert.equal((await read(identity, 'generation-1')).draft, 'local work');
assert.equal(await read('viewer-1:athlete-13:session-9', 'generation-1'), null, 'different subject cannot recover');
failChunk = true;
await assert.rejects(write(identity, 'generation-1', { draft: 'x'.repeat(1600) }));
assert.equal((await read(identity, 'generation-1')).draft, 'local work', 'interruption preserves previous generation');
assert.equal([...storage.keys()].filter((key) => /\.pending$/.test(key)).length, 0, 'interrupted chunks are cleaned');
assert.equal(await read(identity, 'generation-2'), null, 'changed relationship/capability generation rejects old recovery');
await write(identity, 'generation-2', { draft: 'new context' });
await clear(identity);
assert.equal(await read(identity, 'generation-2'), null);
await write(identity, 'generation-2', { draft: 'before logout' });
const queued = write(identity, 'generation-2', { draft: 'queued at logout' });
const logout = purge();
await Promise.all([queued, logout]);
await write(identity, 'generation-2', { draft: 'late unmount' });
assert.equal(storage.size, 0, 'logout purges and late cleanup cannot resurrect a draft');
const first = command.sessionAuthoringCommand(9, 'a'.repeat(64), { title: 'A', ids: [-1] });
assert.equal(first.command_key, command.sessionAuthoringCommand(9, 'a'.repeat(64), { title: 'A', ids: [-1] }).command_key, 'same recovered plan retries with the same key');
assert.notEqual(first.command_key, command.sessionAuthoringCommand(9, 'a'.repeat(64), { title: 'B', ids: [-1] }).command_key);
assert.notEqual(first.command_key, command.sessionAuthoringCommand(9, 'b'.repeat(64), { title: 'A', ids: [-1] }).command_key);
assert.throws(() => command.sessionAuthoringCommand(9, '', {}));
console.log('PASS: protected draft recovery, subject generations, interruption, logout, deterministic retry keys');
