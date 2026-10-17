import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
export function backendInputFiles(root) {
  const files = {};
  function visit(dir) {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir,{withFileTypes:true})) {
      if (entry.name === '__pycache__') continue;
      const file = path.join(dir,entry.name);
      if (entry.isDirectory()) visit(file);
      else if (/\.(py|json|html|js|ts)$/.test(file)) files[path.relative(root,file)] = sha(fs.readFileSync(file));
    }
  }
  for (const name of ['app','migrations']) visit(path.join(root,name));
  for (const name of ['wsgi.py','requirements.txt']) if(fs.existsSync(path.join(root,name))) files[name]=sha(fs.readFileSync(path.join(root,name)));
  return Object.fromEntries(Object.entries(files).sort(([a],[b])=>a.localeCompare(b)));
}
const mutableWebPresentation = file => file.startsWith('app/templates/') && file.endsWith('.html') || file.startsWith('app/static/') && /\.(js|ts)$/.test(file);
const serverInputs = files => Object.fromEntries(Object.entries(files).filter(([file])=>!mutableWebPresentation(file)));
export function assertBackendContractSnapshot(proof, canonicalRoot) {
  assert.equal(fs.realpathSync(canonicalRoot),proof.canonicalRoot);
  assert.deepEqual(backendInputFiles(proof.root),proof.files,'Frozen backend test inputs changed');
  assert.deepEqual(serverInputs(backendInputFiles(canonicalRoot)),serverInputs(proof.files),'Canonical Python/catalog/server inputs changed during release');
}
export function createBackendContractSnapshot(canonicalRoot, parent=os.tmpdir()) {
  canonicalRoot=fs.realpathSync(canonicalRoot);
  const files=backendInputFiles(canonicalRoot);
  const root=fs.mkdtempSync(path.join(parent,'sl-contract-inputs-'));
  function copy(source,destination) {
    fs.mkdirSync(destination,{recursive:true});
    for(const entry of fs.readdirSync(source,{withFileTypes:true})) {
      if(entry.name==='__pycache__'||entry.name==='.DS_Store')continue;
      const from=path.join(source,entry.name),to=path.join(destination,entry.name);
      if(entry.isDirectory())copy(from,to);
      else if(entry.isSymbolicLink())fs.symlinkSync(fs.realpathSync(from),to);
      else if(/\.(py|json|html|js|ts|mjs|txt|md|sql|csv|sh|yml|yaml)$/.test(from))fs.copyFileSync(from,to);
      else fs.symlinkSync(from,to); // Existing binary assets retain their original owner.
    }
  }
  for(const name of ['app','migrations','tests','scripts','docs','config'])if(fs.existsSync(path.join(canonicalRoot,name)))copy(path.join(canonicalRoot,name),path.join(root,name));
  for(const name of ['wsgi.py','requirements.txt','AGENTS.md','README.md','package.json'])if(fs.existsSync(path.join(canonicalRoot,name)))fs.copyFileSync(path.join(canonicalRoot,name),path.join(root,name));
  if(fs.existsSync(path.join(canonicalRoot,'venv')))fs.symlinkSync(path.join(canonicalRoot,'venv'),path.join(root,'venv'),'dir');
  const proof={root,canonicalRoot,files,capturedAt:new Date().toISOString(),purpose:'Immutable contract-test inputs while independent web presentation work continues; canonical DEV remains source authority.'};
  assert.deepEqual(backendInputFiles(root),files,'Source changed during snapshot capture; retry capture');
  assertBackendContractSnapshot(proof,canonicalRoot);
  return proof;
}
