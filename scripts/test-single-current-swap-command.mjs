import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { resolveLoggerMovementIdentity } from '../lib/logger-movement-identity.ts';
import { accessoryRepTargetFromText, accessoryRepTargetText } from '../lib/prescription-wheel-options.ts';
const source=fs.readFileSync('app/(tabs)/workout/[workoutId].tsx','utf8');
const ast=ts.createSourceFile('route.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
let declaration;
function visit(node){if(ts.isVariableDeclaration(node)&&node.name.getText(ast)==='saveSwapAcc')declaration=node.getText(ast);ts.forEachChild(node,visit)}visit(ast);
assert.ok(declaration);
const current={id:60001,key:'private_machine',display_name:'Machine Overhead Triceps Extension',equipment_type:'machine',primary_muscle_group:'triceps'};
const equipment={id:60002,key:'machine_equipment_prime_selectorized'};
function harness({changed=false,realSwap=false,legacy=false,restoreFails=false}={}){
 const calls=[],errors=[];
 const item={id:10,movement_identity_contract:1,movement_definition_id:current.id,movement_identity:current,performed_movement_identity:equipment,sets:3,reps_text:'10',rir_target:2,set_logs:[]};
 const ctx={console,workoutId:'8',API_BASE:'http://qa.invalid',swapAccItem:item,swapAccIdentity:realSwap?{...current,id:60003,key:'private_other'}:current,
  swapAccForm:{sets:changed?'4':'3',rir:'2'},swapRepTarget:accessoryRepTargetFromText('10'),substitutionAuthority:'self_governed',
  itemHasPersistedSetLogs:()=>false,acceptedSetEvidenceItemIds:new Set(),resolveLoggerMovementIdentity,accessoryRepTargetText,accessoryRepTargetFromText,
  executionScope:'user:1:session:8',executionScopeRef:{current:'user:1:session:8'},dataRef:{current:{workout:{accessory_groups:[{items:[item]}]}}},
  setError:v=>{if(v)errors.push(v)},setSavingItemId(){},setSwapPickerVisible(){},setSwapAccVisible(){},setSwapAccItem(){},setSwapAccIdentity(){},rememberScroll(){},fetchWorkout:async()=>true,
  setData(update){ctx.dataRef.current=update(ctx.dataRef.current)},
  fetchJson:async(url,options)=>{
   calls.push({url,options});
   if(options.method==='PUT')return restoreFails?{ok:false,json:{ok:false}}:{ok:true,json:{ok:true,performed_movement_identity:equipment}};
   return {ok:true,status:200,json:{ok:true,item:{...item,movement_definition_id:ctx.swapAccIdentity.id,movement_identity:ctx.swapAccIdentity,performed_movement_identity:legacy?null:equipment}}};
  },
 };
 const code=ts.transpileModule(`const ${declaration}; saveSwapAcc;`,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
 return {run:vm.runInNewContext(code,ctx),calls,errors,ctx};
}
let h=harness();await h.run();assert.equal(h.calls.length,0,'same ID and prescription must not call old or new Swap APIs');
h=harness({changed:true});await h.run();assert.equal(h.calls.length,1);assert.equal(h.calls[0].options.body.movement_definition_id,current.id);assert.equal(h.calls[0].options.body.sets,4);assert.equal(h.ctx.dataRef.current.workout.accessory_groups[0].items[0].performed_movement_identity.id,equipment.id);
h=harness({changed:true,legacy:true});await h.run();assert.equal(h.calls.length,2);assert.equal(h.calls[1].options.method,'PUT');assert.equal(h.calls[1].options.body.movement_definition_id,equipment.id);assert.equal(h.errors.length,0);
h=harness({changed:true,legacy:true,restoreFails:true});await h.run();assert.equal(h.errors.length,1,'partial legacy write must never report success');
h=harness({realSwap:true,legacy:true});await h.run();assert.equal(h.calls.length,1,'a real movement change must not inherit old equipment');assert.equal(h.calls[0].options.body.movement_definition_id,60003);
console.log('Actual Swap command: same-ID no write, explicit prescription edit, old-API equipment preservation/error, and real Swap PASS.');
