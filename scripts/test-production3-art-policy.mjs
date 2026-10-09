import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { createRequire } from 'node:module';
import { approvedArtRuntimeEnabled } from '../lib/approved-art-runtime.ts';
import { artBundlePolicyFiles, legacyArtBundleCondition, production3ArtBundleCondition, assertArtBundlePolicyProgression } from './approved-art-bundle-policy.mjs';

assert.equal(approvedArtRuntimeEnabled(false, 'production', '2.0.2'), false);
assert.equal(approvedArtRuntimeEnabled(false, 'production3', '2.0.2'), false);
assert.equal(approvedArtRuntimeEnabled(false, 'production3', undefined), false);
assert.equal(approvedArtRuntimeEnabled(false, 'production3', '3.0.0'), true);
assert.equal(approvedArtRuntimeEnabled(false, 'testflight', '2.1.0'), true);
const source = fs.readFileSync('app.config.js', 'utf8');
const original = JSON.parse(fs.readFileSync('app.json', 'utf8'));
const actualRequire = createRequire(import.meta.url);
function config(env) {
  const module = { exports: {} };
  vm.runInNewContext(source, { module, require: name => {
    if (name === './app.json') return structuredClone(original);
    assert.equal(name, './scripts/native-build-upload-policy.cjs');
    return actualRequire('./native-build-upload-policy.cjs');
  }, __dirname: process.cwd(), process: { env } });
  return module.exports.expo;
}
const env = {
  STRENGTH_LEDGER_RELEASE_TARGET: 'production3',
  EXPO_PUBLIC_APPROVED_ART_CHANNEL: 'production3',
  EXPO_PUBLIC_ART_RUNTIME_VERSION: '3.0.0',
};
const normalEnv = original.expo.extra?.releaseTrack === 'testflight' ? { EXPO_PUBLIC_APPROVED_ART_CHANNEL: 'testflight' } : {};
assert.equal(config(normalEnv).version, original.expo.version, 'normal DEV/TestFlight config remains unchanged');
if (original.expo.extra?.releaseTrack === 'testflight') assert.throws(() => config({}), /TESTFLIGHT RELEASE BLOCKED/, 'missing TestFlight inclusion switch still fails closed');
const next = config(env);
assert.equal(next.version, '3.0.0'); assert.equal(next.runtimeVersion, '3.0.0');
assert.equal(next.extra.publicationAuthorized, false);
for (const key of Object.keys(env)) {
  const missing = { ...env }; delete missing[key];
  assert.throws(() => config(missing), /BLOCKED/, `missing ${key} must reject the export`);
}
assert.throws(() => config({ EXPO_PUBLIC_APPROVED_ART_CHANNEL: 'production3' }), /legacy runtime/);
const baseline = JSON.parse(fs.readFileSync('config/production-mobile-baseline.json', 'utf8'));
assert.equal(baseline.runtimeVersion, '2.0.2');
assert.equal(baseline.nativeBuildAuthorization, 'NOT_GRANTED');
assert.equal(baseline.storeSubmissionAuthorization, 'NOT_GRANTED');
const code = ts.transpileModule(fs.readFileSync('lib/approved-art-runtime.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
const exports = {}; vm.runInNewContext(code, { exports, __DEV__: false, process: { env } });
assert.equal(exports.approvedArtRuntimeEnabled(), true, 'the actual bundled default resolver enables the 3.0 inventory');
function bundledRequires(source, channel, version) {
  const requested = [], exports = {};
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  vm.runInNewContext(code, { exports, __DEV__: false, process: { env: { EXPO_PUBLIC_APPROVED_ART_CHANNEL: channel, EXPO_PUBLIC_ART_RUNTIME_VERSION: version } }, require: name => {
    if (name.endsWith('.png')) { requested.push(name); return name; }
    // No resolver is invoked here: exercise the actual top-level bundle requires.
    return {};
  }});
  return requested;
}
for (const file of artBundlePolicyFiles) {
  const current = fs.readFileSync(file, 'utf8');
  const original = current.replaceAll(production3ArtBundleCondition, legacyArtBundleCondition);
  assertArtBundlePolicyProgression(file, original, current);
  const required = bundledRequires(current, 'testflight', '2.1.0');
  assert.deepEqual(bundledRequires(current, 'production3', '3.0.0'), required, `${file}: every approved TestFlight require survives the new runtime`);
  assert.deepEqual(bundledRequires(current, 'production3', '2.0.2'), bundledRequires(original, 'production', '2.0.2'));
  assert.throws(() => assert.deepEqual(bundledRequires(original, 'production3', '3.0.0'), required), /AssertionError/, 'deliberately omitted bundle switch must fail');
  assert.throws(() => assertArtBundlePolicyProgression(file, original, current.replace(/require\(([^)]+)\)/, 'require("unapproved.png")')), /approved references/, 'switch extension cannot substitute imagery');
}
console.log('Production 3.0 art policy PASS; absent switches/version fail closed; legacy 2.0.2 and shipment authorization unchanged.');
