import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { BASE_RULES, UPLOAD_ONLY_RULES, MAX_SOURCE_BYTES, MAX_UPLOAD_BYTES,
  assertUploadRules, assertUploadBudget, assertNativeBuildUploadPolicy,
  assertNativeBuildArchive } = require('./native-build-upload-policy.cjs');
const base = BASE_RULES.join('\n');
const valid = [...BASE_RULES, ...UPLOAD_ONLY_RULES].join('\n');
assert.doesNotThrow(() => assertUploadRules(valid, base));
assert.throws(() => assertUploadRules(base, base), /upload exclusions changed/);
assert.throws(() => assertUploadRules(valid.replace('/.git\n', ''), base), /upload exclusions changed/);
for (const unsafe of ['/assets/', '/assets/images/movement-artwork/', '/lib/', '/artwork-review/']) {
  assert.throws(() => assertUploadRules(`${valid}\n${unsafe}`, base), /upload exclusions changed/);
}
assert.throws(() => assertUploadBudget(8_747_596_603, MAX_UPLOAD_BYTES), /safe/);
assert.throws(() => assertUploadBudget(MAX_SOURCE_BYTES), /safe/);
assert.doesNotThrow(() => assertUploadBudget(1_500_000_000));

// Exercise the real archive checker against a portable native-input fixture,
// then deliberately remove/change images from the actual staged directory.
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'strength-ledger-upload-policy-'));
try {
  const source = path.join(temp, 'source');
  const archive = path.join(temp, 'archive');
  fs.mkdirSync(source);
  for (const dir of ['assets', 'app', 'components', 'constants', 'hooks', 'lib', 'config', 'scripts', 'dev-mocks', 'context', 'artwork-review']) {
    fs.mkdirSync(path.join(source, dir));
  }
  for (const file of ['package.json', 'package-lock.json', 'app.json', 'app.config.js', 'eas.json', 'tsconfig.json', 'theme.ts', 'eslint.config.js', 'artwork-review/runtime-policy.json', 'artwork-review/review-state.json']) {
    fs.writeFileSync(path.join(source, file), '{}');
  }
  fs.writeFileSync(path.join(source, '.gitignore'), base);
  fs.writeFileSync(path.join(source, '.easignore'), valid);
  fs.copyFileSync('app.config.js', path.join(source, 'app.config.js'));
  fs.copyFileSync('app.json', path.join(source, 'app.json'));
  fs.copyFileSync('scripts/native-build-upload-policy.cjs', path.join(source, 'scripts', 'native-build-upload-policy.cjs'));
  const keys = ['STRENGTH_LEDGER_RELEASE_TARGET', 'EXPO_PUBLIC_APPROVED_ART_CHANNEL', 'EXPO_PUBLIC_ART_RUNTIME_VERSION'];
  const prior = Object.fromEntries(keys.map(key => [key, process.env[key]]));
  const readActualConfig = () => {
    const filename = path.join(source, 'app.config.js');
    delete require.cache[require.resolve(filename)];
    delete require.cache[require.resolve(path.join(source, 'app.json'))];
    return require(filename).expo;
  };
  try {
    process.env.STRENGTH_LEDGER_RELEASE_TARGET = 'production3';
    process.env.EXPO_PUBLIC_APPROVED_ART_CHANNEL = 'production3';
    process.env.EXPO_PUBLIC_ART_RUNTIME_VERSION = '3.0.0';
    assert.equal(readActualConfig().version, '3.0.0');
    fs.writeFileSync(path.join(source, '.easignore'), `${valid}\n/assets/`);
    assert.throws(readActualConfig, /NATIVE UPLOAD BLOCKED/, 'the actual direct EAS config must reject imagery exclusions');
    fs.unlinkSync(path.join(source, '.easignore'));
    assert.throws(readActualConfig, /NATIVE UPLOAD BLOCKED/, 'the actual direct EAS config must reject missing upload exclusions');
    fs.writeFileSync(path.join(source, '.easignore'), valid);
  } finally {
    for (const key of keys) {
      if (prior[key] === undefined) delete process.env[key];
      else process.env[key] = prior[key];
    }
  }
  fs.writeFileSync(path.join(source, 'assets', 'approved.png'), Buffer.from([137,80,78,71,1,2,3]));
  fs.cpSync(source, archive, { recursive: true });
  fs.mkdirSync(path.join(archive, '.expo'));
  assert.equal(assertNativeBuildArchive(source, archive, 1000).missingOrChangedRequiredFiles, 0);
  fs.writeFileSync(path.join(archive, '.expo', 'unexpected-cache'), 'payload');
  assert.throws(() => assertNativeBuildArchive(source, archive, 1000), /excluded .expo/);
  fs.unlinkSync(path.join(archive, '.expo', 'unexpected-cache'));
  fs.writeFileSync(path.join(archive, 'assets', 'approved.png'), 'changed');
  assert.throws(() => assertNativeBuildArchive(source, archive, 1000), /changed assets\/approved.png/);
  fs.unlinkSync(path.join(archive, 'assets', 'approved.png'));
  assert.throws(() => assertNativeBuildArchive(source, archive, 1000), /missing assets\/approved.png/);
  fs.mkdirSync(path.join(archive, '.git'));
  assert.throws(() => assertNativeBuildArchive(source, archive, 1000), /excluded .git/);
  fs.unlinkSync(path.join(source, '.easignore'));
  assert.throws(() => assertNativeBuildUploadPolicy(source), /.easignore is missing/);
} finally {
  fs.rmSync(temp, { recursive: true, force: true });
}
assert.equal(assertNativeBuildUploadPolicy(process.cwd()).result, 'PASS');
const appConfig = fs.readFileSync('app.config.js', 'utf8');
assert.match(appConfig, /assertNativeBuildUploadPolicy\(__dirname\)/);
console.log('Native upload policy PASS: oversize, missing exclusions, unsafe asset/source exclusions, changed/missing staged assets and retained Git history all fail.');
