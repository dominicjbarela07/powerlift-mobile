import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { ledgerCompetitionArtwork, ledgerDefinitionArtwork, ledgerVariantArtwork, ledgerArchiveArtwork } from '../lib/ledger-movement-art.ts';
import { normalizeCanonicalMovementArtSubject, resolveCanonicalMovementArtwork } from '../lib/canonical-movement-artwork.ts';
import { resolveApprovedExactMovementArtwork } from '../lib/movement-artwork-hero.ts';
import * as records from '../lib/ledger-records.ts';
import * as art from '../lib/ledger-movement-art.ts';
import * as visualHelpers from '../lib/ledger-visuals.ts';
import * as units from '../lib/display-units.ts';

for(const lift of ['squat','bench','deadlift']){
 const input=ledgerCompetitionArtwork(lift),subject=normalizeCanonicalMovementArtSubject(input);
 assert.equal(subject.canonicalKey,`competition_${lift}`);
 assert.equal(subject.coreVariant,false);
 assert.equal(resolveApprovedExactMovementArtwork(input,true)?.key,`competition_${lift}`,'Core cards must reach the existing human-approved image');
}
const physical=ledgerDefinitionArtwork({id:605,key:'pause_squat',kind:'core',family:'squat'});
assert.equal(normalizeCanonicalMovementArtSubject(physical).canonicalIdentityId,37,'A physical definition ID must not be mistaken for a Core ID');
assert.equal(normalizeCanonicalMovementArtSubject(physical).movementDefinitionId,605);
const typed=ledgerVariantArtwork({core_movement_id:37,key:'pause_squat',family:'squat'});
assert.equal(normalizeCanonicalMovementArtSubject(typed).canonicalIdentityId,37);
assert.equal(resolveApprovedExactMovementArtwork(typed,true)?.key,'competition_squat','Only the already-governed reuse receipt can select shared art');
assert.equal(ledgerDefinitionArtwork({id:605,key:'competition_squat',kind:'core'}),null,'A conflicting old reference cannot borrow another lift image');
assert.equal(ledgerDefinitionArtwork({id:999999,key:'pause_squat',kind:'core',family:'squat'}),null,'Unknown physical IDs cannot be recast as Core IDs by their labels or keys');
assert.equal(ledgerArchiveArtwork({title:'Competition Squat',source_id:1,movement:null}),null,'SetLog/Session row IDs and titles are not artwork identity');
assert.equal(ledgerArchiveArtwork({movement:{name:'Competition Squat'}}),null);
const saved=ledgerArchiveArtwork({source_id:999,movement:{id:2,key:'competition_bench',kind:'core',family:'bench'}});
assert.equal(resolveApprovedExactMovementArtwork(saved,true)?.key,'competition_bench');
assert.equal(resolveApprovedExactMovementArtwork(ledgerDefinitionArtwork({id:1,key:'private_squat',kind:'custom',ownership_scope:'coach',primary_muscle_group:'quads'}),true),null,'Private IDs cannot borrow global artwork');

const token=new Proxy({},{get:(_,k)=>String(k)}),theme={colors:token,material:token,fonts:token,type:{micro:11,cardNumber:32},radius:token};
let width=390;
const react={createElement:(type,props,...children)=>({type,props:{...props,children}}),useId:()=>':id:'};
const mocks={react,'react-native':{Image:'Image',Pressable:'Pressable',View:'View',StyleSheet:{create:x=>x},useWindowDimensions:()=>({width})},'expo-linear-gradient':{LinearGradient:'Gradient'},'react-native-svg':{default:'Svg',Circle:'Circle',Defs:'Defs',LinearGradient:'SvgGradient',Path:'Path',Stop:'Stop',Line:'Line',Text:'SvgText'},'@expo/vector-icons':{Ionicons:'Icon'},'@/components/ui/sl-text':{Text:'Text'},'@/constants/ledger':{LEDGER:theme},'@/lib/anatomy-system':{},'@/components/anatomy/ProgrammingMuscleRegionArt':{},'@/lib/ledger-exploration':{},'@/lib/ledger-visuals':visualHelpers,'@/lib/ledger-records':records,'@/lib/barbell/plate-stack-render-resolver':{},'@/lib/display-units':units,'@/lib/barbell/milestone-render-assets':{},'./use-ledger-resource':{},'./LedgerMovementBackdrop':{LedgerMovementBackdrop:'MovementBackdrop'},'@/lib/ledger-movement-art':art};
const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync('components/ledger/LedgerVisuals.tsx','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.React,esModuleInterop:true,target:ts.ScriptTarget.ES2022}}).outputText,{exports,require:name=>{assert.ok(name in mocks,name);return mocks[name];}});
const nodes=tree=>!tree?[]:Array.isArray(tree)?tree.flatMap(nodes):typeof tree==='object'?[tree,...nodes(tree.props?.children)]:[];
const assertCardArt=tree=>assert.equal(nodes(tree).filter(n=>n.type==='MovementBackdrop').length,1,'A primary record card must contain its movement artwork');
for(width of [320,375,390,430,768])for(const lift of ['squat','bench','deadlift']){
 let opened=false;const tree=exports.LedgerRecordCard({label:lift,lift,kg:117.5,reps:5,points:[{date:'2026-10-12',value_kg:117.5}],unit:'kg',onPress:()=>opened=true});
 assertCardArt(tree);
 const image=nodes(tree).find(n=>n.type==='MovementBackdrop'),spark=nodes(tree).find(n=>n.type===exports.LedgerSparkline);
 assert.equal(resolveApprovedExactMovementArtwork(image.props.movement,true)?.key,`competition_${lift}`);
 assert.ok(image.props.width>=150,'Integrated movement art needs a meaningful background area');
 assert.equal(image.props.align,'right');
 assert.equal(image.props.size,undefined,'The artwork is no longer a square thumbnail');
 assert.ok(spark.props.width>=140,'Adding art cannot squeeze the plot into an unreadable sliver');
 assert.ok(spark.props.width+30<=width-36,'Background art cannot take space away from the foreground chart');
 tree.props.onPress();assert.equal(opened,true,'Artwork does not replace the original record action');
 assert.throws(()=>assertCardArt({type:'View',props:{children:[]}}),'Deliberately removing all art must be rejected');
}
const product=fs.readFileSync('components/ledger/LedgerExperience.tsx','utf8'),source=fs.readFileSync('components/ledger/LedgerSourceContent.tsx','utf8'),renderer=fs.readFileSync('components/ledger/LedgerMovementBackdrop.tsx','utf8');
for(const anchor of ['ledgerCompetitionArtwork(lift)','ledgerVariantArtwork(m)','ledgerDefinitionArtwork(m)'])assert.ok(product.includes(anchor));
assert.match(source,/ledgerArchiveArtwork\(item\)/);
assert.doesNotMatch(product+source+fs.readFileSync('components/ledger/LedgerVisuals.tsx','utf8'),/LedgerMovementArtwork|<CanonicalMovementArtwork/,'Owner correction prohibits the square thumbnail presentation on these surfaces');
assert.match(renderer,/canonicalMovementArtworkSource\(movement\)/);assert.match(renderer,/resolveApprovedExactMovementArtwork\(movement\)/);assert.match(renderer,/<MaskedView/);assert.match(renderer,/contentFit="contain"/);assert.doesNotMatch(renderer,/tintColor|filter:|require\(.*\.png|accessoryPresentation="muscle-focus"/,'A movement artwork consumer cannot bypass the shared approval/crop renderer');
const background=fs.readFileSync('components/ui/sl-workspace.tsx','utf8');
const assertTexture=s=>{assert.match(s,/ledger \? <Image[\s\S]*brushed-gunmetal-v1\.png/);assert.match(s,/opacity: SLLedgerMaterial\.textureOpacity/);};
assertTexture(background);assert.throws(()=>assertTexture(background.replace('brushed-gunmetal-v1.png','none.png')),'Subtraction of the actual shared canvas texture must fail');
console.log('PASS: exact approved Core art, physical/Core/private identity boundaries, immutable source references, actual card rendering/actions at five widths, readable artwork/chart balance, approved-source background rendering and scoped gunmetal texture.');

// Execute the actual backdrop: approved images remain contained, doubly feathered,
// non-interactive background layers. Unknown art produces no invented image.
const backdropExports={};let sourceDimensions={width:512,height:512};
const backdropMocks={'@/constants/ledger':{LEDGER:theme},react:{...react,memo:x=>x,useEffect:()=>{},useState:()=>[{width:210,height:200},()=>{}]},'react-native':{Image:{resolveAssetSource:()=>sourceDimensions},StyleSheet:{create:x=>x,absoluteFillObject:{position:'absolute',top:0,left:0,right:0,bottom:0}},View:'View'},'expo-image':{Image:'Raster'},'@react-native-masked-view/masked-view':{default:'MaskedView'},'expo-linear-gradient':{LinearGradient:'Gradient'},'@/lib/canonical-movement-artwork-assets':{canonicalMovementArtworkSource:input=>resolveApprovedExactMovementArtwork(input,true)?.key??null},'@/lib/movement-artwork-hero':{resolveApprovedExactMovementArtwork:input=>resolveApprovedExactMovementArtwork(input,true),reportApprovedArtworkBypass:()=>{}}};
vm.runInNewContext(ts.transpileModule(renderer,{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.React,esModuleInterop:true,target:ts.ScriptTarget.ES2022}}).outputText,{exports:backdropExports,require:name=>{assert.ok(name in backdropMocks,name);return backdropMocks[name];}});
const tree=backdropExports.LedgerMovementBackdrop({movement:ledgerCompetitionArtwork('squat'),width:210});
assert.equal(tree.props.pointerEvents,'none');assert.equal(tree.props.accessible,false);
const masks=nodes(tree).filter(n=>n.props?.maskElement);assert.equal(masks[0].props.style.width,masks[0].props.style.height,'Feather the actual contained image, not the wider box around it');assert.equal(masks[0].props.style.width,200);assert.equal(masks.length,2,'Both photo edges must dissolve into the material');
const raster=nodes(tree).find(n=>n.type==='Raster');assert.equal(raster.props.contentFit,'contain');assert.equal(raster.props.source,'competition_squat');
assert.equal(backdropExports.LedgerMovementBackdrop({movement:null}),null);
assert.equal(backdropExports.LedgerMovementBackdrop({movement:{kind:'custom',movement_definition_id:999999}}),null);
console.log('PASS: actual backdrop render; approved-only pixels, full source containment, two alpha masks, no thumbnail frame and no input interception.');

const assertContainedMask=(tree,aspect)=>{const mask=nodes(tree).find(n=>n.props?.maskElement);assert.ok(Math.abs(mask.props.style.width/mask.props.style.height-aspect)<.0001,'Mask edges must match source aspect, not the container aspect');};
for(sourceDimensions of [{width:600,height:400},{width:400,height:600},{width:512,height:512}])assertContainedMask(backdropExports.LedgerMovementBackdrop({movement:ledgerCompetitionArtwork('bench'),width:210}),sourceDimensions.width/sourceDimensions.height);
assert.throws(()=>assertContainedMask({type:'Masked',props:{maskElement:true,style:{width:210,height:200}}},1),'Deliberately feathering the wider container instead of its square raster must fail');
const historyReader=fs.readFileSync('components/movement-history/CanonicalMovementHistoryScreen.tsx','utf8'),historyRoute=fs.readFileSync('app/movement-history-sheet.tsx','utf8');
assert.match(historyReader,/ledgerAtmosphere = false/,'Shared Logger history keeps its existing default presentation');assert.match(historyReader,/ledgerAtmosphere\?<LedgerMovementBackdrop/);assert.match(historyRoute,/ledgerAtmosphere=\{params.ledgerAtmosphere === '1'\}/);assert.match(product,/displayUnit:unit,ledgerAtmosphere:'1'/,'The Ledger accessory handoff must retain unit/identity and opt into integrated artwork');
console.log('PASS: square, landscape and portrait raster-edge feathering; deliberate wider-mask failure; opt-in Ledger history header with unchanged shared-history default.');

// Source-space focus points inspected against the three actual approved 512px
// images. Face, torso/hip and lower-body points must stay fully visible; the old
// left-side fade erased them even though the source itself remained contained.
const subjectPoints={squat:[[.56,.30],[.49,.62],[.45,.86]],bench:[[.43,.43],[.60,.52],[.65,.86],[.89,.80]],deadlift:[[.60,.16],[.43,.43],[.44,.78],[.65,.57]]};
const alphaAt=(mask,x)=>{const {colors,locations}=mask.props;const alpha=color=>color==='maskOpaque'?1:0;for(let i=1;i<locations.length;i++)if(x<=locations[i]){const t=(x-locations[i-1])/(locations[i]-locations[i-1]);return alpha(colors[i-1])+(alpha(colors[i])-alpha(colors[i-1]))*Math.max(0,t);}return alpha(colors.at(-1));};
const assertSubjectVisible=(tree,points)=>{const masks=nodes(tree).filter(n=>n.props?.maskElement);for(const [x,y] of points)assert.ok(alphaAt(masks[0].props.maskElement,x)*alphaAt(masks[1].props.maskElement,y)>=.98,`A verified movement subject point ${x},${y} was faded out`);};
for(const lift of ['squat','bench','deadlift'])assertSubjectVisible(backdropExports.LedgerMovementBackdrop({movement:ledgerCompetitionArtwork(lift),width:210,align:'right'}),subjectPoints[lift]);
const rejected=backdropExports.LedgerMovementBackdrop({movement:ledgerCompetitionArtwork('squat'),width:210,align:'left'});
assert.throws(()=>assertSubjectVisible(rejected,subjectPoints.squat),'The owner-rejected mask that fades the lifter must be caught');
console.log('PASS: actual masked output preserves inspected face/torso/lower-body points for Squat, Bench and Deadlift; deliberately rejected subject-fading mask fails.');
