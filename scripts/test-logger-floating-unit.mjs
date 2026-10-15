import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { execFileSync } from 'node:child_process';

let measuredHeight = 0, toggles = 0;
const react = {createElement:(type,props,...children)=>({type,props:props||{},children}), Fragment:'Fragment',
  createContext:()=>({}), useState:()=>[measuredHeight,v=>{measuredHeight=v;}], useRef:v=>({current:v}), useMemo:f=>f(), useCallback:f=>f};
const theme = {SLColors:new Proxy({},{get:()=> 'theme-color'}),SLSpacing:{sm:8,xs:4,md:16,lg:24,xxl:32,xxs:2},SLLayout:{screenGutter:20},SLMotion:{},SLRadius:{pill:999},SLShadows:{level1:{},level2:{}},SLFontFamilies:{sansBold:'bold'}};
const mocks = {'react':{...react,default:react},'react-native':{View:'View',Pressable:'Pressable',StyleSheet:{create:s=>s,absoluteFillObject:{}}},
  '@/constants/theme':theme,'@/components/ui/sl-text':{Text:'Text'},'@/components/ui/sl-motion':{SLMotionPressable:'MotionButton'},
  '@/components/ui/sl-trophy':{SLCanonicalIcon:'Icon'},'@expo/vector-icons':{},'expo-linear-gradient':{LinearGradient:'Gradient'},
  '@/components/keyboard/keyboard-state':{useKeyboardState:()=>({visible:false})},'react-native-safe-area-context':{useSafeAreaInsets:()=>({bottom:34})},
  'expo-blur':{},'expo-glass-effect':{},'expo-haptics':{},'@/components/keyboard/KeyboardSurface':{},
  '@/components/sheets/StrengthLedgerBottomSheet':{},'@/lib/motion':{},'@/components/movement/CanonicalMovementArtwork':{},'./session-clock-text':{}};
function load(file) {
  const exports={}; const output=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.React,esModuleInterop:true}}).outputText;
  vm.runInNewContext(output,{exports,require:id=>{assert.ok(id in mocks, id);return mocks[id];},__DEV__:false,console},{filename:file});return exports;
}
mocks['@/components/navigation/sl-tab-row-control']=load('components/navigation/sl-tab-row-control.tsx');
const floating=load('components/ui/floating-control-coordinator.tsx');
mocks['@/components/ui/floating-control-coordinator']=floating;
const {SessionV3Footer}=load('components/workout-logger/session-v3-shell.tsx');
const nodes=tree=>!tree||typeof tree!=='object'?[]:[tree,...(tree.children||[]).flat(Infinity).flatMap(nodes)];
const props={bottom:34,label:'Log set 3',onPress(){},secondary:'2 of 2 movements',onSecondary(){},unit:'lb',onUnit:()=>toggles++};
let tree=SessionV3Footer(props);
nodes(tree).find(n=>n.props.onLayout).props.onLayout({nativeEvent:{layout:{height:140}}});
tree=SessionV3Footer(props);
let button=nodes(tree).find(n=>n.props.testID==='session-logger-unit-toggle');
assert.ok(button);assert.equal(button.props.label,'lb');assert.equal(button.props.size,'large');
button.props.onPress();assert.equal(toggles,1,'the one floating button invokes the existing toggle exactly once');
button=nodes(SessionV3Footer({...props,unit:'kg'})).find(n=>n.props.testID==='session-logger-unit-toggle');
assert.equal(button.props.label,'kg');assert.match(button.props.accessibilityLabel,/Switch to lb/);
const stack=nodes(tree).find(n=>n.type===floating.FloatingControlStack);
assert.equal(stack.props.style.bottom,148,'float follows actual measured footer');
measuredHeight=250;
assert.equal(nodes(SessionV3Footer(props)).find(n=>n.type===floating.FloatingControlStack).props.style.bottom,258,'active-rest footer cannot cover the unit control');
assert.equal(nodes(tree).filter(n=>n.props.testID?.startsWith('session-logger-unit-')).length,1,'no segmented selector');
const flatten=styles=>Object.assign({},...(Array.isArray(styles)?styles.flat(Infinity):[styles]).filter(Boolean));
let utility=floating.FloatingUtilityButton(button.props);
assert.equal(flatten(utility.props.style).width,56);
let action=nodes(utility).find(n=>n.type==='MotionButton');assert.equal(flatten(action.props.style).height,48);
assert.equal(flatten(nodes(utility).find(n=>n.type==='Text').props.style).fontSize,18);
utility=floating.FloatingUtilityButton({accessibilityLabel:'Other unchanged utility',label:'lb',onPress(){}});
assert.equal(flatten(utility.props.style).width,48,'other app utilities retain original shell');
assert.equal(flatten(nodes(utility).find(n=>n.type==='Text').props.style).fontSize,15);
execFileSync(process.execPath,['--import','tsx','scripts/test-logger-canonical-weight.mjs'],{stdio:'pipe'});
console.log('PASS: actual floating Logger component, single toggle callback, measured rest clearance, original utility defaults and canonical numeric conversion.');
