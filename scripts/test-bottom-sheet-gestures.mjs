import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import * as policy from '../lib/bottom-sheet-gesture.ts';

const source=fs.readFileSync('components/sheets/StrengthLedgerBottomSheet.tsx','utf8');
function harness(reduced=false) {
  let keyboardDismissals=0, announcements=0;
  const react={createElement:(type,props,...children)=>({type,props:{...props,children}}),
    createContext:()=>{const context={current:null};context.Provider=({value,children})=>{context.current=value;return children;};return context;},
    useContext:context=>context.current,forwardRef:fn=>fn,useCallback:fn=>fn,useMemo:fn=>fn(),useRef:value=>({current:value}),useState:value=>[value,()=>{}],useEffect:fn=>fn(),useImperativeHandle:(ref,fn)=>{if(ref)ref.current=fn();}};
  class Value {constructor(value){this.value=value;}setValue(value){this.value=value;}}
  const animation=(value,config)=>({start:callback=>{value.setValue(config.toValue);callback?.({finished:true});}});
  const Animated={Value,View:'Animated.View',spring:animation,timing:animation,parallel:rows=>({start:callback=>{rows.forEach(row=>row.start());callback?.({finished:true});}})};
  function Pan(){const result={config:{},events:{}};for(const key of ['minPointers','maxPointers','activeOffsetY','failOffsetY','failOffsetX','cancelsTouchesInView','runOnJS'])result[key]=value=>{result.config[key]=value;return result;};for(const key of ['onUpdate','onEnd','onFinalize'])result[key]=fn=>{result.events[key]=fn;return result;};return result;}
  const mocks={react,'react-native':{Animated,View:'View',ScrollView:'ScrollView',Modal:'Modal',Keyboard:{dismiss:()=>keyboardDismissals++},AccessibilityInfo:{announceForAccessibility:()=>announcements++},Easing:{out:x=>x,quad:()=>{},linear:()=>{},bezier:()=>{}},StyleSheet:{create:x=>x,absoluteFillObject:{}},useWindowDimensions:()=>({height:850,width:390})},
    'react-native-gesture-handler':{Gesture:{Pan},GestureDetector:'GestureDetector',GestureHandlerRootView:'GestureHandlerRootView'},
    '@/components/ui/sl-motion':{SLMotionPressable:'Pressable'},'@/components/ui/sl-text':{Text:'Text'},'@expo/vector-icons':{Ionicons:'Icon'},'react-native-safe-area-context':{useSafeAreaInsets:()=>({top:44,bottom:34})},'@/lib/motion':{useSLReducedMotion:()=>reduced},'@/constants/theme':{SLColors:{},SLShadows:{}},'@/components/navigation/StrengthLedgerAppHeader':{STRENGTH_LEDGER_APP_HEADER:{contentHeight:48}},'@/lib/bottom-sheet-gesture':policy};
  const exports={};vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.React,esModuleInterop:true,target:ts.ScriptTarget.ES2022}}).outputText,{exports,require:name=>{assert.ok(name in mocks,name);return mocks[name];},setTimeout:()=>0,clearTimeout:()=>{}});
  function materialize(node){if(Array.isArray(node))return node.flatMap(materialize);if(!node||typeof node!=='object')return node;if(typeof node.type==='function')return materialize(node.type(node.props));return {...node,props:{...node.props,children:materialize(node.props.children)}};}
  function nodes(node,predicate,parents=[]){if(Array.isArray(node))return node.flatMap(x=>nodes(x,predicate,parents));if(!node||typeof node!=='object')return[];return [...(predicate(node)?[{node,parents}]:[]),...nodes(node.props?.children,predicate,[...parents,node])];}
  const drag=(detector,dy,velocity=0,success=true)=>{detector.props.gesture.events.onUpdate({translationY:dy,velocityY:velocity});detector.props.gesture.events.onEnd({translationY:dy,velocityY:velocity},success);detector.props.gesture.events.onFinalize({},success);};
  return {exports,materialize,nodes,drag,keyboard:()=>keyboardDismissals,announcements:()=>announcements,element:react.createElement};
}

// Release requires displacement even for a fast flick. Cancellation never closes.
for(const [dy,vy,expected]of [[10,8,false],[20,8,false],[47,2,false],[48,.84,false],[48,.85,true],[95,0,false],[96,0,true],[-150,3,false],[NaN,3,false],[Infinity,0,false]])assert.equal(policy.shouldDismissBottomSheet({dy,vy}),expected,`${dy}/${vy}`);
assert.equal(policy.bottomSheetVelocityFromGestureHandler(850),.85);
for(const origin of ['body','chrome'])for(const dy of [-100,0,10,20,60,150])assert.equal(policy.shouldCaptureBottomSheetDismissGesture({origin,dx:0,dy}),origin==='chrome'&&dy>12);

for(const reduced of [false,true])for(const bodyType of ['ScrollView','FlatList','SectionList','TextInput','WheelPicker']) {
 const h=harness(reduced);let closed=0,scrolled=0;const ref={current:null};
 const body=h.element(bodyType,{testID:'body',onScroll:()=>scrolled++},...Array.from({length:120},(_,i)=>h.element('Text',{},`row ${i}`)));
 const tree=h.materialize(h.exports.StrengthLedgerBottomSheet({visible:true,accessibilityLabel:'Gesture QA',children:body,onDismiss:()=>closed++},ref));
 const bodyMatch=h.nodes(tree,n=>n.props.testID==='body')[0];
 assert.ok(!bodyMatch.parents.some(n=>n.type==='GestureDetector'),'body must not have any dismiss recognizer ancestor');
 // Long-list top/bottom, bounce and reversal retain body ownership. No sheet
 // offset subscription or responder transfer is installed on those events.
 for(const offset of [0,400,1800,800,0,-20,15])bodyMatch.node.props.onScroll({nativeEvent:{contentOffset:{y:offset}}});
 assert.equal(scrolled,7);assert.equal(closed,0);
 const [detector]=h.nodes(tree,n=>n.type==='GestureDetector').map(x=>x.node);assert.equal(h.nodes(tree,n=>n.type==='GestureDetector').length,1);
 assert.equal(detector.props.gesture.config.activeOffsetY,12);assert.equal(detector.props.gesture.config.failOffsetY,-12);
 h.drag(detector,18,3000);assert.equal(closed,0,'tiny fast pull returns open');
 h.drag(detector,130,0,false);assert.equal(closed,0,'cancelled native gesture returns open');
 const sheet=h.nodes(tree,n=>n.props.accessibilityLabel==='Gesture QA')[0].node;
 assert.equal(sheet.props.style.at(-1).transform[0].translateY.value,0,'insufficient/cancelled pull springs back');
 h.drag(detector,110,0);assert.equal(closed,1,'deliberate top pull closes once');
 h.drag(detector,110,0);assert.equal(closed,1,'duplicate end cannot dismiss twice');
 assert.ok(h.keyboard()>0,'valid close clears keyboard independent of body type');
}
for(const reason of ['backdrop','close-button','system-back','gesture']){
 const h=harness();let requested=[],closed=0;
 const tree=h.materialize(h.exports.StrengthLedgerBottomSheet({visible:true,accessibilityLabel:'Guarded',children:h.element('ScrollView',{}),onDismiss:()=>closed++,onRequestClose:value=>requested.push(value)}));
 if(reason==='gesture')h.drag(h.nodes(tree,n=>n.type==='GestureDetector')[0].node,120);
 else if(reason==='system-back')h.nodes(tree,n=>n.type==='Modal')[0].node.props.onRequestClose();
 else h.nodes(tree,n=>n.props.accessibilityLabel===(reason==='backdrop'?'Dismiss Guarded':'Close Guarded'))[0].node.props.onPress();
 assert.deepEqual(requested,[reason]);assert.equal(closed,0,'owner dirty-state decision remains authoritative');
}
{
 const h=harness();let closed=0,blocked=0;const tree=h.materialize(h.exports.StrengthLedgerBottomSheet({visible:true,accessibilityLabel:'Busy',children:null,dismissalBlocked:true,onDismiss:()=>closed++,onDismissBlocked:()=>blocked++}));
 h.drag(h.nodes(tree,n=>n.type==='GestureDetector')[0].node,160);assert.equal(closed,0);assert.equal(blocked,1);assert.equal(h.announcements(),1);
}
for(const reduced of [false,true])for(const kind of ['adapter','inline']) {
 const h=harness(reduced);let requested=0;
 const contents=[h.element(h.exports.StrengthLedgerSheetDragRegion,{},h.element('Text',{},'Title / X')),h.element('FlatList',{testID:'legacy-body'})];
 const component=kind==='adapter'?h.exports.StrengthLedgerSheetModalAdapter:h.exports.StrengthLedgerSheetGestureSurface;
 const tree=h.materialize(component({visible:true,onRequestClose:()=>requested++,children:contents}));
 assert.ok(!h.nodes(tree,n=>n.props.testID==='legacy-body')[0].parents.some(n=>n.type==='GestureDetector'));
 const gestures=h.nodes(tree,n=>n.type==='GestureDetector');assert.equal(gestures.length,1);
 h.drag(gestures[0].node,15,4000);assert.equal(requested,0);
 h.drag(gestures[0].node,120,0,false);assert.equal(requested,0);
 h.drag(gestures[0].node,60,1000);assert.equal(requested,1);
 const animated=h.nodes(tree,n=>n.type==='Animated.View')[0].node;
 assert.equal(animated.props.style.at(-1).transform[0].translateY.value,0,'guarded legacy callback cannot leave a live sheet off-screen');
}
console.log('Bottom sheets: actual canonical/legacy/inline gesture trees; body ownership, reversal/long lists, keyboard, deliberate pull, cancel/spring, explicit/guarded close and reduced motion PASS');
