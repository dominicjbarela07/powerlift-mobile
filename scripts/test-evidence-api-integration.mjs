import assert from 'node:assert/strict';
import ts from 'typescript';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const compile = (path) => ts.transpileModule(readFileSync(new URL(path, import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
}).outputText;
const evaluate = (path, globals = {}) => {
  const exports = {};
  vm.runInNewContext(compile(path), { exports, Date, Map, Set, Promise, console, ...globals });
  return exports;
};
const cache = evaluate('../lib/evidence-read-cache.ts');
const exposure = evaluate('../lib/session-exposure-cache.ts', { require: name => {
  assert.equal(name, './evidence-read-cache'); return cache;
} });
const policy = evaluate('../lib/api-request-policy.ts');
let account = 'account-a'; let mode = 'coach'; let calls = [];
let implementation = async () => new Response(JSON.stringify({ ok: true, weight_kg: 100 }), { status: 200 });
const modules = {
  './evidence-read-cache': cache,
  './session-exposure-cache': exposure,
  'expo-secure-store': { getItemAsync: async (key) => key === 'auth_token' ? account : null },
  '@react-native-async-storage/async-storage': { getItem: async () => mode },
  'expo-constants': { expoConfig: {} },
  'react-native': { Platform: { OS: 'ios' } },
  '@/lib/api-base': { API_BASE: 'http://localhost:5000' },
  '@/lib/release-preview-stubs': { resolveProductionIdealRequest: () => null },
  '@/lib/profile-photo': { normalizeProfilePhotoPayload: (value) => value },
  '@/lib/api-request-policy': policy,
};
const api = evaluate('../lib/api.ts', {
  require: (name) => { assert.ok(name in modules, `Unmocked dependency ${name}`); return modules[name]; },
  __DEV__: false, URL, Intl, AbortController, setTimeout, clearTimeout,
  fetch: async (url, options) => { calls.push({ url, method: options.method }); return implementation(url, options); },
});
const path = '/athletes/mobile/progression?athlete_id=4&range=90d';
await Promise.all([api.fetchJson(path), api.fetchJson(path)]);
assert.equal(calls.length, 1, 'Concurrent hooks share one authenticated request.');
await api.fetchJson(path); assert.equal(calls.length, 1);
await api.fetchJson(path, { evidenceSubject: 'relationship-generation-2' }); assert.equal(calls.length, 2);
mode = 'athlete'; await api.fetchJson(path); assert.equal(calls.length, 3);
account = 'account-b'; await api.fetchJson(path); assert.equal(calls.length, 4);
for (const mutation of [
  '/workouts/mobile/1/complete', '/workouts/mobile/1/items/2/sets/3', '/mobile/ledger/pr-repair',
  '/athletes/mobile/readiness', '/athletes/mobile/check-ins', '/mobile/programming/blocks/1', '/mobile/auth/profile',
]) {
  const before = calls.length;
  await api.fetchJson(mutation, { method: 'POST', body: JSON.stringify({ test: true }) });
  await api.fetchJson(path);
  assert.equal(calls.length, before + 2, `${mutation} invalidates the summary.`);
}
let blocked = 0; api.subscribeAccountStateBlocks(() => blocked++);
cache.invalidateEvidenceReads();
implementation = async () => new Response(JSON.stringify({ ok: false, can_access_product: false }), { status: 403 });
const beforeDenial = calls.length;
await api.fetchJson(path); await api.fetchJson(path);
assert.equal(calls.length, beforeDenial + 2); assert.equal(blocked, 2, 'Access blocks still reach the account state machine.');
cache.invalidateEvidenceReads();
let finish;
implementation = () => new Promise((resolve) => { finish = resolve; });
const controller = new AbortController();
const cancelled = api.fetchJson(path, { signal: controller.signal }).catch((error) => error);
const survivor = api.fetchJson(path);
while (!finish) await new Promise((resolve) => setTimeout(resolve, 0));
controller.abort(); finish(new Response(JSON.stringify({ ok: true }), { status: 200 }));
assert.equal((await cancelled).name, 'AbortError');
assert.equal((await survivor).ok, true, 'One caller leaving cannot cancel another caller’s read.');
console.log('PASS: real API dedupe, workspace/account scope, mutation invalidation, authorization notifications, and independent cancellation');
