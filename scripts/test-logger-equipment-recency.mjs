import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import * as cacheModule from '../lib/session-exposure-cache.ts';
import * as snapshots from '../lib/session-exposure-snapshot.ts';
import * as launch from '../lib/movement-history-launch.ts';
import * as semantics from '../lib/performed-load-semantics.ts';
import * as metric from '../lib/movement-strength-metric.ts';
import * as contract from '../lib/canonical-movement-history-contract.ts';
import { mostRecentEquipmentChoice, orderEquipmentChoices, orderEquipmentTypeChoices, presentEquipmentHistory } from '../lib/equipment-selection.ts';
const cache = cacheModule.sessionExposureCache, effects = [], calls = [];
const react = { useEffect: fn => effects.push(fn), useSyncExternalStore: (_, snapshot) => snapshot(),
  createElement: (type, props, ...children) => typeof type === 'function' ? type({...props, children}) : {type, props: props || {}, children} };
function load(file, deps) {
  const module = {exports:{}};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.React,esModuleInterop:true}}).outputText,
    {URLSearchParams, module,exports:module.exports,require:key=>{assert.ok(key in deps,key);return deps[key];}});
  return module.exports;
}
const recorded = (id, day, equipmentId, brand, weight=50) => ({id:`${id}:${equipmentId}`,workout_id:id,date:`2026-09-${day}`,performed_at:`2026-09-${day}T12:00:00`,
  equipment:{id:equipmentId,key:`equipment-${equipmentId}`,equipment_type:'plate_loaded_machine',label:`${brand} · Plate Loaded Machine`,manufacturer:{id:equipmentId,key:brand,display_name:brand}},
  comparison_scope:'exact_implementation',comparison_identity_key:`314:${equipmentId}`,set_count:3,
  best_set:{id:id*10,weight_kg:weight,reps:10,rir:1,load_convention:'machine_stack_display',measurement_type:'load_reps'}});
const latest=recorded(90,'15',72,'Hammer Strength',113.3980925), older=recorded(80,'10',73,'Matrix');
const baseline={athlete:{id:4},identity_resolution:{status:'resolved',subject_type:'accessory',subject_id:314},scope:'exact_identity',comparison_allowed:false,
  movement:{id:314,requires_equipment_configuration:true},filters:{date_range:'all',selected_scope:'all_history'},
  summary:{set_count:6,exposure_count:2,first_performed_on:older.date},exposures:[latest,older],has_more:false,
  performance_trend:[],load_progression:[],load_rep_profile:[],equipment_breakdown:[],statistics:{}};
let response=baseline, fail=false, destination;
const api=load('lib/canonical-movement-history.ts',{'@/lib/api':{fetchJson:async path=>{calls.push(path);if(fail)throw Error('offline');return {ok:true,json:{ok:true,movement_history:response}};}},
  '@/lib/movement-strength-metric':metric,'@/lib/performed-load-semantics':semantics,'@/lib/canonical-movement-history-contract':contract});
const hooks=load('lib/use-session-exposure.ts',{react,'./canonical-movement-history':api,'./session-exposure-cache':cacheModule,'./session-exposure-snapshot':snapshots});
const component=load('components/workout-logger/session-history-peek.tsx',{react,'react-native':{Pressable:'Pressable',View:'View',StyleSheet:{create:s=>s}},
  '@/components/ui/sl-text':{Text:'Text'},'@/constants/theme':{SLFontFamilies:{sansSemiBold:'test'}},'@/lib/use-session-exposure':hooks,'@/lib/session-exposure-snapshot':snapshots});
const item={id:7,variant:'ACC',lift:'AX',movement_identity_contract:1,movement_definition_id:314,movement_identity:{id:314},
  original_movement:'Unrelated label',performed_canonical_movement_identity:{id:315},is_substituted:true};
const resolution=launch.resolveMovementHistoryLaunchForItem({athleteId:4,item}); assert.equal(resolution.ok,true);
assert.equal(resolution.target.movementDefinitionId,314);
const props={target:resolution.target,workoutId:100,sessionDate:'2026-09-24',ownerId:'1',unit:'lb',history:null,
  onOpen:()=>destination=launch.movementHistorySheetRoute(resolution.target)};
const text=n=>n==null||n===false?'':typeof n==='object'?(n.children||[]).map(text).join(' ').replace(/\s+/g,' ').trim():String(n);
const render=(p=props)=>component.SessionHistoryPeek(p);
const settle=async()=>{effects.splice(0).forEach(f=>f());for(let i=0;i<6;i++)await new Promise(r=>setImmediate(r));};
const reset=()=>{cache.clear();effects.length=0;calls.length=0;response=baseline;fail=false;};
reset();render();await settle();let tree=render();
assert.match(text(tree),/LAST EXPOSURE.*Sep 15.*250 lb × 10.*@1 RIR.*Hammer Strength · Plate Loaded Machine/);
assert.doesNotMatch(text(tree),/No comparable|LAST COMPARABLE|unavailable/);
tree.props.onPress();assert.equal(destination.params.movementDefinitionId,'314');
assert.equal(calls.length,1);assert.match(calls[0],/movement_definition_id=314/);assert.doesNotMatch(calls[0],/equipment_definition_id=/);
const history=await api.fetchCanonicalMovementHistory({athleteId:4,movementDefinitionId:314,range:'all'});
assert.equal(history.exposures[0].best_set.id,cache.get(hooks.sessionExposureIdentity({ownerId:'1',athleteId:4,workoutId:100,sessionDate:'2026-09-24'},props.target)).set.id);
// Selecting equipment changes only comparison context. Older matching evidence must replace latest other-equipment evidence.
const selected={...props,target:{...props.target,equipmentContextDefinitionId:73},history:{identity_scope:'exact_identity',comparison_allowed:true,
  movement_definition_id:314,comparison_scope:'exact_implementation',equipment_configuration_identity_id:73,comparison_identity_key:'314:73',
  previous_exposure:{workout_id:80,date:older.date,comparison_identity_key:'314:73',representative_set:{...older.best_set,workout_id:80}}}};
assert.match(text(render(selected)),/LAST COMPARABLE EXPOSURE.*Sep 10.*110.23 lb × 10/);
assert.doesNotMatch(text(render(selected)),/250 lb/);assert.equal(selected.target.movementDefinitionId,314);
assert.match(text(render({...selected,history:{...selected.history,previous_exposure:null}})),/No comparable exposure/);
assert.match(text(render({...selected,history:{...selected.history,movement_definition_id:315}})),/History unavailable/);
const option=(id,name,record=null,current=false)=>({id,key:name,display_name:name,manufacturer:{id,key:name,display_name:name},equipment_context:{option_kind:'catalog',is_current:current,
  usage_status:record?'used':'not_used',last_exposure:record,last_used_at:record?.performed_at,equipment_type_last_exposure:record?{plate_loaded:record}:{},
  equipment_latest_exposures:record?{[record.equipment.id]:record}:{},used_equipment_type_keys:record?['plate_loaded']:[]}});
const hammer=option(72,'Hammer Strength',latest), matrix=option(73,'Matrix',older), never=option(74,'AAA Unused',null,true);
assert.deepEqual(orderEquipmentChoices([never,matrix,hammer],never.id).map(x=>x.id),[72,73,74]);
assert.deepEqual(orderEquipmentChoices([never,option(75,'BBB Unused')].reverse()).map(x=>x.id),[74,75]);
const presentation=presentEquipmentHistory(hammer,'lb',false);
assert.equal(presentation.performance,'250 lb × 10 @1 RIR');assert.match(presentation.detail,/Last used Sep 15.*Plate Loaded/);assert.equal(presentation.status,'');
assert.equal(presentEquipmentHistory(hammer,'kg',true).performance,'113.4 kg × 10 @1 RIR');
assert.equal(presentEquipmentHistory(never,'lb',true).performance,undefined);
assert.equal(presentEquipmentHistory(hammer,'lb',false,'selectorized').performance,undefined,'another type cannot borrow this performance');
const both={...hammer,equipment_context:{...hammer.equipment_context,equipment_type_last_exposure:{selectorized:latest,plate_loaded:older}}};
assert.deepEqual(orderEquipmentTypeChoices([{key:'plate_loaded'},{key:'selectorized'}],both).map(x=>x.key),['selectorized','plate_loaded']);
const recent=mostRecentEquipmentChoice([matrix,never,hammer],['plate_loaded','selectorized']);
assert.equal(recent?.equipmentDefinitionId,72);assert.equal(recent?.manufacturer.manufacturer.id,72);
assert.equal(recent?.equipmentType,'plate_loaded');
assert.equal(mostRecentEquipmentChoice([never],['plate_loaded','selectorized']),null);
assert.equal(mostRecentEquipmentChoice([matrix,hammer],['selectorized']),null,'disallowed type cannot be quick-selected');
assert.equal(mostRecentEquipmentChoice([{...hammer,manufacturer:{...hammer.manufacturer,id:900}}],['plate_loaded']),null,'brand identity mismatch must fail closed');
assert.equal(mostRecentEquipmentChoice([{...hammer,equipment_context:{...hammer.equipment_context,equipment_latest_exposures:{72:{...latest,equipment:{...latest.equipment,id:0}}}}}],['plate_loaded']),null,'missing canonical equipment ID must fail closed');
// Historical load semantics beat a different current setup; bodyweight and assisted evidence retain their meanings.
const bodyweight={...latest,equipment:null,comparison_scope:'exact_movement',best_set:{...latest.best_set,weight_kg:0,load_convention:'added_bodyweight',measurement_type:'added_weight_reps'}};
reset();response={...baseline,movement:{id:314,requires_equipment_configuration:false},exposures:[bodyweight]};render();await settle();
assert.match(text(render()),/LAST EXPOSURE.*BW × 10/);assert.doesNotMatch(text(render()),/Equipment not recorded|No comparable/);
reset();response={...baseline,exposures:[],summary:{set_count:0,exposure_count:0}};render();await settle();assert.match(text(render()),/No previous exposure/);
for(const bad of [{...baseline,athlete:{id:5}},{...baseline,identity_resolution:{...baseline.identity_resolution,subject_id:315}}]){
  reset();response=bad;render();await settle();assert.match(text(render()),/History unavailable/);assert.doesNotMatch(text(render()),/250 lb|No previous exposure/);
}
reset();fail=true;render();await settle();assert.match(text(render()),/History unavailable.*Retry history/);
const route=fs.readFileSync('app/(tabs)/workout/[workoutId].tsx','utf8');
assert.match(route,/assertEquipmentResponseSubject\(entry.subject, response.json\)/);
assert.match(route,/orderEquipmentTypeChoices\(equipmentFlowVariants/);
assert.match(route,/presentEquipmentHistory\(row, unit/);
assert.match(route,/MOST RECENT EQUIPMENT/);
assert.match(route,/equipment_definition_id: expectedEquipmentId/);
console.log('PASS: exact movement pre-equipment evidence, full History parity, selected-equipment transition, no-history/error distinction, bodyweight semantics, athlete/movement isolation, latest evidence, units and manufacturer/type recency');
