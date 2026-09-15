import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';
import { assertArtworkExportBytes } from './assert-no-dev-artwork-export.mjs';

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'approved-art-export-test-'));
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
const assets = {app:'approved app bytes',thumbnail:'approved thumbnail bytes',pending:'pending bytes',rejected:'rejected bytes',master:'master bytes'};
const knownHashes = new Set(Object.values(assets).map(hash));
const allowedHashes = new Set([hash(assets.app)]);
try {
  fs.writeFileSync(path.join(dir,'bundle.hbc'),'ordinary bundle');
  const check = () => assertArtworkExportBytes(dir,{knownHashes,allowedHashes});
  assert.throws(check,/missing/,'a TestFlight flag without actual OTA assets must fail');
  fs.writeFileSync(path.join(dir,'app'),assets.app);
  assert.equal(check().size,1);
  for (const key of ['pending','rejected','master','thumbnail']) {
    fs.writeFileSync(path.join(dir,'leak'),assets[key]);
    assert.throws(check,/Unapproved/,'candidate/master bytes must fail even beside approved derivatives');
    fs.unlinkSync(path.join(dir,'leak'));
  }
  assert.throws(()=>assertArtworkExportBytes(dir,{knownHashes,allowedHashes:new Set()}),/Unapproved/,'ordinary release context cannot include the family');
  fs.unlinkSync(path.join(dir,'app'));
  assert.equal(assertArtworkExportBytes(dir,{knownHashes,allowedHashes:new Set()}).size,0);
} finally { fs.rmSync(dir,{recursive:true,force:true}); }

const source=fs.readFileSync('lib/approved-art-runtime.ts','utf8');
const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
for (const [dev,channel,expected] of [[true,'',true],[false,'testflight',true],[false,'',false],[false,'production',false],[false,'disabled',false]]) {
  const exports={};vm.runInNewContext(code,{exports,__DEV__:dev,process:{env:{EXPO_PUBLIC_APPROVED_ART_CHANNEL:channel}}});
  assert.equal(exports.approvedArtRuntimeEnabled(),expected);
}
console.log('Approved OTA artwork: actual derivatives required; pending/rejected/master bytes forbidden; DEV/TestFlight enabled and Production disabled PASS');
