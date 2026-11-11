import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import vm from 'node:vm';
function callback(file, name, wrapped = false) {
  const source=fs.readFileSync(file,'utf8'),tree=ts.createSourceFile(file,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
  let found;
  function visit(node){if(ts.isVariableDeclaration(node)&&node.name.getText(tree)===name)found=wrapped?node.initializer.arguments[0].getText(tree):node.initializer.getText(tree);ts.forEachChild(node,visit);}visit(tree);
  assert.ok(found,name);return ts.transpileModule('globalThis.run = '+found,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
}
const verifyCode=callback('app/verify-email.tsx','applyVerifiedPayload');
let routed=[],errors=[],proof={email_verified:false,account_state:'EMAIL_VERIFICATION_REQUIRED'};
const verify={applyAccountStatePayload:async()=>proof,router:{replace:path=>routed.push(path)},setError:value=>errors.push(value)};
vm.createContext(verify);vm.runInContext(verifyCode,verify);
await verify.run({ok:true});assert.equal(routed.length,0,'an OK response without verification proof cannot open the next step');
proof={email_verified:true,account_state:'ACTIVATION_REQUIRED'};await verify.run({user:proof});assert.deepEqual(routed,['/']);
const refreshCode=callback('app/index.tsx','refreshActivationState',true);
for(const outage of ['preferences-only','membership','profile','both']){
 const routes=[],messages=[],failures=[],checking=[];
 const ready={account_state:'READY_INDIVIDUAL',billing_required:false,can_access_product:true,is_coach:true};
 const ctx={refreshAccountState:async()=>{if(outage==='profile'||outage==='both')throw Error('profile offline');return ready;},
 checkMobileBillingStatus:async()=>{if(outage==='membership'||outage==='both')throw Error('membership offline');return {ok:true,json:{...ready,billing_terms:{trial_days:14}}};},
 applyAccountStatePayload:async payload=>payload,setTerms(){},setChecking:value=>checking.push(value),setError:value=>{if(value)failures.push(value);},setNotice:value=>{if(value)messages.push(value);},router:{replace:value=>routes.push(value)}};
 vm.createContext(ctx);vm.runInContext(refreshCode,ctx);await ctx.run({showMessage:true});
 assert.equal(checking.at(-1),false,'status checking always ends');
 assert.equal(routes.length,outage==='both'?0:1,'either authoritative read can recover ready access');
 if(outage==='both')assert.equal(failures.length,1);
}
const checkoutCode=callback('app/index.tsx','openActivation');
for(const type of ['cancel','dismiss','success']){
 const state={starts:0,notices:[],errors:[],refreshes:[],busy:[]};
 const ctx={checkoutInFlight:{current:false},setActivating:value=>state.busy.push(value),setError:value=>{if(value)state.errors.push(value);},setNotice:value=>{if(value)state.notices.push(value);},
 startMobileBillingCheckout:async()=>{state.starts++;return {ok:true,json:{checkout_url:'https://checkout.stripe.com/qa'}};},openRecoverableCheckoutBrowser:async()=>({type}),refreshActivationState:async value=>state.refreshes.push(value),console:{warn(){}}};
 vm.createContext(ctx);vm.runInContext(checkoutCode,ctx);await Promise.all([ctx.run(),ctx.run()]);
 assert.equal(state.starts,1,'double taps cannot start two checkout requests');assert.equal(ctx.checkoutInFlight.current,false);assert.equal(state.busy.at(-1),false);assert.equal(state.errors.length,0);
 assert.equal(state.refreshes[0].showMessage,type==='success');
 if(type!=='success')assert.ok(state.notices[0].includes('Checkout closed'),'cancel and dismiss receive calm retained-progress feedback');
}
console.log('PASS actual verification, activation and checkout handlers. Missing proof fails closed. Either status read recovers readiness. Double taps, cancellation and dismissal preserve a usable setup screen.');
