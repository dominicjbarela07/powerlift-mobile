import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
let actor = '1', downloads = 0, badChecksum = false, holdDownloads = false;
const releases = [], cancelled = [];
const actorListeners = [], files = new Map();
const expectedMd5 = '0123456789abcdef0123456789abcdef';
const exports = {};
const js = ts.transpileModule(fs.readFileSync('lib/videoArtifactCache.ts', 'utf8'),
  { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const mocks = {
  './execution-actor': { currentExecutionActor: () => actor, subscribeExecutionActor: fn => actorListeners.push(fn) },
  'expo-file-system/legacy': { cacheDirectory: 'file:/cache/', EncodingType: { Base64: 'base64' }, FileSystemSessionType: { BACKGROUND: 0 },
    makeDirectoryAsync: async () => {}, readDirectoryAsync: async prefix => [...files.keys()].filter(uri => uri.startsWith(prefix)).map(uri => uri.slice(prefix.length)),
    getInfoAsync: async uri => files.has(uri) ? { exists: true, size: 12, md5: badChecksum ? 'incorrect' : expectedMd5, modificationTime: 1 } : { exists: false },
    readAsStringAsync: async () => Buffer.from('0000ftypabcd').toString('base64'),
    deleteAsync: async uri => files.delete(uri),
    createDownloadResumable: (url, target, options, progress) => ({
      downloadAsync: async () => { downloads++; assert.equal(options.sessionType, 0); progress({ totalBytesWritten: 6, totalBytesExpectedToWrite: 12 });
        if (holdDownloads) await new Promise(resolve => releases.push(resolve));
        await new Promise(setImmediate); files.set(target, true); return { status: 200 }; }, cancelAsync: async () => { cancelled.push(target); },
    }),
  },
};
vm.runInNewContext(js, { exports, require: name => { assert.ok(name in mocks, name); return mocks[name]; }, Map, Set, Promise, Date, atob, console });
const input = { owner: '1', exportId: 8, unit: 'kg', url: 'https://signed.example/artifact', expectedBytes: 12, expectedMd5 };
const [first, second] = await Promise.all([exports.videoArtifactFile(input), exports.videoArtifactFile(input)]);
assert.equal(first, second);
assert.equal(downloads, 1, 'simultaneous Save/Share deduplicate a single native transfer');
await exports.videoArtifactFile(input);
assert.equal(downloads, 1, 'verified artifact is reused');
await assert.rejects(exports.videoArtifactFile({ ...input, owner: '2' }), /Sign in/);
actor = '2'; actorListeners.forEach(fn => fn());
const other = await exports.videoArtifactFile({ ...input, owner: '2' });
assert.notEqual(other, first, 'cache is scoped to canonical account ID');
badChecksum = true;
await assert.rejects(exports.videoArtifactFile({ ...input, owner: '2', exportId: 9 }), /verified/);
assert.ok(!files.has('file:/cache/video-exports/2/9/strength-ledger-video-kg.mp4'), 'unverified partial artifact is removed');
assert.ok(first.endsWith('/8/strength-ledger-video-kg.mp4'), 'system share sheet receives a useful filename with isolated cache identity');
badChecksum = false; holdDownloads = true;
const simultaneous = [10, 11].map(exportId => exports.videoArtifactFile({ ...input, owner: '2', exportId }));
while (releases.length < 2) await new Promise(setImmediate);
exports.cancelVideoArtifactTransfers('2');
assert.equal(new Set(cancelled).size, 2, 'cancel must reach every active artifact, including different exports');
actor = '3'; actorListeners.forEach(fn => fn());
releases.forEach(resolve => resolve());
const stopped = await Promise.allSettled(simultaneous);
assert.ok(stopped.every(result => result.status === 'rejected'), 'account switch cannot hand off either artifact');
console.log('PASS: native background download, progress, account isolation, deduplication, checksum/size verification, reuse and failed-artifact cleanup.');
