import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import * as identity from '../lib/canonical-movement-artwork.ts';
import * as art from '../lib/movement-artwork-hero.ts';
import * as geometry from '../lib/movement-artwork-geometry.mjs';
import * as taxonomy from '../lib/governed-movement-art-taxonomy.ts';
import { assertHumanArtworkGate, approvedExactArtworkPolicy } from './canonical-art-review-gate.mjs';

// Execute the actual TSX consumers with native host elements represented as a
// tree. This catches a screen bypassing approval or keeping an active-only gate;
// native screenshots separately validate image composition and touch behavior.
const policy=JSON.parse(fs.readFileSync('artwork-review/runtime-policy.json'));
const state=JSON.parse(fs.readFileSync('artwork-review/review-state.json'));
assertHumanArtworkGate();
assert.deepEqual(policy.approved_exact_artwork,approvedExactArtworkPolicy(state));
for (const [family, expected] of [['canonical_bodyweight_accessories',100],['canonical_machine_accessories',85]]) {
 const mapped=state.canonical_assets.filter(a=>state.items.find(i=>i.candidate_id===a.candidate_id)?.family===family);
 assert.equal(mapped.length,expected,`${family}: complete approved family mapped`);
 for(const a of mapped) assert.ok(policy.approved_exact_artwork.some(r=>r.candidate_id===a.candidate_id),`${a.key}: positive human receipt`);
}
for(const runtime of [{dev:true,channel:''},{dev:false,channel:'testflight'}]) {
let currentPolicy=policy;
const NativeImage=Object.assign(function Image(){},{resolveAssetSource:source=>{
 const png=fs.readFileSync(source.replace('@/', ''));
 return {width:png.readUInt32BE(16),height:png.readUInt32BE(20)};
}});
const react={createElement:(type,props,...children)=>({type:type===NativeImage?'Image':type,props:{...props,children}}),useEffect:callback=>callback(),useState:x=>[x?.width===0&&x?.height===0?{width:393,height:250}:x,()=>{}],useCallback:f=>f,memo:f=>f};
const mocks={react,'react-native':{View:'View',Image:NativeImage,Pressable:'Pressable',ActivityIndicator:'ActivityIndicator',StyleSheet:{create:x=>x,hairlineWidth:1}},
 '@expo/vector-icons':{Ionicons:'Ionicons'},'expo-image':{Image:'ExpoImage'},'expo-linear-gradient':{LinearGradient:'LinearGradient'},'@/components/ui/sl-text':{Text:'Text'},
 '@/constants/theme':{SLColors:{},SLRadius:{lg:18},SLFontFamilies:{}},
 '@/lib/canonical-movement-artwork':identity,
 '@/lib/movement-artwork-geometry.mjs':geometry,
 '@/lib/governed-movement-art-taxonomy':taxonomy,
 '@/lib/movement-artwork-hero':{...art,reportApprovedArtworkBypass:(m,k,s)=>art.reportApprovedArtworkBypass(m,k,s,currentPolicy,true),resolveApprovedExactMovementArtwork:m=>art.resolveApprovedExactMovementArtwork(m,true,currentPolicy),resolveMovementArtworkPresentation:(m,e,c,s)=>art.resolveMovementArtworkPresentation(m,e,c,s,true,currentPolicy)},
 '@/lib/accessory-muscle-region-assets':{accessoryMuscleRegionAsset:region=>({label:region,source:`anatomy:${region}`})},
 '@/components/workout-logger/core-variant-badge':{CoreVariantBadge:'CoreVariantBadge'},
 '@/components/movement/CanonicalMovementArtwork':{CanonicalMovementArtwork:'CanonicalMovementArtwork'},
 '@/components/movement/MovementArtworkHero':{MovementArtworkHero:'MovementArtworkHero'},
 './logger-primitives':{LoggerPlateStackVisual:'LoggerPlateStackVisual'},'./compact-set-timeline':{CompactSetTimeline:'CompactSetTimeline'},
 '@/lib/superset-workspace-focus':{supersetMemberLabel:(g,p)=>`${g}${p}`},
 '@/lib/set-log-delete-order':{canDeletePersistedSetLog:()=>false},
};
function load(file,dev=runtime.dev,channel=runtime.channel){const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.React,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,{exports,__DEV__:dev,process:{env:{EXPO_PUBLIC_APPROVED_ART_CHANNEL:channel}},console,require:name=>{if(name==='@/lib/approved-art-runtime')return {approvedArtRuntimeEnabled:()=>dev||channel==='testflight'};if(name.endsWith('.png'))return name;if(name in mocks)return mocks[name];throw Error(`Unmocked ${name}`);}});return exports;}
const assets=load('lib/canonical-movement-artwork-assets.ts');mocks['@/lib/canonical-movement-artwork-assets']=assets;
const {MovementArtworkHero:heroLayer}=load('components/movement/MovementArtworkHero.tsx');
// Production omits the registry; even diagnostics must not dereference it.
mocks['@/lib/canonical-movement-artwork-assets']={...assets,CANONICAL_ACCESSORY_MOVEMENT_ARTWORK:null};
const releaseHero=load('components/movement/MovementArtworkHero.tsx',false,'').MovementArtworkHero;
assert.equal(releaseHero({artworkKey:'accessory_dumbbell_curl',receiptId:'none',movementDefinitionId:253}),null);
mocks['@/lib/canonical-movement-artwork-assets']=assets;
const {CanonicalMovementArtwork:thumbnail}=load('components/movement/CanonicalMovementArtwork.tsx');
const {SessionV3Movement:single}=load('components/workout-logger/session-v3-movement.tsx');
const {SupersetRoundWorkspace:superset}=load('components/workout-logger/superset-round-workspace.tsx');
const nodes=(tree,type)=>{const out=[];function walk(n){if(!n||typeof n!=='object')return;if(Array.isArray(n)){n.forEach(walk);return;}if(n.type===type)out.push(n);walk(n.props?.children);}walk(tree);return out;};
const subject=id=>{const row=identity.CANONICAL_ACCESSORY_ARTWORK_IDENTITIES[id] || ({91:{key:'accessory_machine_shoulder_press',primary:'front_delts'},120:{key:'accessory_cable_upright_row',primary:'side_delts'}})[id];return {identity_type:'accessory',movement_definition_id:id,key:row.key,primary_muscle_group:row.primary};};
const renderSingle=(id,expanded,active)=>single({title:'Deliberately unrelated label',index:1,expanded,complete:false,active,onOpen:()=>{},visual:{movementArtworkInput:subject(id)},focus:{currentSetRepsLabel:'6–8 reps',currentSetEffortLabel:'1 RIR'}});
const renderGroup=(ids,selected,phase)=>superset({groupLabel:'A',expanded:selected!=null,selectedItemId:selected,phase,canLog:phase==='active',swapActionForItem:()=>null,model:{status:'pending',roundCount:1,currentRoundIndex:1,completedRounds:0,rounds:[{index:1,entries:ids.map((id,position)=>({itemId:id,position:position+1}))}],movements:ids.map((id,position)=>({item:{id,title:'Unrelated label',prescription:'1×6–8',movementArtwork:subject(id)},position:position+1,requiredSets:1,loggedRequiredSets:0,nextSetIndex:1,complete:false}))}});
function assertCue(tree,exact,key){const image=nodes(thumbnail(nodes(tree,'CanonicalMovementArtwork')[0].props),'Image')[0];assert.ok(image);assert.equal(image.props.source,exact?assets.CANONICAL_ACCESSORY_MOVEMENT_ARTWORK[key].source:`anatomy:${identity.resolveCanonicalMovementArtwork(nodes(tree,'CanonicalMovementArtwork')[0].props.movement).regionKey}`);}
for(const receipt of policy.approved_exact_artwork){
 const id=receipt.movement_definition_id,key=receipt.key;
 assert.equal(art.resolveApprovedExactMovementArtwork(subject(id),true)?.key,key,`${id}: normalized ID → current approval`);
 const mapping=state.canonical_assets.find(a=>a.key===key);
 assert.ok(mapping);
 const asset=assets.CANONICAL_ACCESSORY_MOVEMENT_ARTWORK[key];assert.ok(asset);
 assert.equal(asset.source,`@/${mapping.files.app.path}`);assert.equal(asset.thumbnail,undefined);
 const layer=heroLayer({artworkKey:key,receiptId:receipt.candidate_id,movementDefinitionId:id,reduceMotion:true});
 const raster=nodes(layer,'ExpoImage')[0];assert.ok(raster,'approved layer paints its real source after layout');
 assert.equal(raster.props.source,asset.source);assert.equal(raster.props.contentFit,'contain');assert.equal(raster.props.transition,0);
 const frame=raster.props.style[1],dimensions=NativeImage.resolveAssetSource(asset.source);
 assert.ok(Math.abs(frame.width/frame.height-dimensions.width/dimensions.height)<1e-9,'actual hero respects PNG aspect ratio');
 const canvasFades=nodes(layer,'LinearGradient').slice(-2);
 assert.equal(JSON.stringify(canvasFades[1].props.locations),'[0,0.26,0.46,0.78,1]','every actual hero uses the locked T-Bar Row canvas fade');
 for(const active of [false,true]){
  const compact=renderSingle(id,false,active);assertCue(compact,true,key);assert.equal(nodes(compact,'MovementArtworkHero').length,0);
  for(let remount=0;remount<2;remount++){
   const detail=renderSingle(id,true,active);assertCue(detail,false,key);const hero=nodes(detail,'MovementArtworkHero');assert.equal(hero.length,1);assert.equal(hero[0].props.artworkKey,key);assert.equal(hero[0].props.receiptId,receipt.candidate_id);
  }
 }
 for(const phase of ['pre','active']){
  const compact=renderGroup([id,120],null,phase);const first=nodes(compact,'CanonicalMovementArtwork')[0];assert.equal(first.props.accessoryPresentation,'movement');
  const selected=renderGroup([id,120],id,phase);assert.equal(nodes(selected,'CanonicalMovementArtwork')[0].props.accessoryPresentation,'muscle-focus');assert.equal(nodes(selected,'MovementArtworkHero')[0].props.artworkKey,key);
  const uncovered=renderGroup([id,120],120,phase);assert.equal(nodes(uncovered,'MovementArtworkHero').length,0);assert.equal(nodes(uncovered,'CanonicalMovementArtwork')[0].props.accessoryPresentation,'movement');
 }
 for(const size of [40,44,64,80]){const rendered=thumbnail({movement:subject(id),size,accessoryPresentation:'movement'});assert.equal(nodes(rendered,'Image')[0].props.source,asset.source,'all row sizes reuse the approved app image');const box=art.movementThumbnailGeometry(size,key);assert.equal(box.width,box.height);assert.ok(box.left<=0&&box.top<=0&&box.left+box.width>=size&&box.top+box.height>=size,'bounded crop covers frame without stretching');}
}
for(const mode of ['pending','rejected','missing']){
 const key=policy.approved_exact_artwork.find(r=>r.movement_definition_id===253).key;
 currentPolicy={denied_keys:mode==='missing'?[]:[key],approved_exact_artwork:[]};
 for(const active of [false,true])for(const expanded of [false,true]){const tree=renderSingle(253,expanded,active);assertCue(tree,false,key);assert.equal(nodes(tree,'MovementArtworkHero').length,0,mode);}
 for(const phase of ['pre','active'])assert.equal(nodes(renderGroup([253,120],253,phase),'MovementArtworkHero').length,0);
}
currentPolicy=policy;
for(const id of [120])for(const active of [false,true])for(const expanded of [false,true]){const tree=renderSingle(id,expanded,active);assertCue(tree,false);assert.equal(nodes(tree,'MovementArtworkHero').length,0);}
const warnings=[];const oldWarn=console.warn;console.warn=(...args)=>warnings.push(args);
try{
 art.reportApprovedArtworkBypass(subject(253),null,`test:missing-registry:${runtime.channel}`,policy,true);
 art.reportApprovedArtworkBypass(subject(253),null,`test:missing-registry:${runtime.channel}`,policy,true);
 assert.equal(warnings.length,1,'deduplicated approved-but-missing consumer warning');assert.equal(warnings[0][1].movement_definition_id,253);
 art.reportApprovedArtworkBypass(subject(120),null,'test:uncovered',policy,true);
 art.reportApprovedArtworkBypass(subject(253),null,'test:release',policy,false);
 art.reportApprovedArtworkBypass(subject(253),'accessory_dumbbell_curl','test:correct',policy,true);
 assert.equal(warnings.length,1,'no warning for uncovered, release or correct exact rendering');
 const expanded=renderSingle(253,true,false);assert.equal(nodes(expanded,'CanonicalMovementArtwork')[0].props.accessoryPresentation,'muscle-focus');
 assert.equal(warnings.length,1,'intentional anatomy cue is not an eligibility failure');
 const key='accessory_dumbbell_curl',asset=assets.CANONICAL_ACCESSORY_MOVEMENT_ARTWORK[key];delete assets.CANONICAL_ACCESSORY_MOVEMENT_ARTWORK[key];
 try{assert.equal(heroLayer({artworkKey:key,receiptId:'test',movementDefinitionId:253}),null);assert.equal(warnings.length,runtime.dev?2:1,'missing hero registry asset reports its approved canonical ID only in DEV');if(runtime.dev)assert.equal(warnings[1][1].movement_definition_id,253);}finally{assets.CANONICAL_ACCESSORY_MOVEMENT_ARTWORK[key]=asset;}
}finally{console.warn=oldWarn;}
console.log(`Approved art consumption (${runtime.dev ? 'DEV' : 'TestFlight release'}): ${policy.approved_exact_artwork.length} human-approved asset chains; actual compact/expanded TSX, PRE/ACTIVE/remount, superset selection, pending/rejected/missing, approved BW/machine coverage and independent cable fallback, crops and diagnostics PASS`);

}
