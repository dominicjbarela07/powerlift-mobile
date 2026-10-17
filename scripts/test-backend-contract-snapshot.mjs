import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createBackendContractSnapshot,assertBackendContractSnapshot} from './backend-contract-snapshot.mjs';
const root=fs.mkdtempSync(path.join(os.tmpdir(),'contract-snapshot-test-'));
let proof;
try {
  for(const name of ['app/templates','app/static/js','app/services'])fs.mkdirSync(path.join(root,name),{recursive:true});
  fs.writeFileSync(path.join(root,'app/services/api.py'),'protected server');
  fs.writeFileSync(path.join(root,'app/catalog.json'),'protected catalog');
  fs.writeFileSync(path.join(root,'app/templates/page.html'),'initial presentation');
  fs.writeFileSync(path.join(root,'app/static/js/web.js'),'initial web');
  proof=createBackendContractSnapshot(root);
  fs.writeFileSync(path.join(root,'app/templates/page.html'),'new independent presentation');
  fs.writeFileSync(path.join(root,'app/static/js/web.js'),'new independent web');
  assertBackendContractSnapshot(proof,root);
  assert.equal(fs.readFileSync(path.join(proof.root,'app/static/js/web.js'),'utf8'),'initial web');
  for(const file of ['app/services/api.py','app/catalog.json']) {
    const previous=fs.readFileSync(path.join(root,file));fs.writeFileSync(path.join(root,file),'unauthorized change');
    assert.throws(()=>assertBackendContractSnapshot(proof,root),/server inputs changed/);fs.writeFileSync(path.join(root,file),previous);
  }
  fs.writeFileSync(path.join(proof.root,'app/static/js/web.js'),'mutated snapshot');
  assert.throws(()=>assertBackendContractSnapshot(proof,root),/test inputs changed/);
  console.log('PASS: immutable backend contract copies survive independent web edits; Python/catalog changes and frozen-input mutation fail closed.');
}finally{if(proof)fs.rmSync(proof.root,{recursive:true,force:true});fs.rmSync(root,{recursive:true,force:true});}
