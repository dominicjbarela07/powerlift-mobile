import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const source=fs.readFileSync('context/AuthContext.tsx','utf8');
function loginBody(text){const tree=ts.createSourceFile('auth.tsx',text,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);let fn;function visit(n){if(ts.isFunctionDeclaration(n)&&n.name?.text==='login')fn=n.getText(tree);ts.forEachChild(n,visit);}visit(tree);assert.ok(fn);return ts.transpileModule(fn+';globalThis.actualLogin=login;',{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;}
async function check(text,role='coach'){
 const calls=[],userRef={current:null},tokenRef={current:null},confirmedMobileUserRef={current:null};
 const context={normalizeProfilePhotoPayload:()=>({hasProfilePhotoValue:false}),confirmedMobileUserRef,userRef,tokenRef,
 persistUser:async user=>{userRef.current=user;calls.push('persist');},setToken:()=>{},SecureStore:{setItemAsync:async()=>{}},TOKEN_KEY:'synthetic-token',
 fetchJson:async()=>({ok:true,json:{role,preferred_units:'lb'}}),preferredUnitFromSettingsPayload:x=>x.preferred_units,
 mergeAccountStatePayload:(u,p)=>({...u,...p.user}),saveMobileViewMode:async()=>{},resolveActiveMobileMode:u=>u.role,
 refreshAccountState:async()=>{assert.equal(tokenRef.current,'fixture-token','authenticated identity must use current login token');calls.push('identity');userRef.current={...userRef.current,id:77,user_id:77};return userRef.current;},
 startVideoUploadQueue:()=>{calls.push('queue');assert.equal(userRef.current?.id,77,'fresh login must resolve canonical account ID before scoped operations');}};
 vm.createContext(context);vm.runInContext(loginBody(text),context);await context.actualLogin({user:{email:'fixture@example.test',role},token:'fixture-token'});
 assert.ok(calls.indexOf('identity')<calls.indexOf('queue'));assert.equal(userRef.current.role,role);
}
for(const role of ['coach','athlete'])await check(source,role);
const original=source.replace('      await refreshAccountState();\n','');await assert.rejects(()=>check(original),/fresh login must resolve canonical account ID/,'deliberately omitting authenticated hydration reproduces accountId0');
console.log('Actual fresh login hydrates canonical account ID under the installed token before scoped work; coach/athlete retained; original missing-ID path rejected.');
