import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import crypto from 'node:crypto';
import ts from 'typescript';
import catalog from '../config/governed-movement-art-taxonomy.json' with {type:'json'};
import {equipmentFlowSubject,assertEquipmentFlowSubject} from '../lib/equipment-flow-subject.ts';
import {resolveLoggerMovementIdentity} from '../lib/logger-movement-identity.ts';
import {activeEquipmentIdentity,equipmentSelectionOperation,canConfigureMachineEquipment,needsEquipmentSelection} from '../lib/equipment-selection.ts';

const bytes=fs.readFileSync('config/testflight-runtime-equipment-20261014/production-serializer-fixture.json');
assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),'a4368fe74ca93c2e859c888e7e72eefe55f21644097e9dcee5d165a660dc7ba4','Production serializer fixture must retain its captured exact public metadata');
const wire=JSON.parse(bytes);
assert.equal(wire.length,212,'complete Production serializer audit fixture is retained');
const byKey=new Map([...catalog.movements,...(catalog.compatibility_movements||[])].map(row=>[row.key,row]));
const cases=wire.map((payload,index)=>{
 const registered=byKey.get(payload.key);
 const identity={...registered,...payload,id:registered?.id||80000+index,kind:'accessory',display_name:registered?.display_name||payload.key};
 return {id:90000+index,movement_identity_contract:1,movement_definition_id:identity.id,movement_identity:identity,lift:'AX',variant:'ACC',sets:3,set_logs:[]};
});
const source=fs.readFileSync('app/(tabs)/workout/[workoutId].tsx','utf8');
const ast=ts.createSourceFile('logger.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
let declaration;
const visit=n=>{if(ts.isVariableDeclaration(n)&&n.name.getText(ast)==='openIdentityPicker')declaration='const '+n.getText(ast)+';\nopenIdentityPicker;';ts.forEachChild(n,visit);};visit(ast);
assert.ok(declaration);
const notices=[],ctx={equipmentFlowSubject,assertEquipmentFlowSubject,resolveLoggerMovementIdentity,activeEquipmentIdentity,equipmentSelectionOperation,
 executionScope:'fixture',executionScopeRef:{current:'fixture'},data:{workout:{status:'in_progress'}},dataRef:{current:{workout:{accessory_groups:[{items:cases}]}}},
 identityPickerRequestRef:{current:0},identityPickerEntryRef:{current:null},isIdealWorkoutDetailPreview:false,Alert:{alert:(...args)=>notices.push(args)}};
for(const key of ['Subject','Item','Query','Rows','Loading','Error','Continuation','Manufacturer'])ctx['setIdentityPicker'+key]=v=>ctx['identityPicker'+key]=v;
const open=vm.runInNewContext(ts.transpileModule(declaration,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText,ctx);
let falseRequirementCases=0;
for(const item of cases){
 const originalId=item.movement_definition_id,subject=equipmentFlowSubject(item);
 assert.equal(subject.movementDefinitionId,originalId);
 assert.equal(canConfigureMachineEquipment(item),true,'supported fixed equipment must be selectable');
 assert.equal(needsEquipmentSelection(item),true,'first unconfigured Set reaches equipment selection');
 open(item,{kind:'accessory_set',itemId:item.id});
 assert.equal(notices.length,0,item.movement_identity.key+' must not produce Equipment unavailable');
 assert.equal(ctx.identityPickerItem.id,item.id);
 assert.equal(ctx.identityPickerSubject.movementDefinitionId,originalId);
 assert.equal(item.set_logs.length,0,'opening equipment does not write a Set');
 if(item.movement_identity.requires_equipment_configuration===false)falseRequirementCases++;
}
assert.equal(falseRequirementCases,9,'reproduce all nine original false-requiredness subjects');
const row=cases.find(item=>item.movement_identity.key==='cable_row');assert.ok(row);
assert.equal(equipmentFlowSubject(row).domain,'cable');
// Even explicit optional requiredness never changes the physical domain.
for(const item of cases){
 const identity={...item.movement_identity,requires_equipment_configuration:false,
  material_parameters:{...item.movement_identity.material_parameters,accessory_taxonomy:{...(item.movement_identity.material_parameters?.accessory_taxonomy||{}),requires_equipment_configuration:false}}};
 assert.equal(equipmentFlowSubject({...item,movement_identity:identity}).domain,equipmentFlowSubject(item).domain);
}
const free={id:99999,movement_identity_contract:1,movement_definition_id:999999,lift:'AX',variant:'ACC',movement_identity:{id:999999,key:'fixture_free_weight',display_name:'Cable Row',equipment_type:'dumbbell',requires_equipment_configuration:false}};
assert.throws(()=>equipmentFlowSubject(free),'a cable-like display name does not grant equipment support');
assert.throws(()=>assertEquipmentFlowSubject(equipmentFlowSubject(row),free),'stale identity checks remain intact');
console.log(`PASS: ${cases.length} actual Production-serializer fixed-equipment payloads and actual Logger open handler, nine false-requiredness reproductions, preserved IDs/Sets, optional requiredness, portable and stale-identity rejection; fixture SHA256 ${crypto.createHash('sha256').update(bytes).digest('hex')}`);
