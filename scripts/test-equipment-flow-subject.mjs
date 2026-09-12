import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { equipmentFlowSubject, assertEquipmentFlowSubject, assertEquipmentResponseSubject, equipmentFlowVariants, equipmentFlowWrite } from '../lib/equipment-flow-subject.ts';
import { resolveLoggerMovementIdentity, canonicalArtworkInputForLoggerItem } from '../lib/logger-movement-identity.ts';
import { activeEquipmentIdentity, orderEquipmentChoices, equipmentSelectionOperation } from '../lib/equipment-selection.ts';
const identity=(id,key,name,equipment,extra={})=>({id,key,display_name:name,equipment_type:equipment,primary_muscle_group:'triceps',...extra});
const machine=identity(60001,'qa_machine_overhead_triceps','Machine Overhead Triceps Extension','machine');
const cable=identity(307,'accessory_cable_overhead_triceps_extension','Cable Overhead Triceps Extension','cable');
const make=(id,definition,programmed=definition)=>({id,movement:programmed.display_name,movement_identity:programmed,
 effective_movement_identity:definition,effective_movement_definition_id:definition.id,
 performed_canonical_movement_identity:definition,is_substituted:definition.id!==programmed.id,sets:3,set_logs:[]});
const a=make(101,machine,cable),b=make(102,cable);
assert.equal(a.movement,'Cable Overhead Triceps Extension','fixture reproduces stale programmed text');
assert.equal(resolveLoggerMovementIdentity(a).displayName,'Machine Overhead Triceps Extension');
for(const item of [a,b]) {
 const subject=equipmentFlowSubject(item);
 assert.equal(subject.displayName,resolveLoggerMovementIdentity(item).displayName);
 assert.equal(subject.movementDefinitionId,item.effective_movement_definition_id);
 assert.equal(canonicalArtworkInputForLoggerItem(item).effective_movement_identity.id,subject.movementDefinitionId);
 assertEquipmentResponseSubject(subject,{usage_movement_definition_id:subject.movementDefinitionId});
 assert.throws(()=>assertEquipmentResponseSubject(subject,{usage_movement_definition_id:999}));
 assert.throws(()=>assertEquipmentResponseSubject(subject,{}));
 for(const state of [{},{expanded:true},{expanded:false},{background:true},{set_logs:[{id:5,set_index:1}]},JSON.parse(JSON.stringify(item))]) {
  assertEquipmentFlowSubject(subject,{...item,...state});
 }
 const saved={...item,performed_movement_identity:identity(991,'machine_equipment_prime_selectorized','Prime Fitness · Selectorized','selectorized_machine',{
   identity_specificity:'exact',implementation_key:'prime:selectorized',manufacturer:{id:77,key:'prime',display_name:'Prime Fitness'}})};
 assertEquipmentFlowSubject(subject,saved);
 assert.deepEqual(canonicalArtworkInputForLoggerItem(saved),canonicalArtworkInputForLoggerItem(item));
 assert.deepEqual(equipmentFlowWrite(subject,'prime','selectorized'),{manufacturer_key:'prime',equipment_type:'selectorized'});
}
assert.throws(()=>assertEquipmentFlowSubject(equipmentFlowSubject(a),b));
assert.throws(()=>equipmentFlowSubject({...a,effective_movement_definition_id:307}));
assert.throws(()=>equipmentFlowSubject({...a,effective_movement_identity:cable}));
assert.throws(()=>equipmentFlowSubject({id:1,movement:machine.display_name}));
assert.throws(()=>equipmentFlowSubject(make(1,identity(991,'machine_equipment_prime_selectorized','Prime Fitness','selectorized_machine'))));
assert.throws(()=>equipmentFlowSubject(make(1,identity(3,'curl','Machine Curl','dumbbell'))),'name cannot classify equipment');
assert.throws(()=>equipmentFlowSubject({...a,performed_canonical_movement_identity:null}),'incomplete old substitution cannot be overwritten by equipment');
assert.ok(equipmentFlowVariants(equipmentFlowSubject(b)).every(row=>row.label.endsWith('Cable Station')));
for(const [equipment,allowed] of [['plate_loaded_machine','plate_loaded'],['selectorized_machine','selectorized']]) {
 const subject=equipmentFlowSubject(make(1,identity(41,equipment,equipment,equipment)));
 assert.deepEqual(subject.allowedTypes,[allowed]);
 assert.throws(()=>equipmentFlowWrite(subject,'prime',allowed==='selectorized'?'plate_loaded':'selectorized'));
}
// Same-muscle/family variants, unilateral/bilateral, machine/cable and free weights never collapse IDs.
const variants=['machine','cable','plate_loaded_machine','selectorized_machine','dumbbell','barbell'];
for(const [index,equipment] of variants.entries()) {
 const item=make(index+200,identity(index+70000,`variant_${index}`,`Sibling ${index}`,equipment));
 if(['dumbbell','barbell'].includes(equipment)) assert.throws(()=>equipmentFlowSubject(item));
 else assert.equal(equipmentFlowSubject(item).movementDefinitionId,index+70000);
}

// Execute the actual route's open/load/save/close handlers, including delayed A/B responses.
const source=fs.readFileSync('app/(tabs)/workout/[workoutId].tsx','utf8');
const ast=ts.createSourceFile('route.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
const names=new Set(['openIdentityPicker','loadIdentityPicker','commitPerformedIdentity','closeIdentityPicker']);
const declarations=[];
const visit=node=>{if(ts.isVariableDeclaration(node)&&names.has(node.name.getText(ast)))declarations.push(`const ${node.getText(ast)};`);ts.forEachChild(node,visit);};visit(ast);
assert.equal(declarations.length,names.size);
const requests=[],notices=[];
const ctx={equipmentFlowSubject,assertEquipmentFlowSubject,assertEquipmentResponseSubject,equipmentFlowVariants,equipmentFlowWrite,
 resolveLoggerMovementIdentity,activeEquipmentIdentity,orderEquipmentChoices,equipmentSelectionOperation,
 useCallback:fn=>fn,executionScope:'user:1:session:8',executionScopeRef:{current:'user:1:session:8'},workoutId:'8',API_BASE:'http://qa.invalid',
 data:{athlete:{id:1},workout:{status:'in_progress',accessory_groups:[{group:'A',items:[a,b]}]}},
 identityPickerEntryRef:{current:null},identityPickerRequestRef:{current:0},identityPickerSaveRef:{current:null},
 identityPickerItem:null,identityPickerContinuation:{kind:'none'},isIdealWorkoutDetailPreview:false,
 Keyboard:{dismiss(){}},Alert:{alert(...args){notices.push(args)}},manufacturerMatchesSearch:()=>true,
 fetchJson:(url,options)=>new Promise(resolve=>requests.push({url,options,resolve})),
 setData(value){ctx.data=value;ctx.dataRef.current=value},fetchWorkout:async()=>true,showSetMutationNotice:()=>{},resumeAfterEquipmentSelection:(...args)=>notices.push(args),
};
ctx.dataRef={current:ctx.data};
for(const field of ['Item','Rows','Subject','Query','Error','Loading','Continuation','Manufacturer'])ctx[`setIdentityPicker${field}`]=value=>{ctx[`identityPicker${field}`]=value;};
const code=ts.transpileModule(declarations.join('\n')+'\n({openIdentityPicker,loadIdentityPicker,commitPerformedIdentity,closeIdentityPicker});',{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
const handlers=vm.runInNewContext(code,ctx);
handlers.openIdentityPicker(a);
assert.equal(ctx.identityPickerSubject.movementDefinitionId,machine.id);
const pendingA=handlers.loadIdentityPicker(a);
handlers.closeIdentityPicker();handlers.openIdentityPicker(b);
const pendingB=handlers.loadIdentityPicker(b);
requests[0].resolve({ok:true,json:{ok:true,usage_movement_definition_id:machine.id,items:[{id:1,key:'old',display_name:'Old'}]}});await pendingA;
assert.equal(ctx.identityPickerRows.length,0,'late A cannot populate B');
requests[1].resolve({ok:true,json:{ok:true,usage_movement_definition_id:cable.id,items:[{id:2,key:'b',display_name:'B'}]}});await pendingB;
assert.equal(ctx.identityPickerRows[0].key,'b');
handlers.closeIdentityPicker();handlers.openIdentityPicker(a);
const wrong=handlers.loadIdentityPicker(a);
requests.at(-1).resolve({ok:true,json:{ok:true,usage_movement_definition_id:cable.id,items:[{id:2,key:'b',display_name:'B'}]}});await wrong;
assert.equal(ctx.identityPickerRows.length,0);assert.match(ctx.identityPickerError,/movement changed/);
handlers.closeIdentityPicker();handlers.openIdentityPicker(a);
const save=handlers.commitPerformedIdentity({id:77,manufacturer:{key:'prime'}},'selectorized');
const write=requests.at(-1);
assert.match(write.url,/items\/101\/performed-identity$/);
assert.equal(write.options.body.manufacturer_key,'prime');
assert.equal('movement_definition_id' in write.options.body,false,'Equipment never submits a movement replacement');
const count=requests.length;await handlers.commitPerformedIdentity({id:77,manufacturer:{key:'prime'}},'selectorized');
assert.equal(requests.length,count,'double tap submits once');
handlers.closeIdentityPicker();handlers.openIdentityPicker(b);
write.resolve({ok:true,json:{ok:true,performed_movement_identity:{id:991,key:'machine_equipment_prime_selectorized'}}});await save;
assert.equal(ctx.identityPickerSubject.movementDefinitionId,cable.id,'late A save cannot close or rewrite B');
assert.equal(ctx.identityPickerItem.id,b.id);
handlers.closeIdentityPicker();handlers.openIdentityPicker(a);
const successful=handlers.commitPerformedIdentity({id:77,manufacturer:{key:'prime'}},'selectorized');
// New accepted evidence arriving while equipment saves must not be overwritten.
ctx.dataRef.current={...ctx.data,workout:{...ctx.data.workout,accessory_groups:[{group:'A',items:[{...a,set_logs:[{id:909,set_index:1}]},b]}]}};
requests.at(-1).resolve({ok:true,json:{ok:true,performed_movement_identity:{id:991,key:'machine_equipment_prime_selectorized',
 display_name:'Prime Fitness · Selectorized',equipment_type:'selectorized_machine',identity_specificity:'exact',implementation_key:'prime:selectorized',manufacturer:{id:77,key:'prime',display_name:'Prime Fitness'}}}});
await successful;
assert.equal(ctx.identityPickerItem,null,'successful confirmed save closes only its own sheet');
const confirmed=ctx.dataRef.current.workout.accessory_groups[0].items[0];
assert.equal(confirmed.set_logs[0].id,909,'equipment reconciliation preserves concurrent accepted Sets');
assert.equal(confirmed.effective_movement_definition_id,machine.id);
assert.equal(confirmed.performed_movement_identity.id,991);
assert.equal(notices.at(-1)[0].id,a.id,'continuation uses the confirmed exact item');
handlers.openIdentityPicker(b);
const otherAccount=handlers.loadIdentityPicker(b);
ctx.executionScopeRef.current='other-user:session:8';
requests.at(-1).resolve({ok:true,json:{ok:true,usage_movement_definition_id:cable.id,items:[{id:2,key:'private',display_name:'Old account'}]}});
await otherAccount;
assert.equal(ctx.identityPickerRows.length,0,'account changes discard pending responses even before effects run');
assert.match(source,/identityPickerSubject\?\.displayName/);
assert.doesNotMatch(source,/simplifyMobileMovementName\(identityPickerItem\.movement\)/);
assert.match(source,/onConfigureEquipment=\{\(itemId\)[\s\S]*?candidate\.id === itemId[\s\S]*?openIdentityPicker\(item\)/);
console.log('Equipment subject: exact effective IDs/names, governed loading domain, immutable movement/artwork, actual A/B async handlers and equipment-only writes PASS');
