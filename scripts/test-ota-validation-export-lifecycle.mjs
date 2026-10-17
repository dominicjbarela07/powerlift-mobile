import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import { assertSharedValidation } from './shared-ota-validation.mjs';

const source = fs.readFileSync('scripts/publish-validated-ios-ota.mjs', 'utf8');
const start = source.indexOf("run('npx', [\n  'expo',\n  'export',");
const end = source.indexOf('const exportSource=', start);
assert.ok(start > 0 && end > start);
const block = source.slice(start, end);
const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ota-receipt-lifecycle-'));
const inputs = { sourceSha:'candidate', productFingerprint:'product', checksFingerprint:'checks', backendFingerprint:'backend' };
const sharedReceipt = { schemaVersion:1, pass:true, inputs, checks:['accepted-contracts','critical-invariants','typescript'], completedAt:new Date().toISOString() };
const file = path.join(outputDir, 'release-shared-validation.json');
const runBlock = (code, nextInputs = inputs) => vm.runInNewContext(code, {
  fs, path, root:'fixture', outputDir, sharedReceipt, process:{env:{}},
  contractSnapshot:null, canonicalBackendRoot:'fixture', contractBackendRoot:'fixture',
  sharedValidationInputs:() => nextInputs, assertSharedValidation,
  run:(_command,args) => {
    assert.ok(args.includes('export') && args.includes('--clear'));
    fs.rmSync(outputDir,{recursive:true,force:true}); fs.mkdirSync(outputDir);
  },
});
try {
  fs.writeFileSync(file,JSON.stringify(sharedReceipt));
  runBlock(block);
  assertSharedValidation(JSON.parse(fs.readFileSync(file)),inputs);
  assert.throws(() => runBlock(block,{...inputs,backendFingerprint:'changed'}));
  assert.equal(fs.existsSync(file),false,'Changed validation inputs cannot recreate a passing receipt');
  const beforeFix = block.slice(0,block.indexOf('assertSharedValidation(sharedReceipt'));
  fs.writeFileSync(file,JSON.stringify(sharedReceipt));
  runBlock(beforeFix);
  assert.throws(() => fs.readFileSync(file),/ENOENT/,'Deliberately reproduce the exporter deleting pre-export proof');
  console.log('PASS: actual publisher export block preserves passing validation after Expo clears output, rejects changed inputs, and reproduces lost pre-export proof.');
} finally { fs.rmSync(outputDir,{recursive:true,force:true}); }
