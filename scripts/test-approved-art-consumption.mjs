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
const reuse=JSON.parse(fs.readFileSync('config/governed-movement-art-reuse.json'));
const reuseRows=[...reuse.shared_artwork_identities,...reuse.legacy_artwork_identities];
const policy=JSON.parse(fs.readFileSync('artwork-review/runtime-policy.json'));
const state=JSON.parse(fs.readFileSync('artwork-review/review-state.json'));
const coreCatalog=JSON.parse(fs.readFileSync('config/governed-movement-art-taxonomy.json')).movements.filter(row=>row.kind==='core');
assertHumanArtworkGate();
assert.deepEqual(policy.approved_exact_artwork,approvedExactArtworkPolicy(state));
for (const [family, expected] of [['canonical_bodyweight_accessories',103],['canonical_machine_accessories',85]]) {
 const mapped=state.canonical_assets.filter(a=>state.items.find(i=>i.candidate_id===a.candidate_id)?.family===family);
 assert.equal(mapped.length,expected,`${family}: complete approved family mapped`);
 for(const a of mapped) assert.equal(policy.approved_exact_artwork.some(r=>r.candidate_id===a.candidate_id), !policy.denied_keys.includes(a.key), `${a.key}: current approvals or explicit catalog withdrawal`);
}
for(const runtime of [{dev:true,channel:''},{dev:false,channel:'testflight'}]) {
let currentPolicy=policy;
const measuredHeights=[0,0,0];
let numericStateSlot=0;
const NativeImage=Object.assign(function Image(){},{resolveAssetSource:source=>{
 const png=fs.readFileSync(source.replace('@/', ''));
 return {width:png.readUInt32BE(16),height:png.readUInt32BE(20)};
}});
const react={isValidElement:x=>Boolean(x && typeof x==='object' && 'type' in x && x.props),cloneElement:(x,p)=>({...x,props:{...x.props,...p}}),createElement:(type,props,...children)=>typeof type==='function' && ['SessionV3MovementLayout','MovementArtworkHeroLayer'].includes(type.name)
 ? type({...props,children}) : ({type:type===NativeImage?'Image':type,props:{...props,children}}),useEffect:callback=>callback(),useState:x=>{if(x===0){const slot=numericStateSlot++%3;return [measuredHeights[slot],update=>{measuredHeights[slot]=typeof update==='function'?update(measuredHeights[slot]):update;}];}return [x?.width===0&&x?.height===0?{width:393,height:250}:x,()=>{}];},useCallback:f=>f,memo:f=>f};
const mocks={react,'expo-asset':{Asset:{fromModule:NativeImage.resolveAssetSource}},'react-native':{useWindowDimensions:()=>({width:393,height:852}),View:'View',Image:NativeImage,Pressable:'Pressable',ActivityIndicator:'ActivityIndicator',StyleSheet:{create:x=>x,hairlineWidth:1}},
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
const assertBackgroundSpan=(layer,key)=>{
 const raster=nodes(layer,'ExpoImage')[0];assert.ok(raster,'real raster paints');
 const frame=Object.assign({},...raster.props.style);
 assert.ok(frame.width >= 393 * .82 - 1e-7,
  'actual atmospheric raster must command the movement header');
 const framing = art.movementAtmosphereFraming(key);
 const actionTop = frame.top + frame.height * framing.top / framing.sourceHeight;
 assert.ok(actionTop >= 0 && actionTop <= 20, 'actual renderer removes individually measured empty source margin');
};
const subject=id=>{const core=coreCatalog.find(row=>row.id===id);if(core)return identity.canonicalArtworkInputFromDefinition(core);const row=identity.CANONICAL_ACCESSORY_ARTWORK_IDENTITIES[id] || ({91:{key:'accessory_machine_shoulder_press',primary:'front_delts'},999999:{key:'fixture_unapproved_accessory',primary:'side_delts'}})[id];return {identity_type:'accessory',movement_definition_id:id,key:row.key,primary_muscle_group:row.primary};};
const renderSingle=(id,expanded,active,complete=false)=>single({title:'Deliberately unrelated label',index:1,expanded,complete,active,onOpen:()=>{},visual:{movementArtworkInput:subject(id)},focus:{currentSetRepsLabel:'6–8 reps',currentSetEffortLabel:'1 RIR'}});
const renderGroup=(ids,selected,phase)=>superset({groupLabel:'A',expanded:selected!=null,selectedItemId:selected,phase,canLog:phase==='active',swapActionForItem:()=>null,model:{status:'pending',roundCount:1,currentRoundIndex:1,completedRounds:0,rounds:[{index:1,entries:ids.map((id,position)=>({itemId:id,position:position+1}))}],movements:ids.map((id,position)=>({item:{id,title:'Unrelated label',prescription:'1×6–8',movementArtwork:subject(id)},position:position+1,requiredSets:1,loggedRequiredSets:0,nextSetIndex:1,complete:false}))}});
for(const equipment of [null,{type:'View',props:{children:['Manufacturer']}}]) {
 measuredHeights.fill(0);
 const props={title:'Boundary probe',index:1,expanded:true,complete:false,onOpen:()=>{},equipment,history:'Movement history',visual:{movementArtworkInput:subject(49)}};
 const render=()=>single(props);
 const anchors=nodes(render(),'View').filter(n=>n.props.onLayout);
 assert.equal(anchors.length,2,'the whole header owns the background; caption measurement only protects foreground content');
 anchors[1].props.onLayout({nativeEvent:{layout:{height:90}}});
 anchors[0].props.onLayout({nativeEvent:{layout:{width:353,height:374}}});
 const stage=()=>Object.assign({},...nodes(render(),'View').find(n=>n.props.pointerEvents==='none').props.style);
 assert.equal(stage().top,0,'background must extend behind the movement title');
 assert.equal(stage().height,374,'background commands the complete header, rather than a below-title slot');
 anchors[0].props.onLayout({nativeEvent:{layout:{width:280,height:310}}});
 assert.equal(stage().top,0);
 assert.equal(stage().height,310,'actual measured width/height support nested/narrow phone surfaces');
 assert.ok(stage().left<0 && stage().right<0,'background extends through content gutters');
 assert.equal(nodes(render(),'View').find(n=>n.props.pointerEvents==='none').props.pointerEvents,'none','background never intercepts equipment/picker interaction');
 const caption=nodes(render(),'View').find(n=>Array.isArray(n.props.style)&&n.props.style.some(style=>style?.bottom===12));
 assert.ok(caption,'full-width title overlays the lower atmosphere, clear of upright faces');
}
measuredHeights.fill(0);
for(const count of [1,2]) {
 const endpoints=Array.from({length:count},(_,index)=>({displayLabel:`${135+index*10} lb`,plateStack:{fixture:index}}));
 const tree=single({title:'Competition Bench',index:1,expanded:true,complete:false,onOpen:()=>{},
  visual:{movementArtworkInput:subject(2),plateStack:{mode:count===1?'single':'range',endpoints}},
  focus:{currentSetLoadLabel:count===1?'135 lb':'135–145 lb',currentSetRepsLabel:'8 reps'}});
 const column=nodes(tree,'View').find(node=>node.props.style?.width==='53%');
 const plates=nodes(column,'LoggerPlateStackVisual');
 assert.equal(plates.length,count,'all prescribed load endpoints remain in the foreground load column');
 plates.forEach((plate,index)=>assert.equal(plate.props.plateStack,endpoints[index].plateStack,'physical setup identity is preserved'));
 const stage=nodes(column,'View').find(node=>Array.isArray(node.props.style)&&node.props.style[0]?.width===130);
 assert.ok(stage&&!stage.props.style[0].position,'load reference no longer floats over the lifter’s face');
}
measuredHeights.fill(0);
function assertCue(tree,exact,key){
 const props=nodes(tree,'CanonicalMovementArtwork')[0].props;
 const resolution=identity.resolveCanonicalMovementArtwork(props.movement), rendered=thumbnail(props);
 if(!exact && resolution.kind==='core_variant'){
  const badge=nodes(rendered,'CoreVariantBadge')[0];assert.ok(badge,'expanded variant retains its established contextual badge');
  assert.equal(badge.props.family,resolution.family);assert.equal(badge.props.liftArtworkSource,assets.CANONICAL_CORE_MOVEMENT_ARTWORK[resolution.family]);return;
 }
 const image=nodes(rendered,'Image')[0];assert.ok(image);
 const context=resolution.kind==='core'?assets.CANONICAL_CORE_MOVEMENT_ARTWORK[resolution.family]:`anatomy:${resolution.regionKey}`;
 assert.equal(image.props.source,exact?assets.CANONICAL_ACCESSORY_MOVEMENT_ARTWORK[key].source:context);
}
for(const receipt of policy.approved_exact_artwork){
 const id=receipt.movement_definition_id,key=receipt.key;
 const resolved=art.resolveApprovedExactMovementArtwork(subject(id),true);
 if(resolved?.key!==key){
  const binding=reuseRows.find(row=>row.movement_definition_id===id && row.key===key);
  assert.ok(binding, 'a differing image requires an explicit governed reuse binding');
  assert.equal(resolved?.key,binding.artwork_key);
  continue;
 }
 assert.equal(resolved?.key,key,`${id}: normalized ID → current approval`);
 const mapping=state.canonical_assets.find(a=>a.key===key);
 assert.ok(mapping);
 const asset=assets.CANONICAL_ACCESSORY_MOVEMENT_ARTWORK[key];assert.ok(asset);
 assert.equal(asset.source,`@/${mapping.files.app.path}`);assert.equal(asset.thumbnail,undefined);
 const layer=heroLayer({artworkKey:key,receiptId:receipt.candidate_id,movementDefinitionId:id,reduceMotion:true});
 const raster=nodes(layer,'ExpoImage')[0];assert.ok(raster,'approved layer paints its real source after layout');
 assert.equal(raster.props.source,asset.source);assert.equal(raster.props.contentFit,'contain');assert.equal(raster.props.transition,0);
 const frame=Object.assign({},...raster.props.style),dimensions=NativeImage.resolveAssetSource(asset.source);
 assert.ok(Math.abs(frame.width/frame.height-dimensions.width/dimensions.height)<1e-9,'actual hero respects PNG aspect ratio');
 assertBackgroundSpan(layer,key);
 const canvasFades=nodes(layer,'LinearGradient').slice(-2);
 assert.ok(frame.opacity>0 && frame.opacity<1,'artwork sits below foreground contrast');
 assert.equal(canvasFades[1].props.locations[0],0);
 assert.equal(canvasFades[1].props.locations.at(-1),1);
 assert.ok(!canvasFades[0].props.colors.slice(1,-1).some(color=>color.endsWith(',1)')),'the prescription side is shaded, never hidden behind an opaque panel');
 for(const active of [false,true]){
  const compact=renderSingle(id,false,active);assertCue(compact,true,key);assert.equal(nodes(compact,'MovementArtworkHero').length,0);
  for(const complete of [false,true])for(let remount=0;remount<2;remount++){
   const detail=renderSingle(id,true,active,complete);assertCue(detail,false,key);const hero=nodes(detail,'MovementArtworkHero');assert.equal(hero.length,1);assert.equal(hero[0].props.artworkKey,key);assert.equal(hero[0].props.receiptId,receipt.candidate_id);
  }
 }
 for(const phase of ['pre','active']){
  const compact=renderGroup([id,999999],null,phase);const first=nodes(compact,'CanonicalMovementArtwork')[0];assert.equal(first.props.accessoryPresentation,'movement');
  const selected=renderGroup([id,999999],id,phase);assert.equal(nodes(selected,'CanonicalMovementArtwork')[0].props.accessoryPresentation,'muscle-focus');assert.equal(nodes(selected,'MovementArtworkHero')[0].props.artworkKey,key);
  const uncovered=renderGroup([id,999999],999999,phase);assert.equal(nodes(uncovered,'MovementArtworkHero').length,0);assert.equal(nodes(uncovered,'CanonicalMovementArtwork')[0].props.accessoryPresentation,'movement');
 }
 for(const size of [40,44,64,80]){const rendered=thumbnail({movement:subject(id),size,accessoryPresentation:'movement'});assert.equal(nodes(rendered,'Image')[0].props.source,asset.source,'all row sizes reuse the approved app image');const box=art.movementThumbnailGeometry(size,key);assert.equal(box.width,box.height);assert.ok(box.left<=0&&box.top<=0&&box.left+box.width>=size&&box.top+box.height>=size,'bounded crop covers frame without stretching');}
}
// Reproduce the exact rejected failure class inside the actual TSX renderer:
// whole-raster containment shrinks a square into a small image window.
const goodGeometry=mocks['@/lib/movement-artwork-geometry.mjs'];
try {
 mocks['@/lib/movement-artwork-geometry.mjs']={...geometry,movementAtmosphereFrame:(box,sw,sh,w,h)=>{
  const raw=geometry.movementHeroSourceFrame(box,sw,sh),scale=Math.min(1,w/raw.width,h/raw.height);
  return {left:w-raw.width*scale,top:0,width:raw.width*scale,height:raw.height*scale};
 }};
 const faulty=load('components/movement/MovementArtworkHero.tsx').MovementArtworkHero;
 assert.throws(()=>assertBackgroundSpan(faulty({artworkKey:'accessory_push_up',receiptId:'deliberate-rejected-thumbnail',movementDefinitionId:67,reduceMotion:true}),'accessory_push_up'),
  /actual atmospheric raster must command/,'the owner-rejected small square is rejected inside the actual renderer');
} finally { mocks['@/lib/movement-artwork-geometry.mjs']=goodGeometry; }
// Reproduce the latest owner screenshot through the real component. A wide
// square photograph still fails if its empty upper studio remains visible.
try {
 mocks['@/lib/movement-artwork-geometry.mjs']={...geometry,movementAtmosphereFrame:(box,sw,sh,w,h)=>geometry.movementAtmosphereFrame(box,sw,sh,w,h)};
 const faulty=load('components/movement/MovementArtworkHero.tsx').MovementArtworkHero;
 assert.throws(()=>assertBackgroundSpan(faulty({artworkKey:'accessory_push_up',receiptId:'deliberate-empty-top',movementDefinitionId:67,reduceMotion:true}),'accessory_push_up'),
  /empty source margin/,'the owner-rejected full-square empty-space composition is rejected in the real renderer');
} finally { mocks['@/lib/movement-artwork-geometry.mjs']=goodGeometry; }
measuredHeights.fill(0);
const pushUp=renderSingle(67,true,true,true);
const pushUpHeader=nodes(pushUp,'View').find(node=>node.props.onLayout);
const pushUpStyle=Object.assign({},...pushUpHeader.props.style.filter(Boolean));
assert.ok(pushUpStyle.minHeight < 240, 'the actual completed Push-Up header drops the old tall square scene');
for(const mode of ['pending','rejected','missing']){
 const key=policy.approved_exact_artwork.find(r=>r.movement_definition_id===253).key;
 currentPolicy={denied_keys:mode==='missing'?[]:[key],approved_exact_artwork:[]};
 for(const active of [false,true])for(const expanded of [false,true]){const tree=renderSingle(253,expanded,active);assertCue(tree,false,key);assert.equal(nodes(tree,'MovementArtworkHero').length,0,mode);}
 for(const phase of ['pre','active'])assert.equal(nodes(renderGroup([253,999999],253,phase),'MovementArtworkHero').length,0);
}
currentPolicy=policy;
for(const id of [999999])for(const active of [false,true])for(const expanded of [false,true]){const tree=renderSingle(id,expanded,active);assertCue(tree,false);assert.equal(nodes(tree,'MovementArtworkHero').length,0);}
const warnings=[];const oldWarn=console.warn;console.warn=(...args)=>warnings.push(args);
try{
 art.reportApprovedArtworkBypass(subject(253),null,`test:missing-registry:${runtime.channel}`,policy,true);
 art.reportApprovedArtworkBypass(subject(253),null,`test:missing-registry:${runtime.channel}`,policy,true);
 assert.equal(warnings.length,1,'deduplicated approved-but-missing consumer warning');assert.equal(warnings[0][1].movement_definition_id,253);
 art.reportApprovedArtworkBypass(subject(999999),null,'test:uncovered',policy,true);
 art.reportApprovedArtworkBypass(subject(253),null,'test:release',policy,false);
 art.reportApprovedArtworkBypass(subject(253),'accessory_dumbbell_curl','test:correct',policy,true);
 assert.equal(warnings.length,1,'no warning for uncovered, release or correct exact rendering');
 const expanded=renderSingle(253,true,false);assert.equal(nodes(expanded,'CanonicalMovementArtwork')[0].props.accessoryPresentation,'muscle-focus');
 assert.equal(warnings.length,1,'intentional anatomy cue is not an eligibility failure');
 const key='accessory_dumbbell_curl',asset=assets.CANONICAL_ACCESSORY_MOVEMENT_ARTWORK[key];delete assets.CANONICAL_ACCESSORY_MOVEMENT_ARTWORK[key];
 try{assert.equal(heroLayer({artworkKey:key,receiptId:'test',movementDefinitionId:253}),null);assert.equal(warnings.length,runtime.dev?2:1,'missing hero registry asset reports its approved canonical ID only in DEV');if(runtime.dev)assert.equal(warnings[1][1].movement_definition_id,253);}finally{assets.CANONICAL_ACCESSORY_MOVEMENT_ARTWORK[key]=asset;}
}finally{console.warn=oldWarn;}
console.log(`Approved art consumption (${runtime.dev ? 'DEV' : 'TestFlight release'}): ${policy.approved_exact_artwork.length} human-approved asset chains; actual compact/expanded TSX, PRE/ACTIVE/remount, superset selection, pending/rejected/missing, approved BW/machine coverage and independent unapproved fallback, crops and diagnostics PASS`);

}
