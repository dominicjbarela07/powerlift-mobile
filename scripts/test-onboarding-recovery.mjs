import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const source = fs.readFileSync(new URL('../lib/checkoutBrowser.ts', import.meta.url), 'utf8');
async function run(candidate, mode = 'success') {
  const output = ts.transpileModule(candidate, {compilerOptions: {module: ts.ModuleKind.CommonJS}}).outputText;
  let resolve, reject, dismissed = 0;
  const pending = new Promise((yes, no) => {resolve = yes; reject = no;});
  const timers = [], blockers = [], openings = [];
  const sandbox = {exports: {}, require: name => {
    if (name === 'expo-web-browser') return {openAuthSessionAsync: (...args) => { openings.push(args); return pending; }, openBrowserAsync: () => pending,
      dismissBrowser: () => dismissed++, WebBrowserPresentationStyle: {AUTOMATIC:'automatic'}};
    if (name === '@/lib/updateSafety') return {setUpdateBlocker: (...value) => blockers.push(value)};
    throw new Error(name);
  }, setTimeout: (fn, ms) => {timers.push({fn,ms});return timers.length;}, clearTimeout: () => {}};
  vm.runInNewContext(output,sandbox);
  const checkout=sandbox.exports.openRecoverableCheckoutBrowser('https://localhost/billing/native-checkout/opaque');
  // Simulate arbitrarily long bank/card interaction: no scheduled close is legal.
  for (const timer of timers) timer.fn();
  await Promise.resolve();await Promise.resolve();
  assert.equal(timers.length,0,'checkout must never time out the customer browser');
  assert.equal(dismissed,0);
  assert.equal(openings[0][1],'powerliftmobile://billing-return');
  assert.deepEqual(blockers,[['billing_browser',true]]);
  if(mode==='error') { reject(new Error('browser presentation failed')); await assert.rejects(checkout); }
  else { resolve({type:mode,url:'powerliftmobile://billing-return?result=check'}); assert.equal((await checkout).type,mode); }
  assert.deepEqual(blockers,[['billing_browser',true],['billing_browser',false]]);
  return {noForcedClose:true,callback:true,updateBlockerReleased:true};
}
console.log(JSON.stringify(await run(source)));
for(const mode of ['cancel','dismiss','error']) await run(source,mode);
console.log('Cancel, dismiss and presentation failure release the update blocker.');
const previous = source.replace('return await WebBrowser.openAuthSessionAsync(',
  'setTimeout(() => WebBrowser.dismissBrowser(), 120000); return await WebBrowser.openAuthSessionAsync(');
assert.notEqual(previous, source, 'forced-dismiss failure injection must be applied');
let rejected=false;
try{await run(previous)}catch{rejected=true}
assert(rejected,'the previous two-minute forced-dismiss failure must be rejected');
console.log('PASS: deliberate forced-dismiss regression rejected; success, cancel, dismiss and presentation failure preserve native checkout recovery.');
