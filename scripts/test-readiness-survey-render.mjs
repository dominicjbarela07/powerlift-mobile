import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import * as readiness from '../lib/readiness.ts';
const react={createElement:(type,props,...children)=>({type,props:props||{},children})};
const deps={react,'@/components/keyboard/KeyboardSurface':{KeyboardAvoidingView:'KeyboardAvoidingView'},
 'react-native':{ActivityIndicator:'ActivityIndicator',Animated:{View:'AnimatedView'},Platform:{OS:'ios'},StyleSheet:{create:s=>s,hairlineWidth:0.5,absoluteFillObject:{position:'absolute'}}},
 '@/components/ui/sl-motion':{SLMotionPressable:'Pressable'},'@/components/ui/sl-text':{Text:'Text',TextInput:'TextInput'},
 '@/components/ui/sl-button':{SLButton:'SLButton'},'expo-linear-gradient':{LinearGradient:'LinearGradient'},'expo-haptics':{},'@expo/vector-icons':{Ionicons:'Ionicons'},'react-native-gesture-handler':{},
 '@/components/sheets/StrengthLedgerBottomSheet':{StrengthLedgerBottomSheet:'Sheet',StrengthLedgerBottomSheetScrollView:'ScrollView'},
 '@/constants/theme':{SLColors:{textMuted:'#999',text:'#fff',danger:'#f66'},SLMotion:{},SLRadius:{pill:999,md:12},SLTypography:{hero:{},kpiNumber:{},sectionTitle:{},caption:{fontSize:12},label:{fontSize:13}}},
 '@/lib/readiness':readiness,'@/lib/motion-preview':{useSLMotionPreviewOverrides:()=>null}};
const module={exports:{}};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('components/workout-logger/readiness-modal.tsx','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.React,esModuleInterop:true}}).outputText,{module,exports:module.exports,require:key=>{assert.ok(key in deps,key);return deps[key];}});
const {ReadinessModal,ReadinessScale}=module.exports;
const nodes=n=>n&&typeof n==='object'?[n,...(n.children||[]).flat(Infinity).flatMap(nodes)]:[];
let changed;const submit=()=>{},skip=()=>{},cancel=()=>{};
const values={bodyweight:'',bodyweightSkipped:false,sleepPosition:NaN,energyPosition:NaN,sorenessPosition:NaN,stressPosition:NaN};
const props={visible:true,unit:'lb',values,submitting:false,reduceMotion:false,onChange:v=>changed=v,onSubmit:submit,onSkip:skip,onCancel:cancel};
const render=overrides=>nodes(ReadinessModal({...props,...overrides}));
let tree=render();const primary=t=>t.find(n=>n.type==='Pressable'&&n.props.accessibilityLabel==='Save & Begin Session');
assert.equal(primary(tree).props.onPress,submit);assert.equal(primary(tree).props.disabled,false);
assert.equal(tree.find(n=>n.type==='SLButton').props.onPress,skip);
assert.equal(tree.find(n=>n.type==='Pressable'&&n.props.accessibilityLabel==='Cancel readiness check').props.onPress,cancel);
assert.equal(tree.find(n=>n.type==='Sheet').props.onDismiss,cancel);
const scales=tree.filter(n=>n.type===ReadinessScale);assert.equal(scales.length,4);
scales[0].props.onChange(0.25);assert.equal(changed.sleepPosition,0.25);assert.ok(Number.isNaN(changed.energyPosition),'other scales stay explicitly unselected');
assert.equal(scales[0].props.accessibilityStep,1/18);
assert.equal(scales[1].props.hapticBoundaries,true);
tree.find(n=>n.type==='TextInput').props.onChangeText('185,5');assert.equal(changed.bodyweight,'185.5');
for(const state of [{readOnly:true},{checking:true},{canSubmit:false}])assert.equal(primary(render(state)).props.disabled,true);
tree=render({submitting:true});const saving=tree.find(n=>n.type==='Pressable'&&n.props.accessibilityLabel==='Beginning session');assert.equal(saving.props.disabled,true);assert.equal(saving.props.accessibilityState.busy,true);assert.ok(tree.some(n=>n.type==='ActivityIndicator'));assert.equal(tree.find(n=>n.type==='SLButton').props.disabled,true);assert.equal(tree.find(n=>n.type==='Sheet').props.dismissalBlocked,true);
tree=render({existing:{id:7,workout_id:41,sleep_hours:8,energy:3,soreness:2,stress:2,bodyweight_kg:90}});assert.equal(tree.filter(n=>n.type===ReadinessScale).length,0);assert.equal(tree.find(n=>n.type==='Pressable'&&n.props.accessibilityLabel==='Continue to Session').props.onPress,submit);
tree=render({context:'daily'});assert.equal(tree.filter(n=>n.type==='SLButton').length,0,'daily never gains Session Skip');assert.equal(tree.find(n=>n.type==='Pressable'&&n.props.accessibilityLabel==='Save Check-In').props.onPress,submit);
assert.equal(render({error:'save failed'}).find(n=>n.props.accessibilityRole==='alert').children[0],'save failed');
console.log('PASS: actual readiness survey renderer preserves slider/bodyweight handlers, save/skip/cancel, busy/preview/lookup disable states, existing Continue, daily mode and errors');
