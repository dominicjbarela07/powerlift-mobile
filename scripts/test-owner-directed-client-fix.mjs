import assert from 'node:assert/strict';
import { assertClientFixScope } from './owner-directed-client-fix.mjs';
const instruction = 'Let me log at zero pounds.';
const text = instruction + '\nYou will not do simulator runs. Stop talking about it';
const scope = {scope: 'canonical-zero-load-edit-20261005', productFingerprint: 'fixed', validation: 'OWNER_DIRECTED_CONTRACTS_ONLY', ownerInstruction: instruction,
  changedProductFiles: {'app/logger.tsx': 'fixed-editor'}, contracts: {'scripts/test-zero-load-edit-api.mjs':'api', 'scripts/test-zero-load-edit-set.mjs':'editor'}};
const delta = [{path:'app/logger.tsx',after:'fixed-editor'}];
assertClientFixScope(scope,'fixed',delta,text);
assert.throws(() => assertClientFixScope(scope,'different',delta,text), /changed product source/);
assert.throws(() => assertClientFixScope(scope,'fixed',[...delta,{path:'assets/art.png',after:'new'}],text), /unrelated/);
assert.throws(() => assertClientFixScope(scope,'fixed',[{path:'app/logger.tsx',after:'other'}],text), /source changed/);
assert.throws(() => assertClientFixScope(scope,'fixed',delta,instruction), /exact owner instruction/);
assert.throws(() => assertClientFixScope({...scope,contracts:{'scripts/test-zero-load-edit-set.mjs':'editor'}},'fixed',delta,text));
console.log('Owner-directed zero-load validation: exact source, exact contracts, explicit instruction, no unrelated changes; deliberately invalid scopes rejected PASS');
